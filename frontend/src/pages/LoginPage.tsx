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
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { status: backendStatus, error: backendError } = useBackendHealth();

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
              <div className="rounded-md border border-slate-200 bg-white/90 p-4 text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40">
                    <svg
                      className="h-6 w-6 animate-spin"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <title>{t('backendStatusCheckingTitle')}</title>
                      <circle className="opacity-25" cx="12" cy="12" r="10" />
                      <path className="opacity-75" d="M12 2a10 10 0 0 1 10 10" />
                    </svg>
                    <span className="sr-only">{t('backendStatusCheckingTitle')}</span>
                  </span>
                  <div>
                    <p className="font-semibold text-slate-700 dark:text-slate-100">
                      {t('backendStatusCheckingTitle')}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
                      {t('backendStatusCheckingDescription', { apiUrl: API_BASE_URL })}
                    </p>
                    {backendStatus === 'offline' && backendError && (
                      <p className="mt-2 text-xs text-amber-600 dark:text-amber-300">{backendError}</p>
                    )}
                  </div>
                </div>
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
