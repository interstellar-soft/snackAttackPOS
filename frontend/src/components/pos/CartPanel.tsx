import { useEffect, useRef, useState } from 'react';
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
  highlightedItemId?: string | null;
  onQuantityConfirm?: () => void;
}

const clampQuantity = (value: number) => {
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.max(1, Math.floor(value));
};

export function CartPanel({ onClear, highlightedItemId, onQuantityConfirm }: CartPanelProps) {
  const { t, i18n } = useTranslation();
  const { items, setItemQuantity, updateDiscount, removeItem, subtotalUsd, subtotalLbp } = useCartStore();
  const quantityInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [draftValues, setDraftValues] = useState<Record<string, { quantity: string; discount: string }>>({});

  useEffect(() => {
    const nextDrafts = items.reduce<Record<string, { quantity: string; discount: string }>>((acc, item) => {
      acc[item.productId] = {
        quantity: String(item.quantity),
        discount: String(item.discountPercent)
      };
      return acc;
    }, {});
    setDraftValues(nextDrafts);
  }, [items]);

  useEffect(() => {
    if (!highlightedItemId) return;
    const input = quantityInputRefs.current[highlightedItemId];
    if (input) {
      input.focus();
      input.select();
    }
  }, [highlightedItemId, items]);

  const commitQuantity = (productId: string, rawValue: string) => {
    const item = items.find((cartItem) => cartItem.productId === productId);
    if (!item) {
      return;
    }
    const trimmed = rawValue.trim();
    if (!trimmed) {
      setDraftValues((prev) => ({
        ...prev,
        [productId]: {
          quantity: String(item.quantity),
          discount: prev[productId]?.discount ?? String(item.discountPercent)
        }
      }));
      return;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      setDraftValues((prev) => ({
        ...prev,
        [productId]: {
          quantity: String(item.quantity),
          discount: prev[productId]?.discount ?? String(item.discountPercent)
        }
      }));
      return;
    }
    const nextQuantity = clampQuantity(parsed);
    setItemQuantity(productId, nextQuantity);
    setDraftValues((prev) => ({
      ...prev,
      [productId]: {
        quantity: String(nextQuantity),
        discount: prev[productId]?.discount ?? String(item.discountPercent)
      }
    }));
    if (highlightedItemId === productId) {
      onQuantityConfirm?.();
    }
  };

  const commitDiscount = (productId: string, rawValue: string) => {
    const item = items.find((cartItem) => cartItem.productId === productId);
    if (!item) {
      return;
    }
    const trimmed = rawValue.trim();
    if (!trimmed) {
      setDraftValues((prev) => ({
        ...prev,
        [productId]: {
          quantity: prev[productId]?.quantity ?? String(item.quantity),
          discount: String(item.discountPercent)
        }
      }));
      return;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      setDraftValues((prev) => ({
        ...prev,
        [productId]: {
          quantity: prev[productId]?.quantity ?? String(item.quantity),
          discount: String(item.discountPercent)
        }
      }));
      return;
    }
    const nextDiscount = Math.min(100, Math.max(0, parsed));
    updateDiscount(productId, nextDiscount);
    setDraftValues((prev) => ({
      ...prev,
      [productId]: {
        quantity: prev[productId]?.quantity ?? String(item.quantity),
        discount: String(nextDiscount)
      }
    }));
  };

  return (
    <Card className="flex h-full flex-col bg-slate-50 dark:bg-slate-900">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>{t('cart')}</CardTitle>
        <Button type="button" className="bg-slate-600 hover:bg-slate-500" onClick={onClear}>
          {t('clearCart')}
        </Button>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 space-y-3 overflow-y-auto pr-1">
          {items.map((item) => {
            const isHighlighted = highlightedItemId === item.productId;
            const containerClasses = `rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition-shadow dark:border-slate-700 dark:bg-slate-800 ${
              isHighlighted
                ? 'border-indigo-400 shadow-lg ring-2 ring-indigo-200 dark:border-indigo-500/70 dark:ring-indigo-500/30'
                : ''
            }`;
            return (
              <div key={item.productId} className={containerClasses}>
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
                      min={1}
                      ref={(element) => {
                        quantityInputRefs.current[item.productId] = element;
                      }}
                      value={draftValues[item.productId]?.quantity ?? ''}
                      onChange={(event) => {
                        const value = event.target.value;
                        setDraftValues((prev) => ({
                          ...prev,
                          [item.productId]: {
                            quantity: value,
                            discount: prev[item.productId]?.discount ?? String(item.discountPercent)
                          }
                        }));
                      }}
                      onBlur={(event) => commitQuantity(item.productId, event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          commitQuantity(item.productId, event.currentTarget.value);
                        }
                      }}
                      inputMode="numeric"
                    />
                  </label>
                  <label className="space-y-1">
                    <span>{t('discount')}</span>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={draftValues[item.productId]?.discount ?? ''}
                      onChange={(event) => {
                        const value = event.target.value;
                        setDraftValues((prev) => ({
                          ...prev,
                          [item.productId]: {
                            quantity: prev[item.productId]?.quantity ?? String(item.quantity),
                            discount: value
                          }
                        }));
                      }}
                      onBlur={(event) => commitDiscount(item.productId, event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          commitDiscount(item.productId, event.currentTarget.value);
                        }
                      }}
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
            );
          })}
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
