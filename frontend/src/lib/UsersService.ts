import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';
import { useAuthStore } from '../stores/authStore';

export type UserRole = 'Admin' | 'Manager' | 'Cashier';

export interface UserDto {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  createdAt: string;
  updatedAt?: string | null;
}

export interface CreateUserPayload {
  username: string;
  password: string;
  displayName: string;
  role: UserRole;
}

export interface UpdateUserPayload {
  id: string;
  displayName?: string;
  role?: UserRole;
}

export interface UpdateUserPasswordPayload {
  id: string;
  newPassword: string;
}

export interface ResetPasswordResponse {
  temporaryPassword: string;
}

export const USERS_QUERY_KEY = ['admin', 'users'] as const;

export function useUsersQuery() {
  const token = useAuthStore((state) => state.token);

  return useQuery<UserDto[]>({
    queryKey: USERS_QUERY_KEY,
    enabled: Boolean(token),
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!token) throw new Error('Not authenticated');
      return await apiFetch<UserDto[]>('/api/admin/users', {}, token);
    }
  });
}

export function useCreateUserMutation() {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();

  return useMutation<UserDto, Error, CreateUserPayload>({
    mutationFn: async (payload) => {
      if (!token) throw new Error('Not authenticated');
      return await apiFetch<UserDto>(
        '/api/admin/users',
        {
          method: 'POST',
          body: JSON.stringify(payload)
        },
        token
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
    }
  });
}

export function useUpdateUserMutation() {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();

  return useMutation<UserDto, Error, UpdateUserPayload>({
    mutationFn: async ({ id, ...payload }) => {
      if (!token) throw new Error('Not authenticated');
      return await apiFetch<UserDto>(
        `/api/admin/users/${id}`,
        {
          method: 'PUT',
          body: JSON.stringify(payload)
        },
        token
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
    }
  });
}

export function useResetPasswordMutation() {
  const token = useAuthStore((state) => state.token);

  return useMutation<ResetPasswordResponse, Error, string>({
    mutationFn: async (id) => {
      if (!token) throw new Error('Not authenticated');
      return await apiFetch<ResetPasswordResponse>(
        `/api/admin/users/${id}/reset-password`,
        {
          method: 'POST'
        },
        token
      );
    }
  });
}

export function useUpdatePasswordMutation() {
  const token = useAuthStore((state) => state.token);

  return useMutation<void, Error, UpdateUserPasswordPayload>({
    mutationFn: async ({ id, newPassword }) => {
      if (!token) throw new Error('Not authenticated');
      await apiFetch<void>(
        `/api/admin/users/${id}/password`,
        {
          method: 'PUT',
          body: JSON.stringify({ newPassword })
        },
        token
      );
    }
  });
}
