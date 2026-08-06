/**
 * ItineraryScreen V5 – Streaming job pipeline, server-parsed intent,
 * bulk idempotent save, tap-to-edit on saved trips, dark mode.
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Alert,
  useWindowDimensions,
  Platform,
  Pressable,
} from "react-native";
import { Text, TextInput } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute, RouteProp, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import BottomSheet, {
  BottomSheetScrollView,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import {
  MapComponent,
  MarkerComponent,
  PolylineComponent,
  MAP_PROVIDER,
} from "@/components/Common/ExpoMap";
import { RootStackParamList } from "@/navigation/types";
import { useItinerary } from "@/hooks/useItinerary";
import { useTravelIntelligence } from "@/stores/travelIntelligenceStore";
import { useUIStore } from "@/stores/uiStore";
import { exportService } from "@/services/export";
import { ItineraryDay } from "@/services/itinerary";
import { spacing } from "@/theme/colors";
import KeyboardAvoidingWrapper from "@/components/Common/KeyboardAvoidingWrapper";
import { PressableScale } from "@/components/UI/PressableScale";
import { GlassCard } from "@/components/UI/GlassCard";
import { ItinerarySkeleton } from "@/components/UI/SkeletonLoader";
import { getErrorInfo } from "@/utils/errorHandler";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import DayCard from "@/components/Itinerary/DayCard";
import ProgressBar from "@/components/Itinerary/ProgressBar";
import ErrorState from "@/components/Itinerary/ErrorState";
import ActivityEditModal from "@/components/Itinerary/ActivityEditModal";
import { buildItineraryPalette } from "@/components/Itinerary/palette";

export default function ItineraryScreen() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const mapRef = useRef<any>(null);
  const bottomSheetRef = useRef<BottomSheet>(null);
  const hasFiredAutoGenerate = useRef(false);

  const route = useRoute<RouteProp<RootStackParamList, "Itinerary">>();
  const incomingQuery = route.params?.query || "";

  // Dark mode + palette
  const themeDark = useUIStore((s) => s.themeDark);
  const palette = useMemo(() => buildItineraryPalette(themeDark), [themeDark]);

  // State
  const [query, setQuery] = useState(incomingQuery);
  const [expandedDay, setExpandedDay] = useState<number | null>(1);
  const [exporting, setExporting] = useState(false);

  // Tap-to-edit (available after bulk save): day → [place ids in slot order]
  const [savedPlaceIds, setSavedPlaceIds] = useState<Record<number, number[]>>(
    {},
  );
  const [editTarget, setEditTarget] = useState<{
    day: number;
    slot: "morning" | "afternoon" | "evening";
  } | null>(null);

  // Hooks
  const {
    itinerary,
    weather,
    loading,
    error,
    isFromCache,
    progress,
    jobId,
    cancel,
    retry,
    generate,
    saving,
    savedTripId,
    saveTrip,
  } = useItinerary();

  const { setActiveTrip } = useTravelIntelligence();

  // Bottom sheet snap points (relative to window height)
  const snapPoints = useMemo(() => ["18%", "55%", "94%"], []);

  // Fire-once auto-trigger from route params
  useEffect(() => {
    if (
      !hasFiredAutoGenerate.current &&
      incomingQuery &&
      incomingQuery.trim().length > 0
    ) {
      hasFiredAutoGenerate.current = true;
      generate(incomingQuery);
    }
  }, [incomingQuery, generate]);

  // ── Map markers: server-resolved coordinates only (no client geocoding) ──
  const dayMarkers = useMemo(() => {
    const markers: Record<number, { lat: number; lon: number }> = {};
    const points = itinerary?.route_points || [];
    for (const point of points) {
      if (markers[point.day]) continue;
      const coords = point.coordinates ?? point.destination_coordinates;
      if (coords?.lat && coords?.lon) {
        markers[point.day] = { lat: coords.lat, lon: coords.lon };
      }
    }
    // Fallback: single destination pin
    const dest = itinerary?.destination_coordinates;
    if (Object.keys(markers).length === 0 && dest?.lat && dest?.lon) {
      markers[1] = { lat: dest.lat, lon: dest.lon };
    }
    return markers;
  }, [itinerary]);

  const polyline = useMemo(() => {
    const coords = (itinerary?.route_points || [])
      .map((p) => p.coordinates ?? p.destination_coordinates)
      .filter((c): c is { lat: number; lon: number } => Boolean(c?.lat && c?.lon))
      .map((c) => ({ latitude: c.lat, longitude: c.lon }));
    return coords.length >= 2 ? coords : undefined;
  }, [itinerary]);

  // Fit map to markers once they arrive
  const fitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const coords = Object.values(dayMarkers);
    if (coords.length === 0) return;
    if (fitTimerRef.current) clearTimeout(fitTimerRef.current);
    fitTimerRef.current = setTimeout(() => {
      mapRef.current?.fitToCoordinates(
        coords.map((g) => ({ latitude: g.lat, longitude: g.lon })),
        {
          edgePadding: {
            top: 120,
            right: 60,
            bottom: height / 2,
            left: 60,
          },
          animated: true,
        },
      );
    }, 800);
    return () => {
      if (fitTimerRef.current) clearTimeout(fitTimerRef.current);
    };
  }, [dayMarkers, height]);

  // Sync active trip with real destination coordinates (no lat:0/lon:0 stub)
  useEffect(() => {
    if (itinerary && itinerary.itinerary.length > 0) {
      const dest = itinerary.destination_coordinates ?? null;
      setActiveTrip(
        {
          id: itinerary.destination,
          label: itinerary.destination,
          region: "",
          best_season: "",
          highlight: "",
          tagline: "",
          category: [],
          lat: dest?.lat ?? 0,
          lon: dest?.lon ?? 0,
        },
        itinerary.num_days,
      );
    }
  }, [itinerary, setActiveTrip]);

  // Focus map on a day
  const focusOnDay = useCallback(
    (day: number) => {
      const geo = dayMarkers[day];
      if (geo && mapRef.current) {
        mapRef.current.animateToRegion(
          {
            latitude: geo.lat,
            longitude: geo.lon,
            latitudeDelta: 0.1,
            longitudeDelta: 0.1,
          },
          1000,
        );
      }
    },
    [dayMarkers],
  );

  const handleDayToggle = useCallback((day: number) => {
    setExpandedDay((prev) => (prev === day ? null : day));
  }, []);

  const handleGenerate = useCallback(() => {
    if (query.trim()) generate(query);
  }, [query, generate]);

  const handleCancel = useCallback(() => {
    cancel();
  }, [cancel]);

  // ── Save: single bulk transaction, idempotent via source_id ──
  const handleSaveItinerary = useCallback(async () => {
    if (!itinerary?.itinerary?.length) return;
    try {
      const sourceId = jobId ?? `gen-${Date.now()}`;
      const days = itinerary.itinerary.map((day: ItineraryDay) => ({
        day_number: day.day,
        title: day.title || `Day ${day.day}`,
        places: [day.morning, day.afternoon, day.evening]
          .filter(Boolean)
          .map((act: any, idx: number) => ({
            name: act.place || act.activity,
            category: act.activity,
            notes: act.description
              ? `${act.description}${act.duration ? ` (${act.duration})` : ""}`
              : undefined,
            position_order: idx,
          })),
      }));

      const result = await saveTrip({
        trip: {
          title: `${itinerary.destination} ${itinerary.num_days}-Day Trip`,
          destination: itinerary.destination,
          num_days: itinerary.num_days,
          family_size: itinerary.family_size || 1,
          travel_class: itinerary.travel_class || "economy",
          notes: itinerary.interests
            ? `Interests: ${itinerary.interests}`
            : undefined,
        },
        source_id: sourceId,
        itinerary_payload: itinerary,
        days,
      });

      // Map saved place ids per day for tap-to-edit
      const placeIds: Record<number, number[]> = {};
      result.trip.days?.forEach((d) => {
        placeIds[d.day_number] = (d.places || []).map((p) => p.id);
      });
      setSavedPlaceIds(placeIds);

      const isDuplicate = Boolean((result.trip as any).duplicate);
      Alert.alert(
        "Itinerary Saved! ✅",
        isDuplicate
          ? `This trip was already saved. Tap an activity to edit it.`
          : `Your ${itinerary.num_days}-day trip to ${itinerary.destination} has been saved to your trips. Tap any activity to edit it.`,
        [
          { text: "Stay here" },
          {
            text: "Go to trips",
            onPress: () =>
              navigation.navigate("MainTabs", { screen: "Trips" }),
          },
        ],
      );
    } catch (saveError) {
      const info = getErrorInfo(saveError);
      Alert.alert(
        "Save failed",
        info.message || "Could not save the trip. Try again.",
      );
    }
  }, [itinerary, jobId, saveTrip, navigation]);

  const handleExportPdf = useCallback(async () => {
    if (!itinerary?.itinerary?.length) return;
    setExporting(true);
    try {
      await exportService.exportItineraryPdf({
        destination: itinerary.destination,
        num_days: itinerary.num_days,
        family_size: itinerary.family_size,
        travel_class: itinerary.travel_class || "economy",
        interests: itinerary.interests,
        itinerary: itinerary.itinerary,
      });
    } catch (exportError) {
      const info = getErrorInfo(exportError);
      Alert.alert(
        "Export failed",
        info.message || "Could not generate the PDF. Try again.",
      );
    } finally {
      setExporting(false);
    }
  }, [itinerary]);

  // Budget display
  const calculateBudget = useCallback(() => {
    const estimate = itinerary?.budget_estimate?.total;
    if (typeof estimate === "number" && Number.isFinite(estimate)) {
      return `₹${Math.round(estimate).toLocaleString()}`;
    }
    if (!itinerary?.itinerary) return "₹0";
    let total = 0;
    itinerary.itinerary.forEach((day) => {
      [day.morning, day.afternoon, day.evening].forEach((act) => {
        if (act?.cost) total += parseBudgetCost(act.cost);
      });
    });
    return `₹${total.toLocaleString()}`;
  }, [itinerary]);

  // Tap-to-edit target activity
  const editSlotActivity = useMemo(() => {
    if (!editTarget || !itinerary) return null;
    const day = itinerary.itinerary.find((d) => d.day === editTarget.day);
    return day?.[editTarget.slot] ?? null;
  }, [editTarget, itinerary]);

  const handleEditSaved = useCallback(() => {
    // Refresh nothing locally — the modal already PUTs; just ack.
  }, []);

  const canEdit = Boolean(savedTripId) && Object.keys(savedPlaceIds).length > 0;

  const handleEditActivity = useCallback(
    (day: number, slot: "morning" | "afternoon" | "evening") => {
      setEditTarget({ day, slot });
    },
    [],
  );

  const placeIdForTarget = useMemo(() => {
    if (!editTarget) return null;
    const slotOrder = ["morning", "afternoon", "evening"];
    const ids = savedPlaceIds[editTarget.day];
    if (!ids) return null;
    const idx = slotOrder.indexOf(editTarget.slot);
    return ids[idx] ?? null;
  }, [editTarget, savedPlaceIds]);

  return (
    <KeyboardAvoidingWrapper>
      <View style={[styles.container, { backgroundColor: palette.background }]}>
        {/* Map Background */}
        <MapComponent
          ref={mapRef as any}
          style={StyleSheet.absoluteFillObject}
          provider={MAP_PROVIDER}
          initialRegion={{
            latitude: 20.5937,
            longitude: 78.9629,
            latitudeDelta: 15,
            longitudeDelta: 15,
          }}
          customMapStyle={mapStyle}
        >
          {polyline ? (
            <PolylineComponent
              coordinates={polyline}
              strokeColor="#0f766e"
              strokeWidth={4}
              lineCap="round"
            />
          ) : null}

          {Object.entries(dayMarkers).map(([day, geo]) => (
            <MarkerComponent
              key={`marker-day-${day}`}
              coordinate={{ latitude: geo.lat, longitude: geo.lon }}
              title={`Day ${day}`}
              onPress={() => focusOnDay(parseInt(day))}
            >
              <View style={[styles.customMarker, { backgroundColor: palette.accent, borderColor: palette.markerBorder }]}>
                <Text style={styles.markerText}>{day}</Text>
              </View>
            </MarkerComponent>
          ))}
        </MapComponent>

        {/* Floating Header */}
        <View style={[styles.headerOverlay, { paddingTop: insets.top }]}>
          <PressableScale
            style={[styles.backBtn, { backgroundColor: palette.headerBg }]}
            onPress={() => navigation.goBack()}
          >
            <Text style={[styles.backBtnText, { color: palette.text }]}>←</Text>
          </PressableScale>

          {loading && (
            <GlassCard style={[styles.loadingPill, { backgroundColor: palette.headerBg }]}>
              <ProgressBar
                progress={progress.percentage}
                step={progress.step}
                palette={palette}
              />
            </GlassCard>
          )}

          {isFromCache && !loading && (
            <GlassCard style={styles.cachePill}>
              <Text style={styles.cachePillText}>⚡ From cache</Text>
            </GlassCard>
          )}
        </View>

        {/* Bottom Sheet */}
        <BottomSheet
          ref={bottomSheetRef}
          index={1}
          snapPoints={snapPoints}
          handleIndicatorStyle={[styles.sheetIndicator, { backgroundColor: palette.textMuted }]}
          backgroundStyle={[styles.sheetBackground, { backgroundColor: palette.surfaceAlt }]}
        >
          {/* Search Header */}
          <View style={styles.sheetHeader}>
            <Text style={styles.aiIcon}>✨</Text>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Plan your trip..."
              style={[styles.sheetSearchInput, { color: palette.inputText }]}
              autoCorrect={false}
              onSubmitEditing={handleGenerate}
              placeholderTextColor={palette.textMuted}
              accessibilityLabel="Trip planning search input"
            />
            {loading ? (
              <Pressable
                style={[styles.sheetSearchBtn, { backgroundColor: palette.danger }]}
                onPress={handleCancel}
                accessibilityLabel="Cancel generation"
                accessibilityRole="button"
              >
                <Text style={styles.sheetSearchIcon}>✕</Text>
              </Pressable>
            ) : (
              <Pressable
                style={[styles.sheetSearchBtn, { backgroundColor: palette.text }]}
                onPress={handleGenerate}
                accessibilityLabel="Generate itinerary"
                accessibilityRole="button"
              >
                <Text style={styles.sheetSearchIcon}>→</Text>
              </Pressable>
            )}
          </View>

          {/* Content */}
          {loading ? (
            <BottomSheetView style={styles.loadingContainer}>
              <ItinerarySkeleton days={3} />
            </BottomSheetView>
          ) : error ? (
            <BottomSheetView style={styles.errorSheet}>
              <ErrorState error={error} onRetry={retry} palette={palette} />
            </BottomSheetView>
          ) : itinerary ? (
            <BottomSheetScrollView contentContainerStyle={styles.sheetScroll}>
              {/* Stats Row */}
              <View style={[styles.statsRow, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                <View style={styles.statItem}>
                  <Text style={[styles.statVal, { color: palette.text }]}>
                    {itinerary.num_days}
                  </Text>
                  <Text style={[styles.statLabel, { color: palette.textMuted }]}>Days</Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: palette.border }]} />
                <View style={styles.statItem}>
                  <Text style={[styles.statVal, { color: palette.text }]}>
                    {progress.dayCount > 0 ? progress.dayCount : "--"}
                  </Text>
                  <Text style={[styles.statLabel, { color: palette.textMuted }]}>Planned</Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: palette.border }]} />
                <View style={styles.statItem}>
                  <Text style={[styles.statVal, { color: palette.text }]}>
                    {calculateBudget()}
                  </Text>
                  <Text style={[styles.statLabel, { color: palette.textMuted }]}>Est. Cost</Text>
                </View>
              </View>

              {/* Weather Card */}
              {weather && (
                <GlassCard style={styles.weatherCard}>
                  <Text style={styles.weatherEmoji}>🌤️</Text>
                  <View style={styles.weatherInfo}>
                    <Text style={[styles.weatherTemp, { color: palette.text }]}>
                      {weather.temperature_c}°C
                    </Text>
                    <Text style={[styles.weatherDesc, { color: palette.textSecondary }]}>
                      {weather.description || "Clear"}
                    </Text>
                  </View>
                </GlassCard>
              )}

              {/* AI Disclaimer */}
              <View style={[styles.disclaimer, { backgroundColor: themeDark ? "rgba(245,158,11,0.12)" : "rgba(245, 158, 11, 0.1)" }]}>
                <MaterialCommunityIcons name="robot-outline" size={16} color="#F59E0B" />
                <Text style={[styles.disclaimerText, { color: themeDark ? "#FCD34D" : "#92400E" }]}>
                  AI-generated itinerary — verify details before booking
                </Text>
              </View>

              {/* Day Cards */}
              {itinerary.itinerary.map((day: ItineraryDay) => (
                <DayCard
                  key={day.day}
                  day={day}
                  isExpanded={expandedDay === day.day}
                  onToggle={handleDayToggle}
                  onFocusMap={focusOnDay}
                  editable={canEdit}
                  onEditActivity={canEdit ? handleEditActivity : undefined}
                  palette={palette}
                />
              ))}

              {/* Finalize Row */}
              <View style={styles.finalizeRow}>
                <TouchableOpacity
                  style={[styles.finalizeBtn, { backgroundColor: palette.danger }]}
                  onPress={handleExportPdf}
                  disabled={exporting || loading}
                  accessibilityLabel="Export itinerary as PDF"
                  accessibilityRole="button"
                >
                  <MaterialCommunityIcons name="file-pdf-box" size={16} color="#FFFFFF" />
                  <Text style={styles.finalizeBtnText}>
                    {exporting ? "Exporting…" : "Export PDF"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.finalizeBtn, { backgroundColor: palette.text }]}
                  onPress={handleSaveItinerary}
                  disabled={saving || loading}
                  accessibilityLabel="Save this itinerary to your trips"
                  accessibilityRole="button"
                >
                  <MaterialCommunityIcons name="content-save" size={16} color="#FFFFFF" />
                  <Text style={styles.finalizeBtnText}>
                    {saving ? "Saving…" : "Save Itinerary"}
                  </Text>
                </TouchableOpacity>
              </View>
            </BottomSheetScrollView>
          ) : (
            <BottomSheetView style={styles.emptySheet}>
              <Text style={styles.emptyIcon}>🗺️</Text>
              <Text style={[styles.emptyTitle, { color: palette.text }]}>Plan Your Trip</Text>
              <Text style={[styles.emptySubtitle, { color: palette.textMuted }]}>
                Try: "3 days in Munnar from Kochi"
              </Text>
            </BottomSheetView>
          )}
        </BottomSheet>

        {/* Tap-to-edit modal */}
        <ActivityEditModal
          visible={Boolean(editTarget)}
          tripId={savedTripId}
          placeId={placeIdForTarget}
          initialName={editSlotActivity?.activity || ""}
          initialNotes={editSlotActivity?.description || ""}
          initialCost={editSlotActivity?.cost || ""}
          palette={palette}
          onClose={() => setEditTarget(null)}
          onSaved={handleEditSaved}
        />
      </View>
    </KeyboardAvoidingWrapper>
  );
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function parseBudgetCost(cost?: string): number {
  if (!cost) return 0;
  const normalized = cost.replace(/,/g, "").trim();
  const rangeMatch = normalized.match(
    /(\d+(?:\.\d+)?)\s*(?:-|to)\s*(\d+(?:\.\d+)?)/i,
  );
  if (rangeMatch) {
    const low = Number(rangeMatch[1]);
    const high = Number(rangeMatch[2]);
    if (!Number.isNaN(low) && !Number.isNaN(high)) {
      return (low + high) / 2;
    }
  }
  const singleMatch = normalized.match(/\d+(?:\.\d+)?/);
  return singleMatch ? Number(singleMatch[0]) : 0;
}

// ─────────────────────────────────────────────────────────────
// MAP STYLE
// ─────────────────────────────────────────────────────────────

const mapStyle = [
  {
    featureType: "administrative",
    elementType: "labels.text.fill",
    stylers: [{ color: "#444444" }],
  },
  {
    featureType: "landscape",
    elementType: "all",
    stylers: [{ color: "#f2f2f2" }],
  },
  { featureType: "poi", elementType: "all", stylers: [{ visibility: "off" }] },
  {
    featureType: "road",
    elementType: "all",
    stylers: [{ saturation: -100 }, { lightness: 45 }],
  },
  {
    featureType: "water",
    elementType: "all",
    stylers: [{ color: "#cbd5e1" }, { visibility: "on" }],
  },
];

// ─────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────

const headerShadow = Platform.select({
  web: { boxShadow: "0px 2px 10px rgba(0, 0, 0, 0.1)" } as any,
  default: {
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
});

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header
  headerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    zIndex: 10,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    ...headerShadow,
  },
  backBtnText: { fontSize: 24, fontWeight: "600" },
  loadingPill: {
    marginLeft: spacing.md,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 150,
  },
  cachePill: {
    marginLeft: spacing.md,
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  cachePillText: { fontSize: 12, fontWeight: "700", color: "#16A34A" },

  // Bottom Sheet
  sheetBackground: { borderRadius: 32 },
  sheetIndicator: { width: 40 },
  sheetHeader: { padding: spacing.md, paddingBottom: spacing.sm },
  aiIcon: { fontSize: 20, marginRight: 10 },
  sheetSearchInput: { flex: 1, fontSize: 16, fontWeight: "600", backgroundColor: "transparent" },
  sheetSearchBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  sheetSearchIcon: { fontSize: 18, color: "#FFF", fontWeight: "900" },

  // Loading
  loadingContainer: { flex: 1, padding: spacing.md },

  // Error
  errorSheet: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },

  // Empty State
  emptySheet: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: "800", marginBottom: 8 },
  emptySubtitle: { fontSize: 14 },

  // Scroll Content
  sheetScroll: { padding: spacing.md, paddingBottom: 60 },

  // Stats
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderRadius: 20,
    padding: 16,
    marginBottom: spacing.lg,
    borderWidth: 1,
  },
  statItem: { alignItems: "center", flex: 1 },
  statVal: { fontSize: 18, fontWeight: "900" },
  statLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    marginTop: 2,
  },
  statDivider: { width: 1 },

  // Weather
  weatherCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    marginBottom: spacing.md,
  },
  weatherEmoji: { fontSize: 32 },
  weatherInfo: { marginLeft: 12 },
  weatherTemp: { fontSize: 18, fontWeight: "800" },
  weatherDesc: { fontSize: 13 },

  // Disclaimer
  disclaimer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  disclaimerText: { fontSize: 12, flex: 1 },

  // Finalize Button
  finalizeRow: { flexDirection: "row", alignItems: "stretch" },
  finalizeBtn: {
    height: 56,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginTop: spacing.md,
    flexDirection: "row",
    gap: 8,
    flex: 1,
  },
  finalizeBtnExport: { marginRight: spacing.sm },
  finalizeBtnText: { color: "#FFF", fontSize: 16, fontWeight: "800" },

  // Custom Marker
  customMarker: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 2,
  },
  markerText: { color: "#FFF", fontSize: 12, fontWeight: "900" },
});
