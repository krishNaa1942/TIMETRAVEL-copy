/**
 * ReservationsScreen V2 - AI-Powered Smart Booking Engine
 * Production-grade reservation management with AI insights, search, and offline support
 */

import React, { useState, useCallback, useMemo, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Dimensions,
  TextInput as RNTextInput,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from "react-native";
import {
  Text,
  TextInput,
  Button,
  Chip,
  Divider,
  FAB,
  Portal,
  Dialog,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";

import {
  reservationService,
  Reservation,
  ReservationType,
  ReservationStatus,
  RESERVATION_TYPES,
  STATUS_CONFIG,
  AIInsight,
} from "@/services/reservations";
import { tripPlannerService, TripData } from "@/services/tripPlanner";
import { useUIStore } from "@/stores/uiStore";
import { colors, spacing } from "@/theme/colors";
import { RootStackParamList } from "@/types";
import { PressableScale } from "@/components/UI/PressableScale";
import { Shimmer } from "@/components/UI/SkeletonLoader";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const isSmallDevice = SCREEN_WIDTH < 375;

type NavProp = NativeStackNavigationProp<RootStackParamList>;

// ─────────────────────────────────────────────────────────────
// SKELETON COMPONENTS
// ─────────────────────────────────────────────────────────────

const ReservationSkeleton = () => (
  <View style={styles.skeletonCard}>
    <View style={styles.skeletonRow}>
      <Shimmer width={48} height={48} borderRadius={12} />
      <View style={styles.skeletonContent}>
        <Shimmer width="60%" height={16} borderRadius={4} />
        <Shimmer
          width="40%"
          height={12}
          borderRadius={4}
          style={{ marginTop: 8 }}
        />
      </View>
    </View>
  </View>
);

// ─────────────────────────────────────────────────────────────
// RESERVATION CARD COMPONENT
// ─────────────────────────────────────────────────────────────

interface ReservationCardProps {
  reservation: Reservation;
  onPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleBookmark: () => void;
  onStatusChange: (status: ReservationStatus) => void;
}

const ReservationCard = React.memo<ReservationCardProps>(
  ({
    reservation,
    onPress,
    onEdit,
    onDelete,
    onToggleBookmark,
    onStatusChange,
  }) => {
    const typeConfig =
      RESERVATION_TYPES[reservation.res_type] || RESERVATION_TYPES.other;
    const statusConfig =
      STATUS_CONFIG[reservation.status] || STATUS_CONFIG.pending;

    const formattedDate = reservation.start_datetime
      ? new Date(reservation.start_datetime).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : null;

    const formattedTime = reservation.start_datetime
      ? new Date(reservation.start_datetime).toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;

    const handleHaptic = useCallback(() => {
      // Haptic feedback placeholder
    }, []);

    return (
      <PressableScale
        style={styles.resCard}
        onPress={() => {
          handleHaptic();
          onPress();
        }}
      >
        <LinearGradient
          colors={[`${typeConfig.color}08`, `${typeConfig.color}15`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.resCardGradient}
        >
          {/* Header Row */}
          <View style={styles.resHeader}>
            <View
              style={[
                styles.resIconContainer,
                { backgroundColor: `${typeConfig.color}20` },
              ]}
            >
              <Text style={styles.resEmoji}>{typeConfig.emoji}</Text>
            </View>
            <View style={styles.resTitleContainer}>
              <Text style={styles.resTitle} numberOfLines={2}>
                {reservation.title}
              </Text>
              {reservation.provider && (
                <Text style={styles.resProvider}>{reservation.provider}</Text>
              )}
            </View>
            <TouchableOpacity
              onPress={onToggleBookmark}
              style={styles.bookmarkBtn}
            >
              <Ionicons
                name={
                  reservation.is_bookmarked ? "bookmark" : "bookmark-outline"
                }
                size={22}
                color={reservation.is_bookmarked ? colors.primary : colors.gray}
              />
            </TouchableOpacity>
          </View>

          {/* Details */}
          <View style={styles.resDetails}>
            {reservation.confirmation_code && (
              <View style={styles.resDetailRow}>
                <Ionicons name="key-outline" size={14} color={colors.gray} />
                <Text style={styles.resDetailText}>
                  {reservation.confirmation_code}
                </Text>
              </View>
            )}
            {formattedDate && (
              <View style={styles.resDetailRow}>
                <Ionicons
                  name="calendar-outline"
                  size={14}
                  color={colors.gray}
                />
                <Text style={styles.resDetailText}>
                  {formattedDate} {formattedTime && `• ${formattedTime}`}
                </Text>
              </View>
            )}
            {reservation.location && (
              <View style={styles.resDetailRow}>
                <Ionicons
                  name="location-outline"
                  size={14}
                  color={colors.gray}
                />
                <Text style={styles.resDetailText} numberOfLines={1}>
                  {reservation.location}
                </Text>
              </View>
            )}
          </View>

          {/* Footer */}
          <View style={styles.resFooter}>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: `${statusConfig.color}20` },
              ]}
            >
              <Text style={styles.statusEmoji}>{statusConfig.emoji}</Text>
              <Text style={[styles.statusText, { color: statusConfig.color }]}>
                {statusConfig.label}
              </Text>
            </View>
            {reservation.amount && (
              <Text style={styles.resAmount}>
                ₹{reservation.amount.toLocaleString()}
              </Text>
            )}
          </View>

          {/* Action Buttons */}
          <View style={styles.resActions}>
            <TouchableOpacity style={styles.actionBtn} onPress={onEdit}>
              <Ionicons name="pencil" size={16} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() =>
                onStatusChange(
                  reservation.status === "confirmed"
                    ? "completed"
                    : "confirmed",
                )
              }
            >
              <Ionicons name="checkmark-circle" size={16} color="#10B981" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={onDelete}>
              <Ionicons name="trash-outline" size={16} color="#EF4444" />
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </PressableScale>
    );
  },
);

// ─────────────────────────────────────────────────────────────
// AI INSIGHT CARD
// ─────────────────────────────────────────────────────────────

const AIInsightCard = React.memo<{ insight: AIInsight; onPress?: () => void }>(
  (props) => {
    const bgColors: Record<string, string> = {
      warning: "#FEF3C7",
      info: "#DBEAFE",
      suggestion: "#EDE9FE",
      reminder: "#FEE2E2",
    };
    const textColors: Record<string, string> = {
      warning: "#92400E",
      info: "#1E40AF",
      suggestion: "#5B21B6",
      reminder: "#DC2626",
    };

    return (
      <PressableScale
        style={[
          styles.insightCard,
          { backgroundColor: bgColors[props.insight.type] || bgColors.info },
        ]}
        onPress={props.onPress}
        disabled={!props.insight.action}
      >
        <Text style={styles.insightIcon}>{props.insight.icon}</Text>
        <View style={styles.insightContent}>
          <Text
            style={[
              styles.insightTitle,
              { color: textColors[props.insight.type] || textColors.info },
            ]}
          >
            {props.insight.title}
          </Text>
          <Text style={styles.insightMessage}>{props.insight.message}</Text>
        </View>
        {props.insight.action && (
          <Ionicons name="chevron-forward" size={20} color={colors.gray} />
        )}
      </PressableScale>
    );
  },
);

// ─────────────────────────────────────────────────────────────
// SPENDING BREAKDOWN COMPONENT
// ─────────────────────────────────────────────────────────────

const SpendingBreakdown = React.memo<{ reservations: Reservation[] }>(
  ({ reservations }) => {
    const spending = useMemo(() => {
      const byType: Record<string, number> = {};
      let total = 0;

      reservations.forEach((r) => {
        if (r.amount) {
          byType[r.res_type] = (byType[r.res_type] || 0) + r.amount;
          total += r.amount;
        }
      });

      return { byType, total };
    }, [reservations]);

    if (spending.total === 0) return null;

    const sortedTypes = Object.entries(spending.byType).sort(
      (a, b) => b[1] - a[1],
    );

    return (
      <View style={styles.spendingCard}>
        <Text style={styles.spendingTitle}>💰 Trip Spending</Text>
        <Text style={styles.spendingTotal}>
          ₹{spending.total.toLocaleString()}
        </Text>

        <View style={styles.spendingBars}>
          {sortedTypes.slice(0, 4).map(([type, amount]) => {
            const config = RESERVATION_TYPES[type as ReservationType];
            const percent = Math.round((amount / spending.total) * 100);
            return (
              <View key={type} style={styles.spendingRow}>
                <Text style={styles.spendingEmoji}>
                  {config?.emoji || "📋"}
                </Text>
                <View style={styles.spendingBarBg}>
                  <View
                    style={[
                      styles.spendingBarFill,
                      {
                        width: `${percent}%`,
                        backgroundColor: config?.color || "#64748B",
                      },
                    ]}
                  />
                </View>
                <Text style={styles.spendingPercent}>{percent}%</Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  },
);

// ─────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────

export default function ReservationsScreen() {
  const navigation = useNavigation<NavProp>();
  const { themeDark } = useUIStore();

  // State
  const [trips, setTrips] = useState<TripData[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<ReservationType | null>(null);
  const [filterStatus, setFilterStatus] = useState<ReservationStatus | null>(
    null,
  );
  const [showFilters, setShowFilters] = useState(false);

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingReservation, setEditingReservation] =
    useState<Reservation | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formType, setFormType] = useState<ReservationType>("flight");
  const [formTitle, setFormTitle] = useState("");
  const [formConfirmCode, setFormConfirmCode] = useState("");
  const [formProvider, setFormProvider] = useState("");
  const [formLocation, setFormLocation] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formStatus, setFormStatus] = useState<ReservationStatus>("pending");

  // Parse email modal
  const [showParseModal, setShowParseModal] = useState(false);
  const [parseText, setParseText] = useState("");

  // Load trips on mount
  useEffect(() => {
    loadTrips();
  }, []);

  // Load reservations when trip is selected
  useEffect(() => {
    if (selectedTripId) {
      loadReservations(selectedTripId);
    }
  }, [selectedTripId]);

  // Load trips
  const loadTrips = useCallback(async () => {
    try {
      const response = await tripPlannerService.listTrips();
      setTrips(response.trips || []);
      if (response.trips?.length > 0 && !selectedTripId) {
        setSelectedTripId(response.trips[0].id);
      }
    } catch (err) {
      console.error("Failed to load trips:", err);
      setError("Failed to load trips");
    }
  }, [selectedTripId]);

  // Load reservations
  const loadReservations = useCallback(async (tripId: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await reservationService.getByTrip(tripId);
      setReservations(data);
    } catch (err) {
      console.error("Failed to load reservations:", err);
      setError("Failed to load reservations");
    } finally {
      setLoading(false);
    }
  }, []);

  // Refresh
  const onRefresh = useCallback(async () => {
    if (!selectedTripId) return;
    setRefreshing(true);
    await loadReservations(selectedTripId);
    setRefreshing(false);
  }, [selectedTripId, loadReservations]);

  // Filtered reservations
  const filteredReservations = useMemo(() => {
    let filtered = [...reservations];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.title.toLowerCase().includes(query) ||
          r.provider?.toLowerCase().includes(query) ||
          r.confirmation_code?.toLowerCase().includes(query) ||
          r.location?.toLowerCase().includes(query),
      );
    }

    if (filterType) {
      filtered = filtered.filter((r) => r.res_type === filterType);
    }

    if (filterStatus) {
      filtered = filtered.filter((r) => r.status === filterStatus);
    }

    // Sort by date (upcoming first)
    filtered.sort((a, b) => {
      const dateA = a.start_datetime
        ? new Date(a.start_datetime).getTime()
        : Infinity;
      const dateB = b.start_datetime
        ? new Date(b.start_datetime).getTime()
        : Infinity;
      return dateA - dateB;
    });

    return filtered;
  }, [reservations, searchQuery, filterType, filterStatus]);

  // AI Insights
  const aiInsights = useMemo(() => {
    return reservationService.generateInsights(reservations);
  }, [reservations]);

  // Stats
  const stats = useMemo(() => {
    const confirmed = reservations.filter(
      (r) => r.status === "confirmed",
    ).length;
    const pending = reservations.filter((r) => r.status === "pending").length;
    const upcoming = reservations.filter((r) => {
      if (!r.start_datetime || r.status === "cancelled") return false;
      return new Date(r.start_datetime) > new Date();
    }).length;
    return { confirmed, pending, upcoming, total: reservations.length };
  }, [reservations]);

  // Reset form
  const resetForm = useCallback(() => {
    setFormType("flight");
    setFormTitle("");
    setFormConfirmCode("");
    setFormProvider("");
    setFormLocation("");
    setFormAmount("");
    setFormNotes("");
    setFormStatus("pending");
    setEditingReservation(null);
  }, []);

  // Open add modal
  const openAddModal = useCallback(() => {
    resetForm();
    setShowAddModal(true);
  }, [resetForm]);

  // Open edit modal
  const openEditModal = useCallback((reservation: Reservation) => {
    setEditingReservation(reservation);
    setFormType(reservation.res_type);
    setFormTitle(reservation.title);
    setFormConfirmCode(reservation.confirmation_code || "");
    setFormProvider(reservation.provider || "");
    setFormLocation(reservation.location || "");
    setFormAmount(reservation.amount?.toString() || "");
    setFormNotes(reservation.notes || "");
    setFormStatus(reservation.status);
    setShowAddModal(true);
  }, []);

  // Save reservation
  const handleSave = useCallback(async () => {
    if (!selectedTripId) return;
    if (!formTitle.trim()) {
      Alert.alert("Error", "Please enter a title");
      return;
    }

    setSaving(true);
    try {
      if (editingReservation) {
        await reservationService.update(editingReservation.id, {
          res_type: formType,
          title: formTitle.trim(),
          confirmation_code: formConfirmCode.trim() || undefined,
          provider: formProvider.trim() || undefined,
          location: formLocation.trim() || undefined,
          amount: formAmount ? parseFloat(formAmount) : undefined,
          notes: formNotes.trim() || undefined,
          status: formStatus,
        });
      } else {
        await reservationService.create({
          trip_id: selectedTripId,
          res_type: formType,
          title: formTitle.trim(),
          confirmation_code: formConfirmCode.trim() || undefined,
          provider: formProvider.trim() || undefined,
          location: formLocation.trim() || undefined,
          amount: formAmount ? parseFloat(formAmount) : undefined,
          notes: formNotes.trim() || undefined,
        });
      }

      setShowAddModal(false);
      resetForm();
      await loadReservations(selectedTripId);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to save reservation");
    } finally {
      setSaving(false);
    }
  }, [
    selectedTripId,
    editingReservation,
    formType,
    formTitle,
    formConfirmCode,
    formProvider,
    formLocation,
    formAmount,
    formNotes,
    formStatus,
    loadReservations,
    resetForm,
  ]);

  // Delete reservation
  const handleDelete = useCallback(
    (reservation: Reservation) => {
      if (!selectedTripId) return;

      Alert.alert(
        "Delete Reservation",
        `Are you sure you want to delete "${reservation.title}"?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              try {
                await reservationService.delete(reservation.id, selectedTripId);
                await loadReservations(selectedTripId);
              } catch (err) {
                Alert.alert("Error", "Failed to delete reservation");
              }
            },
          },
        ],
      );
    },
    [selectedTripId, loadReservations],
  );

  // Toggle bookmark
  const handleToggleBookmark = useCallback(
    async (reservation: Reservation) => {
      if (!selectedTripId) return;
      try {
        await reservationService.toggleBookmark(reservation.id, selectedTripId);
        await loadReservations(selectedTripId);
      } catch (err) {
        console.error("Failed to toggle bookmark:", err);
      }
    },
    [selectedTripId, loadReservations],
  );

  // Change status
  const handleStatusChange = useCallback(
    async (reservation: Reservation, newStatus: ReservationStatus) => {
      if (!selectedTripId) return;
      try {
        await reservationService.update(reservation.id, { status: newStatus });
        await loadReservations(selectedTripId);
      } catch (err) {
        console.error("Failed to update status:", err);
      }
    },
    [selectedTripId, loadReservations],
  );

  // Parse email text
  const handleParseEmail = useCallback(() => {
    if (!parseText.trim()) return;

    const parsed = reservationService.parseBookingText(parseText);
    if (parsed) {
      setFormType(parsed.type);
      setFormTitle(parsed.title);
      if (parsed.provider) setFormProvider(parsed.provider);
      if (parsed.confirmation_code)
        setFormConfirmCode(parsed.confirmation_code);
      if (parsed.amount) setFormAmount(parsed.amount.toString());
      setShowParseModal(false);
      setParseText("");
      setShowAddModal(true);
    } else {
      Alert.alert(
        "Parse Failed",
        "Could not extract booking information from the text. Please try again or enter manually.",
      );
    }
  }, [parseText]);

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────

  const selectedTrip = trips.find((t) => t.id === selectedTripId);

  return (
    <SafeAreaView
      style={[styles.container, themeDark && styles.containerDark]}
      edges={["top"]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>🎫 Reservations</Text>
            <Text style={styles.headerSubtitle}>
              Track your travel bookings
            </Text>
          </View>
          <TouchableOpacity
            style={styles.parseBtn}
            onPress={() => setShowParseModal(true)}
          >
            <Ionicons name="mail-outline" size={20} color={colors.primary} />
            <Text style={styles.parseBtnText}>Parse</Text>
          </TouchableOpacity>
        </View>

        {/* Trip Selector */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tripSelector}
        >
          {trips.map((trip) => (
            <PressableScale
              key={trip.id}
              style={[
                styles.tripChip,
                selectedTripId === trip.id && styles.tripChipActive,
              ]}
              onPress={() => setSelectedTripId(trip.id)}
            >
              <Text
                style={[
                  styles.tripChipText,
                  selectedTripId === trip.id && styles.tripChipTextActive,
                ]}
              >
                {trip.title}
              </Text>
            </PressableScale>
          ))}
        </ScrollView>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons
            name="search"
            size={20}
            color={colors.gray}
            style={styles.searchIcon}
          />
          <RNTextInput
            style={styles.searchInput}
            placeholder="Search reservations..."
            placeholderTextColor={colors.gray}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={20} color={colors.gray} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.filterBtn}
            onPress={() => setShowFilters(!showFilters)}
          >
            <Ionicons
              name="options-outline"
              size={20}
              color={showFilters ? colors.primary : colors.gray}
            />
          </TouchableOpacity>
        </View>

        {/* Filters */}
        {showFilters && (
          <View style={styles.filtersContainer}>
            <View style={styles.filterRow}>
              <Text style={styles.filterLabel}>Type:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {Object.entries(RESERVATION_TYPES).map(([key, config]) => (
                  <Chip
                    key={key}
                    selected={filterType === key}
                    onPress={() =>
                      setFilterType(
                        filterType === key ? null : (key as ReservationType),
                      )
                    }
                    style={styles.filterChip}
                    textStyle={styles.filterChipText}
                  >
                    {config.emoji} {config.label}
                  </Chip>
                ))}
              </ScrollView>
            </View>
            <View style={styles.filterRow}>
              <Text style={styles.filterLabel}>Status:</Text>
              {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                <Chip
                  key={key}
                  selected={filterStatus === key}
                  onPress={() =>
                    setFilterStatus(
                      filterStatus === key ? null : (key as ReservationStatus),
                    )
                  }
                  style={styles.filterChip}
                  textStyle={styles.filterChipText}
                >
                  {config.emoji} {config.label}
                </Chip>
              ))}
            </View>
            {(filterType || filterStatus) && (
              <Button
                mode="text"
                onPress={() => {
                  setFilterType(null);
                  setFilterStatus(null);
                }}
                compact
              >
                Clear Filters
              </Button>
            )}
          </View>
        )}

        {/* Stats Bar */}
        <View style={styles.statsBar}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: "#10B981" }]}>
              {stats.confirmed}
            </Text>
            <Text style={styles.statLabel}>Confirmed</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: "#F59E0B" }]}>
              {stats.pending}
            </Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: "#3B82F6" }]}>
              {stats.upcoming}
            </Text>
            <Text style={styles.statLabel}>Upcoming</Text>
          </View>
        </View>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* AI Insights */}
        {aiInsights.length > 0 && (
          <View style={styles.insightsSection}>
            <Text style={styles.sectionTitle}>🧠 Smart Insights</Text>
            {aiInsights.map((insight, i) => (
              <AIInsightCard key={i} insight={insight} />
            ))}
          </View>
        )}

        {/* Spending Breakdown */}
        {reservations.length > 0 && (
          <SpendingBreakdown reservations={reservations} />
        )}

        {/* Reservations List */}
        {loading ? (
          <>
            <ReservationSkeleton />
            <ReservationSkeleton />
            <ReservationSkeleton />
          </>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
            <Text style={styles.errorText}>{error}</Text>
            <Button
              mode="contained"
              onPress={() => selectedTripId && loadReservations(selectedTripId)}
            >
              Retry
            </Button>
          </View>
        ) : filteredReservations.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>🎫</Text>
            <Text style={styles.emptyTitle}>
              {searchQuery || filterType || filterStatus
                ? "No matching reservations"
                : "No reservations yet"}
            </Text>
            <Text style={styles.emptySubtitle}>
              {selectedTripId
                ? "Add your first booking to start tracking"
                : "Select a trip to view reservations"}
            </Text>
            {selectedTripId && !searchQuery && !filterType && !filterStatus && (
              <Button
                mode="contained"
                onPress={openAddModal}
                style={styles.emptyBtn}
              >
                Add First Booking
              </Button>
            )}
          </View>
        ) : (
          filteredReservations.map((reservation) => (
            <ReservationCard
              key={reservation.id}
              reservation={reservation}
              onPress={() => {
                /* TODO: Navigate to detail */
              }}
              onEdit={() => openEditModal(reservation)}
              onDelete={() => handleDelete(reservation)}
              onToggleBookmark={() => handleToggleBookmark(reservation)}
              onStatusChange={(status) =>
                handleStatusChange(reservation, status)
              }
            />
          ))
        )}
      </ScrollView>

      {/* FAB */}
      {selectedTripId && (
        <FAB
          icon="plus"
          style={styles.fab}
          onPress={openAddModal}
          color="#FFF"
        />
      )}

      {/* Add/Edit Modal */}
      <Portal>
        <Modal visible={showAddModal} animationType="slide" transparent>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.modalContainer}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {editingReservation ? "Edit Reservation" : "Add Reservation"}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setShowAddModal(false);
                    resetForm();
                  }}
                >
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Type Selector */}
                <Text style={styles.formLabel}>Type</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.typeSelector}
                >
                  {Object.entries(RESERVATION_TYPES).map(([key, config]) => (
                    <PressableScale
                      key={key}
                      style={[
                        styles.typeChip,
                        formType === key && {
                          borderColor: config.color,
                          backgroundColor: `${config.color}15`,
                        },
                      ]}
                      onPress={() => setFormType(key as ReservationType)}
                    >
                      <Text style={styles.typeEmoji}>{config.emoji}</Text>
                      <Text
                        style={[
                          styles.typeLabel,
                          formType === key && { color: config.color },
                        ]}
                      >
                        {config.label}
                      </Text>
                    </PressableScale>
                  ))}
                </ScrollView>

                <TextInput
                  mode="outlined"
                  label="Title *"
                  value={formTitle}
                  onChangeText={setFormTitle}
                  style={styles.input}
                  placeholder="e.g., Delhi → Goa Flight"
                />

                <TextInput
                  mode="outlined"
                  label="Confirmation Code"
                  value={formConfirmCode}
                  onChangeText={setFormConfirmCode}
                  style={styles.input}
                  placeholder="e.g., ABC123"
                />

                <TextInput
                  mode="outlined"
                  label="Provider"
                  value={formProvider}
                  onChangeText={setFormProvider}
                  style={styles.input}
                  placeholder="e.g., Indigo Airlines"
                />

                <TextInput
                  mode="outlined"
                  label="Location"
                  value={formLocation}
                  onChangeText={setFormLocation}
                  style={styles.input}
                  placeholder="e.g., Goa Airport"
                />

                <TextInput
                  mode="outlined"
                  label="Amount (₹)"
                  value={formAmount}
                  onChangeText={setFormAmount}
                  keyboardType="numeric"
                  style={styles.input}
                  placeholder="e.g., 5000"
                />

                <TextInput
                  mode="outlined"
                  label="Notes"
                  value={formNotes}
                  onChangeText={setFormNotes}
                  multiline
                  numberOfLines={3}
                  style={styles.input}
                  placeholder="Additional notes..."
                />

                {editingReservation && (
                  <View style={styles.statusSelector}>
                    <Text style={styles.formLabel}>Status</Text>
                    <View style={styles.statusRow}>
                      {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                        <PressableScale
                          key={key}
                          style={[
                            styles.statusChip,
                            formStatus === key && {
                              backgroundColor: `${config.color}20`,
                              borderColor: config.color,
                            },
                          ]}
                          onPress={() =>
                            setFormStatus(key as ReservationStatus)
                          }
                        >
                          <Text style={styles.statusEmoji}>{config.emoji}</Text>
                          <Text
                            style={[
                              styles.statusLabel,
                              formStatus === key && { color: config.color },
                            ]}
                          >
                            {config.label}
                          </Text>
                        </PressableScale>
                      ))}
                    </View>
                  </View>
                )}

                <Button
                  mode="contained"
                  onPress={handleSave}
                  loading={saving}
                  disabled={saving || !formTitle.trim()}
                  style={styles.saveBtn}
                >
                  {editingReservation
                    ? "Update Reservation"
                    : "Add Reservation"}
                </Button>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </Portal>

      {/* Parse Email Modal */}
      <Portal>
        <Dialog
          visible={showParseModal}
          onDismiss={() => setShowParseModal(false)}
        >
          <Dialog.Title>Parse Booking Email</Dialog.Title>
          <Dialog.Content>
            <Text style={styles.parseHint}>
              Paste your booking confirmation email or text and we'll extract
              the details automatically.
            </Text>
            <TextInput
              mode="outlined"
              multiline
              numberOfLines={6}
              value={parseText}
              onChangeText={setParseText}
              placeholder="Paste booking email here..."
              style={styles.parseInput}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowParseModal(false)}>Cancel</Button>
            <Button
              mode="contained"
              onPress={handleParseEmail}
              disabled={!parseText.trim()}
            >
              Parse
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  containerDark: { backgroundColor: "#0F172A" },

  // Header
  header: {
    padding: spacing.md,
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  headerTitle: { fontSize: 24, fontWeight: "800", color: colors.text },
  headerSubtitle: { fontSize: 13, color: colors.gray, marginTop: 2 },
  parseBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: `${colors.primary}10`,
  },
  parseBtnText: { fontSize: 13, fontWeight: "600", color: colors.primary },

  // Trip Selector
  tripSelector: { marginBottom: spacing.sm },
  tripChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
  },
  tripChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tripChipText: { fontSize: 13, fontWeight: "600", color: colors.text },
  tripChipTextActive: { color: "#FFF" },

  // Search
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
  },
  filterBtn: { padding: 8 },

  // Filters
  filtersContainer: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  filterLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.gray,
    width: 50,
  },
  filterChip: { marginRight: 6, height: 32 },
  filterChipText: { fontSize: 11 },

  // Stats Bar
  statsBar: {
    flexDirection: "row",
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  statItem: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 20, fontWeight: "800", color: "#FFF" },
  statLabel: { fontSize: 11, color: "rgba(255,255,255,0.8)", marginTop: 2 },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: "rgba(255,255,255,0.3)",
  },

  // Content
  content: { flex: 1 },
  scrollContent: { padding: spacing.md, paddingBottom: 100 },

  // AI Insights
  insightsSection: { marginBottom: spacing.md },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.sm,
  },
  insightCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderRadius: 12,
    marginBottom: spacing.sm,
  },
  insightIcon: { fontSize: 24, marginRight: 12 },
  insightContent: { flex: 1 },
  insightTitle: { fontSize: 14, fontWeight: "700" },
  insightMessage: { fontSize: 12, color: colors.text, marginTop: 2 },

  // Spending
  spendingCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...Platform.select({
      web: { boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.05)" } as any,
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
      },
    }),
  },
  spendingTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
  spendingTotal: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.text,
    marginTop: 4,
  },
  spendingBars: { marginTop: spacing.md },
  spendingRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  spendingEmoji: { fontSize: 16, width: 30 },
  spendingBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: "#E2E8F0",
    borderRadius: 4,
    marginHorizontal: 10,
  },
  spendingBarFill: { height: "100%", borderRadius: 4 },
  spendingPercent: {
    width: 35,
    textAlign: "right",
    fontSize: 12,
    fontWeight: "600",
    color: colors.text,
  },

  // Reservation Card
  resCard: { marginBottom: spacing.md, borderRadius: 16, overflow: "hidden" },
  resCardGradient: { padding: spacing.md },
  resHeader: { flexDirection: "row", alignItems: "flex-start" },
  resIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  resEmoji: { fontSize: 24 },
  resTitleContainer: { flex: 1, marginLeft: 12 },
  resTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  resProvider: { fontSize: 12, color: colors.gray, marginTop: 2 },
  bookmarkBtn: { padding: 8, marginRight: -8 },
  resDetails: { marginTop: spacing.sm, marginLeft: 60 },
  resDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  resDetailText: { fontSize: 12, color: colors.gray, flex: 1 },
  resFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.sm,
    marginLeft: 60,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusEmoji: { fontSize: 12 },
  statusText: { fontSize: 11, fontWeight: "600" },
  resAmount: { fontSize: 16, fontWeight: "700", color: colors.text },
  resActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: spacing.sm,
    marginLeft: 60,
  },
  actionBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.05)",
  },

  // Skeleton
  skeletonCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  skeletonRow: { flexDirection: "row", alignItems: "center" },
  skeletonContent: { flex: 1, marginLeft: 12 },

  // Empty
  emptyContainer: { alignItems: "center", paddingVertical: spacing.xxl },
  emptyEmoji: { fontSize: 64 },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
    marginTop: spacing.md,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.gray,
    marginTop: 8,
    textAlign: "center",
  },
  emptyBtn: { marginTop: spacing.lg, backgroundColor: colors.primary },

  // Error
  errorContainer: { alignItems: "center", paddingVertical: spacing.xxl },
  errorText: {
    fontSize: 14,
    color: colors.gray,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },

  // FAB
  fab: {
    position: "absolute",
    margin: spacing.md,
    right: 0,
    bottom: 20,
    backgroundColor: colors.primary,
  },

  // Modal
  modalContainer: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.md,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  modalTitle: { fontSize: 20, fontWeight: "700", color: colors.text },

  // Form
  formLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.gray,
    marginBottom: 8,
  },
  typeSelector: { marginBottom: spacing.md },
  typeChip: {
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    marginRight: 8,
  },
  typeEmoji: { fontSize: 20 },
  typeLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: colors.text,
    marginTop: 4,
  },
  input: { marginBottom: spacing.sm, backgroundColor: "#FFF" },
  statusSelector: { marginTop: spacing.sm },
  statusRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  statusLabel: { fontSize: 12, fontWeight: "600", color: colors.text },
  saveBtn: { marginTop: spacing.md, backgroundColor: colors.primary },

  // Parse Modal
  parseHint: { fontSize: 12, color: colors.gray, marginBottom: spacing.sm },
  parseInput: { minHeight: 120 },
});
