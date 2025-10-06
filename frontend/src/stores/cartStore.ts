import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartItem {
  productId: string;
  name: string;
  sku?: string | null;
  barcode: string;
  priceUsd: number;
  priceLbp: number;
  quantity: number;
  discountPercent: number;
}

interface CartState {
  items: CartItem[];
  rate: number;
  lastAddedItemId: string | null;
  addItem: (item: CartItem) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  setItemQuantity: (productId: string, quantity: number) => void;
  updateDiscount: (productId: string, discount: number) => void;
  removeItem: (productId: string) => void;
  setRate: (rate: number) => void;
  clear: () => void;
  subtotalUsd: () => number;
  subtotalLbp: () => number;
  setLastAddedItemId: (productId: string | null) => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      rate: 90000,
      lastAddedItemId: null,
      addItem: (item) => {
        const existing = get().items.find((i) => i.productId === item.productId);
        if (existing) {
          set((state) => {
            const items = state.items.map((i) =>
              i.productId === item.productId
                ? { ...i, quantity: i.quantity + item.quantity }
                : i
            );
            return { items, lastAddedItemId: item.productId };
          });
        } else {
          set((state) => ({
            items: [...state.items, item],
            lastAddedItemId: item.productId
          }));
        }
      },
      updateQuantity: (productId, quantity) => get().setItemQuantity(productId, quantity),
      setItemQuantity: (productId, quantity) =>
        set((state) => {
          const index = state.items.findIndex((item) => item.productId === productId);
          if (index === -1) {
            return {};
          }
          const sanitizedQuantity = Math.max(1, Math.floor(quantity));
          const items = [...state.items];
          items[index] = { ...items[index], quantity: sanitizedQuantity };
          return { items };
        }),
      updateDiscount: (productId, discount) => {
        set({
          items: get().items.map((item) =>
            item.productId === productId ? { ...item, discountPercent: discount } : item
          )
        });
      },
      removeItem: (productId) => {
        set((state) => ({
          items: state.items.filter((item) => item.productId !== productId),
          lastAddedItemId:
            state.lastAddedItemId === productId ? null : state.lastAddedItemId
        }));
      },
      setRate: (rate) => set({ rate }),
      clear: () => set({ items: [], lastAddedItemId: null }),
      subtotalUsd: () =>
        get()
          .items.reduce((total, item) => total + item.priceUsd * (1 - item.discountPercent / 100) * item.quantity, 0),
      subtotalLbp: () =>
        get()
          .items.reduce((total, item) => total + item.priceLbp * (1 - item.discountPercent / 100) * item.quantity, 0),
      setLastAddedItemId: (productId) => set({ lastAddedItemId: productId })
    }),
    {
      name: 'aurora-cart',
      version: 1,
      migrate: (persistedState) => {
        if (!persistedState || typeof persistedState !== 'object') {
          return persistedState;
        }
        const state = persistedState as CartState;
        const items = Array.isArray(state.items)
          ? state.items.map((item) => ({
              ...item,
              sku: item.sku && String(item.sku).trim() ? String(item.sku) : undefined
            }))
          : [];
        return {
          ...state,
          items
        } satisfies CartState;
      }
    }
  )
);
