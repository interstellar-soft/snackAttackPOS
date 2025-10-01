import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartItem {
  productId: string;
  name: string;
  sku: string;
  barcode: string;
  priceUsd: number;
  priceLbp: number;
  quantity: number;
  discountPercent: number;
}

interface CartState {
  items: CartItem[];
  rate: number;
  addItem: (item: CartItem) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  updateDiscount: (productId: string, discount: number) => void;
  removeItem: (productId: string) => void;
  setRate: (rate: number) => void;
  clear: () => void;
  subtotalUsd: () => number;
  subtotalLbp: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      rate: 90000,
      addItem: (item) => {
        const existing = get().items.find((i) => i.productId === item.productId);
        if (existing) {
          set({
            items: get().items.map((i) =>
              i.productId === item.productId
                ? { ...i, quantity: i.quantity + item.quantity }
                : i
            )
          });
        } else {
          set({ items: [...get().items, item] });
        }
      },
      updateQuantity: (productId, quantity) => {
        set({
          items: get().items.map((item) =>
            item.productId === productId ? { ...item, quantity } : item
          )
        });
      },
      updateDiscount: (productId, discount) => {
        set({
          items: get().items.map((item) =>
            item.productId === productId ? { ...item, discountPercent: discount } : item
          )
        });
      },
      removeItem: (productId) => {
        set({ items: get().items.filter((item) => item.productId !== productId) });
      },
      setRate: (rate) => set({ rate }),
      clear: () => set({ items: [] }),
      subtotalUsd: () =>
        get()
          .items.reduce((total, item) => total + item.priceUsd * (1 - item.discountPercent / 100) * item.quantity, 0),
      subtotalLbp: () =>
        get()
          .items.reduce((total, item) => total + item.priceLbp * (1 - item.discountPercent / 100) * item.quantity, 0)
    }),
    {
      name: 'aurora-cart'
    }
  )
);
