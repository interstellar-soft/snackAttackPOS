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
const resolveSessionStorage = (): StateStorage | undefined => {
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
  }

  return undefined;
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
const sessionStorageInstance = resolveSessionStorage();

export const useAuthStore = create<AuthState>()(
  sessionStorageInstance
    ? persist(authStoreCreator, {
        name: 'aurora-auth',
        storage: createJSONStorage(() => sessionStorageInstance)
      })
    : authStoreCreator
);
