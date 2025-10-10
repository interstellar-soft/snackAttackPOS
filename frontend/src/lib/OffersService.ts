import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';
import { useAuthStore } from '../stores/authStore';

export interface OfferItem {
  productId: string;
  productName: string;
  productSku?: string | null;
  productBarcode?: string | null;
  quantity: number;
}

export interface Offer {
  id: string;
  name: string;
  description?: string | null;
  priceUsd: number;
  priceLbp: number;
  isActive: boolean;
  items: OfferItem[];
}

export interface OfferItemInput {
  productId: string;
  quantity: number;
}

export interface CreateOfferInput {
  name: string;
  description?: string | null;
  price: number;
  currency: 'USD' | 'LBP';
  isActive: boolean;
  items: OfferItemInput[];
}

export interface UpdateOfferInput extends CreateOfferInput {
  id: string;
}

const offersKeys = {
  all: ['offers'] as const
};

function useAuthToken() {
  return useAuthStore((state) => state.token);
}

export const OffersService = {
  useOffers() {
    const token = useAuthToken();
    return useQuery<Offer[]>({
      queryKey: [...offersKeys.all, token],
      queryFn: async () => {
        return await apiFetch<Offer[]>('/api/offers', {}, token ?? undefined);
      },
      enabled: !!token
    });
  },
  useCreateOffer() {
    const token = useAuthToken();
    const queryClient = useQueryClient();
    return useMutation<Offer, Error, CreateOfferInput>({
      mutationFn: async (payload) => {
        return await apiFetch<Offer>(
          '/api/offers',
          {
            method: 'POST',
            body: JSON.stringify(payload)
          },
          token ?? undefined
        );
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: offersKeys.all });
      }
    });
  },
  useUpdateOffer() {
    const token = useAuthToken();
    const queryClient = useQueryClient();
    return useMutation<Offer, Error, UpdateOfferInput>({
      mutationFn: async ({ id, ...payload }) => {
        return await apiFetch<Offer>(
          `/api/offers/${id}`,
          {
            method: 'PUT',
            body: JSON.stringify(payload)
          },
          token ?? undefined
        );
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: offersKeys.all });
      }
    });
  },
  useDeleteOffer() {
    const token = useAuthToken();
    const queryClient = useQueryClient();
    return useMutation<void, Error, { id: string }>({
      mutationFn: async ({ id }) => {
        await apiFetch<void>(
          `/api/offers/${id}`,
          {
            method: 'DELETE'
          },
          token ?? undefined
        );
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: offersKeys.all });
      }
    });
  },
  keys: offersKeys
};

export type OffersServiceType = typeof OffersService;
