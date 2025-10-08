import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
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

const createMemoryStorage = (): StateStorage => {
  const storage: Record<string, string> = {};

  return {
    getItem: (name) => (Object.prototype.hasOwnProperty.call(storage, name) ? storage[name] : null),
    setItem: (name, value) => {
      storage[name] = value;
    },
    removeItem: (name) => {
      delete storage[name];
    }
  };
};

const fallbackStorage = createMemoryStorage();
let cachedStorage: StateStorage | null = null;
let warningLogged = false;

const logSessionStorageWarning = (error?: unknown) => {
  if (warningLogged) {
    return;
  }

  warningLogged = true;
  if (typeof error !== 'undefined') {
    console.debug('Session storage is unavailable, falling back to in-memory auth store.', error);
  } else {
    console.debug('Session storage is unavailable, falling back to in-memory auth store.');
  }
};

const resolveSessionStorage = (): StateStorage => {
  if (cachedStorage) {
    return cachedStorage;
  }

  if (typeof window !== 'undefined') {
    try {
      const { sessionStorage } = window;

      if (sessionStorage) {
        cachedStorage = sessionStorage;
        return cachedStorage;
      }
    } catch (error) {
      logSessionStorageWarning(error);
    }
  }

  logSessionStorageWarning();
  cachedStorage = fallbackStorage;
  return cachedStorage;
};

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
      storage: createJSONStorage(resolveSessionStorage)
    }
  )
);
