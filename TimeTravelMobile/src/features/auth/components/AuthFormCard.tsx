import React, { memo } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import type {
  AuthErrors,
  AuthFeedback,
  AuthFieldName,
  AuthMode,
  AuthValues,
} from "../types";
import { getAuthFieldError, getAuthValue } from "../utils";

// ─── Types ──────────────────────────────────────────────────

interface AuthFormCardProps {
  mode: AuthMode;
  values: AuthValues;
  errors: AuthErrors;
  feedback: AuthFeedback | null;
  isSubmitting: boolean;
  showPassword: boolean;
  showConfirmPassword: boolean;
  acceptedTerms: boolean;
  submitLabel: string;
  switchLabel: string;
  switchPrompt: string;
  onChangeMode: (mode: AuthMode) => void;
  onChangeField: (field: AuthFieldName, value: string) => void;
  onToggleAcceptedTerms: () => void;
  onTogglePasswordVisibility: () => void;
  onToggleConfirmPasswordVisibility: () => void;
  onSubmit: () => void;
}

// ─── Sub-components ─────────────────────────────────────────

function FeedbackBanner({ feedback }: { feedback: AuthFeedback | null }) {
  if (!feedback) return null;

  const isError = feedback.type === "error";
  return (
    <View
      style={[
        styles.banner,
        { backgroundColor: isError ? "#FEF2F2" : "#F0FDF4" },
      ]}
    >
      <MaterialCommunityIcons
        name={isError ? "alert-circle-outline" : "check-circle-outline"}
        size={16}
        color={isError ? "#DC2626" : "#16A34A"}
      />
      <Text
        style={[styles.bannerText, { color: isError ? "#DC2626" : "#16A34A" }]}
      >
        {feedback.message}
      </Text>
    </View>
  );
}

function Field({
  label,
  value,
  error,
  onChangeText,
  placeholder,
  secureTextEntry,
  showToggle,
  visible,
  onToggle,
  keyboardType,
  autoCapitalize,
}: {
  label: string;
  value: string;
  error?: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  showToggle?: boolean;
  visible?: boolean;
  onToggle?: () => void;
  keyboardType?: "default" | "email-address";
  autoCapitalize?: "none" | "sentences" | "words";
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.fieldBox, error && styles.fieldBoxError]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder || label}
          placeholderTextColor="#9CA3AF"
          secureTextEntry={secureTextEntry && !visible}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          style={styles.fieldInput}
        />
        {showToggle ? (
          <Pressable onPress={onToggle} hitSlop={8}>
            <MaterialCommunityIcons
              name={visible ? "eye-off-outline" : "eye-outline"}
              size={20}
              color="#9CA3AF"
            />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

// ─── Main Component ─────────────────────────────────────────

export const AuthFormCard = memo(function AuthFormCard({
  mode,
  values,
  errors,
  feedback,
  isSubmitting,
  showPassword,
  showConfirmPassword,
  acceptedTerms,
  submitLabel,
  switchLabel,
  switchPrompt,
  onChangeMode,
  onChangeField,
  onToggleAcceptedTerms,
  onTogglePasswordVisibility,
  onToggleConfirmPasswordVisibility,
  onSubmit,
}: AuthFormCardProps) {
  const nextMode = mode === "login" ? "signup" : "login";

  return (
    <View style={styles.card}>
      <FeedbackBanner feedback={feedback} />

      {/* Email */}
      <Field
        label="Email"
        value={getAuthValue(values, "email")}
        error={getAuthFieldError(errors, "email")?.message}
        onChangeText={(t) => onChangeField("email", t)}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
      />

      {/* Password (not shown in forgot mode) */}
      {mode !== "forgot" ? (
        <Field
          label="Password"
          value={getAuthValue(values, "password")}
          error={getAuthFieldError(errors, "password")?.message}
          onChangeText={(t) => onChangeField("password", t)}
          placeholder="At least 8 characters"
          secureTextEntry
          showToggle
          visible={showPassword}
          onToggle={onTogglePasswordVisibility}
          autoCapitalize="none"
        />
      ) : null}

      {/* Signup extras */}
      {mode === "signup" ? (
        <>
          <Field
            label="Full name"
            value={getAuthValue(values, "name")}
            error={getAuthFieldError(errors, "name")?.message}
            onChangeText={(t) => onChangeField("name", t)}
            placeholder="Your name"
            autoCapitalize="words"
          />

          <Field
            label="Confirm password"
            value={getAuthValue(values, "confirmPassword")}
            error={getAuthFieldError(errors, "confirmPassword")?.message}
            onChangeText={(t) => onChangeField("confirmPassword", t)}
            placeholder="Re-enter password"
            secureTextEntry
            showToggle
            visible={showConfirmPassword}
            onToggle={onToggleConfirmPasswordVisibility}
            autoCapitalize="none"
          />

          {/* Terms checkbox */}
          <Pressable style={styles.termsRow} onPress={onToggleAcceptedTerms}>
            <View
              style={[
                styles.checkbox,
                acceptedTerms && styles.checkboxChecked,
              ]}
            >
              {acceptedTerms ? (
                <MaterialCommunityIcons
                  name="check"
                  size={14}
                  color="#FFFFFF"
                />
              ) : null}
            </View>
            <Text style={styles.termsText}>
              I agree to Terms & Privacy Policy
            </Text>
          </Pressable>
          {errors.terms ? (
            <Text style={styles.fieldError}>{errors.terms.message}</Text>
          ) : null}
        </>
      ) : null}

      {/* Forgot password link */}
      {mode === "login" ? (
        <Text style={styles.forgotLink} onPress={() => onChangeMode("forgot")}>
          Forgot password?
        </Text>
      ) : null}

      {/* Global error */}
      {errors.global ? (
        <Text style={styles.fieldError}>{errors.global.message}</Text>
      ) : null}

      {/* Submit button */}
      <Pressable
        onPress={onSubmit}
        disabled={isSubmitting}
        style={({ pressed }) => [
          styles.submitBtn,
          pressed && styles.submitBtnPressed,
          isSubmitting && styles.submitBtnDisabled,
        ]}
      >
        {isSubmitting ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <Text style={styles.submitLabel}>{submitLabel}</Text>
        )}
      </Pressable>

      {/* Switch mode */}
      <View style={styles.switchRow}>
        <Text style={styles.switchPrompt}>{switchPrompt}</Text>
        <Pressable onPress={() => onChangeMode(nextMode)}>
          <Text style={styles.switchLink}>{switchLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
});

// ─── Styles ─────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    gap: 16,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.04)",
    elevation: 2,
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  bannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18,
  },
  fieldWrap: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
  },
  fieldBox: {
    flexDirection: "row",
    alignItems: "center",
    height: 48,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FAFBFC",
  },
  fieldBoxError: {
    borderColor: "#FCA5A5",
    backgroundColor: "#FEF2F2",
  },
  fieldInput: {
    flex: 1,
    fontSize: 15,
    color: "#111827",
    paddingVertical: 0,
  },
  fieldError: {
    fontSize: 12,
    color: "#DC2626",
    fontWeight: "500",
  },
  termsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  checkboxChecked: {
    backgroundColor: "#2563EB",
    borderColor: "#2563EB",
  },
  termsText: {
    fontSize: 13,
    color: "#4B5563",
  },
  forgotLink: {
    fontSize: 13,
    color: "#2563EB",
    fontWeight: "500",
    alignSelf: "flex-end",
    marginTop: -8,
  },
  submitBtn: {
    height: 48,
    borderRadius: 10,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  submitBtnPressed: {
    opacity: 0.85,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
  },
  switchPrompt: {
    fontSize: 13,
    color: "#6B7280",
  },
  switchLink: {
    fontSize: 13,
    fontWeight: "600",
    color: "#2563EB",
  },
});
