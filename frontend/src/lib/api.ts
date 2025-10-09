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
  sku?: string | null;
  name: string;
  barcode: string;
  priceUsd: number;
  priceLbp: number;
  description?: string | null;
  categoryName: string;
  isFlagged?: boolean | null;
  flagReason?: string | null;
  quantityOnHand?: number;
  averageCostUsd?: number;
  reorderPoint?: number;
  isReorderAlarmEnabled?: boolean;
}

export interface ProductMutationPayload {
  name: string;
  sku?: string;
  barcode: string;
  price: number;
  currency?: ProductCurrency;
  categoryName: string;
  description?: string | null;
  isPinned?: boolean;
  reorderPoint?: number;
}

export async function apiFetch<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let res: Response;

  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error && error.message ? ` ${error.message}` : '';
    throw new Error(
      `Unable to reach the Aurora POS backend at ${API_BASE_URL}. Ensure the infrastructure stack is running before signing in.${errorMessage}`
    );
  }

  if (!res.ok) {
    const errorText = await res.text();
    let message = errorText.trim();

    if (errorText) {
      const parsedMessage = parseErrorMessage(errorText);
      if (parsedMessage) {
        message = parsedMessage;
      }
    }

    if (!message) {
      message = `Request failed with status ${res.status}`;
    }

    throw new Error(message);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}

function parseErrorMessage(errorText: string): string | null {
  try {
    const data = JSON.parse(errorText) as unknown;
    if (!data || typeof data !== 'object') {
      return null;
    }

    const maybeProblem = data as {
      title?: unknown;
      detail?: unknown;
      errors?: unknown;
    };

    const validationMessages: string[] = [];
    if (maybeProblem.errors && typeof maybeProblem.errors === 'object') {
      const entries = Object.values(maybeProblem.errors as Record<string, unknown>);
      for (const value of entries) {
        if (Array.isArray(value)) {
          for (const item of value) {
            if (typeof item === 'string' && item.trim()) {
              validationMessages.push(item.trim());
            }
          }
        } else if (typeof value === 'string' && value.trim()) {
          validationMessages.push(value.trim());
        }
      }
    }

    if (validationMessages.length > 0) {
      return validationMessages.join(' ');
    }

    if (typeof maybeProblem.detail === 'string' && maybeProblem.detail.trim()) {
      return maybeProblem.detail.trim();
    }

    if (typeof maybeProblem.title === 'string' && maybeProblem.title.trim()) {
      return maybeProblem.title.trim();
    }

    return null;
  } catch (error) {
    return null;
  }
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
