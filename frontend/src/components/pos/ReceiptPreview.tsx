import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardTitle } from '../ui/card';
import { useCartStore } from '../../stores/cartStore';
import { formatCurrency } from '../../lib/utils';

export function ReceiptPreview() {
  const { t, i18n } = useTranslation();
  const { items, subtotalUsd, subtotalLbp } = useCartStore();

  const lines = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        totalUsd: item.priceUsd * item.quantity * (1 - item.discountPercent / 100)
      })),
    [items]
  );

  return (
    <Card className="bg-white dark:bg-slate-900">
      <CardContent className="text-sm">
        <CardTitle className="mb-4 text-center text-base font-semibold">{t('receiptPreview')}</CardTitle>
        <div className="space-y-2">
          {lines.map((line) => (
            <div key={line.productId} className="flex justify-between border-b border-dashed border-slate-200 pb-1 text-xs dark:border-slate-700">
              <span>{line.name}</span>
              <span>
                {line.quantity} × {formatCurrency(line.priceUsd, 'USD', i18n.language === 'ar' ? 'ar-LB' : 'en-US')}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-4 space-y-1 border-t border-slate-200 pt-2 text-sm dark:border-slate-700">
          <div className="flex justify-between">
            <span>{t('total')} USD</span>
            <span className="font-semibold">{formatCurrency(subtotalUsd(), 'USD', i18n.language === 'ar' ? 'ar-LB' : 'en-US')}</span>
          </div>
          <div className="flex justify-between">
            <span>{t('total')} LBP</span>
            <span className="font-semibold">{formatCurrency(subtotalLbp(), 'LBP', i18n.language === 'ar' ? 'ar-LB' : 'en-US')}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
