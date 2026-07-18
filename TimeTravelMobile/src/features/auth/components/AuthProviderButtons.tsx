import React, { memo } from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { PressableScale } from "@/components/UI/PressableScale";
import { colors, spacing } from "@/theme/colors";

import type { AuthProvider } from "../types";

interface AuthProviderButtonsProps {
  onGooglePress: () => void;
  onApplePress: () => void;
  loadingProvider: AuthProvider | null;
  googleReady: boolean;
  appleReady: boolean;
  googleHint: string;
  appleHint: string;
}

function ProviderButton({
  label,
  subtitle,
  icon,
  loading,
  disabled,
  emphasized,
  onPress,
}: {
  label: string;
  subtitle: string;
  icon: string;
  loading: boolean;
  disabled: boolean;
  emphasized?: boolean;
  onPress: () => void;
}) {
  return (
    <PressableScale
      style={[
        styles.button,
        emphasized ? styles.buttonEmphasized : styles.buttonMuted,
        disabled && styles.disabledButton,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
    >
      <View style={styles.iconWrap}>
        {loading ? (
          <ActivityIndicator color={colors.primaryDark} />
        ) : (
          <MaterialCommunityIcons
            name={icon as any}
            size={20}
            color={colors.primaryDark}
          />
        )}
      </View>

      <View style={styles.buttonCopy}>
        <Text
          style={[
            styles.buttonLabel,
            emphasized && styles.buttonLabelEmphasized,
          ]}
        >
          {label}
        </Text>
        <Text style={styles.buttonSubtitle}>{subtitle}</Text>
      </View>

      <View style={styles.trustMark}>
        <MaterialCommunityIcons
          name="shield-check-outline"
          size={16}
          color={colors.textTertiary}
        />
      </View>
    </PressableScale>
  );
}

const buttonShadow =
  Platform.select({
    web: {
      boxShadow: "0px 8px 12px rgba(15, 23, 42, 0.05)",
    } as any,
    default: {
      shadowColor: "#0F172A",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.05,
      shadowRadius: 12,
      elevation: 2,
    },
  }) ?? {};

export const AuthProviderButtons = memo(function AuthProviderButtons({
  onGooglePress,
  onApplePress,
  loadingProvider,
  googleReady,
  appleReady,
  googleHint,
  appleHint,
}: AuthProviderButtonsProps) {
  return (
    <View style={styles.container}>
      <ProviderButton
        label="Continue with Google"
        subtitle={googleHint || "Quick sign-in"}
        icon="google"
        loading={loadingProvider === "google"}
        disabled={!googleReady}
        emphasized
        onPress={onGooglePress}
      />

      <ProviderButton
        label="Continue with Apple"
        subtitle={appleHint || "Use Apple ID"}
        icon="apple"
        loading={loadingProvider === "apple"}
        disabled={!appleReady}
        onPress={onApplePress}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 56,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.16)",
    backgroundColor: "rgba(255,255,255,0.88)",
    ...buttonShadow,
  },
  buttonEmphasized: {
    borderColor: "rgba(37, 99, 235, 0.14)",
    backgroundColor: "rgba(255,255,255,0.95)",
  },
  buttonMuted: {
    backgroundColor: "rgba(255,255,255,0.82)",
    borderColor: "rgba(148, 163, 184, 0.12)",
  },
  disabledButton: {
    opacity: 0.6,
  },
  iconWrap: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonCopy: {
    flex: 1,
  },
  buttonLabel: {
    color: "#0F172A",
    fontSize: 15,
    fontWeight: "700",
  },
  buttonSubtitle: {
    marginTop: 2,
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "500",
  },
  buttonLabelEmphasized: {
    color: colors.primaryDark,
  },
  trustMark: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default AuthProviderButtons;
