import React, { memo } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput as NativeTextInput,
  View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { PressableScale } from "@/components/UI/PressableScale";
import { colors, spacing } from "@/theme/colors";

import { AUTH_PRIVACY_URL, AUTH_TERMS_URL } from "../config";
import AuthProviderButtons from "./AuthProviderButtons";
import type {
  AuthErrors,
  AuthFeedback,
  AuthFieldName,
  AuthMode,
  AuthProvider,
  AuthValues,
  PasswordStrength,
} from "../types";
import {
  getAuthFieldError,
  getAuthValue,
  getPasswordStrengthMeta,
} from "../utils";

const paperComponents =
  Platform.OS === "web"
    ? null
    : (require("react-native-paper") as typeof import("react-native-paper"));

const Button = paperComponents?.Button;
const Checkbox = paperComponents?.Checkbox;
const PaperTextInput = paperComponents?.TextInput;

interface AuthFormCardProps {
  mode: AuthMode;
  values: AuthValues;
  errors: AuthErrors;
  feedback: AuthFeedback | null;
  isSubmitting: boolean;
  loadingProvider: AuthProvider | null;
  acceptedTerms: boolean;
  passwordStrength: PasswordStrength;
  showPassword: boolean;
  showConfirmPassword: boolean;
  title: string;
  subtitle: string;
  googleReady: boolean;
  appleReady: boolean;
  googleHint: string;
  appleHint: string;
  submitLabel: string;
  switchLabel: string;
  switchPrompt: string;
  onChangeMode: (mode: AuthMode) => void;
  onChangeField: (field: AuthFieldName, value: string) => void;
  onToggleAcceptedTerms: () => void;
  onTogglePasswordVisibility: () => void;
  onToggleConfirmPasswordVisibility: () => void;
  onSubmit: () => void;
  onGooglePress: () => void;
  onApplePress: () => void;
}

function FeedbackBanner({ feedback }: { feedback: AuthFeedback | null }) {
  if (!feedback) {
    return null;
  }

  const tone =
    feedback.type === "success"
      ? {
          backgroundColor: "rgba(16, 185, 129, 0.12)",
          borderColor: "rgba(16, 185, 129, 0.24)",
          color: "#059669",
          icon: "check-circle-outline",
        }
      : feedback.type === "info"
        ? {
            backgroundColor: "rgba(14, 165, 233, 0.12)",
            borderColor: "rgba(14, 165, 233, 0.24)",
            color: "#0284C7",
            icon: "information-outline",
          }
        : {
            backgroundColor: "rgba(239, 68, 68, 0.12)",
            borderColor: "rgba(239, 68, 68, 0.24)",
            color: "#DC2626",
            icon: "alert-circle-outline",
          };

  return (
    <View
      style={[
        styles.feedback,
        {
          backgroundColor: tone.backgroundColor,
          borderColor: tone.borderColor,
        },
      ]}
    >
      <MaterialCommunityIcons
        name={tone.icon as any}
        size={18}
        color={tone.color}
      />
      <Text style={[styles.feedbackText, { color: tone.color }]}>
        {feedback.message}
      </Text>
    </View>
  );
}

function StrengthMeter({ strength }: { strength: PasswordStrength }) {
  const meta = getPasswordStrengthMeta(strength);

  return (
    <View style={styles.strengthWrap}>
      <View style={styles.strengthBar}>
        {Array.from({ length: 4 }).map((_, index) => (
          <View
            key={index}
            style={[
              styles.strengthSegment,
              index < strength.score && { backgroundColor: meta.color },
            ]}
          />
        ))}
      </View>
      <Text style={[styles.strengthLabel, { color: meta.color }]}>
        {meta.label}
      </Text>
    </View>
  );
}

function PasswordTips({ password }: { password: string }) {
  const tips: string[] = [];

  if (password.length < 8) {
    tips.push("Use at least 8 characters");
  }

  if (!/[0-9]/.test(password)) {
    tips.push("Add a number");
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    tips.push("Add a symbol");
  }

  if (tips.length === 0) {
    return null;
  }

  return (
    <View style={styles.tipRow}>
      {tips.slice(0, 3).map((tip) => (
        <View key={tip} style={styles.tipChip}>
          <Text style={styles.tipChipText}>{tip}</Text>
        </View>
      ))}
    </View>
  );
}

function Field({
  label,
  value,
  error,
  onChangeText,
  icon,
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
  icon: string;
  secureTextEntry?: boolean;
  showToggle?: boolean;
  visible?: boolean;
  onToggle?: () => void;
  keyboardType?: "default" | "email-address" | "visible-password";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
}) {
  if (Platform.OS === "web") {
    return (
      <View style={styles.fieldWrap}>
        <Text style={styles.webFieldLabel}>{label}</Text>
        <View
          style={[styles.webFieldShell, error && styles.webFieldShellError]}
        >
          <MaterialCommunityIcons
            name={icon as any}
            size={18}
            color={colors.textSecondary}
          />
          <NativeTextInput
            value={value}
            onChangeText={onChangeText}
            autoCapitalize={autoCapitalize}
            keyboardType={keyboardType}
            secureTextEntry={secureTextEntry && !visible}
            autoCorrect={false}
            placeholder={label}
            placeholderTextColor="#94A3B8"
            style={styles.webFieldInput}
          />
          {showToggle ? (
            <Pressable
              onPress={onToggle}
              hitSlop={8}
              accessibilityRole="button"
            >
              <MaterialCommunityIcons
                name={visible ? "eye-off" : "eye"}
                size={18}
                color={colors.textSecondary}
              />
            </Pressable>
          ) : null}
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>
    );
  }

  return (
    <View style={styles.fieldWrap}>
      <PaperTextInput
        mode="outlined"
        label={label}
        value={value}
        onChangeText={onChangeText}
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry && !visible}
        style={styles.field}
        outlineColor="rgba(148, 163, 184, 0.45)"
        activeOutlineColor={colors.primary}
        error={Boolean(error)}
        left={<PaperTextInput.Icon icon={icon} color={colors.textSecondary} />}
        right={
          showToggle ? (
            <PaperTextInput.Icon
              icon={visible ? "eye-off" : "eye"}
              onPress={onToggle}
              color={colors.textSecondary}
            />
          ) : undefined
        }
      />

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

export const AuthFormCard = memo(function AuthFormCard({
  mode,
  values,
  errors,
  feedback,
  isSubmitting,
  loadingProvider,
  acceptedTerms,
  passwordStrength,
  showPassword,
  showConfirmPassword,
  title,
  subtitle,
  googleReady,
  appleReady,
  googleHint,
  appleHint,
  submitLabel,
  switchLabel,
  switchPrompt,
  onChangeMode,
  onChangeField,
  onToggleAcceptedTerms,
  onTogglePasswordVisibility,
  onToggleConfirmPasswordVisibility,
  onSubmit,
  onGooglePress,
  onApplePress,
}: AuthFormCardProps) {
  const showSocialLogin = mode !== "forgot";
  const nextMode = mode === "login" ? "signup" : "login";
  const emailValue = getAuthValue(values, "email");
  const passwordValue = getAuthValue(values, "password");
  const nameValue = getAuthValue(values, "name");
  const confirmPasswordValue = getAuthValue(values, "confirmPassword");
  const passwordMeta = getPasswordStrengthMeta(passwordStrength);

  return (
    <View style={styles.card}>
      <View style={styles.cardGlow} />
      <View style={styles.cardInner}>
        <View style={styles.badgeRow}>
          <View style={styles.badge}>
            <MaterialCommunityIcons
              name="shield-lock-outline"
              size={14}
              color={colors.primary}
            />
            <Text style={styles.badgeText}>Secure access</Text>
          </View>
        </View>

        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>

        <FeedbackBanner feedback={feedback} />

        {showSocialLogin ? (
          <View style={styles.socialSection}>
            <Text style={styles.sectionLabel}>Fastest way to continue</Text>
            <AuthProviderButtons
              onGooglePress={onGooglePress}
              onApplePress={onApplePress}
              loadingProvider={loadingProvider}
              googleReady={googleReady}
              appleReady={appleReady}
              googleHint={googleHint}
              appleHint={appleHint}
            />
          </View>
        ) : null}

        {showSocialLogin ? (
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>Or use email</Text>
            <View style={styles.dividerLine} />
          </View>
        ) : null}

        <View style={styles.form}>
          <Field
            label="Email"
            value={emailValue}
            error={getAuthFieldError(errors, "email")?.message}
            onChangeText={(text) => onChangeField("email", text)}
            icon="email-outline"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          {mode !== "forgot" ? (
            <>
              <Field
                label="Password"
                value={passwordValue}
                error={getAuthFieldError(errors, "password")?.message}
                onChangeText={(text) => onChangeField("password", text)}
                icon="lock-outline"
                secureTextEntry
                showToggle
                visible={showPassword}
                onToggle={onTogglePasswordVisibility}
                autoCapitalize="none"
              />

              {mode === "signup" && passwordValue ? (
                <View style={styles.passwordMeterBlock}>
                  <StrengthMeter strength={passwordStrength} />
                  <PasswordTips password={passwordValue} />
                  <Text style={styles.passwordHelp}>
                    {passwordMeta.helperText}
                  </Text>
                </View>
              ) : null}
            </>
          ) : null}

          {mode === "signup" ? (
            <View style={styles.signupExtras}>
              <Text style={styles.sectionLabel}>Finish your profile</Text>

              <Field
                label="Full name"
                value={nameValue}
                error={getAuthFieldError(errors, "name")?.message}
                onChangeText={(text) => onChangeField("name", text)}
                icon="account-outline"
                autoCapitalize="words"
              />

              <Field
                label="Confirm password"
                value={confirmPasswordValue}
                error={getAuthFieldError(errors, "confirmPassword")?.message}
                onChangeText={(text) => onChangeField("confirmPassword", text)}
                icon="lock-check-outline"
                secureTextEntry
                showToggle
                visible={showConfirmPassword}
                onToggle={onToggleConfirmPasswordVisibility}
                autoCapitalize="none"
              />

              <PressableScale
                style={styles.termsRow}
                onPress={onToggleAcceptedTerms}
              >
                {Platform.OS === "web" ? (
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      borderWidth: 2,
                      borderColor: acceptedTerms
                        ? colors.primary
                        : "rgba(148, 163, 184, 0.45)",
                      backgroundColor: acceptedTerms
                        ? colors.primary
                        : "transparent",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {acceptedTerms ? (
                      <MaterialCommunityIcons
                        name="check"
                        size={16}
                        color="#FFFFFF"
                      />
                    ) : null}
                  </View>
                ) : (
                  <Checkbox status={acceptedTerms ? "checked" : "unchecked"} />
                )}
                <Text style={styles.termsText}>I agree to Terms & Privacy</Text>
              </PressableScale>

              {errors.terms ? (
                <Text style={styles.formError}>{errors.terms.message}</Text>
              ) : null}

              <View style={styles.legalLinksRow}>
                <Text
                  style={styles.legalLink}
                  onPress={() => Linking.openURL(AUTH_TERMS_URL)}
                >
                  Terms
                </Text>
                <Text style={styles.legalSeparator}>•</Text>
                <Text
                  style={styles.legalLink}
                  onPress={() => Linking.openURL(AUTH_PRIVACY_URL)}
                >
                  Privacy Policy
                </Text>
              </View>
            </View>
          ) : null}

          {mode === "login" ? (
            <Text
              style={styles.forgotText}
              onPress={() => onChangeMode("forgot")}
            >
              Forgot password?
            </Text>
          ) : null}

          {errors.global ? (
            <Text style={styles.formError}>{errors.global.message}</Text>
          ) : null}

          {Platform.OS === "web" ? (
            <PressableScale
              onPress={onSubmit}
              disabled={isSubmitting || loadingProvider !== null}
              accessibilityRole="button"
              accessibilityState={{
                disabled: isSubmitting || loadingProvider !== null,
                busy: isSubmitting,
              }}
              style={[
                styles.submitButton,
                styles.webSubmitButton,
                (isSubmitting || loadingProvider !== null) &&
                  styles.submitButtonDisabled,
              ]}
            >
              <View style={styles.webSubmitContent}>
                {isSubmitting ? <ActivityIndicator color="#FFFFFF" /> : null}
                <Text style={styles.submitLabel}>{submitLabel}</Text>
              </View>
            </PressableScale>
          ) : (
            <Button
              mode="contained"
              onPress={onSubmit}
              loading={isSubmitting}
              disabled={isSubmitting || loadingProvider !== null}
              style={styles.submitButton}
              contentStyle={styles.submitContent}
              labelStyle={styles.submitLabel}
              buttonColor={colors.primary}
            >
              {submitLabel}
            </Button>
          )}

          <View style={styles.bottomRow}>
            <Text style={styles.bottomPrompt}>{switchPrompt}</Text>
            <PressableScale
              style={styles.bottomAction}
              onPress={() => onChangeMode(nextMode)}
            >
              <Text style={styles.bottomLink}>{switchLabel}</Text>
            </PressableScale>
          </View>

          <View style={styles.securityRow}>
            <MaterialCommunityIcons
              name="shield-check-outline"
              size={14}
              color={colors.textTertiary}
            />
            <Text style={styles.securityNote}>
              Encrypted on this device. Your session stays private.
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
});

const cardShadow =
  Platform.select({
    web: {
      boxShadow: "0px 20px 32px rgba(2, 6, 23, 0.18)",
    } as any,
    default: {
      shadowColor: "#020617",
      shadowOffset: { width: 0, height: 20 },
      shadowOpacity: 0.18,
      shadowRadius: 32,
      elevation: 6,
    },
  }) ?? {};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xl,
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.18)",
    ...cardShadow,
    overflow: "hidden",
  },
  cardGlow: {
    position: "absolute",
    top: -80,
    right: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(14, 165, 233, 0.08)",
  },
  cardInner: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "rgba(14, 165, 233, 0.1)",
  },
  badgeText: {
    color: colors.primary,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  header: {
    gap: 6,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.4,
  },
  subtitle: {
    color: "#475569",
    fontSize: 14,
    lineHeight: 20,
  },
  feedback: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  feedbackText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  socialSection: {
    gap: 10,
  },
  sectionLabel: {
    color: "#64748B",
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingTop: 2,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(148, 163, 184, 0.34)",
  },
  dividerText: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  form: {
    gap: spacing.sm,
  },
  fieldWrap: {
    gap: 6,
  },
  field: {
    backgroundColor: "#F8FAFC",
    borderRadius: 18,
  },
  webFieldLabel: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  webFieldShell: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.45)",
  },
  webFieldShellError: {
    borderColor: colors.error,
  },
  webFieldInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 16,
    color: "#0F172A",
    paddingVertical: 10,
    paddingHorizontal: 0,
  },
  errorText: {
    color: colors.error,
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 4,
  },
  passwordMeterBlock: {
    gap: 8,
    marginTop: 2,
    padding: 12,
    borderRadius: 18,
    backgroundColor: "rgba(248, 250, 252, 0.96)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.18)",
  },
  strengthWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  strengthBar: {
    flex: 1,
    flexDirection: "row",
    gap: 6,
  },
  strengthSegment: {
    flex: 1,
    height: 6,
    borderRadius: 999,
    backgroundColor: "rgba(148, 163, 184, 0.24)",
  },
  strengthLabel: {
    width: 68,
    textAlign: "right",
    fontSize: 12,
    fontWeight: "800",
  },
  tipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tipChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.18)",
  },
  tipChipText: {
    color: "#334155",
    fontSize: 11,
    fontWeight: "700",
  },
  passwordHelp: {
    fontSize: 12,
    lineHeight: 18,
    color: "#475569",
  },
  signupExtras: {
    gap: spacing.sm,
    paddingTop: 2,
    paddingBottom: 2,
  },
  termsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  termsText: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "600",
  },
  legalLinksRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  legalLink: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  legalSeparator: {
    color: "#94A3B8",
    fontSize: 12,
  },
  forgotText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700",
    alignSelf: "flex-start",
  },
  formError: {
    color: colors.error,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
  },
  submitButton: {
    marginTop: 2,
    borderRadius: 18,
  },
  webSubmitButton: {
    minHeight: 50,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  submitContent: {
    minHeight: 50,
  },
  submitLabel: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  webSubmitContent: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  submitButtonDisabled: {
    opacity: 0.72,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  bottomPrompt: {
    color: "#64748B",
    fontSize: 13,
    fontWeight: "600",
  },
  bottomAction: {
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  bottomLink: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "800",
  },
  securityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingTop: 4,
  },
  securityNote: {
    color: colors.textTertiary,
    fontSize: 12,
    lineHeight: 16,
  },
});

export default AuthFormCard;
