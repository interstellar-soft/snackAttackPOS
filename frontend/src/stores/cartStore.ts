import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const generateLineId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

const clampUsd = (value: number | null | undefined) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  return Math.round(value * 100) / 100;
};

const clampLbp = (value: number | null | undefined) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  return Math.round(value);
};

const normalizeCostUsd = (value: number) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }
  return Math.round(value * 100) / 100;
};

const normalizeCostLbp = (value: number) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }
  return Math.round(value);
};

export interface CartItem {
  lineId: string;
  productId: string;
  name: string;
  sku?: string | null;
  barcode: string;
  priceUsd: number;
  priceLbp: number;
  costUsd: number;
  costLbp: number;
  quantity: number;
  discountPercent: number;
  isWaste: boolean;
  manualTotalUsd?: number | null;
  manualTotalLbp?: number | null;
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
  setItemManualTotals: (
    lineId: string,
    totals: { totalUsd?: number | null; totalLbp?: number | null }
  ) => void;
  setCartManualTotals: (totals: { totalUsd?: number | null; totalLbp?: number | null }) => void;
  clearCartManualTotals: () => void;
  setRate: (rate: number) => void;
  clear: () => void;
  subtotalUsd: () => number;
  subtotalLbp: () => number;
  setLastAddedItemId: (lineId: string | null) => void;
  manualCartTotalUsd: number | null;
  manualCartTotalLbp: number | null;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      rate: 90000,
      lastAddedItemId: null,
      manualCartTotalUsd: null,
      manualCartTotalLbp: null,
      addItem: (item) => {
        const normalized: CartItem = {
          ...item,
          isWaste: item.isWaste ?? false,
          lineId: generateLineId(),
          costUsd: normalizeCostUsd(item.costUsd),
          costLbp: normalizeCostLbp(item.costLbp),
          manualTotalUsd: clampUsd(item.manualTotalUsd),
          manualTotalLbp: clampLbp(item.manualTotalLbp)
        };
        const existingIndex = get().items.findIndex(
          (i) =>
            i.productId === normalized.productId &&
            i.isWaste === normalized.isWaste &&
            i.barcode === normalized.barcode &&
            i.priceUsd === normalized.priceUsd &&
            i.priceLbp === normalized.priceLbp
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
            discountPercent: isWaste ? 0 : currentItem.discountPercent,
            manualTotalUsd: isWaste ? null : currentItem.manualTotalUsd,
            manualTotalLbp: isWaste ? null : currentItem.manualTotalLbp
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
      setItemManualTotals: (lineId, totals) =>
        set((state) => {
          const index = state.items.findIndex((item) => item.lineId === lineId);
          if (index === -1) {
            return {};
          }
          const items = [...state.items];
          const current = items[index];
          const nextUsd =
            Object.prototype.hasOwnProperty.call(totals, 'totalUsd')
              ? clampUsd(totals.totalUsd ?? null)
              : current.manualTotalUsd ?? null;
          const nextLbp =
            Object.prototype.hasOwnProperty.call(totals, 'totalLbp')
              ? clampLbp(totals.totalLbp ?? null)
              : current.manualTotalLbp ?? null;
          items[index] = {
            ...current,
            manualTotalUsd: current.isWaste ? null : nextUsd,
            manualTotalLbp: current.isWaste ? null : nextLbp
          };
          return { items };
        }),
      setCartManualTotals: (totals) =>
        set((state) => {
          const nextUsd = Object.prototype.hasOwnProperty.call(totals, 'totalUsd')
            ? clampUsd(totals.totalUsd ?? null)
            : state.manualCartTotalUsd;
          const nextLbp = Object.prototype.hasOwnProperty.call(totals, 'totalLbp')
            ? clampLbp(totals.totalLbp ?? null)
            : state.manualCartTotalLbp;
          return {
            manualCartTotalUsd: nextUsd,
            manualCartTotalLbp: nextLbp
          };
        }),
      clearCartManualTotals: () => set({ manualCartTotalUsd: null, manualCartTotalLbp: null }),
      setRate: (rate) => set({ rate }),
      clear: () =>
        set({
          items: [],
          lastAddedItemId: null,
          manualCartTotalUsd: null,
          manualCartTotalLbp: null
        }),
      subtotalUsd: () => {
        const state = get();
        const { rate } = state;
        if (state.manualCartTotalUsd !== null) {
          return state.manualCartTotalUsd;
        }
        if (state.manualCartTotalLbp !== null && rate > 0) {
          return Math.round((state.manualCartTotalLbp / rate) * 100) / 100;
        }
        return state.items.reduce((total, item) => {
          if (item.isWaste) {
            return total;
          }
          if (item.manualTotalUsd !== null && item.manualTotalUsd !== undefined) {
            return total + item.manualTotalUsd;
          }
          if (item.manualTotalLbp !== null && item.manualTotalLbp !== undefined && rate > 0) {
            return total + Math.round((item.manualTotalLbp / rate) * 100) / 100;
          }
          const discountedPriceUsd = item.priceUsd * (1 - item.discountPercent / 100);
          return total + discountedPriceUsd * item.quantity;
        }, 0);
      },
      subtotalLbp: () => {
        const state = get();
        const { rate } = state;
        if (state.manualCartTotalLbp !== null) {
          return state.manualCartTotalLbp;
        }
        if (state.manualCartTotalUsd !== null) {
          return Math.round(state.manualCartTotalUsd * rate);
        }
        return state.items.reduce((total, item) => {
          if (item.isWaste) {
            return total;
          }
          if (item.manualTotalLbp !== null && item.manualTotalLbp !== undefined) {
            return total + item.manualTotalLbp;
          }
          if (item.manualTotalUsd !== null && item.manualTotalUsd !== undefined) {
            return total + Math.round(item.manualTotalUsd * rate);
          }
          const discountedPriceLbp = item.priceLbp * (1 - item.discountPercent / 100);
          return total + discountedPriceLbp * item.quantity;
        }, 0);
      },
      setLastAddedItemId: (lineId) => set({ lastAddedItemId: lineId })
    }),
    {
      name: 'aurora-cart',
      version: 4,
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
              isWaste: Boolean(item.isWaste),
              costUsd: normalizeCostUsd(
                item.costUsd ?? (typeof item.priceUsd === 'number' ? item.priceUsd : 0)
              ),
              costLbp: normalizeCostLbp(
                item.costLbp ?? (typeof item.priceLbp === 'number' ? item.priceLbp : 0)
              ),
              manualTotalUsd:
                item.manualTotalUsd !== undefined && item.manualTotalUsd !== null
                  ? clampUsd(Number(item.manualTotalUsd))
                  : null,
              manualTotalLbp:
                item.manualTotalLbp !== undefined && item.manualTotalLbp !== null
                  ? clampLbp(Number(item.manualTotalLbp))
                  : null
            }))
          : [];
        return {
          ...state,
          items,
          lastAddedItemId: null,
          manualCartTotalUsd:
            state.manualCartTotalUsd !== undefined && state.manualCartTotalUsd !== null
              ? clampUsd(Number(state.manualCartTotalUsd))
              : null,
          manualCartTotalLbp:
            state.manualCartTotalLbp !== undefined && state.manualCartTotalLbp !== null
              ? clampLbp(Number(state.manualCartTotalLbp))
              : null
        } satisfies CartState;
      }
    }
  )
);
