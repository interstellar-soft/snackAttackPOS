import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { useCartStore } from '../../stores/cartStore';
import { formatCurrency } from '../../lib/utils';

export function ReceiptPreview() {
  const { t, i18n } = useTranslation();
  const { items, subtotalUsd, subtotalLbp } = useCartStore();
  const locale = i18n.language === 'ar' ? 'ar-LB' : 'en-US';

  return (
    <Card className="bg-slate-50 text-sm dark:bg-slate-900">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-slate-700 dark:text-slate-100">
          {t('receiptPreview')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="max-h-32 space-y-2 overflow-y-auto pr-1">
          {items.length > 0 ? (
            items.map((item) => (
              <div key={item.productId} className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="truncate font-medium text-slate-700 dark:text-slate-200">{item.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">x{item.quantity}</p>
                </div>
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-200">
                  {formatCurrency(item.priceUsd * item.quantity * (1 - item.discountPercent / 100), 'USD', locale)}
                </p>
              </div>
            ))
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">{t('barcodePlaceholder')}</p>
          )}
        </div>
        <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
          <div className="flex justify-between">
            <span>{t('total')} USD</span>
            <span className="font-semibold">
              {formatCurrency(subtotalUsd(), 'USD', locale)}
            </span>
          </div>
          <div className="flex justify-between">
            <span>{t('total')} LBP</span>
            <span className="font-semibold">
              {formatCurrency(subtotalLbp(), 'LBP', locale)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
