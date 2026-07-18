import type {
  AuthErrorCode,
  AuthErrors,
  AuthFieldName,
  AuthMode,
  AuthModeCopy,
  AuthValues,
  FieldError,
  PasswordStrength,
  PasswordStrengthMeta,
} from "./types";

function createFieldError(message: string, code?: AuthErrorCode): FieldError {
  return {
    message,
    code,
    source: "client",
  };
}

export function createEmptyAuthErrors(): AuthErrors {
  return { fields: {} };
}

export function getAuthFieldError(
  errors: AuthErrors,
  field: AuthFieldName,
): FieldError | undefined {
  return errors.fields[field];
}

export function clearAuthFieldError(
  errors: AuthErrors,
  field: AuthFieldName,
): AuthErrors {
  if (!errors.fields[field]) {
    return errors;
  }

  const nextFields = { ...errors.fields };
  delete nextFields[field];

  return {
    ...errors,
    fields: nextFields,
    global:
      field === "email" || field === "password" ? undefined : errors.global,
    terms: field === "confirmPassword" ? undefined : errors.terms,
  };
}

export function createAuthValues(
  mode: AuthMode,
  seed?: Partial<{
    name: string;
    email: string;
    password: string;
    confirmPassword: string;
  }>,
): AuthValues {
  const email = seed?.email ?? "";

  switch (mode) {
    case "signup":
      return {
        mode,
        name: seed?.name ?? "",
        email,
        password: seed?.password ?? "",
        confirmPassword: seed?.confirmPassword ?? "",
      };
    case "forgot":
      return {
        mode,
        email,
      };
    case "login":
    default:
      return {
        mode,
        email,
        password: seed?.password ?? "",
      };
  }
}

export function transitionAuthValues(
  current: AuthValues,
  nextMode: AuthMode,
): AuthValues {
  const email = getAuthValue(current, "email");
  const name = getAuthValue(current, "name");
  const password = getAuthValue(current, "password");
  const confirmPassword = getAuthValue(current, "confirmPassword");

  switch (nextMode) {
    case "signup":
      return {
        mode: "signup",
        name: current.mode === "signup" ? name : "",
        email,
        password: current.mode === "forgot" ? "" : password,
        confirmPassword: current.mode === "signup" ? confirmPassword : "",
      };
    case "forgot":
      return {
        mode: "forgot",
        email,
      };
    case "login":
    default:
      return {
        mode: "login",
        email,
        password,
      };
  }
}

export function getAuthValue(values: AuthValues, field: AuthFieldName): string {
  switch (values.mode) {
    case "signup":
      return values[field] ?? "";
    case "login":
      if (field === "name" || field === "confirmPassword") {
        return "";
      }
      return values[field] ?? "";
    case "forgot":
      return field === "email" ? values.email : "";
  }
}

export function setAuthValue(
  values: AuthValues,
  field: AuthFieldName,
  value: string,
): AuthValues {
  switch (values.mode) {
    case "signup":
      return {
        ...values,
        [field]: value,
      };
    case "login":
      if (field === "name" || field === "confirmPassword") {
        return values;
      }

      return {
        ...values,
        [field]: value,
      };
    case "forgot":
      if (field !== "email") {
        return values;
      }

      return {
        ...values,
        email: value,
      };
  }
}

export function normalizeEmail(email: string): string {
  return email.normalize("NFKC").trim().toLowerCase();
}

export function validateEmail(email: string): boolean {
  const normalized = normalizeEmail(email);
  const parts = normalized.split("@");

  if (parts.length !== 2) {
    return false;
  }

  const [localPart, domainPart] = parts;
  return Boolean(localPart && domainPart.includes("."));
}

export function calculatePasswordStrength(password: string): PasswordStrength {
  if (!password) {
    return {
      score: 0,
      level: "empty",
    };
  }

  let score = 0;
  const checks = {
    length: password.length >= 8,
    mixedCase: /[A-Z]/.test(password) && /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
  };

  score += checks.length ? 1 : 0;
  score += checks.mixedCase ? 1 : 0;
  score += checks.number ? 1 : 0;
  score += checks.symbol ? 1 : 0;

  if (score <= 1) {
    return {
      score,
      level: "weak",
    };
  }

  if (score === 2) {
    return {
      score,
      level: "fair",
    };
  }

  if (score === 3) {
    return {
      score,
      level: "good",
    };
  }

  return {
    score,
    level: "strong",
  };
}

export function getPasswordStrengthMeta(
  strength: PasswordStrength,
): PasswordStrengthMeta {
  switch (strength.level) {
    case "empty":
      return {
        label: "Empty",
        color: "#94A3B8",
        helperText: "Use at least 8 characters, with a number and a symbol.",
      };
    case "weak":
      return {
        label: "Needs work",
        color: "#EF4444",
        helperText: "Add more characters and mix in a number or symbol.",
      };
    case "fair":
      return {
        label: "Okay",
        color: "#F97316",
        helperText: "You are close. Add a symbol or another word for safety.",
      };
    case "good":
      return {
        label: "Strong",
        color: "#10B981",
        helperText: "Strong enough for a secure travel session.",
      };
    case "strong":
    default:
      return {
        label: "Very strong",
        color: "#0EA5E9",
        helperText:
          "Excellent. This password is ready for long-lived sessions.",
      };
  }
}

export function validateAuthForm(
  mode: AuthMode,
  values: AuthValues,
  acceptedTerms: boolean,
): AuthErrors {
  const errors: AuthErrors = { fields: {} };

  const email = getAuthValue(values, "email");
  const password = getAuthValue(values, "password");
  const name = getAuthValue(values, "name");
  const confirmPassword = getAuthValue(values, "confirmPassword");

  if (mode === "signup") {
    if (!name.trim()) {
      errors.fields.name = createFieldError("Name is required", "REQUIRED");
    } else if (name.trim().length < 2) {
      errors.fields.name = createFieldError(
        "Name must be at least 2 characters",
        "REQUIRED",
      );
    }
  }

  if (!email.trim()) {
    errors.fields.email = createFieldError("Email is required", "REQUIRED");
  } else if (!validateEmail(email)) {
    errors.fields.email = createFieldError(
      "Enter a valid email address",
      "INVALID_EMAIL",
    );
  }

  if (mode !== "forgot") {
    if (!password) {
      errors.fields.password = createFieldError(
        "Password is required",
        "REQUIRED",
      );
    } else if (password.length < 8) {
      errors.fields.password = createFieldError(
        "Password must be at least 8 characters",
        "PASSWORD_TOO_SHORT",
      );
    }
  }

  if (mode === "signup") {
    if (!confirmPassword) {
      errors.fields.confirmPassword = createFieldError(
        "Please confirm your password",
        "REQUIRED",
      );
    } else if (password !== confirmPassword) {
      errors.fields.confirmPassword = createFieldError(
        "Passwords do not match",
        "PASSWORD_MISMATCH",
      );
    }

    if (!acceptedTerms) {
      errors.terms = createFieldError(
        "Please accept the Terms and Privacy Policy to continue",
        "TERMS_REQUIRED",
      );
    }
  }

  return errors;
}

export function getAuthModeCopy(mode: AuthMode): AuthModeCopy {
  switch (mode) {
    case "signup":
      return {
        title: "Create account",
        subtitle: "Get started in seconds.",
        submitLabel: "Get started",
        switchLabel: "Sign in",
        switchPrompt: "Already have an account?",
      };
    case "forgot":
      return {
        title: "Reset password",
        subtitle: "We’ll send a reset link.",
        submitLabel: "Send link",
        switchLabel: "Sign in",
        switchPrompt: "Remember your password?",
      };
    case "login":
    default:
      return {
        title: "Welcome back",
        subtitle: "Sign in to continue.",
        submitLabel: "Continue",
        switchLabel: "Create account",
        switchPrompt: "New to TimeToTravel?",
      };
  }
}

export function formatDisplayName(
  fullName?: { givenName?: string | null; familyName?: string | null } | null,
): string {
  const parts = [
    fullName?.givenName?.trim(),
    fullName?.familyName?.trim(),
  ].filter(Boolean);
  if (parts.length > 0) {
    return parts.join(" ");
  }
  return "Guest";
}
