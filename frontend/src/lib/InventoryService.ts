import { useQuery } from '@tanstack/react-query';
import { apiFetch } from './api';
import { useAuthStore } from '../stores/authStore';

export interface InventorySummaryResponse {
  totalCostUsd: number;
  totalCostLbp: number;
  categories: InventoryCategorySummary[];
  items: InventoryItemSummary[];
}

export interface InventoryCategorySummary {
  categoryId: string;
  categoryName: string;
  quantityOnHand: number;
  totalCostUsd: number;
  totalCostLbp: number;
}

export interface InventoryItemSummary {
  productId: string;
  productName: string;
  sku?: string | null;
  barcode: string;
  categoryId?: string | null;
  categoryName: string;
  quantityOnHand: number;
  averageCostUsd: number;
  averageCostLbp: number;
  totalCostUsd: number;
  totalCostLbp: number;
}

const inventoryKeys = {
  all: ['inventory'] as const,
  summary: () => [...inventoryKeys.all, 'summary'] as const
};

export function useInventorySummary() {
  const token = useAuthStore((state) => state.token);

  return useQuery<InventorySummaryResponse>({
    queryKey: [...inventoryKeys.summary(), token],
    queryFn: async () =>
      await apiFetch<InventorySummaryResponse>(
        '/api/inventory/summary',
        {},
        token ?? undefined
      ),
    enabled: !!token
  });
}

export const InventoryService = {
  useInventorySummary,
  keys: inventoryKeys
};

