import { FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '../components/pos/TopBar';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { useAuthStore } from '../stores/authStore';
import { useStoreProfileStore } from '../stores/storeProfileStore';
import { useStoreProfileQuery, useUpdateStoreProfileMutation } from '../lib/SettingsService';
import { useLanguageDirection } from '../hooks/useLanguageDirection';

interface StatusMessage {
  type: 'success' | 'error';
  message: string;
}

export function SettingsPage() {
  const { t } = useTranslation();
  useLanguageDirection();
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);
  const role = useAuthStore((state) => state.role);
  const storeName = useStoreProfileStore((state) => state.name);
  const canManageInventory = role?.toLowerCase() === 'admin' || role?.toLowerCase() === 'manager';
  const { isLoading, isError, refetch } = useStoreProfileQuery();
  const updateProfile = useUpdateStoreProfileMutation();

  const [name, setName] = useState(storeName);
  const [status, setStatus] = useState<StatusMessage | null>(null);

  useEffect(() => {
    setName(storeName);
  }, [storeName]);

  useEffect(() => {
    if (!status) {
      return;
    }
    const handle = window.setTimeout(() => setStatus(null), 3000);
    return () => window.clearTimeout(handle);
  }, [status]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);

    try {
      await updateProfile.mutateAsync({ name: name.trim() });
      setStatus({ type: 'success', message: t('settingsSuccess') });
    } catch (error) {
      const message = error instanceof Error ? error.message : t('settingsError');
      setStatus({ type: 'error', message });
    }
  };

  return (
    <div className="flex min-h-screen flex-col gap-4 bg-slate-100 p-4 dark:bg-slate-950">
      <TopBar
        onLogout={logout}
        onNavigatePos={() => navigate('/')}
        onNavigateAnalytics={canManageInventory ? () => navigate('/analytics') : undefined}
        onNavigatePurchases={canManageInventory ? () => navigate('/purchases') : undefined}
        onNavigateInventory={canManageInventory ? () => navigate('/inventory') : undefined}
        isSettings
      />
      <Card className="max-w-2xl space-y-4 p-6">
        <CardHeader className="flex-col items-start gap-2 px-0">
          <CardTitle>{t('settings')}</CardTitle>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('settingsIntro')}</p>
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
              {status.message}
            </div>
          )}
          {isError && !isLoading && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-700 dark:border-amber-500/40 dark:bg-amber-900/20 dark:text-amber-200">
              <div className="flex items-center justify-between gap-2">
                <span>{t('settingsError')}</span>
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
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300" htmlFor="store-name">
                {t('storeNameLabel')}
              </label>
              <Input
                id="store-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t('storeNamePlaceholder', { storeName }) ?? ''}
                disabled={isLoading || updateProfile.isPending}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={updateProfile.isPending}>
                {updateProfile.isPending ? t('settingsSaving') : t('settingsSave')}
              </Button>
              <Button
                type="button"
                onClick={() => setName(storeName)}
                disabled={updateProfile.isPending || name === storeName}
                className="bg-slate-200 text-slate-900 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100"
              >
                {t('inventoryCancel')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
