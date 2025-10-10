import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';
import { useAuthStore } from '../stores/authStore';

export function useResetAnalyticsMutation() {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();

  return useMutation<void, Error>({
    mutationFn: async () => {
      if (!token) {
        throw new Error('Not authenticated');
      }
      await apiFetch<void>(
        '/api/analytics/reset',
        {
          method: 'POST'
        },
        token
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profit-summary'] });
      queryClient.invalidateQueries({ queryKey: ['analytics-dashboard'] });
    }
  });
}
