import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { useCartStore } from '../../stores/cartStore';
import { formatCurrency } from '../../lib/utils';
import { useStoreProfileStore } from '../../stores/storeProfileStore';

export function ReceiptPreview() {
  const { t, i18n } = useTranslation();
  const { items, subtotalUsd, subtotalLbp, removeItem } = useCartStore();
  const locale = i18n.language === 'ar' ? 'ar-LB' : 'en-US';
  const storeName = useStoreProfileStore((state) => state.name);

  return (
    <Card className="flex h-full flex-col bg-slate-50 text-sm dark:bg-slate-900">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-slate-700 dark:text-slate-100">
          {t('receiptPreview')}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col space-y-3 overflow-y-auto">
        <div className="text-center text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {storeName}
        </div>
        <div className="flex-1 space-y-2 overflow-y-auto pr-1">
          {items.length > 0 ? (
            items.map((item) => (
              <div key={item.productId} className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="truncate font-medium text-slate-700 dark:text-slate-200">{item.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">x{item.quantity}</p>
                </div>
                <div className="flex items-center gap-1">
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-200">
                    {formatCurrency(item.priceUsd * item.quantity * (1 - item.discountPercent / 100), 'USD', locale)}
                  </p>
                  <button
                    type="button"
                    aria-label={t('removeItem') ?? 'Remove item'}
                    onClick={() => removeItem(item.productId)}
                    className="ml-2 rounded-full p-1 text-xs font-semibold text-red-600 transition-colors hover:text-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 dark:text-red-400 dark:hover:text-red-300"
                  >
                    ×
                  </button>
                </div>
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
