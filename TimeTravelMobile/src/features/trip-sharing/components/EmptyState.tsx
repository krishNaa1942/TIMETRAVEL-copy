import React, { memo } from "react";
import { View, StyleSheet } from "react-native";
import { Button, Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { colors, spacing } from "@/theme/colors";

interface EmptyStateProps {
  iconName: string;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState = memo(
  ({ iconName, title, message, actionLabel, onAction }: EmptyStateProps) => {
    return (
      <View style={styles.container} accessibilityRole="text">
        <View style={styles.iconWrapper}>
          <MaterialCommunityIcons
            name={iconName as never}
            size={28}
            color={colors.primary}
          />
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
        {actionLabel && onAction ? (
          <Button
            mode="contained"
            buttonColor={colors.primary}
            textColor="#FFF"
            onPress={onAction}
            style={styles.actionWrapper}
          >
            {actionLabel}
          </Button>
        ) : null}
      </View>
    );
  },
);

EmptyState.displayName = "EmptyState";

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  iconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(37, 99, 235, 0.08)",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
  },
  message: {
    fontSize: 14,
    color: colors.gray,
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 320,
  },
  actionWrapper: {
    marginTop: spacing.sm,
    borderRadius: 12,
  },
});
