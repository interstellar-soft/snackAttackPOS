import { create } from 'zustand';
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

const createMemoryStorage = (): StateStorage => {
  const storage: Record<string, string> = {};

  return {
    getItem: (name) => {
      if (Object.prototype.hasOwnProperty.call(storage, name)) {
        return storage[name];
      }

      return null;
    },
    setItem: (name, value) => {
      storage[name] = value;
    },
    removeItem: (name) => {
      delete storage[name];
    }
  };
};

const fallbackStorage = createMemoryStorage();
let sessionStorageWarningLogged = false;

const getSessionStorage = (): StateStorage | null => {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      return window.sessionStorage;
    }
  } catch (error) {
    if (!sessionStorageWarningLogged) {
      sessionStorageWarningLogged = true;
      // Some runtimes (such as private browsing) can throw when sessionStorage is accessed.
      console.debug('Session storage is unavailable, falling back to in-memory auth store.', error);
    }
  }

  if (typeof sessionStorage !== 'undefined') {
    return sessionStorage;
  }

  return null;
};

const sessionAwareStorage = createJSONStorage<AuthState>(() => getSessionStorage() ?? fallbackStorage);

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
      storage: sessionAwareStorage
    }
  )
);
