/**
 * Authentication Service (Compatibility Layer)
 *
 * The app now uses JWT sessions plus secure storage. This wrapper keeps
 * older callers working while delegating to the production auth service.
 */

import { authServiceV2, type LoginCredentials, type RegisterData } from "./authV2";
import { useAuthStore, User } from "@/stores/authStore";

export interface LoginPayload extends LoginCredentials {}

export interface RegisterPayload extends RegisterData {}

export const authService = {
  async login(payload: LoginPayload): Promise<void> {
    const user = await authServiceV2.login(payload);
    const { setToken, setUser } = useAuthStore.getState();
    await setToken("session-active");
    setUser(user);
  },

  async register(payload: RegisterPayload): Promise<void> {
    const user = await authServiceV2.register(payload);
    const { setToken, setUser } = useAuthStore.getState();
    await setToken("session-active");
    setUser(user);
  },

  async logout(): Promise<void> {
    try {
      await authServiceV2.logout();
    } finally {
      useAuthStore.getState().clearUser();
    }
  },

  async checkAuth(): Promise<boolean> {
    const user = await authServiceV2.checkAuth();

    if (!user) {
      return false;
    }

    const { setToken, setUser } = useAuthStore.getState();
    await setToken("session-active");
    setUser(user);
    return true;
  },
};

export default authService;