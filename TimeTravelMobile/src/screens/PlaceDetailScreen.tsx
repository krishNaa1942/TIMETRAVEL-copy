/**
 * PlaceDetailScreen - Trip place detail (modal)
 * ===============================================
 * Read-only detail for a trip place, with optional removal.
 */

import React from "react";
import { View, ScrollView, StyleSheet, Alert } from "react-native";
import { Text, Button, Chip, Divider, ActivityIndicator } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import apiService from "@/services/api";
import { queryKeys } from "@/api/queryKeys";
import { colors, spacing } from "@/theme/colors";
import { RootStackParamList } from "@/navigation/types";

type PlaceRoute = RouteProp<RootStackParamList, "PlaceDetail">;

const formatCurrency = (value: number) => `₹${value.toLocaleString("en-IN")}`;

const PlaceDetailScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<PlaceRoute>();
  const queryClient = useQueryClient();
  const place = route.params?.place;
  const tripId = place?.trip_id;

  const removeMutation = useMutation({
    mutationFn: async () => {
      if (!tripId || !place) return;
      await apiService.delete(`/trips/planner/${tripId}/places/${place.id}`);
    },
    onSuccess: () => {
      if (tripId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.trips.detail(tripId) });
      }
      navigation.goBack();
    },
    onError: (error: any) => {
      Alert.alert("Error", error?.message || "Could not remove this place.");
    },
  });

  if (!place) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <Text style={styles.empty}>Place details unavailable</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <MaterialCommunityIcons name="map-marker" size={28} color={colors.primary} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.title}>{place.name}</Text>
            {place.category ? (
              <Chip
                mode="flat"
                compact
                style={styles.categoryChip}
                textStyle={styles.categoryChipText}
              >
                {place.category}
              </Chip>
            ) : null}
          </View>
        </View>

        {place.is_booked ? (
          <Chip icon="check-circle" style={styles.bookedChip} textStyle={styles.bookedText}>
            Booked
          </Chip>
        ) : null}

        <Divider style={styles.divider} />

        {place.start_time ? (
          <View style={styles.row}>
            <MaterialCommunityIcons name="clock-outline" size={20} color={colors.gray} />
            <Text style={styles.rowText}>
              {place.start_time}
              {place.end_time ? ` – ${place.end_time}` : ""}
            </Text>
          </View>
        ) : null}

        {place.duration_minutes ? (
          <View style={styles.row}>
            <MaterialCommunityIcons name="timelapse" size={20} color={colors.gray} />
            <Text style={styles.rowText}>{place.duration_minutes} min</Text>
          </View>
        ) : null}

        {place.estimated_cost ? (
          <View style={styles.row}>
            <MaterialCommunityIcons name="currency-inr" size={20} color={colors.gray} />
            <Text style={styles.rowText}>{formatCurrency(place.estimated_cost)}</Text>
          </View>
        ) : null}

        {place.rating ? (
          <View style={styles.row}>
            <MaterialCommunityIcons name="star" size={20} color={colors.accent} />
            <Text style={styles.rowText}>{place.rating} / 5</Text>
          </View>
        ) : null}

        {place.address ? (
          <View style={styles.row}>
            <MaterialCommunityIcons name="map-marker-outline" size={20} color={colors.gray} />
            <Text style={styles.rowText}>{place.address}</Text>
          </View>
        ) : null}

        {place.notes ? (
          <>
            <Divider style={styles.divider} />
            <Text style={styles.sectionLabel}>Notes</Text>
            <Text style={styles.notes}>{place.notes}</Text>
          </>
        ) : null}

        {tripId ? (
          <Button
            mode="outlined"
            icon="delete-outline"
            textColor={colors.error}
            style={styles.removeButton}
            loading={removeMutation.isPending}
            onPress={() => {
              Alert.alert("Remove place", `Remove "${place.name}" from this trip?`, [
                { text: "Cancel", style: "cancel" },
                { text: "Remove", style: "destructive", onPress: () => removeMutation.mutate() },
              ]);
            }}
          >
            Remove Place
          </Button>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.darkBackground,
  },
  content: {
    padding: spacing.md,
  },
  empty: {
    color: colors.gray,
    textAlign: "center",
    marginTop: spacing.xxl,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.darkSurface,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.darkText,
  },
  categoryChip: {
    alignSelf: "flex-start",
    backgroundColor: colors.darkSurface,
  },
  categoryChipText: {
    color: colors.primary,
    fontSize: 12,
  },
  bookedChip: {
    alignSelf: "flex-start",
    marginTop: spacing.md,
    backgroundColor: "#064E3B",
  },
  bookedText: {
    color: colors.success,
    fontSize: 12,
  },
  divider: {
    backgroundColor: "#334155",
    marginVertical: spacing.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  rowText: {
    color: colors.darkText,
    fontSize: 15,
    flex: 1,
  },
  sectionLabel: {
    color: colors.gray,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  notes: {
    color: colors.darkText,
    fontSize: 15,
    lineHeight: 22,
  },
  removeButton: {
    marginTop: spacing.xl,
    borderColor: colors.error,
  },
});

export default PlaceDetailScreen;
