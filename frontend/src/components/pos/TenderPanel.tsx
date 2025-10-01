import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { formatCurrency } from '../../lib/utils';

interface TenderPanelProps {
  paidUsd: number;
  paidLbp: number;
  onChangePaidUsd: (value: number) => void;
  onChangePaidLbp: (value: number) => void;
  onCheckout: () => void;
  balanceUsd: number;
  balanceLbp: number;
  exchangeRate: number;
  onOpenRateModal: () => void;
  canEditRate: boolean;
  disabled?: boolean;
}

export function TenderPanel({
  paidUsd,
  paidLbp,
  onChangePaidUsd,
  onChangePaidLbp,
  onCheckout,
  balanceUsd,
  balanceLbp,
  exchangeRate,
  onOpenRateModal,
  canEditRate,
  disabled = false
}: TenderPanelProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'ar' ? 'ar-LB' : 'en-US';
  const balanceUsdText = formatCurrency(balanceUsd, 'USD', locale);
  const balanceLbpText = formatCurrency(balanceLbp, 'LBP', locale);

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
          <Input type="number" value={paidUsd} min={0} step="0.01" onChange={(event) => onChangePaidUsd(Number(event.target.value))} />
        </div>
        <div>
          <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">LBP</label>
          <Input type="number" value={paidLbp} min={0} step="1" onChange={(event) => onChangePaidLbp(Number(event.target.value))} />
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
        <Button type="button" className="w-full" onClick={onCheckout} disabled={disabled}>
          {t('checkout')}
        </Button>
      </CardContent>
    </Card>
  );
}
