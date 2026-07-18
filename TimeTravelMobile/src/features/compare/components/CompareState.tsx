import React, { memo } from "react";
import { View, StyleSheet } from "react-native";
import { Button, Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { GlassCard } from "@/components/UI/GlassCard";

import type { ComparePalette } from "../utils/formatters";

interface CompareStateProps {
  title: string;
  message: string;
  actionLabel: string;
  onAction: () => void;
  palette: ComparePalette;
  icon: string;
}

export const CompareState = memo(
  ({
    title,
    message,
    actionLabel,
    onAction,
    palette,
    icon,
  }: CompareStateProps) => {
    return (
      <GlassCard
        style={[
          styles.card,
          {
            backgroundColor: palette.surfaceElevated,
            borderColor: palette.border,
          },
        ]}
      >
        <View
          style={[styles.iconWrap, { backgroundColor: palette.accentSoft }]}
        >
          <MaterialCommunityIcons
            name={icon as never}
            size={20}
            color={palette.accent}
          />
        </View>
        <Text
          variant="titleLarge"
          style={[styles.title, { color: palette.text }]}
        >
          {title}
        </Text>
        <Text
          variant="bodyMedium"
          style={[styles.message, { color: palette.muted }]}
        >
          {message}
        </Text>
        <Button
          mode="contained"
          onPress={onAction}
          buttonColor={palette.accent}
          textColor="#FFF"
          style={styles.button}
        >
          {actionLabel}
        </Button>
      </GlassCard>
    );
  },
);

CompareState.displayName = "CompareState";

const styles = StyleSheet.create({
  card: {
    padding: 20,
    borderRadius: 24,
    alignItems: "center",
    gap: 12,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontWeight: "900",
    textAlign: "center",
  },
  message: {
    textAlign: "center",
    lineHeight: 22,
  },
  button: {
    marginTop: 6,
    borderRadius: 16,
  },
});
