export type AuthMode = "login" | "signup" | "forgot";

export type AuthProvider = "google" | "apple";

export type AuthFieldName = "name" | "email" | "password" | "confirmPassword";

export type AuthErrorCode =
  | "REQUIRED"
  | "INVALID_EMAIL"
  | "PASSWORD_TOO_SHORT"
  | "PASSWORD_MISMATCH"
  | "TERMS_REQUIRED"
  | "INVALID_RESPONSE"
  | "NETWORK"
  | "UNKNOWN";

export type AuthFeedbackSource = "client" | "server" | "network" | "provider";

export interface FieldError {
  message: string;
  code?: AuthErrorCode;
  source?: AuthFeedbackSource;
}

export interface AuthErrors {
  fields: Partial<Record<AuthFieldName, FieldError>>;
  global?: FieldError;
  terms?: FieldError;
}

export type PasswordStrengthLevel =
  | "empty"
  | "weak"
  | "fair"
  | "good"
  | "strong";

export interface PasswordStrength {
  score: number;
  level: PasswordStrengthLevel;
}

export interface PasswordStrengthMeta {
  label: string;
  color: string;
  helperText: string;
}

export interface AuthFeedback {
  type: "success" | "error" | "info";
  message: string;
  code?: AuthErrorCode | string;
  retryable?: boolean;
  source?: AuthFeedbackSource;
}

export interface LoginValues {
  mode: "login";
  email: string;
  password: string;
}

export interface SignupValues {
  mode: "signup";
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface ForgotValues {
  mode: "forgot";
  email: string;
}

export type AuthValues = LoginValues | SignupValues | ForgotValues;

export interface AuthModeCopy {
  title: string;
  subtitle: string;
  submitLabel: string;
  switchLabel: string;
  switchPrompt: string;
}

export interface OAuthClientConfig {
  webClientId?: string;
  iosClientId?: string;
  androidClientId?: string;
  expoClientId?: string;
}

export interface UserPreferences extends Record<string, unknown> {
  onboarded?: boolean;
}

export interface OAuthUserPayload {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  avatar_url?: string;
  preferences?: UserPreferences;
}

export interface TokenBundle {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  issued_at?: number;
  scope?: string | null;
  id_token?: string | null;
}

export type OAuthExchangeResponse =
  | {
      success: true;
      user: OAuthUserPayload;
      tokens: TokenBundle;
    }
  | {
      success: false;
      error: string;
      user?: never;
      tokens?: never;
    };

export interface GoogleExchangePayload {
  access_token: string;
  id_token?: string | null;
}

export interface AppleExchangePayload {
  identity_token: string;
  authorization_code?: string | null;
  email?: string | null;
  name?: string | null;
  nonce?: string | null;
}
