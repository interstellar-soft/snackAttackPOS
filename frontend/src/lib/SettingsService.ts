import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';
import { useAuthStore } from '../stores/authStore';
import { useStoreProfileStore } from '../stores/storeProfileStore';

export interface StoreProfileResponse {
  id: string;
  name: string;
  createdAt: string;
  updatedAt?: string | null;
}

export interface UpdateStoreProfileRequest {
  name: string;
}

export const STORE_PROFILE_QUERY_KEY = ['store-profile'] as const;

export function useStoreProfileQuery() {
  const token = useAuthStore((state) => state.token);
  const setName = useStoreProfileStore((state) => state.setName);

  return useQuery<StoreProfileResponse>({
    queryKey: STORE_PROFILE_QUERY_KEY,
    enabled: Boolean(token),
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!token) throw new Error('Not authenticated');
      return await apiFetch<StoreProfileResponse>('/api/settings/store-profile', {}, token);
    },
    onSuccess: (data) => {
      setName(data.name);
    }
  });
}

export function useUpdateStoreProfileMutation() {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();
  const setName = useStoreProfileStore((state) => state.setName);

  return useMutation<StoreProfileResponse, Error, UpdateStoreProfileRequest>({
    mutationFn: async (payload) => {
      if (!token) throw new Error('Not authenticated');
      return await apiFetch<StoreProfileResponse>(
        '/api/settings/store-profile',
        {
          method: 'PUT',
          body: JSON.stringify(payload)
        },
        token
      );
    },
    onSuccess: (data) => {
      setName(data.name);
      queryClient.setQueryData(STORE_PROFILE_QUERY_KEY, data);
    }
  });
}
