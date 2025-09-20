import { create } from "zustand";
import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5243/api";

export type UserRole = "Admin" | "Manager" | "Cashier";

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
}

type AuthState = {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  refresh: () => Promise<void>;
  initialise: () => void;
};

const storageKey = "litepos-auth";

export const authStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  loading: false,
  error: null,
  initialise: () => {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      set({
        user: parsed.user,
        accessToken: parsed.accessToken,
        refreshToken: parsed.refreshToken
      });
    }
  },
  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const response = await axios.post(`${BASE_URL}/auth/login`, { email, password });
      const data = response.data;
      const user: AuthUser = {
        id: data.userId,
        fullName: data.fullName,
        email: data.email,
        role: data.role
      };
      set({
        user,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        loading: false
      });
      localStorage.setItem(
        storageKey,
        JSON.stringify({ user, accessToken: data.accessToken, refreshToken: data.refreshToken })
      );
      return true;
    } catch (error: any) {
      set({ loading: false, error: error.response?.data?.message ?? "Unable to login" });
      return false;
    }
  },
  refresh: async () => {
    const token = get().refreshToken ?? JSON.parse(localStorage.getItem(storageKey) ?? "{}")?.refreshToken;
    if (!token) {
      throw new Error("No refresh token");
    }
    const response = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken: token });
    const data = response.data;
    const user: AuthUser = {
      id: data.userId,
      fullName: data.fullName,
      email: data.email,
      role: data.role
    };
    set({ user, accessToken: data.accessToken, refreshToken: data.refreshToken });
    localStorage.setItem(storageKey, JSON.stringify({ user, accessToken: data.accessToken, refreshToken: data.refreshToken }));
  },
  logout: () => {
    const refreshToken = get().refreshToken;
    if (refreshToken) {
      axios.post(`${BASE_URL}/auth/logout`, { refreshToken }).catch(() => undefined);
    }
    set({ user: null, accessToken: null, refreshToken: null, loading: false, error: null });
    localStorage.removeItem(storageKey);
  }
}));
