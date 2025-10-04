import { create } from 'zustand';

export const DEFAULT_STORE_NAME = 'Aurora Market';

interface StoreProfileState {
  name: string;
  setName: (name: string) => void;
}

export const useStoreProfileStore = create<StoreProfileState>((set) => ({
  name: DEFAULT_STORE_NAME,
  setName: (name: string) => set({ name: name.trim() || DEFAULT_STORE_NAME })
}));
