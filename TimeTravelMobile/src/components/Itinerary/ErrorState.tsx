/**
 * ErrorState — friendly retry UI for generation failures.
 */

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { PressableScale } from "@/components/UI/PressableScale";
import { getErrorInfo } from "@/utils/errorHandler";
import type { ItineraryPalette } from "./palette";

interface Props {
  error: any;
  onRetry: () => void;
  palette: ItineraryPalette;
}

const ErrorState: React.FC<Props> = ({ error, onRetry, palette }) => {
  const info = getErrorInfo(error);

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>😕</Text>
      <Text style={[styles.title, { color: palette.text }]}>{info.title}</Text>
      <Text style={[styles.message, { color: palette.textSecondary }]}>
        {info.message}
      </Text>
      {info.action ? (
        <PressableScale
          style={[styles.retryBtn, { backgroundColor: palette.text }]}
          onPress={onRetry}
        >
          <Text style={styles.retryBtnText}>{info.action}</Text>
        </PressableScale>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { alignItems: "center" },
  icon: { fontSize: 48, marginBottom: 16 },
  title: { fontSize: 20, fontWeight: "800", marginBottom: 8 },
  message: { fontSize: 14, textAlign: "center", marginBottom: 24 },
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryBtnText: { color: "#FFF", fontSize: 14, fontWeight: "700" },
});

export default ErrorState;