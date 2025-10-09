import { useQuery } from '@tanstack/react-query';
import { apiFetch } from './api';
import { useAuthStore } from '../stores/authStore';

export interface MyCartSummary {
  referenceDate: string;
  dailyTotalUsd: number;
  dailyTotalLbp: number;
  monthlyTotalUsd: number;
  monthlyTotalLbp: number;
  yearlyTotalUsd: number;
  yearlyTotalLbp: number;
}

export interface PersonalPurchase {
  id: string;
  transactionId: string;
  transactionNumber: string;
  totalUsd: number;
  totalLbp: number;
  purchaseDate: string;
}

const myCartKeys = {
  base: ['myCart'] as const,
  summary: (date?: string) => ['myCart', 'summary', date ?? 'current'] as const,
  purchases: (params?: { from?: string; to?: string }) => [
    'myCart',
    'purchases',
    params?.from ?? 'start',
    params?.to ?? 'end'
  ] as const
};

function useAuthToken() {
  return useAuthStore((state) => state.token);
}

export const MyCartService = {
  useSummary(date?: string) {
    const token = useAuthToken();
    return useQuery<MyCartSummary | null>({
      queryKey: myCartKeys.summary(date),
      enabled: !!token,
      queryFn: async () => {
        if (!token) {
          return null;
        }
        const query = date ? `?date=${encodeURIComponent(date)}` : '';
        return await apiFetch<MyCartSummary>(`/api/my-cart/summary${query}`, {}, token);
      }
    });
  },
  usePurchases(params?: { from?: string; to?: string }) {
    const token = useAuthToken();
    return useQuery<PersonalPurchase[]>({
      queryKey: myCartKeys.purchases(params),
      enabled: !!token,
      queryFn: async () => {
        if (!token) {
          return [];
        }
        const searchParams = new URLSearchParams();
        if (params?.from) {
          searchParams.set('from', params.from);
        }
        if (params?.to) {
          searchParams.set('to', params.to);
        }
        const query = searchParams.toString();
        const suffix = query ? `?${query}` : '';
        return await apiFetch<PersonalPurchase[]>(`/api/my-cart/purchases${suffix}`, {}, token);
      }
    });
  },
  keys: myCartKeys
};

export type MyCartServiceType = typeof MyCartService;
