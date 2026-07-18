import React from "react";
import { View, StyleSheet, ViewStyle, Platform } from "react-native";
import { BlurView } from "expo-blur";

interface Props {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  intensity?: number;
  tint?: "light" | "dark" | "default";
}

export const GlassCard = ({
  children,
  style,
  intensity = 40,
  tint = "light",
}: Props) => {
  const fallbackShadow =
    Platform.select({
      web: {
        boxShadow: "0px 4px 10px rgba(0, 0, 0, 0.05)",
      } as any,
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 3,
      },
    }) ?? {};

  if (Platform.OS === "ios") {
    return (
      <BlurView intensity={intensity} tint={tint} style={[styles.card, style]}>
        {children}
      </BlurView>
    );
  }

  // Fallback for Android (Semi-transparent white with border)
  return (
    <View style={[styles.card, styles.androidFallback, fallbackShadow, style]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  androidFallback: {
    backgroundColor: "rgba(255, 255, 255, 0.8)",
  },
});
