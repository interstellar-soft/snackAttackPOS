import { QueryClient } from '@tanstack/react-query';

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
export const ML_BASE_URL = import.meta.env.VITE_ML_URL || 'http://localhost:8001';

export const queryClient = new QueryClient();

export const PRODUCTS_QUERY_KEY = ['products'] as const;

export interface LoginResponse {
  token: string;
  displayName: string;
  role: string;
}

export type ProductCurrency = 'USD' | 'LBP';

export interface ProductResponseDto {
  id: string;
  sku: string;
  name: string;
  barcode: string;
  priceUsd: number;
  priceLbp: number;
  description?: string | null;
  category: string;
  isFlagged?: boolean | null;
  flagReason?: string | null;
}

export interface ProductMutationPayload {
  name: string;
  sku: string;
  barcode: string;
  price: number;
  currency?: ProductCurrency;
  categoryName: string;
  description?: string | null;
}

export async function apiFetch<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers
  });

  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || `Request failed with status ${res.status}`);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}

export async function createProduct(
  payload: ProductMutationPayload,
  token?: string
): Promise<ProductResponseDto> {
  const product = await apiFetch<ProductResponseDto>(
    '/api/products',
    {
      method: 'POST',
      body: JSON.stringify(payload)
    },
    token
  );

  await queryClient.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY });
  return product;
}

export async function updateProduct(
  id: string,
  payload: ProductMutationPayload,
  token?: string
): Promise<ProductResponseDto> {
  const product = await apiFetch<ProductResponseDto>(
    `/api/products/${id}`,
    {
      method: 'PUT',
      body: JSON.stringify(payload)
    },
    token
  );

  await queryClient.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY });
  return product;
}

export async function deleteProduct(id: string, token?: string): Promise<void> {
  await apiFetch<void>(
    `/api/products/${id}`,
    {
      method: 'DELETE'
    },
    token
  );

  await queryClient.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY });
}
