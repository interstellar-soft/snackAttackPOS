import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '../components/pos/TopBar';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { useInventorySummary } from '../lib/InventoryService';
import { formatCurrency } from '../lib/utils';
import { useAuthStore } from '../stores/authStore';

export function AlarmsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const logout = useAuthStore((state) => state.logout);
  const role = useAuthStore((state) => state.role);

  const canManageInventory = role?.toLowerCase() === 'admin' || role?.toLowerCase() === 'manager';

  const inventorySummary = useInventorySummary();
  const alerts = inventorySummary.data?.items.filter((item) => item.isReorderAlarmEnabled && item.needsReorder) ?? [];

  const currencyLocale = useMemo(
    () => (i18n.language === 'ar' ? 'ar-LB' : 'en-US'),
    [i18n.language]
  );
  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(i18n.language === 'ar' ? 'ar-LB' : 'en-US'),
    [i18n.language]
  );

  return (
    <div className="flex min-h-screen flex-col gap-4 bg-slate-100 p-4 dark:bg-slate-950">
      <TopBar
        onLogout={logout}
        onNavigatePos={() => navigate('/')}
        onNavigateAnalytics={canManageInventory ? () => navigate('/analytics') : undefined}
        onNavigateProfits={canManageInventory ? () => navigate('/profits') : undefined}
        onNavigateOffers={canManageInventory ? () => navigate('/offers') : undefined}
        onNavigateProducts={canManageInventory ? () => navigate('/products') : undefined}
        onNavigateInventory={canManageInventory ? () => navigate('/inventory') : undefined}
        onNavigatePurchases={canManageInventory ? () => navigate('/purchases') : undefined}
        onNavigateInvoices={canManageInventory ? () => navigate('/invoices') : undefined}
        onNavigateSettings={canManageInventory ? () => navigate('/settings') : undefined}
        onNavigateAlarms={canManageInventory ? () => navigate('/alarms') : undefined}
        onNavigateMyCart={role?.toLowerCase() === 'admin' ? () => navigate('/my-cart') : undefined}
        isAlarms
      />
      <Card className="space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              {t('alarmsPageTitle')}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('alarmsPageDescription')}</p>
          </div>
          <Button
            type="button"
            className="bg-emerald-600 hover:bg-emerald-500"
            onClick={() => navigate('/purchases')}
            disabled={!canManageInventory}
          >
            {t('alarmsNavigatePurchases')}
          </Button>
        </div>
        {inventorySummary.isLoading ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('inventorySummaryLoading')}</p>
        ) : inventorySummary.isError ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-red-600 dark:text-red-400">{t('inventorySummaryError')}</p>
            <div>
              <Button type="button" onClick={() => inventorySummary.refetch()} className="w-fit">
                {t('retry')}
              </Button>
            </div>
          </div>
        ) : alerts.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('alarmsEmpty')}</p>
        ) : (
          <ul className="space-y-3">
            {alerts.map((alert) => (
              <li
                key={alert.productId}
                className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm dark:border-red-500/40 dark:bg-red-500/10"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="font-semibold text-red-700 dark:text-red-200">{alert.productName}</p>
                    <p className="text-xs text-red-600 dark:text-red-300">
                      {t('inventoryReorderAlertItem', {
                        name: alert.productName,
                        quantity: numberFormatter.format(alert.quantityOnHand ?? 0),
                        reorderPoint: numberFormatter.format(alert.reorderPoint ?? 0)
                      })}
                    </p>
                    {alert.sku ? (
                      <p className="text-xs text-red-600 dark:text-red-300">
                        {t('inventorySku')}: {alert.sku}
                      </p>
                    ) : (
                      <p className="text-xs text-red-600 dark:text-red-300">
                        {t('inventoryBarcodeLabel')}: {alert.barcode}
                      </p>
                    )}
                  </div>
                  <Badge className="bg-red-600 text-white hover:bg-red-500 dark:bg-red-500 dark:text-white">
                    {t('inventoryReorderAlarmBadge')}
                  </Badge>
                </div>
                <div className="mt-3 grid gap-2 text-xs text-red-700 dark:text-red-200">
                  <div className="flex items-center justify-between">
                    <span>{t('inventorySummaryQuantityLabel', { count: numberFormatter.format(alert.quantityOnHand ?? 0) })}</span>
                    <span className="font-semibold">{t('inventoryReorderPointLabel')}: {numberFormatter.format(alert.reorderPoint ?? 0)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>{t('inventorySummaryTotalUsd')}</span>
                    <span className="font-semibold">
                      {formatCurrency(alert.totalCostUsd ?? 0, 'USD', currencyLocale)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>{t('inventorySummaryTotalLbp')}</span>
                    <span className="font-semibold">
                      {formatCurrency(alert.totalCostLbp ?? 0, 'LBP', currencyLocale)}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
