import React, { memo } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { colors, spacing, typography } from "@/theme/colors";

interface AuthHeroProps {
  offline: boolean;
  cachedName?: string | null;
}

export const AuthHero = memo(function AuthHero({
  offline,
  cachedName,
}: AuthHeroProps) {
  const trustLabel = offline
    ? "Offline mode - limited access"
    : "Encrypted and private";
  const trustIcon = offline ? "wifi-off" : "shield-check-outline";
  const brandMarkShadow = Platform.select({
    web: { boxShadow: "0px 8px 24px rgba(15, 23, 42, 0.16)" } as any,
    default: {
      shadowColor: "#0F172A",
      shadowOpacity: 0.16,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 8 },
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.brandRow}>
        <View style={styles.brandMarkWrap}>
          <LinearGradient
            colors={[colors.primary, colors.info]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.brandMark, brandMarkShadow]}
          >
            <MaterialCommunityIcons
              name="compass-outline"
              size={30}
              color="#fff"
            />
          </LinearGradient>
        </View>
        <View style={styles.brandCopy}>
          <Text style={styles.brandName}>TimeToTravel</Text>
          <Text style={styles.brandTagline}>Your travel workspace</Text>
        </View>
      </View>

      <Text style={styles.title}>
        {cachedName ? `Welcome back, ${cachedName} 👋` : "Welcome back"}
      </Text>

      <Text style={styles.subtitle}>Sign in to continue.</Text>

      <View style={styles.trustRow}>
        <MaterialCommunityIcons
          name={trustIcon as any}
          size={14}
          color="#BFDBFE"
        />
        <Text style={styles.trustText}>{trustLabel}</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  brandMarkWrap: {
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
  },
  brandMark: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
  },
  brandCopy: {
    flex: 1,
  },
  brandName: {
    color: "#F8FAFC",
    fontSize: 19,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  brandTagline: {
    color: "rgba(226, 232, 240, 0.8)",
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  title: {
    color: "#FFFFFF",
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "800",
    letterSpacing: -0.8,
    maxWidth: 340,
  },
  subtitle: {
    marginTop: 6,
    color: "rgba(241, 245, 249, 0.84)",
    fontSize: typography.bodyLarge.fontSize,
    lineHeight: 24,
    maxWidth: 320,
    fontWeight: "400",
  },
  trustRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: spacing.md,
  },
  trustText: {
    color: "#E2E8F0",
    fontSize: 12,
    fontWeight: "600",
  },
});

export default AuthHero;
