import { create, type StateCreator } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

import type { StateStorage } from 'zustand/middleware';
import { apiFetch, type LoginResponse } from '../lib/api';

interface AuthState {
  token: string | null;
  displayName: string | null;
  role: string | null;
  isLoading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const createMemoryStorage = (): Storage => {
  const storage: Record<string, string> = {};

  return {
    getItem: (name: string) => (name in storage ? storage[name] : null),
    setItem: (name: string, value: string) => {
      storage[name] = value;
    },
    removeItem: (name: string) => {
      delete storage[name];
    },
    clear: () => {
      Object.keys(storage).forEach((key) => {
        delete storage[key];
      });
    },
    key: (index: number) => Object.keys(storage)[index] ?? null,
    get length() {
      return Object.keys(storage).length;
    }
  } as Storage;
};

let cachedSessionStorage: StateStorage | null = null;
let sessionStorageWarningLogged = false;

const resolveSessionStorage = (): StateStorage => {
  if (cachedSessionStorage) {
    return cachedSessionStorage;
  }

  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      cachedSessionStorage = window.sessionStorage;
      return cachedSessionStorage;
    }
  } catch (error) {
    if (!sessionStorageWarningLogged) {
      sessionStorageWarningLogged = true;
      console.debug(
        'Session storage is unavailable, falling back to in-memory auth store.',
        error
      );
    }
  }

  if (!sessionStorageWarningLogged) {
    sessionStorageWarningLogged = true;
    console.debug('Session storage is unavailable, falling back to in-memory auth store.');
  }

  cachedSessionStorage = createMemoryStorage();
  return cachedSessionStorage;
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
