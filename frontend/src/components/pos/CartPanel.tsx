import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { useCartStore } from '../../stores/cartStore';
import { formatCurrency } from '../../lib/utils';

interface CartPanelProps {
  onClear: () => void;
}

export function CartPanel({ onClear }: CartPanelProps) {
  const { t, i18n } = useTranslation();
  const { items, updateQuantity, updateDiscount, removeItem, subtotalUsd, subtotalLbp } = useCartStore();

  return (
    <Card className="h-full bg-slate-50 dark:bg-slate-900">
      <CardHeader>
        <CardTitle>{t('cart')}</CardTitle>
        <Button type="button" className="bg-slate-600 hover:bg-slate-500" onClick={onClear}>
          {t('clearCart')}
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 overflow-y-auto">
          {items.map((item) => (
            <div key={item.productId} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold">{item.name}</p>
                  <p className="text-xs text-slate-500">{item.sku}</p>
                </div>
                <button className="text-xs text-red-500" onClick={() => removeItem(item.productId)}>
                  ×
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
                    {formatCurrency(item.priceUsd * item.quantity * (1 - item.discountPercent / 100), 'USD', i18n.language === 'ar' ? 'ar-LB' : 'en-US')}
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
      </CardContent>
    </Card>
  );
}
