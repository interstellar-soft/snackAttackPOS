import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { useCartStore } from '../../stores/cartStore';
import { formatCurrency } from '../../lib/utils';
import { useStoreProfileStore } from '../../stores/storeProfileStore';

interface ReceiptPreviewProps {
  useCostPricing?: boolean;
}

export function ReceiptPreview({ useCostPricing = false }: ReceiptPreviewProps = {}) {
  const { t, i18n } = useTranslation();
  const { items, subtotalUsd, subtotalLbp, removeItem, rate } = useCartStore((state) => ({
    items: state.items,
    subtotalUsd: state.subtotalUsd,
    subtotalLbp: state.subtotalLbp,
    removeItem: state.removeItem,
    rate: state.rate
  }));
  const locale = i18n.language === 'ar' ? 'ar-LB' : 'en-US';
  const storeName = useStoreProfileStore((state) => state.name);

  return (
    <Card className="flex h-full w-full flex-col bg-slate-50 text-sm dark:bg-slate-900">
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
              <div key={item.lineId} className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="truncate font-medium text-slate-700 dark:text-slate-200">{item.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">x{item.quantity}</p>
                  {item.isWaste && (
                    <Badge className="mt-1 bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-200">
                      {t('cartWasteBadge')}
                    </Badge>
                  )}
                  {!item.isWaste &&
                    (item.manualTotalUsd !== null && item.manualTotalUsd !== undefined ||
                      item.manualTotalLbp !== null && item.manualTotalLbp !== undefined) && (
                      <Badge className="mt-1 bg-indigo-100 text-indigo-900 dark:bg-indigo-900/40 dark:text-indigo-200">
                        {t('cartManualOverrideApplied')}
                      </Badge>
                    )}
                </div>
                <div className="flex items-center gap-1">
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-200">
                    {formatCurrency(
                      (() => {
                        if (item.isWaste) {
                          return 0;
                        }
                        const manualUsd =
                          item.manualTotalUsd !== null && item.manualTotalUsd !== undefined
                            ? item.manualTotalUsd
                            : null;
                        const manualUsdFromLbp =
                          manualUsd === null &&
                          item.manualTotalLbp !== null &&
                          item.manualTotalLbp !== undefined &&
                          rate > 0
                            ? Math.round((item.manualTotalLbp / rate) * 100) / 100
                            : null;
                        if (manualUsd !== null) {
                          return manualUsd;
                        }
                        if (manualUsdFromLbp !== null) {
                          return manualUsdFromLbp;
                        }
                        const baseUnit = useCostPricing ? item.costUsd : item.priceUsd;
                        const discountPercent = useCostPricing ? 0 : item.discountPercent;
                        return baseUnit * item.quantity * (1 - discountPercent / 100);
                      })(),
                      'USD',
                      locale
                    )}
                  </p>
                  <button
                    type="button"
                    aria-label={t('removeItem') ?? 'Remove item'}
                    onClick={() => removeItem(item.lineId)}
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
              {formatCurrency(subtotalUsd(useCostPricing), 'USD', locale)}
            </span>
          </div>
          <div className="flex justify-between">
            <span>{t('total')} LBP</span>
            <span className="font-semibold">
              {formatCurrency(subtotalLbp(useCostPricing), 'LBP', locale)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
