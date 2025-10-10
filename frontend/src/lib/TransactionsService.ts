import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';
import { useAuthStore } from '../stores/authStore';

export interface TransactionLine {
  id: string;
  productId: string;
  productName: string;
  productSku?: string | null;
  productBarcode?: string | null;
  priceRuleId?: string | null;
  priceRuleType?: number | null;
  priceRuleDescription?: string | null;
  quantity: number;
  baseUnitPriceUsd: number;
  baseUnitPriceLbp: number;
  unitPriceUsd: number;
  unitPriceLbp: number;
  discountPercent: number;
  totalUsd: number;
  totalLbp: number;
  costUsd: number;
  costLbp: number;
  profitUsd: number;
  profitLbp: number;
  quantityOnHand: number;
  isWaste: boolean;
}

export interface Transaction {
  id: string;
  transactionNumber: string;
  type: string;
  cashierName: string;
  exchangeRateUsed: number;
  totalUsd: number;
  totalLbp: number;
  paidUsd: number;
  paidLbp: number;
  balanceUsd: number;
  balanceLbp: number;
  createdAt: string;
  updatedAt?: string | null;
  lines: TransactionLine[];
}

export interface TransactionItemInput {
  productId: string;
  quantity: number;
  priceRuleId?: string | null;
  manualDiscountPercent?: number | null;
  isWaste?: boolean;
}

export interface PriceCartItemInput {
  productId: string;
  quantity: number;
  priceRuleId?: string | null;
  manualDiscountPercent?: number | null;
  isWaste?: boolean;
  manualUnitPriceUsd?: number | null;
  manualUnitPriceLbp?: number | null;
  manualTotalUsd?: number | null;
  manualTotalLbp?: number | null;
}

export interface PriceCartRequest {
  exchangeRate: number;
  saveToMyCart?: boolean;
  items: PriceCartItemInput[];
}

export interface PriceCartResponse {
  totalUsd: number;
  totalLbp: number;
  lines: TransactionLine[];
}

export interface CheckoutResponse {
  transactionId: string;
  transactionNumber: string;
  totalUsd: number;
  totalLbp: number;
  paidUsd: number;
  paidLbp: number;
  balanceUsd: number;
  balanceLbp: number;
  exchangeRate: number;
  lines: TransactionLine[];
  receiptPdfBase64: string;
  requiresOverride: boolean;
  overrideReason?: string | null;
  hasManualTotalOverride: boolean;
}

export interface UpdateTransactionInput {
  exchangeRate: number;
  paidUsd: number;
  paidLbp: number;
  items: TransactionItemInput[];
}

export interface ReturnRequest {
  transactionId: string;
  lineIds: string[];
}

export interface TransactionLineLookup {
  transactionId: string;
  lineId: string;
  productId: string;
  transactionNumber: string;
  productName: string;
  productSku?: string | null;
  productBarcode?: string | null;
  quantity: number;
  totalUsd: number;
  totalLbp: number;
  unitPriceUsd: number;
  unitPriceLbp: number;
  costUsd: number;
  costLbp: number;
  profitUsd: number;
  profitLbp: number;
  createdAt: string;
  isWaste: boolean;
}

const transactionsKeys = {
  all: ['transactions'] as const,
  list: () => ['transactions', 'list'] as const,
  detail: (id: string) => ['transactions', 'detail', id] as const
};

function useAuthToken() {
  return useAuthStore((state) => state.token);
}

export const TransactionsService = {
  useTransactions() {
    const token = useAuthToken();
    return useQuery<Transaction[]>({
      queryKey: [...transactionsKeys.list(), token],
      enabled: !!token,
      queryFn: async () => {
        return await apiFetch<Transaction[]>('/api/transactions', {}, token ?? undefined);
      }
    });
  },
  useTransaction(id?: string) {
    const token = useAuthToken();
    return useQuery<Transaction | null>({
      queryKey: id ? [...transactionsKeys.detail(id), token] : ['transactions', 'detail', token],
      enabled: !!token && !!id,
      queryFn: async () => {
        if (!id) {
          return null;
        }
        return await apiFetch<Transaction>(`/api/transactions/${id}`, {}, token ?? undefined);
      }
    });
  },
  useUpdateTransaction() {
    const token = useAuthToken();
    const queryClient = useQueryClient();
    return useMutation<Transaction, Error, { id: string; payload: UpdateTransactionInput }>({
      mutationFn: async ({ id, payload }) => {
        return await apiFetch<Transaction>(
          `/api/transactions/${id}`,
          {
            method: 'PUT',
            body: JSON.stringify(payload)
          },
          token ?? undefined
        );
      },
      onSuccess: (_, variables) => {
        queryClient.invalidateQueries({ queryKey: transactionsKeys.all });
        queryClient.invalidateQueries({ queryKey: transactionsKeys.detail(variables.id) });
        queryClient.invalidateQueries({ queryKey: ['products'] });
      }
    });
  },
  usePriceCart() {
    const token = useAuthToken();
    return useMutation<PriceCartResponse, Error, PriceCartRequest>({
      mutationFn: async (payload) => {
        return await apiFetch<PriceCartResponse>(
          '/api/transactions/price',
          {
            method: 'POST',
            body: JSON.stringify(payload)
          },
          token ?? undefined
        );
      }
    });
  },
  useReturnTransaction() {
    const token = useAuthToken();
    const queryClient = useQueryClient();
    return useMutation<CheckoutResponse, Error, ReturnRequest>({
      mutationFn: async (payload) => {
        return await apiFetch<CheckoutResponse>(
          '/api/transactions/return',
          {
            method: 'POST',
            body: JSON.stringify(payload)
          },
          token ?? undefined
        );
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: transactionsKeys.all });
        queryClient.invalidateQueries({ queryKey: ['products'] });
      }
    });
  },
  keys: transactionsKeys
};

export type TransactionsServiceType = typeof TransactionsService;
