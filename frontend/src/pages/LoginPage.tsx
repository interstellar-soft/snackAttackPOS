import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { useAuthStore } from '../stores/authStore';
import { useStoreProfileStore } from '../stores/storeProfileStore';
import { useBackendHealth } from '../hooks/useBackendHealth';
import { API_BASE_URL } from '../lib/api';

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const isLoading = useAuthStore((state) => state.isLoading);
  const error = useAuthStore((state) => state.error);
  const token = useAuthStore((state) => state.token);
  const storeName = useStoreProfileStore((state) => state.name);
  const [username, setUsername] = useState('cashier');
  const [password, setPassword] = useState('ChangeMe123!');
  const { status: backendStatus, error: backendError, checkHealth } = useBackendHealth();

  const backendOnline = backendStatus === 'online';
  const showConnectivityBanner = backendStatus !== 'online';
  const hideDuplicateError = useMemo(() => {
    if (!error) {
      return false;
    }

    return error.includes('Unable to reach the Aurora POS backend');
  }, [error]);

  useEffect(() => {
    if (token) {
      navigate('/', { replace: true });
    }
  }, [token, navigate]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await login(username, password);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6 dark:bg-slate-950">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center text-2xl font-semibold text-emerald-600 dark:text-emerald-300">{t('welcome', { storeName })}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {showConnectivityBanner && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow-sm dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
                <p className="font-semibold">
                  {backendStatus === 'checking'
                    ? t('backendStatusCheckingTitle')
                    : t('backendStatusOfflineTitle')}
                </p>
                <p className="mt-2 text-amber-800 dark:text-amber-200">
                  {backendStatus === 'checking'
                    ? t('backendStatusCheckingDescription', { apiUrl: API_BASE_URL })
                    : t('backendStatusOfflineDescription', { apiUrl: API_BASE_URL })}
                </p>
                {backendStatus === 'offline' && (
                  <>
                    <p className="mt-3 text-amber-800 dark:text-amber-200">
                      {t('backendStatusOfflineAction')}
                    </p>
                    <code className="mt-2 block rounded bg-amber-100 px-2 py-1 text-xs text-amber-900 dark:bg-amber-900 dark:text-amber-100">
                      docker compose --env-file .env -f infra/docker-compose.yml up -d
                    </code>
                    {backendError && (
                      <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">{backendError}</p>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="rounded-md border border-amber-300 bg-white px-3 py-1 text-xs font-medium text-amber-800 transition hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:border-amber-700 dark:bg-amber-900 dark:text-amber-100 dark:hover:bg-amber-800"
                        onClick={() => {
                          void checkHealth();
                        }}
                        disabled={backendStatus === 'checking'}
                      >
                        {backendStatus === 'checking' ? t('backendStatusCheckingButton') : t('retry')}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300" htmlFor="username">
                  {t('username')}
                </label>
                <Input id="username" value={username} onChange={(event) => setUsername(event.target.value)} autoFocus />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300" htmlFor="password">
                  {t('password')}
                </label>
                <Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
              </div>
              {error && !hideDuplicateError && <p className="text-sm text-red-500">{error}</p>}
              <Button type="submit" disabled={isLoading || !backendOnline} className="w-full">
                {isLoading ? '…' : t('login')}
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
