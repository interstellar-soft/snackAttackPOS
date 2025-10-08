import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { apiFetch, LoginResponse } from '../lib/api';

interface AuthState {
  token: string | null;
  displayName: string | null;
  role: string | null;
  isLoading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const noopStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
  clear: () => undefined,
  key: () => null,
  length: 0
} as Storage;

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      displayName: null,
      role: null,
      isLoading: false,
      error: null,
      login: async (username: string, password: string) => {
        try {
          set({ isLoading: true, error: null });
          const response = await apiFetch<LoginResponse>('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
          });
          set({
            token: response.token,
            displayName: response.displayName,
            role: response.role,
            isLoading: false
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Login failed',
            isLoading: false,
            token: null,
            displayName: null,
            role: null
          });
          throw error;
        }
      },
      logout: () => set({ token: null, displayName: null, role: null })
    }),
    {
      name: 'aurora-auth',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' ? window.sessionStorage : noopStorage
      )
    }
  )
);
