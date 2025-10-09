import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const generateLineId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

export interface CartItem {
  lineId: string;
  productId: string;
  name: string;
  sku?: string | null;
  barcode: string;
  priceUsd: number;
  priceLbp: number;
  quantity: number;
  discountPercent: number;
  isWaste: boolean;
}

export type CartItemInput = Omit<CartItem, 'lineId' | 'isWaste'> & {
  isWaste?: boolean;
};

interface CartState {
  items: CartItem[];
  rate: number;
  lastAddedItemId: string | null;
  addItem: (item: CartItemInput) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  setItemQuantity: (lineId: string, quantity: number) => void;
  updateDiscount: (lineId: string, discount: number) => void;
  removeItem: (lineId: string) => void;
  setItemWaste: (lineId: string, isWaste: boolean) => void;
  setRate: (rate: number) => void;
  clear: () => void;
  subtotalUsd: () => number;
  subtotalLbp: () => number;
  setLastAddedItemId: (lineId: string | null) => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      rate: 90000,
      lastAddedItemId: null,
      addItem: (item) => {
        const normalized: CartItem = {
          ...item,
          isWaste: item.isWaste ?? false,
          lineId: generateLineId()
        };
        const existingIndex = get().items.findIndex(
          (i) => i.productId === normalized.productId && i.isWaste === normalized.isWaste
        );
        if (existingIndex >= 0) {
          set((state) => {
            const items = [...state.items];
            const existing = items[existingIndex];
            const nextQuantity = existing.quantity + normalized.quantity;
            items[existingIndex] = {
              ...existing,
              quantity: nextQuantity
            };
            return { items, lastAddedItemId: existing.lineId };
          });
          return;
        }
        set((state) => ({
          items: [...state.items, normalized],
          lastAddedItemId: normalized.lineId
        }));
      },
      updateQuantity: (lineId, quantity) => get().setItemQuantity(lineId, quantity),
      setItemQuantity: (lineId, quantity) =>
        set((state) => {
          const index = state.items.findIndex((item) => item.lineId === lineId);
          if (index === -1) {
            return {};
          }
          const sanitizedQuantity = Math.max(1, Math.floor(quantity));
          const items = [...state.items];
          items[index] = { ...items[index], quantity: sanitizedQuantity };
          return { items };
        }),
      updateDiscount: (lineId, discount) => {
        set((state) => ({
          items: state.items.map((item) =>
            item.lineId === lineId ? { ...item, discountPercent: discount } : item
          )
        }));
      },
      removeItem: (lineId) => {
        set((state) => ({
          items: state.items.filter((item) => item.lineId !== lineId),
          lastAddedItemId: state.lastAddedItemId === lineId ? null : state.lastAddedItemId
        }));
      },
      setItemWaste: (lineId, isWaste) => {
        set((state) => {
          const index = state.items.findIndex((item) => item.lineId === lineId);
          if (index === -1) {
            return {};
          }
          const items = [...state.items];
          const currentItem = items[index];
          if (currentItem.isWaste === isWaste) {
            return {};
          }
          const updatedItem: CartItem = {
            ...currentItem,
            isWaste,
            discountPercent: isWaste ? 0 : currentItem.discountPercent
          };
          items.splice(index, 1);
          const mergeIndex = items.findIndex(
            (item) => item.productId === updatedItem.productId && item.isWaste === updatedItem.isWaste
          );
          if (mergeIndex >= 0) {
            const existing = items[mergeIndex];
            items[mergeIndex] = {
              ...existing,
              quantity: existing.quantity + updatedItem.quantity
            };
            return { items, lastAddedItemId: existing.lineId };
          }
          items.push(updatedItem);
          return { items, lastAddedItemId: updatedItem.lineId };
        });
      },
      setRate: (rate) => set({ rate }),
      clear: () => set({ items: [], lastAddedItemId: null }),
      subtotalUsd: () =>
        get().items.reduce(
          (total, item) =>
            total + (item.isWaste ? 0 : item.priceUsd * (1 - item.discountPercent / 100) * item.quantity),
          0
        ),
      subtotalLbp: () =>
        get().items.reduce(
          (total, item) =>
            total + (item.isWaste ? 0 : item.priceLbp * (1 - item.discountPercent / 100) * item.quantity),
          0
        ),
      setLastAddedItemId: (lineId) => set({ lastAddedItemId: lineId })
    }),
    {
      name: 'aurora-cart',
      version: 2,
      migrate: (persistedState) => {
        if (!persistedState || typeof persistedState !== 'object') {
          return persistedState;
        }
        const state = persistedState as Partial<CartState> & { items?: unknown };
        const items = Array.isArray(state.items)
          ? (state.items as CartItem[]).map((item) => ({
              ...item,
              sku: item.sku && String(item.sku).trim() ? String(item.sku) : undefined,
              lineId: item.lineId ?? generateLineId(),
              isWaste: Boolean(item.isWaste)
            }))
          : [];
        return {
          ...state,
          items,
          lastAddedItemId: null
        } satisfies CartState;
      }
    }
  )
);
