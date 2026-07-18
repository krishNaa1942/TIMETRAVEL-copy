import React, { memo } from "react";
import { View, StyleSheet } from "react-native";
import { Button, Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { colors, spacing } from "@/theme/colors";

interface ErrorStateProps {
  title: string;
  message: string;
  retryLabel?: string;
  onRetry?: () => void;
}

export const ErrorState = memo(
  ({ title, message, retryLabel = "Try again", onRetry }: ErrorStateProps) => {
    return (
      <View style={styles.container} accessibilityRole="alert">
        <View style={styles.iconWrapper}>
          <MaterialCommunityIcons
            name="cloud-alert"
            size={28}
            color={colors.error}
          />
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
        {onRetry ? (
          <Button
            mode="contained"
            onPress={onRetry}
            buttonColor={colors.primary}
            textColor="#FFF"
            style={styles.button}
          >
            {retryLabel}
          </Button>
        ) : null}
      </View>
    );
  },
);

ErrorState.displayName = "ErrorState";

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
    backgroundColor: "rgba(220, 38, 38, 0.08)",
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
  button: {
    marginTop: spacing.sm,
  },
});
