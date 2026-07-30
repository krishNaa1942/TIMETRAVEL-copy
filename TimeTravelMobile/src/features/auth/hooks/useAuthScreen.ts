import { useCallback, useMemo, useState } from "react";

import { useNetInfo } from "@react-native-community/netinfo";

import { ApiError } from "@/services/apiClient";
import { authServiceV2 } from "@/services/authV2";

import { requestPasswordReset } from "../services/socialAuthService";
import {
  clearAuthFieldError,
  createAuthValues,
  createEmptyAuthErrors,
  getAuthModeCopy,
  getAuthValue,
  normalizeEmail,
  setAuthValue,
  transitionAuthValues,
  validateAuthForm,
} from "../utils";
import type {
  AuthFieldName,
  AuthErrors,
  AuthFeedback,
  AuthMode,
  AuthValues,
} from "../types";

export interface UseAuthScreenResult {
  mode: AuthMode;
  submitLabel: string;
  switchLabel: string;
  switchPrompt: string;
  values: AuthValues;
  errors: AuthErrors;
  feedback: AuthFeedback | null;
  isSubmitting: boolean;
  showPassword: boolean;
  showConfirmPassword: boolean;
  acceptedTerms: boolean;
  setMode: (mode: AuthMode) => void;
  updateField: (field: AuthFieldName, value: string) => void;
  toggleAcceptedTerms: () => void;
  togglePasswordVisibility: () => void;
  toggleConfirmPasswordVisibility: () => void;
  submit: () => Promise<void>;
}

export function useAuthScreen(): UseAuthScreenResult {
  const [mode, setMode] = useState<AuthMode>("login");
  const [values, setValues] = useState<AuthValues>(() =>
    createAuthValues("login"),
  );
  const [errors, setErrors] = useState<AuthErrors>(() =>
    createEmptyAuthErrors(),
  );
  const [feedback, setFeedback] = useState<AuthFeedback | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const netInfo = useNetInfo();
  const isOffline =
    netInfo.isConnected === false || netInfo.isInternetReachable === false;
  const modeCopy = useMemo(() => getAuthModeCopy(mode), [mode]);

  const updateField = useCallback((field: AuthFieldName, value: string) => {
    setValues((current) => setAuthValue(current, field, value));
    setErrors((current) => clearAuthFieldError(current, field));
    setFeedback(null);
  }, []);

  const changeMode = useCallback((nextMode: AuthMode) => {
    setMode(nextMode);
    setErrors(createEmptyAuthErrors());
    setFeedback(null);
    setValues((current) => transitionAuthValues(current, nextMode));
    if (nextMode !== "signup") {
      setAcceptedTerms(false);
    }
  }, []);

  const toggleAcceptedTerms = useCallback(() => {
    setAcceptedTerms((current) => !current);
    setErrors((current) => ({ ...current, terms: undefined }));
  }, []);

  const togglePasswordVisibility = useCallback(() => {
    setShowPassword((current) => !current);
  }, []);

  const toggleConfirmPasswordVisibility = useCallback(() => {
    setShowConfirmPassword((current) => !current);
  }, []);

  const submit = useCallback(async () => {
    if (isSubmitting) return;

    if (isOffline) {
      setFeedback({
        type: "error",
        message: "You're offline. Connect to continue.",
        code: "NETWORK",
        retryable: true,
        source: "network",
      });
      return;
    }

    const validationErrors = validateAuthForm(mode, values, acceptedTerms);
    if (
      Object.keys(validationErrors.fields).length > 0 ||
      validationErrors.global ||
      validationErrors.terms
    ) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      if (mode === "forgot") {
        const message = await requestPasswordReset(
          getAuthValue(values, "email"),
        );
        setFeedback({
          type: "success",
          message,
          code: "RESET_LINK_SENT",
          source: "server",
        });
        setErrors(createEmptyAuthErrors());
        setValues((current) =>
          createAuthValues("login", { email: getAuthValue(current, "email") }),
        );
        setMode("login");
        return;
      }

      const email = normalizeEmail(getAuthValue(values, "email"));

      if (mode === "signup") {
        await authServiceV2.register({
          name: getAuthValue(values, "name").trim(),
          email,
          password: getAuthValue(values, "password"),
        });
      } else {
        await authServiceV2.login({
          email,
          password: getAuthValue(values, "password"),
        });
      }

      setFeedback({
        type: "success",
        message:
          mode === "signup"
            ? "Account created. Redirecting..."
            : "Signed in successfully.",
        code: mode === "signup" ? "ACCOUNT_CREATED" : "SIGNED_IN",
        source: "server",
      });
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.userMessage
          : error instanceof Error
            ? error.message
            : "Authentication failed";
      setFeedback({
        type: "error",
        message,
        code: error instanceof ApiError ? (error.code ?? "UNKNOWN") : "UNKNOWN",
        retryable: error instanceof ApiError ? Boolean(error.retryable) : true,
        source: error instanceof ApiError ? "server" : "client",
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [acceptedTerms, isOffline, isSubmitting, mode, values]);

  return {
    mode,
    submitLabel: modeCopy.submitLabel,
    switchLabel: modeCopy.switchLabel,
    switchPrompt: modeCopy.switchPrompt,
    values,
    errors,
    feedback,
    isSubmitting,
    showPassword,
    showConfirmPassword,
    acceptedTerms,
    setMode: changeMode,
    updateField,
    toggleAcceptedTerms,
    togglePasswordVisibility,
    toggleConfirmPasswordVisibility,
    submit,
  };
}

export default useAuthScreen;
