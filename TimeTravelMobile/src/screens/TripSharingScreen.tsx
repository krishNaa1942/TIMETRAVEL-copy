import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Linking,
  Share as NativeShare,
  StyleSheet,
  View,
} from "react-native";
import { Button, Snackbar, Text } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  ShareCard,
  TripSelector,
  getTripSharingErrorMessage,
  useCreateShare,
  useRevokeShare,
  useShares,
  useTrips,
} from "@/features/trip-sharing";
import type { SharedTrip } from "@/services/sharing";
import { sharingService } from "@/services/sharing";
import type { TripData } from "@/services/tripPlanner";
import { colors, spacing } from "@/theme/colors";

type SnackbarTone = "info" | "success" | "error";

interface SnackbarState {
  visible: boolean;
  message: string;
  tone: SnackbarTone;
}

const INITIAL_SNACKBAR_STATE: SnackbarState = {
  visible: false,
  message: "",
  tone: "info",
};

const buildItineraryPayload = (trip: TripData): Record<string, unknown> => ({
  tripId: trip.id,
  title: trip.title,
  destination: trip.destination,
  num_days: trip.num_days,
  family_size: trip.family_size,
  travel_class: trip.travel_class,
  notes: trip.notes ?? "",
  days: trip.days ?? [],
});

const createShareTextFile = async (share: SharedTrip): Promise<string> => {
  if (!FileSystem.cacheDirectory) {
    throw new Error("Local storage is unavailable on this device.");
  }

  const fileUri = `${FileSystem.cacheDirectory}timetravel-share-${share.share_token}.txt`;
  const lines = [
    share.title,
    "",
    `Share link: ${sharingService.resolveShareUrl(share)}`,
    share.notes ? `Notes: ${share.notes}` : null,
    share.expires_at ? `Expires at: ${share.expires_at}` : null,
    "",
    "Shared from TimeTravel.",
  ].filter((line): line is string => Boolean(line));

  await FileSystem.writeAsStringAsync(fileUri, lines.join("\n"), {
    encoding: FileSystem.EncodingType.UTF8,
  });

  return fileUri;
};

export default function TripSharingScreen() {
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);
  const [snackbar, setSnackbar] = useState<SnackbarState>(
    INITIAL_SNACKBAR_STATE,
  );

  const {
    data: trips = [],
    isLoading: isTripsLoading,
    isFetching: isTripsFetching,
    error: tripsError,
    refetch: refetchTrips,
  } = useTrips();

  const {
    data: shares = [],
    isLoading: isSharesLoading,
    isFetching: isSharesFetching,
    error: sharesError,
    refetch: refetchShares,
  } = useShares();

  const createShare = useCreateShare();
  const revokeShare = useRevokeShare();

  useEffect(() => {
    if (trips.length === 0) {
      setSelectedTripId(null);
      return;
    }

    const selectedTripStillExists =
      selectedTripId !== null &&
      trips.some((trip) => trip.id === selectedTripId);

    if (!selectedTripStillExists) {
      setSelectedTripId(trips[0].id);
    }
  }, [selectedTripId, trips]);

  const selectedTrip = useMemo<TripData | null>(() => {
    if (selectedTripId === null) {
      return null;
    }

    return trips.find((trip) => trip.id === selectedTripId) ?? null;
  }, [selectedTripId, trips]);

  const selectedTripShare = useMemo<SharedTrip | null>(() => {
    if (selectedTripId === null) {
      return null;
    }

    return (
      shares.find(
        (share) => share.trip_id === selectedTripId && share.is_active,
      ) ?? null
    );
  }, [shares, selectedTripId]);

  const activeShareTripIds = useMemo(() => {
    const activeIds = shares
      .filter((share) => share.is_active && typeof share.trip_id === "number")
      .map((share) => share.trip_id as number);

    return new Set(activeIds);
  }, [shares]);

  const tripsErrorMessage = tripsError
    ? getTripSharingErrorMessage(tripsError)
    : null;
  const sharesErrorMessage = sharesError
    ? getTripSharingErrorMessage(sharesError)
    : null;

  const showSnackbar = useCallback(
    (message: string, tone: SnackbarTone = "info") => {
      setSnackbar({ visible: true, message, tone });
    },
    [],
  );

  const hideSnackbar = useCallback(() => {
    setSnackbar((current) => ({ ...current, visible: false }));
  }, []);

  const handleRefresh = useCallback(async () => {
    await Promise.all([refetchTrips(), refetchShares()]);
  }, [refetchShares, refetchTrips]);

  const handleSelectTrip = useCallback((tripId: number) => {
    setSelectedTripId(tripId);
  }, []);

  const handleCreateShare = useCallback(async () => {
    if (!selectedTrip) {
      showSnackbar("Select a valid trip first.", "error");
      return;
    }

    if (selectedTripShare) {
      showSnackbar("This trip already has an active share link.", "error");
      return;
    }

    try {
      await createShare.mutateAsync({
        tripId: selectedTrip.id,
        tripTitle: selectedTrip.title,
        notes: selectedTrip.notes ?? undefined,
        itineraryJson: buildItineraryPayload(selectedTrip),
      });

      showSnackbar("Share link created successfully.", "success");
    } catch (error: unknown) {
      showSnackbar(getTripSharingErrorMessage(error), "error");
    }
  }, [createShare, selectedTrip, selectedTripShare, showSnackbar]);

  const handleCopyShare = useCallback(
    async (share: SharedTrip) => {
      try {
        await Clipboard.setStringAsync(sharingService.resolveShareUrl(share));
        showSnackbar("Share link copied to clipboard.", "success");
      } catch (error: unknown) {
        showSnackbar(getTripSharingErrorMessage(error), "error");
      }
    },
    [showSnackbar],
  );

  const handleOpenShare = useCallback(
    async (share: SharedTrip) => {
      const shareUrl = sharingService.resolveShareUrl(share);

      try {
        const canOpen = await Linking.canOpenURL(shareUrl);

        if (!canOpen) {
          throw new Error("This device cannot open the share link.");
        }

        await Linking.openURL(shareUrl);
      } catch (error: unknown) {
        showSnackbar(getTripSharingErrorMessage(error), "error");
      }
    },
    [showSnackbar],
  );

  const handleNativeShare = useCallback(
    async (share: SharedTrip) => {
      const shareUrl = sharingService.resolveShareUrl(share);
      let tempFileUri: string | null = null;

      try {
        const sharingAvailable = await Sharing.isAvailableAsync();

        if (!sharingAvailable) {
          await NativeShare.share({
            message: shareUrl,
            title: share.title,
          });
          showSnackbar("Native sharing opened.", "success");
          return;
        }

        tempFileUri = await createShareTextFile(share);

        await Sharing.shareAsync(tempFileUri, {
          dialogTitle: `Share ${share.title}`,
          mimeType: "text/plain",
        });

        showSnackbar("Sharing sheet opened.", "success");
      } catch (error: unknown) {
        showSnackbar(getTripSharingErrorMessage(error), "error");
      } finally {
        if (tempFileUri) {
          await FileSystem.deleteAsync(tempFileUri, { idempotent: true }).catch(
            () => undefined,
          );
        }
      }
    },
    [showSnackbar],
  );

  const handleRevokeShare = useCallback(
    (share: SharedTrip) => {
      Alert.alert(
        "Revoke share link?",
        "This will immediately disable the link for everyone who has it.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Revoke",
            style: "destructive",
            onPress: () => {
              void revokeShare
                .mutateAsync(share)
                .then(() => showSnackbar("Share link revoked.", "success"))
                .catch((error: unknown) =>
                  showSnackbar(getTripSharingErrorMessage(error), "error"),
                );
            },
          },
        ],
      );
    },
    [revokeShare, showSnackbar],
  );

  const createDisabled =
    !selectedTrip || Boolean(selectedTripShare) || createShare.isPending;
  const createButtonLabel = selectedTripShare
    ? "Share link already exists"
    : createShare.isPending
      ? "Creating…"
      : "Generate Share Link";

  const header = useMemo(
    () => (
      <View style={styles.headerContainer}>
        <View style={styles.heroCard}>
          <Text style={styles.title}>🔗 Trip Sharing</Text>
          <Text style={styles.subtitle}>
            Create, manage, and distribute shareable trip links with copy,
            native share, and QR support.
          </Text>

          <View style={styles.metricsRow}>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{trips.length}</Text>
              <Text style={styles.metricLabel}>Trips</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{shares.length}</Text>
              <Text style={styles.metricLabel}>Links</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{activeShareTripIds.size}</Text>
              <Text style={styles.metricLabel}>Active</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Select a trip to share</Text>
          <TripSelector
            trips={trips}
            selectedTripId={selectedTripId}
            activeShareTripIds={activeShareTripIds}
            loading={isTripsLoading}
            errorMessage={tripsErrorMessage}
            onSelectTrip={handleSelectTrip}
            onRetry={handleRefresh}
          />

          <View style={styles.actionBlock}>
            <Button
              mode="contained"
              buttonColor={colors.primary}
              textColor="#FFF"
              icon="link-variant"
              loading={createShare.isPending}
              disabled={createDisabled}
              onPress={handleCreateShare}
              contentStyle={styles.createButtonContent}
              style={styles.createButton}
            >
              {createButtonLabel}
            </Button>

            <Text style={styles.helperText}>
              {selectedTripShare
                ? "An active share link already exists for this trip. Revoke it first if you want to create a new one."
                : "Share links can be copied, opened directly, or sent through the device share sheet."}
            </Text>
          </View>

          {sharesErrorMessage && shares.length > 0 ? (
            <View style={styles.inlineErrorBlock}>
              <ErrorState
                title="Could not refresh share links"
                message={sharesErrorMessage}
                retryLabel="Retry refresh"
                onRetry={handleRefresh}
              />
            </View>
          ) : null}
        </View>
      </View>
    ),
    [
      activeShareTripIds,
      createButtonLabel,
      createDisabled,
      createShare.isPending,
      handleCreateShare,
      handleRefresh,
      handleSelectTrip,
      isTripsLoading,
      selectedTripShare,
      selectedTripId,
      shares.length,
      sharesErrorMessage,
      trips.length,
      trips,
      tripsErrorMessage,
    ],
  );

  const listEmptyComponent = useMemo(() => {
    if (isSharesLoading) {
      return <LoadingSkeleton variant="shares" count={3} />;
    }

    if (sharesErrorMessage) {
      return (
        <ErrorState
          title="Unable to load share links"
          message={sharesErrorMessage}
          retryLabel="Retry loading"
          onRetry={handleRefresh}
        />
      );
    }

    return (
      <EmptyState
        iconName="share-variant-outline"
        title="No shared trips yet"
        message="Generate a share link from the selector above. Your active share links will appear here with copy, open, and revoke actions."
        actionLabel="Refresh"
        onAction={handleRefresh}
      />
    );
  }, [handleRefresh, isSharesLoading, sharesErrorMessage]);

  const renderShareItem = useCallback(
    ({ item }: { item: SharedTrip }) => (
      <ShareCard
        share={item}
        shareUrl={sharingService.resolveShareUrl(item)}
        isRevoking={revokeShare.variables?.id === item.id}
        onCopyPress={handleCopyShare}
        onNativeSharePress={handleNativeShare}
        onOpenPress={handleOpenShare}
        onRevokePress={handleRevokeShare}
      />
    ),
    [
      handleCopyShare,
      handleNativeShare,
      handleOpenShare,
      handleRevokeShare,
      revokeShare.variables?.id,
    ],
  );

  const keyExtractor = useCallback((item: SharedTrip) => String(item.id), []);
  const isRefreshing = isTripsFetching || isSharesFetching;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <FlatList
        data={shares}
        renderItem={renderShareItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={header}
        ListEmptyComponent={listEmptyComponent}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshing={isRefreshing}
        onRefresh={handleRefresh}
        keyboardShouldPersistTaps="handled"
      />

      <Snackbar
        visible={snackbar.visible}
        onDismiss={hideSnackbar}
        duration={2800}
        style={[
          styles.snackbar,
          snackbar.tone === "success" && styles.snackbarSuccess,
          snackbar.tone === "error" && styles.snackbarError,
        ]}
        action={{ label: "Dismiss", onPress: hideSnackbar }}
      >
        {snackbar.message}
      </Snackbar>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: 120,
  },
  headerContainer: {
    marginBottom: spacing.md,
  },
  heroCard: {
    borderRadius: 24,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  metricsRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  metricCard: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: "rgba(37, 99, 235, 0.06)",
    paddingVertical: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  metricValue: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSecondary,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
    marginTop: spacing.xs,
  },
  actionBlock: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  createButton: {
    borderRadius: 16,
  },
  createButtonContent: {
    height: 52,
  },
  helperText: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  inlineErrorBlock: {
    marginTop: spacing.xs,
  },
  snackbar: {
    backgroundColor: colors.darkBackground,
    borderRadius: 14,
  },
  snackbarSuccess: {
    backgroundColor: colors.success,
  },
  snackbarError: {
    backgroundColor: colors.error,
  },
});
