import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import {
  UserRole,
  useCreateUserMutation,
  useResetPasswordMutation,
  useUpdatePasswordMutation,
  useUpdateUserMutation,
  useUsersQuery
} from '../../lib/UsersService';

interface StatusMessage {
  type: 'success' | 'error';
  content: ReactNode;
}

interface CreateUserFormState {
  username: string;
  displayName: string;
  password: string;
  role: UserRole;
}

const defaultCreateForm: CreateUserFormState = {
  username: '',
  displayName: '',
  password: '',
  role: 'Cashier'
};

export function UserManagementCard() {
  const { t } = useTranslation();
  const { data: users, isLoading, isError, refetch } = useUsersQuery();
  const createUser = useCreateUserMutation();
  const updateUser = useUpdateUserMutation();
  const resetPassword = useResetPasswordMutation();
  const updatePassword = useUpdatePasswordMutation();

  const [status, setStatus] = useState<StatusMessage | null>(null);
  const [createForm, setCreateForm] = useState<CreateUserFormState>(defaultCreateForm);
  const [draftRoles, setDraftRoles] = useState<Record<string, UserRole>>({});
  const [pendingUpdateUserId, setPendingUpdateUserId] = useState<string | null>(null);
  const [pendingResetUserId, setPendingResetUserId] = useState<string | null>(null);
  const [pendingPasswordUserId, setPendingPasswordUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!status) return;
    const handle = window.setTimeout(() => setStatus(null), 4000);
    return () => window.clearTimeout(handle);
  }, [status]);

  const roleOptions = useMemo(
    () => [
      { value: 'Admin' as UserRole, label: t('adminRoleAdmin') },
      { value: 'Manager' as UserRole, label: t('adminRoleManager') },
      { value: 'Cashier' as UserRole, label: t('adminRoleCashier') }
    ],
    [t]
  );

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);

    try {
      await createUser.mutateAsync({
        username: createForm.username.trim(),
        displayName: createForm.displayName.trim(),
        password: createForm.password.trim(),
        role: createForm.role
      });
      setCreateForm(defaultCreateForm);
      setStatus({ type: 'success', content: t('adminUserCreated') });
    } catch (error) {
      const message = error instanceof Error ? error.message : t('adminUserCreateError');
      setStatus({ type: 'error', content: message });
    }
  };

  const handleRoleChange = (userId: string, role: UserRole) => {
    setDraftRoles((prev) => ({ ...prev, [userId]: role }));
  };

  const handleSaveRole = async (userId: string, currentRole: UserRole) => {
    setStatus(null);
    setPendingUpdateUserId(userId);
    try {
      await updateUser.mutateAsync({ id: userId, role: currentRole });
      setStatus({ type: 'success', content: t('adminUserUpdated') });
    } catch (error) {
      const message = error instanceof Error ? error.message : t('adminUserUpdateError');
      setStatus({ type: 'error', content: message });
    } finally {
      setPendingUpdateUserId(null);
    }
  };

  const handleResetPassword = async (userId: string, username: string) => {
    setStatus(null);
    setPendingResetUserId(userId);
    try {
      const response = await resetPassword.mutateAsync(userId);
      setStatus({
        type: 'success',
        content: (
          <span>
            {t('adminResetPasswordSuccess', { username })}{' '}
            <span className="font-mono font-medium">{response.temporaryPassword}</span>
          </span>
        )
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : t('adminResetPasswordError');
      setStatus({ type: 'error', content: message });
    } finally {
      setPendingResetUserId(null);
    }
  };

  const handleSetPassword = async (userId: string, username: string) => {
    const promptMessage = t('adminSetPasswordPrompt', { username });
    const nextPassword = window.prompt(promptMessage);
    if (!nextPassword) {
      return;
    }

    setStatus(null);
    setPendingPasswordUserId(userId);
    try {
      await updatePassword.mutateAsync({ id: userId, newPassword: nextPassword.trim() });
      setStatus({ type: 'success', content: t('adminSetPasswordSuccess', { username }) });
    } catch (error) {
      const message = error instanceof Error ? error.message : t('adminSetPasswordError');
      setStatus({ type: 'error', content: message });
    } finally {
      setPendingPasswordUserId(null);
    }
  };

  return (
    <Card className="space-y-4 p-6">
      <CardHeader className="flex-col items-start gap-2 px-0">
        <CardTitle>{t('adminUsersTitle')}</CardTitle>
        <p className="text-sm text-slate-500 dark:text-slate-400">{t('adminUsersIntro')}</p>
      </CardHeader>
      <CardContent className="space-y-4 px-0">
        {status && (
          <div
            className={`rounded-lg border p-3 text-sm ${
              status.type === 'success'
                ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-600/40 dark:bg-emerald-900/20 dark:text-emerald-200'
                : 'border-red-300 bg-red-50 text-red-700 dark:border-red-600/40 dark:bg-red-900/20 dark:text-red-200'
            }`}
          >
            {status.content}
          </div>
        )}

        {isError && !isLoading && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-700 dark:border-amber-500/40 dark:bg-amber-900/20 dark:text-amber-200">
            <div className="flex items-center justify-between gap-2">
              <span>{t('adminUsersLoadError')}</span>
              <Button
                type="button"
                onClick={() => {
                  setStatus(null);
                  refetch();
                }}
                className="bg-slate-200 text-slate-900 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100"
              >
                {t('retry')}
              </Button>
            </div>
          </div>
        )}

        <form className="grid gap-3 md:grid-cols-2" onSubmit={handleCreate}>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300" htmlFor="new-username">
              {t('adminUsernameLabel')}
            </label>
            <Input
              id="new-username"
              value={createForm.username}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, username: event.target.value }))}
              placeholder="jane.doe"
              disabled={createUser.isPending}
              required
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300" htmlFor="new-display-name">
              {t('adminDisplayNameLabel')}
            </label>
            <Input
              id="new-display-name"
              value={createForm.displayName}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, displayName: event.target.value }))}
              placeholder={t('adminDisplayNamePlaceholder') ?? ''}
              disabled={createUser.isPending}
              required
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300" htmlFor="new-password">
              {t('adminPasswordLabel')}
            </label>
            <Input
              id="new-password"
              type="password"
              value={createForm.password}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, password: event.target.value }))}
              placeholder="••••••••"
              disabled={createUser.isPending}
              required
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300" htmlFor="new-role">
              {t('adminRoleLabel')}
            </label>
            <select
              id="new-role"
              className="w-full rounded-md border border-slate-300 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              value={createForm.role}
              onChange={(event) =>
                setCreateForm((prev) => ({ ...prev, role: event.target.value as UserRole }))
              }
              disabled={createUser.isPending}
            >
              {roleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2 flex flex-wrap gap-2">
            <Button type="submit" disabled={createUser.isPending}>
              {createUser.isPending ? t('adminCreateUserSubmitting') : t('adminCreateUserButton')}
            </Button>
            <Button
              type="button"
              onClick={() => setCreateForm(defaultCreateForm)}
              disabled={
                createUser.isPending ||
                (createForm.username === '' &&
                  createForm.password === '' &&
                  createForm.displayName === '' &&
                  createForm.role === 'Cashier')
              }
              className="bg-slate-200 text-slate-900 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100"
            >
              {t('inventoryCancel')}
            </Button>
          </div>
        </form>

        <div className="space-y-2">
          <h3 className="text-sm font-medium text-slate-600 dark:text-slate-300">{t('adminExistingUsersTitle')}</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full border border-slate-200 text-left text-sm dark:border-slate-800">
              <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                <tr>
                  <th className="px-3 py-2">{t('adminUsernameColumn')}</th>
                  <th className="px-3 py-2">{t('adminDisplayNameColumn')}</th>
                  <th className="px-3 py-2">{t('adminRoleColumn')}</th>
                  <th className="px-3 py-2">{t('adminActionsColumn')}</th>
                </tr>
              </thead>
              <tbody>
                {!users || users.length === 0 ? (
                  <tr>
                    <td className="px-3 py-4 text-center text-slate-500 dark:text-slate-400" colSpan={4}>
                      {isLoading ? t('adminUsersLoading') : t('adminUsersEmpty')}
                    </td>
                  </tr>
                ) : (
                  users.map((user) => {
                    const currentRole = draftRoles[user.id] ?? user.role;
                    const isSavingRole = pendingUpdateUserId === user.id && updateUser.isPending;
                    const isResetting = pendingResetUserId === user.id && resetPassword.isPending;
                    const isSettingPassword = pendingPasswordUserId === user.id && updatePassword.isPending;

                    return (
                      <tr key={user.id} className="border-t border-slate-200 dark:border-slate-800">
                        <td className="px-3 py-2 font-mono text-xs text-slate-600 dark:text-slate-300">{user.username}</td>
                        <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{user.displayName}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <select
                              className="w-full rounded-md border border-slate-300 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                              value={currentRole}
                              onChange={(event) => handleRoleChange(user.id, event.target.value as UserRole)}
                              disabled={isSavingRole || updateUser.isPending}
                            >
                              {roleOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            <Button
                              type="button"
                              onClick={() => handleSaveRole(user.id, currentRole)}
                              disabled={
                                currentRole === user.role || updateUser.isPending || pendingUpdateUserId === user.id
                              }
                            >
                              {isSavingRole ? t('adminSaveRoleSaving') : t('adminSaveRoleButton')}
                            </Button>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <Button
                              type="button"
                              onClick={() => handleResetPassword(user.id, user.username)}
                              disabled={resetPassword.isPending}
                              className="bg-slate-200 text-slate-900 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100"
                            >
                              {isResetting ? t('adminResettingPassword') : t('adminResetPasswordButton')}
                            </Button>
                            <Button
                              type="button"
                              onClick={() => handleSetPassword(user.id, user.username)}
                              disabled={updatePassword.isPending}
                              className="bg-slate-200 text-slate-900 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100"
                            >
                              {isSettingPassword ? t('adminSettingPassword') : t('adminSetPasswordButton')}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
