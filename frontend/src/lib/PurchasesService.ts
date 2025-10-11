import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';
import { useAuthStore } from '../stores/authStore';

export interface PurchaseLine {
  id: string;
  productId: string;
  productName: string;
  productSku?: string | null;
  categoryName?: string | null;
  barcode: string;
  quantity: number;
  unitCostUsd: number;
  unitCostLbp: number;
  totalCostUsd: number;
  totalCostLbp: number;
  quantityOnHand: number;
  currentSalePriceUsd?: number | null;
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
  list: () => ['purchases', 'list'] as const,
  detail: (id: string) => ['purchases', 'detail', id] as const
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
  usePurchase(id?: string) {
    const token = useAuthToken();
    return useQuery<Purchase | null>({
      queryKey: id ? [...purchasesKeys.detail(id), token] : ['purchases', 'detail', token],
      enabled: !!token && !!id,
      queryFn: async () => {
        if (!id) {
          return null;
        }
        return await apiFetch<Purchase>(`/api/purchases/${id}`, {}, token ?? undefined);
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
  useUpdatePurchase() {
    const token = useAuthToken();
    const queryClient = useQueryClient();
    return useMutation<Purchase, Error, { id: string; payload: CreatePurchaseInput }>({
      mutationFn: async ({ id, payload }) => {
        return await apiFetch<Purchase>(
          `/api/purchases/${id}`,
          {
            method: 'PUT',
            body: JSON.stringify(payload)
          },
          token ?? undefined
        );
      },
      onSuccess: (_, variables) => {
        queryClient.invalidateQueries({ queryKey: purchasesKeys.all });
        queryClient.invalidateQueries({ queryKey: purchasesKeys.detail(variables.id) });
        queryClient.invalidateQueries({ queryKey: ['products'] });
      }
    });
  },
  useDeletePurchase() {
    const token = useAuthToken();
    const queryClient = useQueryClient();
    return useMutation<void, Error, { id: string }>({
      mutationFn: async ({ id }) => {
        await apiFetch<void>(
          `/api/purchases/${id}`,
          {
            method: 'DELETE'
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
