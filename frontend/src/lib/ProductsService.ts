import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';
import { useAuthStore } from '../stores/authStore';

export interface Product {
  id: string;
  sku: string;
  name: string;
  barcode: string;
  priceUsd: number;
  priceLbp: number;
  category: string;
  description?: string | null;
  isFlagged?: boolean;
  flagReason?: string | null;
}

export interface CreateProductInput {
  sku: string;
  name: string;
  barcode: string;
  price: number;
  currency?: 'USD' | 'LBP';
  categoryId: string;
  description?: string;
}

const productsKeys = {
  all: ['products'] as const,
  list: () => ['products', 'list'] as const,
  search: (term: string) => ['products', 'search', term] as const
};

function useAuthToken() {
  return useAuthStore((state) => state.token);
}

function buildSearchPath(term: string) {
  const trimmed = term.trim();
  const query = trimmed ? `?q=${encodeURIComponent(trimmed)}` : '?q=';
  return `/api/products/search${query}`;
}

export const ProductsService = {
  useInventoryProducts() {
    const token = useAuthToken();

    return useQuery<Product[]>({
      queryKey: [...productsKeys.list(), token],
      queryFn: async () => {
        return await apiFetch<Product[]>('/api/products', {}, token ?? undefined);
      },
      enabled: !!token
    });
  },
  useSearchProducts(term: string) {
    const token = useAuthToken();

    return useQuery<Product[]>({
      queryKey: [...productsKeys.search(term), token],
      queryFn: async () => {
        return await apiFetch<Product[]>(buildSearchPath(term), {}, token ?? undefined);
      },
      enabled: !!token,
      staleTime: 30_000
    });
  },
  useCreateProduct() {
    const token = useAuthToken();
    const queryClient = useQueryClient();

    return useMutation<Product, Error, CreateProductInput>({
      mutationFn: async (input) => {
        return await apiFetch<Product>(
          '/api/products',
          {
            method: 'POST',
            body: JSON.stringify(input)
          },
          token ?? undefined
        );
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: productsKeys.all });
      }
    });
  },
  keys: productsKeys
};

export type ProductsServiceType = typeof ProductsService;
