import React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AuthFormCard } from "./components/AuthFormCard";
import { useAuthScreen } from "./hooks/useAuthScreen";

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const auth = useAuthScreen();

  return (
    <View style={styles.screen}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="dark-content"
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: Math.max(insets.top + 48, 72),
              paddingBottom: Math.max(insets.bottom + 32, 48),
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.appName}>Time To Travel</Text>
            <Text style={styles.tagline}>
              Plan trips, not logistics.
            </Text>
          </View>

          {/* Form */}
          <AuthFormCard
            mode={auth.mode}
            values={auth.values}
            errors={auth.errors}
            feedback={auth.feedback}
            isSubmitting={auth.isSubmitting}
            showPassword={auth.showPassword}
            showConfirmPassword={auth.showConfirmPassword}
            acceptedTerms={auth.acceptedTerms}
            submitLabel={auth.submitLabel}
            switchLabel={auth.switchLabel}
            switchPrompt={auth.switchPrompt}
            onChangeMode={auth.setMode}
            onChangeField={auth.updateField}
            onToggleAcceptedTerms={auth.toggleAcceptedTerms}
            onTogglePasswordVisibility={auth.togglePasswordVisibility}
            onToggleConfirmPasswordVisibility={
              auth.toggleConfirmPasswordVisibility
            }
            onSubmit={auth.submit}
          />

          {/* Footer */}
          <Text style={styles.footer}>
            By continuing you agree to our Terms & Privacy Policy
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FAFBFC",
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  header: {
    marginBottom: 36,
  },
  appName: {
    fontSize: 32,
    fontWeight: "700",
    color: "#111827",
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  tagline: {
    fontSize: 16,
    color: "#6B7280",
    lineHeight: 22,
  },
  footer: {
    textAlign: "center",
    color: "#9CA3AF",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 24,
    paddingHorizontal: 32,
  },
});
