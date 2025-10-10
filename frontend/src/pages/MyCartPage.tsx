import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '../components/pos/TopBar';
import { useAuthStore } from '../stores/authStore';
import { useLanguageDirection } from '../hooks/useLanguageDirection';
import { MyCartService } from '../lib/MyCartService';
import { formatCurrency } from '../lib/utils';

export function MyCartPage() {
  const { t, i18n } = useTranslation();
  useLanguageDirection();
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);
  const role = useAuthStore((state) => state.role);

  const summaryQuery = MyCartService.useSummary();
  const purchasesQuery = MyCartService.usePurchases();

  const locale = useMemo(() => (i18n.language === 'ar' ? 'ar-LB' : 'en-US'), [i18n.language]);
  const summary = summaryQuery.data;
  const purchases = purchasesQuery.data ?? [];

  const normalizedRole = role?.toLowerCase();
  const canManageInventory = normalizedRole === 'admin' || normalizedRole === 'manager';

  return (
    <div className="grid min-h-screen grid-rows-[auto_1fr] gap-3 bg-slate-100 p-4 dark:bg-slate-950">
      <TopBar
        onLogout={logout}
        onNavigatePos={() => navigate('/')}
        onNavigateAnalytics={canManageInventory ? () => navigate('/analytics') : undefined}
        onNavigateProfits={canManageInventory ? () => navigate('/profits') : undefined}
        onNavigateOffers={canManageInventory ? () => navigate('/offers') : undefined}
        onNavigateInvoices={canManageInventory ? () => navigate('/invoices') : undefined}
        onNavigatePurchases={canManageInventory ? () => navigate('/purchases') : undefined}
        onNavigateProducts={canManageInventory ? () => navigate('/products') : undefined}
        onNavigateInventory={canManageInventory ? () => navigate('/inventory') : undefined}
        onNavigateSettings={canManageInventory ? () => navigate('/settings') : undefined}
        onNavigateMyCart={() => navigate('/my-cart')}
        isMyCart
      />
      <div className="overflow-y-auto rounded-xl bg-white p-4 shadow-sm dark:bg-slate-900">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {t('myCartDailyTotal')}
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-800 dark:text-slate-100">
              {formatCurrency(summary?.dailyTotalUsd ?? 0, 'USD', locale)}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {formatCurrency(summary?.dailyTotalLbp ?? 0, 'LBP', locale)}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {t('myCartMonthlyTotal')}
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-800 dark:text-slate-100">
              {formatCurrency(summary?.monthlyTotalUsd ?? 0, 'USD', locale)}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {formatCurrency(summary?.monthlyTotalLbp ?? 0, 'LBP', locale)}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {t('myCartYearlyTotal')}
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-800 dark:text-slate-100">
              {formatCurrency(summary?.yearlyTotalUsd ?? 0, 'USD', locale)}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {formatCurrency(summary?.yearlyTotalLbp ?? 0, 'LBP', locale)}
            </p>
          </div>
        </div>
        <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              {t('myCartRecentPurchases')}
            </h2>
            {purchasesQuery.isLoading && (
              <span className="text-xs text-slate-500 dark:text-slate-400">{t('loading')}</span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
              <thead className="bg-slate-100 dark:bg-slate-800">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">
                    {t('transaction')}
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">
                    {t('date')}
                  </th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-600 dark:text-slate-300">
                    USD
                  </th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-600 dark:text-slate-300">
                    LBP
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {purchases.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-center text-sm text-slate-500 dark:text-slate-400">
                      {t('myCartNoPurchases')}
                    </td>
                  </tr>
                ) : (
                  purchases.map((purchase) => {
                    const purchaseDate = new Date(purchase.purchaseDate);
                    return (
                      <tr key={purchase.id} className="hover:bg-slate-100/60 dark:hover:bg-slate-800/60">
                        <td className="px-3 py-2 font-medium text-slate-700 dark:text-slate-200">
                          {purchase.transactionNumber}
                        </td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                          {purchaseDate.toLocaleString(locale)}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-200">
                          {formatCurrency(purchase.totalUsd, 'USD', locale)}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-200">
                          {formatCurrency(purchase.totalLbp, 'LBP', locale)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
