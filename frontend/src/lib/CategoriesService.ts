import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';
import { useAuthStore } from '../stores/authStore';

export interface Category {
  id: string;
  name: string;
}

interface CreateCategoryInput {
  name: string;
}

const categoriesKeys = {
  all: ['categories'] as const
};

function useAuthToken() {
  return useAuthStore((state) => state.token);
}

export const CategoriesService = {
  useCategories() {
    const token = useAuthToken();

    return useQuery<Category[]>({
      queryKey: [...categoriesKeys.all, token],
      queryFn: async () =>
        await apiFetch<Category[]>(
          '/api/categories',
          {},
          token ?? undefined
        ),
      enabled: !!token
    });
  },
  useCreateCategory() {
    const token = useAuthToken();
    const queryClient = useQueryClient();

    return useMutation<Category, Error, CreateCategoryInput>({
      mutationFn: async (input) =>
        await apiFetch<Category>(
          '/api/categories',
          {
            method: 'POST',
            body: JSON.stringify(input)
          },
          token ?? undefined
        ),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: categoriesKeys.all });
      }
    });
  },
  keys: categoriesKeys
};

export type CategoriesServiceType = typeof CategoriesService;
