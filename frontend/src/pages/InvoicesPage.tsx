import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { TopBar } from '../components/pos/TopBar';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { TransactionsService, type Transaction, type TransactionLine, type TransactionItemInput } from '../lib/TransactionsService';
import { useAuthStore } from '../stores/authStore';
import { formatCurrency } from '../lib/utils';
import { API_BASE_URL } from '../lib/api';
import type { Product } from '../lib/ProductsService';

interface InvoiceDraftItem {
  id: string;
  productId: string;
  productName: string;
  barcode: string;
  priceRuleId?: string | null;
  priceRuleDescription?: string | null;
  baseUnitPriceUsd: number;
  unitPriceUsd: number;
  quantity: string;
  manualDiscount: string;
  quantityOnHand: number;
  isWaste: boolean;
}

const createDraftFromLine = (line: TransactionLine): InvoiceDraftItem => ({
  id: line.id,
  productId: line.productId,
  productName: line.productName,
  barcode: line.productBarcode ?? '',
  priceRuleId: line.priceRuleId ?? null,
  priceRuleDescription: line.priceRuleDescription ?? null,
  baseUnitPriceUsd: line.baseUnitPriceUsd,
  unitPriceUsd: line.unitPriceUsd,
  quantity: line.quantity.toString(),
  manualDiscount: line.priceRuleId ? '' : line.discountPercent > 0 ? line.discountPercent.toString() : '',
  quantityOnHand: line.quantityOnHand ?? 0,
  isWaste: line.isWaste
});

const createId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));

export function InvoicesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);
  const role = useAuthStore((state) => state.role);
  const token = useAuthStore((state) => state.token);

  const canManageInventory = role?.toLowerCase() === 'admin' || role?.toLowerCase() === 'manager';

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [barcode, setBarcode] = useState('');
  const [items, setItems] = useState<InvoiceDraftItem[]>([]);
  const [exchangeRate, setExchangeRate] = useState('');
  const [paidUsd, setPaidUsd] = useState('');
  const [paidLbp, setPaidLbp] = useState('');
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [lastFocusedId, setLastFocusedId] = useState<string | null>(null);

  const quantityInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const transactionsQuery = TransactionsService.useTransactions();
  const transactionQuery = TransactionsService.useTransaction(selectedId ?? undefined);
  const updateTransaction = TransactionsService.useUpdateTransaction();

  useEffect(() => {
    if (!banner) {
      return;
    }
    const timeout = window.setTimeout(() => setBanner(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [banner]);

  useEffect(() => {
    if (!transactionQuery.data) {
      return;
    }
    const invoice = transactionQuery.data;
    setExchangeRate(invoice.exchangeRateUsed.toString());
    setPaidUsd(invoice.paidUsd.toString());
    setPaidLbp(invoice.paidLbp.toString());
    setItems(invoice.lines.map(createDraftFromLine));
    setLastFocusedId(null);
  }, [transactionQuery.data]);

  useEffect(() => {
    if (!lastFocusedId) {
      return;
    }
    const input = quantityInputRefs.current[lastFocusedId];
    if (input) {
      input.focus();
      const select = () => input.select();
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(select);
      } else {
        select();
      }
    }
  }, [lastFocusedId]);

  const totals = useMemo(() => {
    const rate = Number(exchangeRate) > 0 ? Number(exchangeRate) : 0;
    return items.reduce(
      (acc, item) => {
        const quantity = Number(item.quantity);
        if (!Number.isFinite(quantity) || quantity <= 0) {
          return acc;
        }
        acc.usd += quantity * item.unitPriceUsd;
        if (rate > 0) {
          acc.lbp += quantity * item.unitPriceUsd * rate;
        }
        return acc;
      },
      { usd: 0, lbp: 0 }
    );
  }, [items, exchangeRate]);

  const isSaving = updateTransaction.isPending;

  const handleSelect = (transaction: Transaction) => {
    setSelectedId(transaction.id);
    setBanner(null);
  };

  const handleFetchProduct = async (code: string): Promise<Product | null> => {
    const trimmed = code.trim();
    if (!trimmed) {
      return null;
    }
    const response = await fetch(`${API_BASE_URL}/api/products/scan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ barcode: trimmed })
    });
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || t('invoicesUpdateError'));
    }
    return (await response.json()) as Product;
  };

  const handleAddProduct = async () => {
    const trimmed = barcode.trim();
    if (!trimmed) {
      return;
    }
    try {
      const product = await handleFetchProduct(trimmed);
      if (!product) {
        setBanner({ type: 'error', message: t('invoicesUpdateError') });
        return;
      }
      setItems((previous) => {
        const existingIndex = previous.findIndex((item) => item.productId === product.id);
        if (existingIndex >= 0) {
          const next = [...previous];
          const target = next[existingIndex];
          const nextQuantity = (Number(target.quantity) || 0) + 1;
          next[existingIndex] = { ...target, quantity: nextQuantity.toString() };
          setLastFocusedId(target.id);
          return next;
        }
        const unitPrice = product.priceUsd ?? 0;
        const draft: InvoiceDraftItem = {
          id: product.id ?? createId(),
          productId: product.id,
          productName: product.name,
          barcode: product.barcode ?? trimmed,
          priceRuleId: null,
          priceRuleDescription: null,
          baseUnitPriceUsd: unitPrice,
          unitPriceUsd: unitPrice,
          quantity: '1',
          manualDiscount: '',
          quantityOnHand: product.quantityOnHand ?? 0,
          isWaste: false
        };
        setLastFocusedId(draft.id);
        return [...previous, draft];
      });
      setBarcode('');
      setBanner(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : t('invoicesUpdateError');
      setBanner({ type: 'error', message });
    }
  };

  const handleLineChange = (id: string, field: 'quantity' | 'manualDiscount', value: string) => {
    setItems((previous) =>
      previous.map((item) => {
        if (item.id !== id) {
          return item;
        }
        if (field === 'manualDiscount') {
          const discount = Number(value);
          if (!Number.isFinite(discount) || discount < 0) {
            return { ...item, manualDiscount: value };
          }
          const clamped = Math.max(0, Math.min(discount, 100));
          const discountedPrice = item.baseUnitPriceUsd * (1 - clamped / 100);
          return { ...item, manualDiscount: value, unitPriceUsd: Math.max(discountedPrice, 0) };
        }
        return { ...item, [field]: value };
      })
    );
  };

  const handleRemoveLine = (id: string) => {
    setItems((previous) => previous.filter((item) => item.id !== id));
    if (lastFocusedId === id) {
      setLastFocusedId(null);
    }
  };

  const handleClearSelection = () => {
    setSelectedId(null);
    setItems([]);
    setExchangeRate('');
    setPaidUsd('');
    setPaidLbp('');
    setBarcode('');
    setBanner(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedId) {
      setBanner({ type: 'error', message: t('invoicesSelectPrompt') });
      return;
    }

    const rate = Number(exchangeRate);
    if (!Number.isFinite(rate) || rate <= 0) {
      setBanner({ type: 'error', message: t('invoicesValidationError') });
      return;
    }

    if (items.length === 0) {
      setBanner({ type: 'error', message: t('invoicesValidationError') });
      return;
    }

    const payloadItems: TransactionItemInput[] = [];
    for (const item of items) {
      const quantity = Number(item.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        setBanner({ type: 'error', message: t('invoicesValidationError') });
        return;
      }
      const manualDiscount = Number(item.manualDiscount);
      payloadItems.push({
        productId: item.productId,
        quantity,
        priceRuleId: item.priceRuleId ?? undefined,
        manualDiscountPercent:
          item.priceRuleId || !Number.isFinite(manualDiscount) || manualDiscount <= 0
            ? undefined
            : manualDiscount,
        isWaste: item.isWaste || undefined
      });
    }

    const paidUsdValue = Number(paidUsd);
    const paidLbpValue = Number(paidLbp);

    try {
      const updated = await updateTransaction.mutateAsync({
        id: selectedId,
        payload: {
          exchangeRate: rate,
          paidUsd: Number.isFinite(paidUsdValue) ? paidUsdValue : 0,
          paidLbp: Number.isFinite(paidLbpValue) ? paidLbpValue : 0,
          items: payloadItems
        }
      });
      setItems(updated.lines.map(createDraftFromLine));
      setExchangeRate(updated.exchangeRateUsed.toString());
      setPaidUsd(updated.paidUsd.toString());
      setPaidLbp(updated.paidLbp.toString());
      setBanner({ type: 'success', message: t('invoicesUpdated') });
    } catch (error) {
      const message = error instanceof Error ? error.message : t('invoicesUpdateError');
      setBanner({ type: 'error', message });
    }
  };

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
        onNavigateMyCart={role?.toLowerCase() === 'admin' ? () => navigate('/my-cart') : undefined}
        isInvoices
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
        <Card className="space-y-4 p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t('invoicesHistoryTitle')}</h2>
          {transactionsQuery.isLoading && <p className="text-sm text-slate-500">{t('inventoryLoading')}</p>}
          {transactionsQuery.isError && <p className="text-sm text-red-600">{t('invoicesUpdateError')}</p>}
          {transactionsQuery.data && transactionsQuery.data.length === 0 && !transactionsQuery.isLoading && (
            <p className="text-sm text-slate-500">{t('invoicesHistoryEmpty')}</p>
          )}
          <div className="space-y-3">
            {transactionsQuery.data?.map((transaction) => {
              const isSelected = selectedId === transaction.id;
              const cardClasses = `rounded-lg border p-4 text-sm transition-colors ${
                isSelected
                  ? 'border-emerald-400 bg-emerald-50 shadow-sm dark:border-emerald-700/60 dark:bg-emerald-900/20'
                  : 'border-slate-200 dark:border-slate-700'
              }`;
              return (
                <div key={transaction.id} className={cardClasses}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">{transaction.transactionNumber}</p>
                      <p className="text-xs text-slate-500">
                        {new Date(transaction.createdAt).toLocaleString()} · {transaction.cashierName}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-emerald-600 dark:text-emerald-300">
                        {formatCurrency(transaction.totalUsd, 'USD')}
                      </p>
                      <p className="text-xs text-slate-500">{t('invoicesHistoryItems', { count: transaction.lines.length })}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="text-xs uppercase tracking-wide text-slate-500">{transaction.type}</span>
                    <Button
                      type="button"
                      className={`bg-emerald-500 hover:bg-emerald-400 ${isSelected ? 'opacity-60' : ''}`}
                      onClick={() => handleSelect(transaction)}
                      disabled={isSelected}
                    >
                      {isSelected ? t('purchasesEditing') : t('purchasesEditAction')}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
        <Card className="space-y-4 p-6">
          <CardHeader className="space-y-1 px-0">
            <CardTitle>
              {selectedId && transactionQuery.data
                ? t('invoicesEditing', { number: transactionQuery.data.transactionNumber })
                : t('invoicesSelectPrompt')}
            </CardTitle>
            <p className="text-sm text-slate-500">{t('invoicesSelectPrompt')}</p>
          </CardHeader>
          <CardContent className="space-y-4 px-0">
            {banner && (
              <div
                className={`rounded-lg border p-3 text-sm ${
                  banner.type === 'success'
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700/50 dark:bg-emerald-900/20 dark:text-emerald-200'
                    : 'border-red-300 bg-red-50 text-red-700 dark:border-red-700/50 dark:bg-red-900/20 dark:text-red-200'
                }`}
              >
                {banner.message}
              </div>
            )}
            {!selectedId && (
              <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                {t('invoicesNoSelection')}
              </p>
            )}
            {selectedId && (
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div className="flex flex-1 gap-2">
                    <Input
                      value={barcode}
                      onChange={(event) => setBarcode(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          void handleAddProduct();
                        }
                      }}
                      placeholder={t('invoicesScanPlaceholder')}
                    />
                    <Button type="button" className="bg-emerald-500 hover:bg-emerald-400" onClick={() => void handleAddProduct()}>
                      {t('invoicesAddItem')}
                    </Button>
                  </div>
                  <Button type="button" className="bg-slate-200 text-slate-800 hover:bg-slate-300" onClick={handleClearSelection}>
                    {t('invoicesCancelEdit')}
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-600 dark:text-slate-300" htmlFor="exchange-rate">
                      {t('invoicesExchangeRate')}
                    </label>
                    <Input
                      id="exchange-rate"
                      type="number"
                      min="1"
                      step="0.01"
                      value={exchangeRate}
                      onChange={(event) => setExchangeRate(event.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-600 dark:text-slate-300" htmlFor="paid-usd">
                      {t('invoicesPaidUsd')}
                    </label>
                    <Input
                      id="paid-usd"
                      type="number"
                      step="0.01"
                      value={paidUsd}
                      onChange={(event) => setPaidUsd(event.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-600 dark:text-slate-300" htmlFor="paid-lbp">
                      {t('invoicesPaidLbp')}
                    </label>
                    <Input
                      id="paid-lbp"
                      type="number"
                      step="0.01"
                      value={paidLbp}
                      onChange={(event) => setPaidLbp(event.target.value)}
                    />
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-left text-sm dark:divide-slate-800">
                    <thead className="bg-slate-50 dark:bg-slate-800/50">
                      <tr className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        <th className="px-4 py-3">{t('product')}</th>
                        <th className="px-4 py-3">{t('quantity')}</th>
                        <th className="px-4 py-3">{t('price')}</th>
                        <th className="px-4 py-3">{t('invoicesDiscount')}</th>
                        <th className="px-4 py-3">{t('total')}</th>
                        <th className="px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {items.length === 0 && (
                        <tr>
                          <td className="px-4 py-6 text-center text-sm text-slate-500" colSpan={6}>
                            {t('invoicesNoSelection')}
                          </td>
                        </tr>
                      )}
                      {items.map((item) => {
                        const quantityNumber = Number(item.quantity);
                        const lineTotal = Number.isFinite(quantityNumber) ? quantityNumber * item.unitPriceUsd : 0;
                        return (
                          <tr key={item.id} className="align-top text-slate-700 dark:text-slate-200">
                            <td className="px-4 py-3">
                              <div className="flex flex-col gap-1">
                                <span className="font-medium">{item.productName}</span>
                                <span className="text-xs text-slate-500">{t('inventoryBarcode')}: {item.barcode || '—'}</span>
                                <span className="text-xs text-slate-500">{t('purchasesOnHand', { count: item.quantityOnHand })}</span>
                                {item.priceRuleDescription && (
                                  <Badge className="w-fit bg-indigo-500">{item.priceRuleDescription}</Badge>
                                )}
                                {item.isWaste && (
                                  <Badge className="w-fit bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200">
                                    {t('cartWasteBadge')}
                                  </Badge>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.quantity}
                                onChange={(event) => handleLineChange(item.id, 'quantity', event.target.value)}
                                ref={(element) => {
                                  if (element) {
                                    quantityInputRefs.current[item.id] = element;
                                  } else {
                                    delete quantityInputRefs.current[item.id];
                                  }
                                }}
                                required
                              />
                            </td>
                            <td className="px-4 py-3">{formatCurrency(item.unitPriceUsd, 'USD')}</td>
                            <td className="px-4 py-3">
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                value={item.manualDiscount}
                                onChange={(event) => handleLineChange(item.id, 'manualDiscount', event.target.value)}
                                disabled={!!item.priceRuleId || item.isWaste}
                                placeholder={item.priceRuleId ? t('purchasesExistingBadge') : '0'}
                              />
                            </td>
                            <td className="px-4 py-3">{formatCurrency(lineTotal, 'USD')}</td>
                            <td className="px-4 py-3 text-right">
                              <Button type="button" className="bg-red-500 hover:bg-red-400" onClick={() => handleRemoveLine(item.id)}>
                                {t('removeItem')}
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-col gap-3 rounded-lg bg-slate-50 p-4 text-sm dark:bg-slate-900/50">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-600 dark:text-slate-300">{t('invoicesTotalsUsd')}</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-300">
                      {formatCurrency(totals.usd, 'USD')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-600 dark:text-slate-300">{t('invoicesTotalsLbp')}</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-300">
                      {formatCurrency(totals.lbp, 'LBP')}
                    </span>
                  </div>
                </div>
                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-500" disabled={isSaving}>
                  {isSaving ? t('inventorySaving') : t('invoicesUpdate')}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
