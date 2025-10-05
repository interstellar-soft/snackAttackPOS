import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const DEFAULT_STORE_NAME = 'Aurora Market';

interface StoreProfileState {
  name: string;
  setName: (name: string) => void;
}

export const useStoreProfileStore = create<StoreProfileState>()(
  persist(
    (set) => ({
      name: DEFAULT_STORE_NAME,
      setName: (name: string) => {
        const trimmedName = name.trim();
        set({ name: trimmedName || DEFAULT_STORE_NAME });
      }
    }),
    { name: 'store-profile' }
  )
);
