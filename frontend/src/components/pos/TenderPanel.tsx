import { useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { DebtCardSelect } from './DebtCardSelect';
import { formatCurrency } from '../../lib/utils';
import { useCartStore } from '../../stores/cartStore';

interface TenderPanelProps {
  paidUsdText: string;
  paidLbpText: string;
  onChangePaidUsdText: Dispatch<SetStateAction<string>>;
  onChangePaidLbpText: Dispatch<SetStateAction<string>>;
  onCommitPaidUsdAmount: Dispatch<SetStateAction<number>>;
  onCommitPaidLbpAmount: Dispatch<SetStateAction<number>>;
  onCheckout: () => void;
  balanceUsd: number;
  balanceLbp: number;
  exchangeRate: number;
  onOpenRateModal: () => void;
  canEditRate: boolean;
  disabled?: boolean;
  canSaveToMyCart?: boolean;
  saveToMyCart?: boolean;
  onToggleSaveToMyCart?: (next: boolean) => void;
  isRefund?: boolean;
  onToggleRefund?: (next: boolean) => void;
  onResumeHeldCart?: () => void;
  isDebtCheckout?: boolean;
  onToggleDebtCheckout?: (next: boolean) => void;
  debtCardName?: string;
  onChangeDebtCardName?: (next: string) => void;
  debtCardOptions?: string[];
  debtCardOptionsLoading?: boolean;
}

export function TenderPanel({
  paidUsdText,
  paidLbpText,
  onChangePaidUsdText,
  onChangePaidLbpText,
  onCommitPaidUsdAmount,
  onCommitPaidLbpAmount,
  onCheckout,
  balanceUsd,
  balanceLbp,
  exchangeRate,
  onOpenRateModal,
  canEditRate,
  disabled = false,
  canSaveToMyCart = false,
  saveToMyCart = false,
  onToggleSaveToMyCart,
  isRefund = false,
  onToggleRefund,
  onResumeHeldCart,
  isDebtCheckout = false,
  onToggleDebtCheckout,
  debtCardName = '',
  onChangeDebtCardName,
  debtCardOptions = [],
  debtCardOptionsLoading = false
}: TenderPanelProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'ar' ? 'ar-LB' : 'en-US';
  const balanceUsdText = formatCurrency(balanceUsd, 'USD', locale);
  const balanceLbpText = formatCurrency(balanceLbp, 'LBP', locale);
  const [heldCartSearch, setHeldCartSearch] = useState('');
  const { heldCarts, resumeHeldCart, removeHeldCart } = useCartStore((state) => ({
    heldCarts: state.heldCarts,
    resumeHeldCart: state.resumeHeldCart,
    removeHeldCart: state.removeHeldCart
  }));

  const heldCartDateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        dateStyle: 'short',
        timeStyle: 'short'
      }),
    [locale]
  );

  const filteredHeldCarts = useMemo(() => {
    const search = heldCartSearch.trim().toLowerCase();
    if (!search) {
      return heldCarts;
    }
    return heldCarts.filter((cart) => cart.name.toLowerCase().includes(search));
  }, [heldCartSearch, heldCarts]);

  const focusCurrencyClass = (balance: number) => {
    if (balance > 0) {
      return 'text-red-500 text-lg font-extrabold';
    }
    if (balance < 0) {
      return 'text-emerald-500 text-lg font-extrabold';
    }
    return 'text-lg font-extrabold text-slate-900 dark:text-slate-100';
  };

  const handleResumeHeldCart = (id: string) => {
    const success = resumeHeldCart(id);
    if (success) {
      setHeldCartSearch('');
      onResumeHeldCart?.();
    }
  };

  const parseAmount = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const parsed = Number(trimmed.replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  };

  const handleCommitUsd = () => {
    const parsed = parseAmount(paidUsdText);
    if (parsed !== null) {
      onCommitPaidUsdAmount(parsed);
      onChangePaidUsdText(parsed.toString());
    }
  };

  const handleCommitLbp = () => {
    const parsed = parseAmount(paidLbpText);
    if (parsed !== null) {
      onCommitPaidLbpAmount(parsed);
      onChangePaidLbpText(parsed.toString());
    }
  };

  const checkoutDisabled =
    Boolean(disabled) || (isDebtCheckout && debtCardName.trim().length === 0);

  return (
    <Card className="bg-white dark:bg-slate-900">
      <CardHeader className="flex items-center justify-between">
        <CardTitle>{t('checkout')}</CardTitle>
        <button className="text-xs text-emerald-600" onClick={onOpenRateModal} disabled={!canEditRate}>
          <Badge className="cursor-pointer bg-emerald-200 text-emerald-900 dark:bg-emerald-800 dark:text-emerald-100">
            1 USD = {exchangeRate.toLocaleString(locale)} LBP
          </Badge>
        </button>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">USD</label>
          <Input
            type="number"
            value={paidUsdText}
            min={0}
            step="0.01"
            onChange={(event) => onChangePaidUsdText(event.target.value)}
            onBlur={handleCommitUsd}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleCommitUsd();
              }
            }}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">LBP</label>
          <Input
            type="number"
            value={paidLbpText}
            min={0}
            step="1"
            onChange={(event) => onChangePaidLbpText(event.target.value)}
            onBlur={handleCommitLbp}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleCommitLbp();
              }
            }}
          />
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="flex justify-between">
            <span>Balance USD</span>
            <span className={focusCurrencyClass(balanceUsd)}>{balanceUsdText}</span>
          </div>
          <div className="flex justify-between">
            <span>Balance LBP</span>
            <span className={focusCurrencyClass(balanceLbp)}>{balanceLbpText}</span>
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
          <input type="checkbox" checked={isRefund} onChange={(event) => onToggleRefund?.(event.target.checked)} />
          <span>{t('tenderRefundMode')}</span>
        </label>
        <label className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            checked={isDebtCheckout}
            onChange={(event) => onToggleDebtCheckout?.(event.target.checked)}
            disabled={disabled || isRefund}
          />
          <span>{t('tenderDebtCheckout')}</span>
        </label>
        {isDebtCheckout && (
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">
              {t('tenderDebtCardName')}
            </label>
            <DebtCardSelect
              value={debtCardName}
              onChange={(next) => onChangeDebtCardName?.(next)}
              options={debtCardOptions}
              placeholder={t('tenderDebtCardPlaceholder')}
              disabled={disabled}
              isLoading={debtCardOptionsLoading}
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {t('tenderDebtCheckoutHelp')}
            </p>
          </div>
        )}
        {canSaveToMyCart && (
          <label className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={saveToMyCart}
              onChange={(event) => onToggleSaveToMyCart?.(event.target.checked)}
              disabled={isRefund || isDebtCheckout}
            />
            <span>{t('tenderSaveToMyCart')}</span>
          </label>
        )}
        <Button type="button" className="w-full" onClick={onCheckout} disabled={checkoutDisabled}>
          {t('checkout')}
        </Button>
        <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-900/40">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold text-slate-700 dark:text-slate-200">{t('heldCarts')}</p>
            {heldCarts.length > 0 && (
              <Input
                value={heldCartSearch}
                onChange={(event) => setHeldCartSearch(event.target.value)}
                placeholder={t('heldCartSearchPlaceholder')}
                className="h-8 w-full max-w-xs text-sm"
              />
            )}
          </div>
          {heldCarts.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">{t('heldCartsEmpty')}</p>
          ) : filteredHeldCarts.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">{t('heldCartsEmptySearch')}</p>
          ) : (
            <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
              {filteredHeldCarts.map((cart) => {
                const totalUsdText = formatCurrency(cart.totalUsd, 'USD', locale);
                const totalLbpText = formatCurrency(cart.totalLbp, 'LBP', locale);
                const timestamp = heldCartDateFormatter.format(cart.createdAt);
                return (
                  <div
                    key={cart.id}
                    className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-800 dark:text-slate-100">{cart.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {t('heldCartCreatedAt', { time: timestamp })}
                        </p>
                      </div>
                      <div className="text-right text-xs text-slate-500 dark:text-slate-400">
                        <p>{t('heldCartTotals', { usd: totalUsdText, lbp: totalLbpText })}</p>
                        <p>{t('heldCartItemCount', { count: cart.items.length })}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button type="button" className="bg-indigo-600 hover:bg-indigo-500" onClick={() => handleResumeHeldCart(cart.id)}>
                        {t('resumeCart')}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-600/40 dark:text-red-300 dark:hover:bg-red-900/30"
                        onClick={() => removeHeldCart(cart.id)}
                      >
                        {t('removeCart')}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
