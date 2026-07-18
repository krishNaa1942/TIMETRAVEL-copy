import React, { memo, useEffect, useMemo, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { ProgressBar, Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import QRCode from "react-native-qrcode-svg";

import { PressableScale } from "@/components/UI/PressableScale";
import { colors, spacing } from "@/theme/colors";
import type { SharedTrip } from "@/services/sharing";

interface ShareCardProps {
  share: SharedTrip;
  shareUrl: string;
  isRevoking: boolean;
  onCopyPress: (share: SharedTrip) => void;
  onNativeSharePress: (share: SharedTrip) => void | Promise<void>;
  onOpenPress: (share: SharedTrip) => void | Promise<void>;
  onRevokePress: (share: SharedTrip) => void;
}

interface ShareActionButtonProps {
  icon: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}

const formatDate = (value?: string | null): string | null => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const ShareActionButton = memo(
  ({ icon, label, onPress, disabled = false }: ShareActionButtonProps) => (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={[styles.actionButton, disabled && styles.actionButtonDisabled]}
    >
      <MaterialCommunityIcons
        name={icon as never}
        size={16}
        color={disabled ? colors.gray : colors.primary}
      />
      <Text
        style={[
          styles.actionButtonText,
          disabled && styles.actionButtonTextDisabled,
        ]}
      >
        {label}
      </Text>
    </PressableScale>
  ),
);

ShareActionButton.displayName = "ShareActionButton";

export const ShareCard = memo(
  ({
    share,
    shareUrl,
    isRevoking,
    onCopyPress,
    onNativeSharePress,
    onOpenPress,
    onRevokePress,
  }: ShareCardProps) => {
    const pulse = useRef(new Animated.Value(0.55)).current;

    const isExpired = useMemo(() => {
      if (!share.expires_at) {
        return false;
      }

      const expiry = new Date(share.expires_at);
      return !Number.isNaN(expiry.getTime()) && expiry.getTime() < Date.now();
    }, [share.expires_at]);

    const status = useMemo(() => {
      if (!share.is_active) {
        return { label: "Revoked", color: colors.error };
      }

      if (isExpired) {
        return { label: "Expired", color: colors.warning };
      }

      return { label: "Active", color: colors.success };
    }, [isExpired, share.is_active]);

    const dateLabel = useMemo(
      () => formatDate(share.created_at),
      [share.created_at],
    );
    const expiresLabel = useMemo(
      () => formatDate(share.expires_at),
      [share.expires_at],
    );
    const engagement = useMemo(
      () => Math.min(share.view_count / 100, 1),
      [share.view_count],
    );
    const actionsDisabled = !share.is_active || isExpired;

    useEffect(() => {
      if (!share.is_active) {
        pulse.setValue(0.55);
        return undefined;
      }

      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 0.55,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
      );

      animation.start();

      return () => animation.stop();
    }, [pulse, share.is_active]);

    return (
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <View style={styles.titleBlock}>
            <Text style={styles.title} numberOfLines={1}>
              {share.title}
            </Text>
            <Text style={styles.shareUrl} numberOfLines={1} selectable>
              {shareUrl}
            </Text>
          </View>

          <View
            style={[
              styles.statusBadge,
              { backgroundColor: `${status.color}15` },
            ]}
          >
            <Animated.View
              style={[
                styles.statusDot,
                { backgroundColor: status.color, opacity: pulse },
              ]}
            />
            <Text style={[styles.statusText, { color: status.color }]}>
              {status.label}
            </Text>
          </View>
        </View>

        <View style={styles.contentRow}>
          <View style={styles.detailsColumn}>
            <View style={styles.metaRow}>
              <MaterialCommunityIcons
                name="eye-outline"
                size={16}
                color={colors.textSecondary}
              />
              <Text style={styles.metaText}>{share.view_count} views</Text>
            </View>
            {dateLabel ? (
              <View style={styles.metaRow}>
                <MaterialCommunityIcons
                  name="calendar-outline"
                  size={16}
                  color={colors.textSecondary}
                />
                <Text style={styles.metaText}>Created {dateLabel}</Text>
              </View>
            ) : null}
            {expiresLabel ? (
              <View style={styles.metaRow}>
                <MaterialCommunityIcons
                  name="timer-outline"
                  size={16}
                  color={colors.textSecondary}
                />
                <Text style={styles.metaText}>
                  {isExpired ? "Expired" : `Expires ${expiresLabel}`}
                </Text>
              </View>
            ) : null}

            <View style={styles.engagementBlock}>
              <View style={styles.engagementHeader}>
                <Text style={styles.engagementLabel}>Engagement</Text>
                <Text style={styles.engagementValue}>{share.view_count}</Text>
              </View>
              <ProgressBar
                progress={engagement}
                color={colors.primary}
                style={styles.progressBar}
              />
            </View>
          </View>

          <View style={styles.qrWrapper}>
            <QRCode
              value={shareUrl}
              size={92}
              backgroundColor="#FFF"
              color="#111827"
            />
          </View>
        </View>

        <View style={styles.actionRow}>
          <ShareActionButton
            icon="content-copy"
            label="Copy"
            onPress={() => onCopyPress(share)}
            disabled={actionsDisabled}
          />
          <ShareActionButton
            icon="share-variant"
            label="Share"
            onPress={() => onNativeSharePress(share)}
            disabled={actionsDisabled}
          />
          <ShareActionButton
            icon="open-in-new"
            label="Open"
            onPress={() => onOpenPress(share)}
            disabled={actionsDisabled}
          />
          {share.is_active ? (
            <ShareActionButton
              icon="link-off"
              label={isRevoking ? "Revoking" : "Revoke"}
              onPress={() => onRevokePress(share)}
              disabled={isRevoking}
            />
          ) : null}
        </View>
      </View>
    );
  },
);

ShareCard.displayName = "ShareCard";

const styles = StyleSheet.create({
  container: {
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  titleBlock: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
  },
  shareUrl: {
    fontSize: 12,
    color: colors.primary,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "800",
  },
  contentRow: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "flex-start",
  },
  detailsColumn: {
    flex: 1,
    gap: spacing.sm,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  metaText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  engagementBlock: {
    gap: 8,
    marginTop: spacing.xs,
  },
  engagementHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  engagementLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  engagementValue: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.text,
  },
  progressBar: {
    borderRadius: 999,
    height: 6,
    backgroundColor: "rgba(37, 99, 235, 0.12)",
  },
  qrWrapper: {
    width: 108,
    height: 108,
    borderRadius: 18,
    padding: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "rgba(229, 231, 235, 0.95)",
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "rgba(37, 99, 235, 0.08)",
    minWidth: 86,
  },
  actionButtonDisabled: {
    backgroundColor: "rgba(156, 163, 175, 0.12)",
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary,
  },
  actionButtonTextDisabled: {
    color: colors.gray,
  },
});
