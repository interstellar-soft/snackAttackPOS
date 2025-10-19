import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '../components/pos/TopBar';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { TransactionsService, type Transaction } from '../lib/TransactionsService';
import { formatCurrency } from '../lib/utils';
import { useAuthStore } from '../stores/authStore';
import { useLanguageDirection } from '../hooks/useLanguageDirection';

export function DebtsPage() {
  const { t, i18n } = useTranslation();
  useLanguageDirection();
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);
  const role = useAuthStore((state) => state.role);

  const normalizedRole = role?.toLowerCase();
  const canManageInventory = normalizedRole === 'admin' || normalizedRole === 'manager';
  const canSeeDebts = canManageInventory;
  const canSaveToMyCart = normalizedRole === 'admin';

  const debtsQuery = TransactionsService.useDebts();
  const settleDebt = TransactionsService.useSettleDebt();

  const [selectedDebtId, setSelectedDebtId] = useState<string | null>(null);
  const [settleUsd, setSettleUsd] = useState('');
  const [settleLbp, setSettleLbp] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (!feedback) {
      return;
    }
    const timeout = window.setTimeout(() => setFeedback(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [feedback]);

  const debts = debtsQuery.data ?? [];
  const locale = useMemo(() => (i18n.language === 'ar' ? 'ar-LB' : 'en-US'), [i18n.language]);
  const selectedDebt = useMemo(() => debts.find((debt) => debt.id === selectedDebtId) ?? null, [debts, selectedDebtId]);

  const handleSelectDebt = (debt: Transaction) => {
    setSelectedDebtId(debt.id);
    const nextUsd = debt.balanceUsd > 0 ? debt.balanceUsd.toFixed(2) : '0';
    const nextLbp = debt.balanceLbp > 0 ? Math.round(debt.balanceLbp).toString() : '0';
    setSettleUsd(nextUsd);
    setSettleLbp(nextLbp);
    setFeedback(null);
  };

  const parseAmount = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return 0;
    }
    const parsed = Number(trimmed.replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const handleSettle = () => {
    if (!selectedDebt) {
      return;
    }
    const paidUsd = parseAmount(settleUsd);
    const paidLbp = parseAmount(settleLbp);
    settleDebt.mutate(
      { id: selectedDebt.id, paidUsd, paidLbp },
      {
        onSuccess: (result) => {
          setFeedback({ type: 'success', message: t('debtsSettleSuccess', { number: result.transactionNumber }) });
          setSelectedDebtId(null);
          setSettleUsd('');
          setSettleLbp('');
        },
        onError: () => {
          setFeedback({ type: 'error', message: t('debtsSettleError') });
        }
      }
    );
  };

  return (
    <div className="grid min-h-screen grid-rows-[auto_1fr] gap-3 bg-slate-100 p-4 dark:bg-slate-950">
      <TopBar
        onLogout={logout}
        onNavigatePos={() => navigate('/')}
        onNavigateAnalytics={canManageInventory ? () => navigate('/analytics') : undefined}
        onNavigateProfits={canManageInventory ? () => navigate('/profits') : undefined}
        onNavigateOffers={canManageInventory ? () => navigate('/offers') : undefined}
        onNavigatePurchases={canManageInventory ? () => navigate('/purchases') : undefined}
        onNavigateAlarms={canManageInventory ? () => navigate('/alarms') : undefined}
        onNavigateProducts={canManageInventory ? () => navigate('/products') : undefined}
        onNavigateInventory={canManageInventory ? () => navigate('/inventory') : undefined}
        onNavigateInvoices={canManageInventory ? () => navigate('/invoices') : undefined}
        onNavigateSettings={canManageInventory ? () => navigate('/settings') : undefined}
        onNavigateMyCart={canSaveToMyCart ? () => navigate('/my-cart') : undefined}
        onNavigateDebts={canSeeDebts ? () => navigate('/debts') : undefined}
        isDebts
      />
      <div className="flex flex-col gap-4 overflow-y-auto rounded-xl bg-white p-4 shadow-sm dark:bg-slate-900">
        <Card>
          <CardHeader>
            <CardTitle>{t('debtsTitle')}</CardTitle>
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('debtsDescription')}</p>
          </CardHeader>
          <CardContent>
            {feedback && (
              <div
                className={`mb-4 rounded-lg border p-3 text-sm ${
                  feedback.type === 'success'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-100'
                    : 'border-red-200 bg-red-50 text-red-600 dark:border-red-800 dark:bg-red-900/40 dark:text-red-200'
                }`}
              >
                {feedback.message}
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
                <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  <tr>
                    <th className="px-3 py-2 text-left">{t('debtsClient')}</th>
                    <th className="px-3 py-2 text-left">{t('debtsTransaction')}</th>
                    <th className="px-3 py-2 text-right">{t('debtsTotal')}</th>
                    <th className="px-3 py-2 text-right">{t('debtsPaid')}</th>
                    <th className="px-3 py-2 text-right">{t('debtsBalance')}</th>
                    <th className="px-3 py-2 text-left">{t('debtsCreated')}</th>
                    <th className="px-3 py-2 text-right">{t('debtsActions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {debts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                        {debtsQuery.isLoading ? t('debtsLoading') : t('debtsEmpty')}
                      </td>
                    </tr>
                  ) : (
                    debts.map((debt) => {
                      const totalText = `${formatCurrency(debt.totalUsd, 'USD', locale)} • ${formatCurrency(debt.totalLbp, 'LBP', locale)}`;
                      const paidText = `${formatCurrency(debt.paidUsd, 'USD', locale)} • ${formatCurrency(debt.paidLbp, 'LBP', locale)}`;
                      const balanceText = `${formatCurrency(debt.balanceUsd, 'USD', locale)} • ${formatCurrency(debt.balanceLbp, 'LBP', locale)}`;
                      const createdAt = new Date(debt.createdAt).toLocaleString(locale);
                      return (
                        <tr key={debt.id} className="hover:bg-slate-100/60 dark:hover:bg-slate-800/60">
                          <td className="px-3 py-2 font-medium text-slate-700 dark:text-slate-200">
                            {debt.debtCardName ?? t('debtsUnknownClient')}
                          </td>
                          <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{debt.transactionNumber}</td>
                          <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-200">{totalText}</td>
                          <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-200">{paidText}</td>
                          <td className="px-3 py-2 text-right text-red-600 dark:text-red-400">{balanceText}</td>
                          <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{createdAt}</td>
                          <td className="px-3 py-2 text-right">
                            <Button type="button" onClick={() => handleSelectDebt(debt)}>
                              {t('debtsSettleAction')}
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
        {selectedDebt && (
          <Card className="max-w-xl">
            <CardHeader>
              <CardTitle>{t('debtsSettleTitle', { name: selectedDebt.debtCardName ?? t('debtsUnknownClient') })}</CardTitle>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t('debtsSettleDescription', {
                  balanceUsd: formatCurrency(selectedDebt.balanceUsd, 'USD', locale),
                  balanceLbp: formatCurrency(selectedDebt.balanceLbp, 'LBP', locale)
                })}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">{t('debtsSettleUsd')}</label>
                <Input value={settleUsd} onChange={(event) => setSettleUsd(event.target.value)} inputMode="decimal" />
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">{t('debtsSettleLbp')}</label>
                <Input value={settleLbp} onChange={(event) => setSettleLbp(event.target.value)} inputMode="decimal" />
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" onClick={handleSettle} disabled={settleDebt.isPending}>
                  {settleDebt.isPending ? t('debtsSettling') : t('debtsConfirmSettle')}
                </Button>
                <Button type="button" variant="secondary" onClick={() => setSelectedDebtId(null)}>
                  {t('debtsCancelSettle')}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
