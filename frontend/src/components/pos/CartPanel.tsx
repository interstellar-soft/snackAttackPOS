import { useTranslation } from 'react-i18next';
import type { SVGProps } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { useCartStore } from '../../stores/cartStore';
import { formatCurrency } from '../../lib/utils';

function TrashIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 6h18" />
      <path d="M8 6V4.5A1.5 1.5 0 0 1 9.5 3h5A1.5 1.5 0 0 1 16 4.5V6" />
      <path d="M18 6v13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

interface CartPanelProps {
  onClear: () => void;
}

export function CartPanel({ onClear }: CartPanelProps) {
  const { t, i18n } = useTranslation();
  const { items, updateQuantity, updateDiscount, removeItem, subtotalUsd, subtotalLbp } = useCartStore();

  return (
    <Card className="flex h-full flex-col bg-slate-50 dark:bg-slate-900">
      <CardHeader>
        <CardTitle>{t('cart')}</CardTitle>
        <Button type="button" className="bg-slate-600 hover:bg-slate-500" onClick={onClear}>
          {t('clearCart')}
        </Button>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        <div className="flex h-full flex-col">
          <div className="flex-1 overflow-y-auto space-y-3">
            {items.map((item) => (
              <div
                key={item.productId}
                className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold">{item.name}</p>
                    <p className="text-xs text-slate-500">{item.sku}</p>
                  </div>
                  <button
                    type="button"
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-red-200 text-red-600 transition hover:border-red-300 hover:bg-red-50 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-white dark:border-red-500/40 dark:text-red-300 dark:hover:border-red-400 dark:hover:bg-red-900/30 dark:hover:text-red-200 dark:focus:ring-offset-slate-900"
                    aria-label={t('removeItem')}
                    onClick={() => removeItem(item.productId)}
                  >
                    <TrashIcon className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                  <label className="space-y-1">
                    <span>{t('quantity')}</span>
                    <Input
                      type="number"
                      min={0}
                      value={item.quantity}
                      onChange={(event) => updateQuantity(item.productId, Number(event.target.value))}
                    />
                  </label>
                  <label className="space-y-1">
                    <span>{t('discount')}</span>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={item.discountPercent}
                      onChange={(event) => updateDiscount(item.productId, Number(event.target.value))}
                    />
                  </label>
                  <div className="space-y-1">
                    <span>{t('total')}</span>
                    <div className="rounded-md border border-slate-200 bg-slate-100 px-2 py-2 text-sm font-semibold dark:border-slate-700 dark:bg-slate-700">
                      {formatCurrency(
                        item.priceUsd * item.quantity * (1 - item.discountPercent / 100),
                        'USD',
                        i18n.language === 'ar' ? 'ar-LB' : 'en-US'
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {items.length === 0 && <p className="text-center text-sm text-slate-500">Cart empty</p>}
          </div>
          <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="flex justify-between">
              <span>{t('total')} USD</span>
              <span className="font-semibold">{formatCurrency(subtotalUsd(), 'USD', i18n.language === 'ar' ? 'ar-LB' : 'en-US')}</span>
            </div>
            <div className="flex justify-between">
              <span>{t('total')} LBP</span>
              <span className="font-semibold">{formatCurrency(subtotalLbp(), 'LBP', i18n.language === 'ar' ? 'ar-LB' : 'en-US')}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
