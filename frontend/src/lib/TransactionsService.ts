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
  debtCardName?: string | null;
  debtSettledAt?: string | null;
  lines: TransactionLine[];
}

export interface TransactionItemInput {
  productId: string;
  quantity: number;
  priceRuleId?: string | null;
  manualDiscountPercent?: number | null;
  isWaste?: boolean;
  manualUnitPriceUsd?: number | null;
  manualUnitPriceLbp?: number | null;
  manualTotalUsd?: number | null;
  manualTotalLbp?: number | null;
  isConfiguredPriceOverride?: boolean;
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
  isConfiguredPriceOverride?: boolean;
}

export interface PriceCartRequest {
  exchangeRate: number;
  saveToMyCart?: boolean;
  isRefund?: boolean;
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
  debtCardName?: string | null;
  debtSettledAt?: string | null;
}

export interface UpdateTransactionInput {
  exchangeRate: number;
  paidUsd: number;
  paidLbp: number;
  items: TransactionItemInput[];
  isRefund?: boolean;
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
  transactionType: 'Sale' | 'Return';
}

const transactionsKeys = {
  all: ['transactions'] as const,
  list: () => ['transactions', 'list'] as const,
  detail: (id: string) => ['transactions', 'detail', id] as const,
  debts: () => ['transactions', 'debts'] as const
};

export interface DebtSettlementInput {
  id: string;
  paidUsd?: number;
  paidLbp?: number;
}

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
  useDebts() {
    const token = useAuthToken();
    return useQuery<Transaction[]>({
      queryKey: [...transactionsKeys.debts(), token],
      enabled: !!token,
      queryFn: async () => {
        return await apiFetch<Transaction[]>('/api/transactions/debts', {}, token ?? undefined);
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
        queryClient.invalidateQueries({ queryKey: transactionsKeys.debts() });
      }
    });
  },
  useSettleDebt() {
    const token = useAuthToken();
    const queryClient = useQueryClient();
    return useMutation<Transaction, Error, DebtSettlementInput>({
      mutationFn: async ({ id, paidUsd = 0, paidLbp = 0 }) => {
        return await apiFetch<Transaction>(
          `/api/transactions/${id}/settle-debt`,
          {
            method: 'POST',
            body: JSON.stringify({ paidUsd, paidLbp })
          },
          token ?? undefined
        );
      },
      onSuccess: (_, variables) => {
        queryClient.invalidateQueries({ queryKey: transactionsKeys.debts() });
        queryClient.invalidateQueries({ queryKey: transactionsKeys.detail(variables.id) });
        queryClient.invalidateQueries({ queryKey: transactionsKeys.list() });
      }
    });
  },
  useDeleteTransaction() {
    const token = useAuthToken();
    const queryClient = useQueryClient();
    return useMutation<void, Error, string>({
      mutationFn: async (id) => {
        await apiFetch(`/api/transactions/${id}`, { method: 'DELETE' }, token ?? undefined);
      },
      onSuccess: (_, id) => {
        queryClient.invalidateQueries({ queryKey: transactionsKeys.all });
        queryClient.removeQueries({ queryKey: transactionsKeys.detail(id) });
        queryClient.invalidateQueries({ queryKey: ['products'] });
        queryClient.invalidateQueries({ queryKey: ['inventory'] });
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
