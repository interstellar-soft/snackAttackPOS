import { QueryClient } from '@tanstack/react-query';

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
export const ML_BASE_URL = import.meta.env.VITE_ML_URL || 'http://localhost:8001';

export const queryClient = new QueryClient();

export interface LoginResponse {
  token: string;
  displayName: string;
  role: string;
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
