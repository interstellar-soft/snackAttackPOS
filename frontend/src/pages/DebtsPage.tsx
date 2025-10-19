import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '../components/pos/TopBar';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { TransactionsService, type DebtCard, type DebtCardTransaction } from '../lib/TransactionsService';
import { formatCurrency } from '../lib/utils';
import { useAuthStore } from '../stores/authStore';
import { useLanguageDirection } from '../hooks/useLanguageDirection';

function formatBalanceText(balanceUsd: number, balanceLbp: number, locale: string) {
  const usd = formatCurrency(Math.max(0, balanceUsd), 'USD', locale);
  const lbp = formatCurrency(Math.max(0, balanceLbp), 'LBP', locale);
  return `${usd} • ${lbp}`;
}

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

  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
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

  const debts = useMemo(() => debtsQuery.data ?? [], [debtsQuery.data]);
  const locale = useMemo(() => (i18n.language === 'ar' ? 'ar-LB' : 'en-US'), [i18n.language]);

  useEffect(() => {
    if (!selectedCardId) {
      return;
    }
    if (!debts.some((card) => card.id === selectedCardId)) {
      setSelectedCardId(null);
      setSelectedTransactionId(null);
    }
  }, [debts, selectedCardId]);

  const selectedCard = useMemo(
    () => debts.find((card) => card.id === selectedCardId) ?? null,
    [debts, selectedCardId]
  );

  useEffect(() => {
    if (!selectedCard) {
      setSelectedTransactionId(null);
      return;
    }
    setSelectedTransactionId((current) => {
      if (current && selectedCard.transactions.some((transaction) => transaction.id === current)) {
        return current;
      }
      const fallback =
        selectedCard.transactions.find((transaction) => transaction.balanceUsd > 0 || transaction.balanceLbp > 0) ??
        selectedCard.transactions[0];
      return fallback?.id ?? null;
    });
  }, [selectedCard]);

  const selectedTransaction = useMemo(() => {
    if (!selectedCard || !selectedTransactionId) {
      return null;
    }
    return selectedCard.transactions.find((transaction) => transaction.id === selectedTransactionId) ?? null;
  }, [selectedCard, selectedTransactionId]);

  useEffect(() => {
    if (!selectedTransaction) {
      setSettleUsd('');
      setSettleLbp('');
      return;
    }
    const usd = selectedTransaction.balanceUsd > 0 ? selectedTransaction.balanceUsd.toFixed(2) : '0';
    const lbp = selectedTransaction.balanceLbp > 0 ? Math.round(selectedTransaction.balanceLbp).toString() : '0';
    setSettleUsd(usd);
    setSettleLbp(lbp);
  }, [selectedTransactionId, selectedTransaction]);

  const handleSelectCard = (card: DebtCard) => {
    setSelectedCardId(card.id);
    setFeedback(null);
  };

  const handleSelectTransaction = (transaction: DebtCardTransaction) => {
    setSelectedTransactionId(transaction.id);
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
    if (!selectedTransaction) {
      return;
    }
    const paidUsd = parseAmount(settleUsd);
    const paidLbp = parseAmount(settleLbp);
    settleDebt.mutate(
      { id: selectedTransaction.id, paidUsd, paidLbp },
      {
        onSuccess: (result) => {
          setFeedback({ type: 'success', message: t('debtsSettleSuccess', { number: result.transactionNumber }) });
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
                    <th className="px-3 py-2 text-left">{t('debtsTransactionsColumn')}</th>
                    <th className="px-3 py-2 text-right">{t('debtsTotal')}</th>
                    <th className="px-3 py-2 text-right">{t('debtsPaid')}</th>
                    <th className="px-3 py-2 text-right">{t('debtsBalance')}</th>
                    <th className="px-3 py-2 text-left">{t('debtsLastSale')}</th>
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
                      const balanceText = formatBalanceText(debt.balanceUsd, debt.balanceLbp, locale);
                      const lastSaleAt = new Date(debt.lastTransactionAt).toLocaleString(locale);
                      return (
                        <tr
                          key={debt.id}
                          className={`hover:bg-slate-100/60 dark:hover:bg-slate-800/60 ${selectedCardId === debt.id ? 'bg-slate-100/80 dark:bg-slate-800/40' : ''}`}
                        >
                          <td className="px-3 py-2 font-medium text-slate-700 dark:text-slate-200">{debt.name || t('debtsUnknownClient')}</td>
                          <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{debt.transactions.length}</td>
                          <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-200">{totalText}</td>
                          <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-200">{paidText}</td>
                          <td className="px-3 py-2 text-right text-red-600 dark:text-red-400">{balanceText}</td>
                          <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{lastSaleAt}</td>
                          <td className="px-3 py-2 text-right">
                            <Button type="button" variant={selectedCardId === debt.id ? 'default' : 'secondary'} onClick={() => handleSelectCard(debt)}>
                              {t('debtsViewDetails')}
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
        {selectedCard && (
          <Card className="max-w-5xl">
            <CardHeader>
              <CardTitle>{t('debtsDetailsTitle', { name: selectedCard.name || t('debtsUnknownClient') })}</CardTitle>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t('debtsDetailsDescription', {
                  totalUsd: formatCurrency(selectedCard.totalUsd, 'USD', locale),
                  totalLbp: formatCurrency(selectedCard.totalLbp, 'LBP', locale),
                  balanceUsd: formatCurrency(selectedCard.balanceUsd, 'USD', locale),
                  balanceLbp: formatCurrency(selectedCard.balanceLbp, 'LBP', locale),
                  count: selectedCard.transactions.length
                })}
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                {selectedCard.transactions.map((transaction) => {
                  const totalText = `${formatCurrency(transaction.totalUsd, 'USD', locale)} • ${formatCurrency(transaction.totalLbp, 'LBP', locale)}`;
                  const paidText = `${formatCurrency(transaction.paidUsd, 'USD', locale)} • ${formatCurrency(transaction.paidLbp, 'LBP', locale)}`;
                  const balanceText = formatBalanceText(transaction.balanceUsd, transaction.balanceLbp, locale);
                  const soldAt = new Date(transaction.createdAt).toLocaleString(locale);
                  const isSelected = transaction.id === selectedTransactionId;
                  const canSettle = transaction.balanceUsd > 0 || transaction.balanceLbp > 0;
                  return (
                    <div
                      key={transaction.id}
                      className={`rounded-lg border border-slate-200 dark:border-slate-800 ${isSelected ? 'ring-2 ring-primary' : ''}`}
                    >
                      <div className="flex flex-col gap-3 border-b border-slate-200 p-4 dark:border-slate-800 md:flex-row md:items-start md:justify-between">
                        <div>
                          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                            {t('debtsTransactionSummary', { number: transaction.transactionNumber, date: soldAt })}
                          </h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {t('debtsTransactionTotals', { total: totalText, paid: paidText })}
                          </p>
                          <p className="text-xs font-semibold text-red-600 dark:text-red-400">
                            {t('debtsTransactionBalance', { balance: balanceText })}
                          </p>
                        </div>
                        <div className="flex flex-col items-start gap-2 md:items-end">
                          <Button
                            type="button"
                            variant={isSelected ? 'default' : 'secondary'}
                            onClick={() => handleSelectTransaction(transaction)}
                            disabled={!canSettle || settleDebt.isPending}
                          >
                            {canSettle ? (isSelected ? t('debtsSelectedSale') : t('debtsSelectSale')) : t('debtsSettledLabel')}
                          </Button>
                          <span className="text-xs text-slate-500 dark:text-slate-400">{soldAt}</span>
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200 text-xs dark:divide-slate-800">
                          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                            <tr>
                              <th className="px-3 py-2 text-left">{t('debtsItem')}</th>
                              <th className="px-3 py-2 text-right">{t('debtsQuantity')}</th>
                              <th className="px-3 py-2 text-right">{t('debtsLineTotal')}</th>
                              <th className="px-3 py-2 text-left">{t('debtsSoldAt')}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                            {transaction.lines.map((line) => {
                              const lineTotal = `${formatCurrency(line.totalUsd, 'USD', locale)} • ${formatCurrency(line.totalLbp, 'LBP', locale)}`;
                              return (
                                <tr key={line.id}>
                                  <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{line.productName}</td>
                                  <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-300">{line.quantity}</td>
                                  <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-200">{lineTotal}</td>
                                  <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{soldAt}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
              {selectedTransaction && (
                <div className="space-y-4 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    {t('debtsSettleSaleTitle', { number: selectedTransaction.transactionNumber })}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {t('debtsSettleSaleDescription', {
                      balanceUsd: formatCurrency(Math.max(0, selectedTransaction.balanceUsd), 'USD', locale),
                      balanceLbp: formatCurrency(Math.max(0, selectedTransaction.balanceLbp), 'LBP', locale)
                    })}
                  </p>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        {t('debtsSettleUsd')}
                      </label>
                      <Input value={settleUsd} onChange={(event) => setSettleUsd(event.target.value)} inputMode="decimal" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        {t('debtsSettleLbp')}
                      </label>
                      <Input value={settleLbp} onChange={(event) => setSettleLbp(event.target.value)} inputMode="decimal" />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" onClick={handleSettle} disabled={settleDebt.isPending}>
                      {settleDebt.isPending ? t('debtsSettling') : t('debtsConfirmSettle')}
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => setSelectedTransactionId(null)}>
                      {t('debtsCancelSettle')}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
