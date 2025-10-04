import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';
import { useAuthStore } from '../stores/authStore';

export interface PurchaseLine {
  id: string;
  productId: string;
  productName: string;
  barcode: string;
  quantity: number;
  unitCostUsd: number;
  unitCostLbp: number;
  totalCostUsd: number;
  totalCostLbp: number;
}

export interface Purchase {
  id: string;
  supplierName: string;
  reference?: string | null;
  orderedAt: string;
  receivedAt?: string | null;
  totalCostUsd: number;
  totalCostLbp: number;
  exchangeRateUsed: number;
  lines: PurchaseLine[];
}

export interface PurchaseItemInput {
  productId?: string;
  barcode: string;
  name?: string;
  sku?: string;
  categoryName?: string;
  quantity: number;
  unitCost: number;
  currency: 'USD' | 'LBP';
  salePriceUsd?: number;
}

export interface CreatePurchaseInput {
  supplierName?: string;
  reference?: string;
  purchasedAt?: string;
  exchangeRate: number;
  items: PurchaseItemInput[];
}

const purchasesKeys = {
  all: ['purchases'] as const,
  list: () => ['purchases', 'list'] as const
};

function useAuthToken() {
  return useAuthStore((state) => state.token);
}

export const PurchasesService = {
  usePurchases() {
    const token = useAuthToken();
    return useQuery<Purchase[]>({
      queryKey: [...purchasesKeys.list(), token],
      enabled: !!token,
      queryFn: async () => {
        return await apiFetch<Purchase[]>('/api/purchases', {}, token ?? undefined);
      }
    });
  },
  useCreatePurchase() {
    const token = useAuthToken();
    const queryClient = useQueryClient();
    return useMutation<Purchase, Error, CreatePurchaseInput>({
      mutationFn: async (input) => {
        return await apiFetch<Purchase>(
          '/api/purchases',
          {
            method: 'POST',
            body: JSON.stringify(input)
          },
          token ?? undefined
        );
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: purchasesKeys.all });
        queryClient.invalidateQueries({ queryKey: ['products'] });
      }
    });
  },
  keys: purchasesKeys
};

export type PurchasesServiceType = typeof PurchasesService;
