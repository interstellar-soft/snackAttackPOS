import { create, type StateCreator } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { StateStorage } from 'zustand/middleware';
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

const createNoopStorage = (): StateStorage => ({
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined
});

const resolveSessionStorage = (): StateStorage => {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    return window.sessionStorage;
  }

  if (typeof globalThis !== 'undefined') {
    const { sessionStorage } = globalThis as unknown as {
      sessionStorage?: StateStorage;
    };

    if (sessionStorage) {
      return sessionStorage;
    }
  }

  return createNoopStorage();
};

const authStoreCreator: StateCreator<AuthState> = (set) => ({
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
});

export const useAuthStore = create<AuthState>()(
  persist(authStoreCreator, {
    name: 'aurora-auth',
    storage: createJSONStorage(resolveSessionStorage)
  })
);
