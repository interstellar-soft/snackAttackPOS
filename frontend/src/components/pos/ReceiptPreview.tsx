import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { SVGProps } from 'react';
import { Card, CardContent, CardTitle } from '../ui/card';
import { useCartStore } from '../../stores/cartStore';
import { formatCurrency } from '../../lib/utils';

function TrashIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M3 6h18" />
      <path d="M8 6V4.5A1.5 1.5 0 0 1 9.5 3h5A1.5 1.5 0 0 1 16 4.5V6" />
      <path d="M18 6v13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

export function ReceiptPreview() {
  const { t, i18n } = useTranslation();
  const { items, subtotalUsd, subtotalLbp, removeItem } = useCartStore();

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
            <div
              key={line.productId}
              className="flex items-start justify-between border-b border-dashed border-slate-200 pb-1 text-xs dark:border-slate-700"
            >
              <span className="max-w-[60%] truncate" title={line.name}>
                {line.name}
              </span>
              <div className="flex items-center gap-2 text-right">
                <span>
                  {line.quantity} ×{' '}
                  {formatCurrency(line.priceUsd, 'USD', i18n.language === 'ar' ? 'ar-LB' : 'en-US')}
                </span>
                <button
                  type="button"
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-red-200 text-red-600 transition hover:border-red-300 hover:bg-red-50 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-white dark:border-red-500/40 dark:text-red-300 dark:hover:border-red-400 dark:hover:bg-red-900/30 dark:hover:text-red-200 dark:focus:ring-offset-slate-900"
                  aria-label={t('removeItem')}
                  onClick={() => removeItem(line.productId)}
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                </button>
              </div>
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
