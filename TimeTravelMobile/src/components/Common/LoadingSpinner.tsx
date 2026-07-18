/**
 * LoadingSpinner – branded loading indicator
 */

import React from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { Text } from "react-native-paper";
import { colors } from "@/theme/colors";

interface Props {
  message?: string;
  size?: "small" | "large";
}

export default function LoadingSpinner({
  message = "Loading…",
  size = "large",
}: Props) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size={size} color={colors.primary} />
      {message ? <Text style={styles.text}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  text: {
    marginTop: 16,
    fontSize: 14,
    color: colors.gray,
  },
});
