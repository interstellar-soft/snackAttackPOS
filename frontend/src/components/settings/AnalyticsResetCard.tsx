import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { useResetAnalyticsMutation } from '../../lib/AnalyticsService';

interface StatusMessage {
  type: 'success' | 'error';
  message: string;
}

export function AnalyticsResetCard() {
  const { t } = useTranslation();
  const resetAnalytics = useResetAnalyticsMutation();
  const [status, setStatus] = useState<StatusMessage | null>(null);

  useEffect(() => {
    if (!status) {
      return;
    }
    const handle = window.setTimeout(() => setStatus(null), 4000);
    return () => window.clearTimeout(handle);
  }, [status]);

  const handleResetClick = async () => {
    const confirmed = window.confirm(t('settingsResetAnalyticsConfirm'));
    if (!confirmed) {
      return;
    }

    setStatus(null);

    try {
      await resetAnalytics.mutateAsync();
      setStatus({ type: 'success', message: t('settingsResetAnalyticsSuccess') });
    } catch (error) {
      const message = error instanceof Error ? error.message : t('settingsResetAnalyticsError');
      setStatus({ type: 'error', message });
    }
  };

  return (
    <Card className="space-y-4 p-6">
      <CardHeader className="flex-col items-start gap-2 px-0">
        <CardTitle>{t('settingsResetAnalyticsTitle')}</CardTitle>
        <p className="text-sm text-slate-500 dark:text-slate-400">{t('settingsResetAnalyticsDescription')}</p>
        <p className="text-sm font-medium text-amber-600 dark:text-amber-300">
          {t('settingsResetAnalyticsWarning')}
        </p>
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
        <Button type="button" onClick={handleResetClick} disabled={resetAnalytics.isPending}>
          {resetAnalytics.isPending ? t('settingsSaving') : t('settingsResetAnalyticsButton')}
        </Button>
      </CardContent>
    </Card>
  );
}
