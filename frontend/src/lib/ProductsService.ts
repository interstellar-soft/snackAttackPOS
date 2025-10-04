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
  categoryName?: string;
  description?: string | null;
  isFlagged?: boolean;
  flagReason?: string | null;
  isPinned?: boolean;
  quantityOnHand?: number;
  averageCostUsd?: number;
}

export interface CreateProductInput {
  sku: string;
  name: string;
  barcode: string;
  price: number;
  currency?: 'USD' | 'LBP';
  categoryName: string;
  description?: string;
  isPinned: boolean;
}

export interface UpdateProductInput extends CreateProductInput {
  id: string;
}

export interface DeleteProductInput {
  id: string;
}

interface SearchProductsOptions {
  pinnedOnly?: boolean;
}

const productsKeys = {
  all: ['products'] as const,
  list: () => ['products', 'list'] as const,
  search: (term: string, pinnedOnly: boolean) =>
    ['products', 'search', term, pinnedOnly] as const
};

function useAuthToken() {
  return useAuthStore((state) => state.token);
}

function buildSearchPath(term: string, options: SearchProductsOptions = {}) {
  const trimmed = term.trim();
  const params = new URLSearchParams();
  params.set('q', trimmed);

  if (options.pinnedOnly) {
    params.set('pinnedOnly', 'true');
  }

  return `/api/products/search?${params.toString()}`;
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
  useSearchProducts(term: string, options: SearchProductsOptions = {}) {
    const token = useAuthToken();
    const pinnedOnly = options.pinnedOnly ?? false;

    return useQuery<Product[]>({
      queryKey: [...productsKeys.search(term, pinnedOnly), token],
      queryFn: async () => {
        return await apiFetch<Product[]>(
          buildSearchPath(term, { pinnedOnly }),
          {},
          token ?? undefined
        );
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
  useUpdateProduct() {
    const token = useAuthToken();
    const queryClient = useQueryClient();

    return useMutation<Product, Error, UpdateProductInput>({
      mutationFn: async ({ id, ...input }) => {
        return await apiFetch<Product>(
          `/api/products/${id}`,
          {
            method: 'PUT',
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
  useDeleteProduct() {
    const token = useAuthToken();
    const queryClient = useQueryClient();

    return useMutation<void, Error, DeleteProductInput>({
      mutationFn: async ({ id }) => {
        await apiFetch<void>(
          `/api/products/${id}`,
          {
            method: 'DELETE'
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
