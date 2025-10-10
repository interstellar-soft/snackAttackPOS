import type { Dispatch, SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { formatCurrency } from '../../lib/utils';

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
  onToggleRefund
}: TenderPanelProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'ar' ? 'ar-LB' : 'en-US';
  const balanceUsdText = formatCurrency(balanceUsd, 'USD', locale);
  const balanceLbpText = formatCurrency(balanceLbp, 'LBP', locale);

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
            <span className={balanceUsd > 0 ? 'text-red-500' : balanceUsd < 0 ? 'text-emerald-500' : ''}>{balanceUsdText}</span>
          </div>
          <div className="flex justify-between">
            <span>Balance LBP</span>
            <span className={balanceLbp > 0 ? 'text-red-500' : balanceLbp < 0 ? 'text-emerald-500' : ''}>{balanceLbpText}</span>
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
          <input type="checkbox" checked={isRefund} onChange={(event) => onToggleRefund?.(event.target.checked)} />
          <span>{t('tenderRefundMode')}</span>
        </label>
        {canSaveToMyCart && (
          <label className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={saveToMyCart}
              onChange={(event) => onToggleSaveToMyCart?.(event.target.checked)}
              disabled={isRefund}
            />
            <span>{t('tenderSaveToMyCart')}</span>
          </label>
        )}
        <Button type="button" className="w-full" onClick={onCheckout} disabled={disabled}>
          {t('checkout')}
        </Button>
      </CardContent>
    </Card>
  );
}
