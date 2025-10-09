import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SVGProps } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { useCartStore } from '../../stores/cartStore';
import { formatCurrency } from '../../lib/utils';

type DraftLineValues = {
  quantity: string;
  discount: string;
  totalUsd: string;
  totalLbp: string;
};

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
  canMarkWaste?: boolean;
  canEditTotals?: boolean;
}

const clampQuantity = (value: number) => {
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.max(1, Math.floor(value));
};

export function CartPanel({
  onClear,
  highlightedItemId,
  onQuantityConfirm,
  canMarkWaste = false,
  canEditTotals = false
}: CartPanelProps) {
  const { t, i18n } = useTranslation();
  const {
    items,
    setItemQuantity,
    updateDiscount,
    removeItem,
    subtotalUsd,
    subtotalLbp,
    setItemWaste,
    setItemManualTotals,
    manualCartTotalUsd,
    manualCartTotalLbp,
    setCartManualTotals,
    clearCartManualTotals
  } = useCartStore();
  const locale = i18n.language === 'ar' ? 'ar-LB' : 'en-US';
  const quantityInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [draftValues, setDraftValues] = useState<Record<string, DraftLineValues>>({});
  const [cartTotalsDraft, setCartTotalsDraft] = useState<{ usd: string; lbp: string }>({ usd: '', lbp: '' });
  const highlightedDraftQuantity = highlightedItemId
    ? draftValues[highlightedItemId]?.quantity
    : undefined;

  useEffect(() => {
    const nextDrafts = items.reduce<Record<string, DraftLineValues>>((acc, item) => {
      acc[item.lineId] = {
        quantity: String(item.quantity),
        discount: String(item.discountPercent),
        totalUsd:
          item.manualTotalUsd !== null && item.manualTotalUsd !== undefined
            ? String(item.manualTotalUsd)
            : '',
        totalLbp:
          item.manualTotalLbp !== null && item.manualTotalLbp !== undefined
            ? String(item.manualTotalLbp)
            : ''
      };
      return acc;
    }, {});
    setDraftValues(nextDrafts);
  }, [items]);

  useEffect(() => {
    setCartTotalsDraft({
      usd:
        manualCartTotalUsd !== null && manualCartTotalUsd !== undefined
          ? String(manualCartTotalUsd)
          : '',
      lbp:
        manualCartTotalLbp !== null && manualCartTotalLbp !== undefined
          ? String(manualCartTotalLbp)
          : ''
    });
  }, [manualCartTotalUsd, manualCartTotalLbp]);

  useEffect(() => {
    if (!highlightedItemId) return;
    const input = quantityInputRefs.current[highlightedItemId];
    if (input) {
      input.focus();
      const select = () => input.select();
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(select);
      } else {
        select();
      }
    }
  }, [highlightedItemId, highlightedDraftQuantity]);

  const commitQuantity = (lineId: string, rawValue: string) => {
    const item = items.find((cartItem) => cartItem.lineId === lineId);
    if (!item) {
      return;
    }
    const trimmed = rawValue.trim();
    if (!trimmed) {
      setDraftValues((prev) => ({
        ...prev,
        [lineId]: {
          quantity: String(item.quantity),
          discount: prev[lineId]?.discount ?? String(item.discountPercent),
          totalUsd:
            prev[lineId]?.totalUsd ??
            (item.manualTotalUsd !== null && item.manualTotalUsd !== undefined
              ? String(item.manualTotalUsd)
              : ''),
          totalLbp:
            prev[lineId]?.totalLbp ??
            (item.manualTotalLbp !== null && item.manualTotalLbp !== undefined
              ? String(item.manualTotalLbp)
              : '')
        }
      }));
      return;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      setDraftValues((prev) => ({
        ...prev,
        [lineId]: {
          quantity: String(item.quantity),
          discount: prev[lineId]?.discount ?? String(item.discountPercent),
          totalUsd:
            prev[lineId]?.totalUsd ??
            (item.manualTotalUsd !== null && item.manualTotalUsd !== undefined
              ? String(item.manualTotalUsd)
              : ''),
          totalLbp:
            prev[lineId]?.totalLbp ??
            (item.manualTotalLbp !== null && item.manualTotalLbp !== undefined
              ? String(item.manualTotalLbp)
              : '')
        }
      }));
      return;
    }
    const nextQuantity = clampQuantity(parsed);
    setItemQuantity(lineId, nextQuantity);
    setDraftValues((prev) => ({
      ...prev,
      [lineId]: {
        quantity: String(nextQuantity),
        discount: prev[lineId]?.discount ?? String(item.discountPercent),
        totalUsd:
          prev[lineId]?.totalUsd ??
          (item.manualTotalUsd !== null && item.manualTotalUsd !== undefined
            ? String(item.manualTotalUsd)
            : ''),
        totalLbp:
          prev[lineId]?.totalLbp ??
          (item.manualTotalLbp !== null && item.manualTotalLbp !== undefined
            ? String(item.manualTotalLbp)
            : '')
      }
    }));
    if (highlightedItemId === lineId) {
      onQuantityConfirm?.();
    }
  };

  const commitDiscount = (lineId: string, rawValue: string) => {
    const item = items.find((cartItem) => cartItem.lineId === lineId);
    if (!item) {
      return;
    }
    if (item.isWaste) {
      return;
    }
    const trimmed = rawValue.trim();
    if (!trimmed) {
      setDraftValues((prev) => ({
        ...prev,
        [lineId]: {
          quantity: prev[lineId]?.quantity ?? String(item.quantity),
          discount: String(item.discountPercent),
          totalUsd:
            prev[lineId]?.totalUsd ??
            (item.manualTotalUsd !== null && item.manualTotalUsd !== undefined
              ? String(item.manualTotalUsd)
              : ''),
          totalLbp:
            prev[lineId]?.totalLbp ??
            (item.manualTotalLbp !== null && item.manualTotalLbp !== undefined
              ? String(item.manualTotalLbp)
              : '')
        }
      }));
      return;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      setDraftValues((prev) => ({
        ...prev,
        [lineId]: {
          quantity: prev[lineId]?.quantity ?? String(item.quantity),
          discount: String(item.discountPercent),
          totalUsd:
            prev[lineId]?.totalUsd ??
            (item.manualTotalUsd !== null && item.manualTotalUsd !== undefined
              ? String(item.manualTotalUsd)
              : ''),
          totalLbp:
            prev[lineId]?.totalLbp ??
            (item.manualTotalLbp !== null && item.manualTotalLbp !== undefined
              ? String(item.manualTotalLbp)
              : '')
        }
      }));
      return;
    }
    const nextDiscount = Math.min(100, Math.max(0, parsed));
    updateDiscount(lineId, nextDiscount);
    setDraftValues((prev) => ({
      ...prev,
      [lineId]: {
        quantity: prev[lineId]?.quantity ?? String(item.quantity),
        discount: String(nextDiscount),
        totalUsd:
          prev[lineId]?.totalUsd ??
          (item.manualTotalUsd !== null && item.manualTotalUsd !== undefined
            ? String(item.manualTotalUsd)
            : ''),
        totalLbp:
          prev[lineId]?.totalLbp ??
          (item.manualTotalLbp !== null && item.manualTotalLbp !== undefined
            ? String(item.manualTotalLbp)
            : '')
      }
    }));
  };

  const parseNumberInput = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return { value: null, isValid: true } as const;
    }
    const normalized = Number(trimmed.replace(/,/g, ''));
    if (!Number.isFinite(normalized)) {
      return { value: null, isValid: false } as const;
    }
    return { value: normalized, isValid: true } as const;
  };

  const commitManualTotalUsd = (lineId: string, rawValue: string) => {
    const item = items.find((cartItem) => cartItem.lineId === lineId);
    if (!item) {
      return;
    }
    const { value, isValid } = parseNumberInput(rawValue);
    if (!isValid) {
      setDraftValues((prev) => ({
        ...prev,
        [lineId]: {
          quantity: prev[lineId]?.quantity ?? String(item.quantity),
          discount: prev[lineId]?.discount ?? String(item.discountPercent),
          totalUsd:
            item.manualTotalUsd !== null && item.manualTotalUsd !== undefined
              ? String(item.manualTotalUsd)
              : '',
          totalLbp:
            prev[lineId]?.totalLbp ??
            (item.manualTotalLbp !== null && item.manualTotalLbp !== undefined
              ? String(item.manualTotalLbp)
              : '')
        }
      }));
      return;
    }
    setItemManualTotals(lineId, { totalUsd: value });
    setDraftValues((prev) => ({
      ...prev,
      [lineId]: {
        quantity: prev[lineId]?.quantity ?? String(item.quantity),
        discount: prev[lineId]?.discount ?? String(item.discountPercent),
        totalUsd: value !== null ? String(value) : '',
        totalLbp:
          prev[lineId]?.totalLbp ??
          (item.manualTotalLbp !== null && item.manualTotalLbp !== undefined
            ? String(item.manualTotalLbp)
            : '')
      }
    }));
  };

  const commitManualTotalLbp = (lineId: string, rawValue: string) => {
    const item = items.find((cartItem) => cartItem.lineId === lineId);
    if (!item) {
      return;
    }
    const { value, isValid } = parseNumberInput(rawValue);
    if (!isValid) {
      setDraftValues((prev) => ({
        ...prev,
        [lineId]: {
          quantity: prev[lineId]?.quantity ?? String(item.quantity),
          discount: prev[lineId]?.discount ?? String(item.discountPercent),
          totalUsd:
            prev[lineId]?.totalUsd ??
            (item.manualTotalUsd !== null && item.manualTotalUsd !== undefined
              ? String(item.manualTotalUsd)
              : ''),
          totalLbp:
            item.manualTotalLbp !== null && item.manualTotalLbp !== undefined
              ? String(item.manualTotalLbp)
              : ''
        }
      }));
      return;
    }
    setItemManualTotals(lineId, { totalLbp: value });
    setDraftValues((prev) => ({
      ...prev,
      [lineId]: {
        quantity: prev[lineId]?.quantity ?? String(item.quantity),
        discount: prev[lineId]?.discount ?? String(item.discountPercent),
        totalUsd:
          prev[lineId]?.totalUsd ??
          (item.manualTotalUsd !== null && item.manualTotalUsd !== undefined
            ? String(item.manualTotalUsd)
            : ''),
        totalLbp: value !== null ? String(value) : ''
      }
    }));
  };

  const commitCartManualUsd = (rawValue: string) => {
    const { value, isValid } = parseNumberInput(rawValue);
    if (!isValid) {
      setCartTotalsDraft({
        usd:
          manualCartTotalUsd !== null && manualCartTotalUsd !== undefined
            ? String(manualCartTotalUsd)
            : '',
        lbp: cartTotalsDraft.lbp
      });
      return;
    }
    setCartManualTotals({ totalUsd: value });
    setCartTotalsDraft((prev) => ({
      usd: value !== null ? String(value) : '',
      lbp: prev.lbp
    }));
  };

  const commitCartManualLbp = (rawValue: string) => {
    const { value, isValid } = parseNumberInput(rawValue);
    if (!isValid) {
      setCartTotalsDraft({
        usd: cartTotalsDraft.usd,
        lbp:
          manualCartTotalLbp !== null && manualCartTotalLbp !== undefined
            ? String(manualCartTotalLbp)
            : ''
      });
      return;
    }
    setCartManualTotals({ totalLbp: value });
    setCartTotalsDraft((prev) => ({
      usd: prev.usd,
      lbp: value !== null ? String(value) : ''
    }));
  };

  const handleClearManualTotals = (lineId: string) => {
    const item = items.find((cartItem) => cartItem.lineId === lineId);
    if (!item) {
      return;
    }
    setItemManualTotals(lineId, { totalUsd: null, totalLbp: null });
    setDraftValues((prev) => ({
      ...prev,
      [lineId]: {
        quantity: prev[lineId]?.quantity ?? String(item.quantity),
        discount: prev[lineId]?.discount ?? String(item.discountPercent),
        totalUsd: '',
        totalLbp: ''
      }
    }));
  };

  return (
    <Card className="flex h-full w-full flex-col bg-slate-50 dark:bg-slate-900">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>{t('cart')}</CardTitle>
        <Button type="button" className="bg-slate-600 hover:bg-slate-500" onClick={onClear}>
          {t('clearCart')}
        </Button>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 space-y-3 overflow-y-auto pr-1">
          {items.map((item) => {
            const isHighlighted = highlightedItemId === item.lineId;
            const containerClasses = `rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition-shadow dark:border-slate-700 dark:bg-slate-800 ${
              isHighlighted
                ? 'border-indigo-400 shadow-lg ring-2 ring-indigo-200 dark:border-indigo-500/70 dark:ring-indigo-500/30'
                : ''
            }`;
            const draft = draftValues[item.lineId];
            const effectiveTotalUsd = item.isWaste
              ? 0
              : item.manualTotalUsd ??
                item.priceUsd * (1 - item.discountPercent / 100) * item.quantity;
            const manualOverrideActive =
              !item.isWaste &&
              ((item.manualTotalUsd !== null && item.manualTotalUsd !== undefined) ||
                (item.manualTotalLbp !== null && item.manualTotalLbp !== undefined));
            return (
              <div key={item.lineId} className={containerClasses}>
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="font-semibold">{item.name}</p>
                    {item.isWaste && (
                      <Badge className="bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-100">
                        {t('cartWasteBadge')}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {canMarkWaste && (
                      <button
                        type="button"
                        className={`rounded-full border px-3 py-1 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                          item.isWaste
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 focus:ring-emerald-500 dark:border-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200'
                            : 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 focus:ring-amber-500 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-200'
                        }`}
                        onClick={() => setItemWaste(item.lineId, !item.isWaste)}
                      >
                        {item.isWaste ? t('cartUnmarkWaste') : t('cartMarkWaste')}
                      </button>
                    )}
                    <button
                      type="button"
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-red-200 text-red-600 transition hover:border-red-300 hover:bg-red-50 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-white dark:border-red-500/40 dark:text-red-300 dark:hover:border-red-400 dark:hover:bg-red-900/30 dark:hover:text-red-200 dark:focus:ring-offset-slate-900"
                      aria-label={t('removeItem')}
                      onClick={() => removeItem(item.lineId)}
                    >
                      <TrashIcon className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
                <div
                  className={`mt-2 grid gap-2 text-xs ${
                    canEditTotals ? 'grid-cols-4' : 'grid-cols-3'
                  }`}
                >
                  <label className="space-y-1">
                    <span>{t('quantity')}</span>
                    <Input
                      type="number"
                      min={1}
                      ref={(element) => {
                        quantityInputRefs.current[item.lineId] = element;
                      }}
                      value={draftValues[item.lineId]?.quantity ?? ''}
                      onChange={(event) => {
                        const value = event.target.value;
                        setDraftValues((prev) => ({
                          ...prev,
                          [item.lineId]: {
                            quantity: value,
                            discount: prev[item.lineId]?.discount ?? String(item.discountPercent),
                            totalUsd:
                              prev[item.lineId]?.totalUsd ??
                              (item.manualTotalUsd !== null && item.manualTotalUsd !== undefined
                                ? String(item.manualTotalUsd)
                                : ''),
                            totalLbp:
                              prev[item.lineId]?.totalLbp ??
                              (item.manualTotalLbp !== null && item.manualTotalLbp !== undefined
                                ? String(item.manualTotalLbp)
                                : '')
                          }
                        }));
                      }}
                      onBlur={(event) => commitQuantity(item.lineId, event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          commitQuantity(item.lineId, event.currentTarget.value);
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
                      value={draftValues[item.lineId]?.discount ?? ''}
                      onChange={(event) => {
                        const value = event.target.value;
                        setDraftValues((prev) => ({
                          ...prev,
                          [item.lineId]: {
                            quantity: prev[item.lineId]?.quantity ?? String(item.quantity),
                            discount: value,
                            totalUsd:
                              prev[item.lineId]?.totalUsd ??
                              (item.manualTotalUsd !== null && item.manualTotalUsd !== undefined
                                ? String(item.manualTotalUsd)
                                : ''),
                            totalLbp:
                              prev[item.lineId]?.totalLbp ??
                              (item.manualTotalLbp !== null && item.manualTotalLbp !== undefined
                                ? String(item.manualTotalLbp)
                                : '')
                          }
                        }));
                      }}
                      onBlur={(event) => commitDiscount(item.lineId, event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          commitDiscount(item.lineId, event.currentTarget.value);
                        }
                      }}
                      disabled={item.isWaste}
                    />
                  </label>
                  <div className="space-y-1">
                    <span>{t('total')}</span>
                    <div className="rounded-md border border-slate-200 bg-slate-100 px-2 py-2 text-sm font-semibold dark:border-slate-700 dark:bg-slate-700">
                      <span>
                        {formatCurrency(effectiveTotalUsd, 'USD', i18n.language === 'ar' ? 'ar-LB' : 'en-US')}
                      </span>
                      {manualOverrideActive && (
                        <span className="mt-1 block text-[0.65rem] font-medium text-indigo-600 dark:text-indigo-300">
                          {t('cartManualOverrideApplied')}
                        </span>
                      )}
                      {item.isWaste && (
                        <span className="mt-1 block text-[0.65rem] font-normal text-amber-700 dark:text-amber-300">
                          {t('cartWasteNoCharge')}
                        </span>
                      )}
                    </div>
                  </div>
                  {canEditTotals && (
                    <div className="space-y-1">
                      <span>{t('cartManualTotal')}</span>
                      <div className="flex flex-col gap-1">
                        <Input
                          type="number"
                          placeholder="USD"
                          value={draft?.totalUsd ?? ''}
                          onChange={(event) => {
                            const value = event.target.value;
                            setDraftValues((prev) => ({
                              ...prev,
                              [item.lineId]: {
                                quantity: prev[item.lineId]?.quantity ?? String(item.quantity),
                                discount: prev[item.lineId]?.discount ?? String(item.discountPercent),
                                totalUsd: value,
                                totalLbp:
                                  prev[item.lineId]?.totalLbp ??
                                  (item.manualTotalLbp !== null && item.manualTotalLbp !== undefined
                                    ? String(item.manualTotalLbp)
                                    : '')
                              }
                            }));
                          }}
                          onBlur={(event) => commitManualTotalUsd(item.lineId, event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              commitManualTotalUsd(item.lineId, event.currentTarget.value);
                            }
                          }}
                          disabled={item.isWaste}
                          inputMode="decimal"
                        />
                        <Input
                          type="number"
                          placeholder="LBP"
                          value={draft?.totalLbp ?? ''}
                          onChange={(event) => {
                            const value = event.target.value;
                            setDraftValues((prev) => ({
                              ...prev,
                              [item.lineId]: {
                                quantity: prev[item.lineId]?.quantity ?? String(item.quantity),
                                discount: prev[item.lineId]?.discount ?? String(item.discountPercent),
                                totalUsd:
                                  prev[item.lineId]?.totalUsd ??
                                  (item.manualTotalUsd !== null && item.manualTotalUsd !== undefined
                                    ? String(item.manualTotalUsd)
                                    : ''),
                                totalLbp: value
                              }
                            }));
                          }}
                          onBlur={(event) => commitManualTotalLbp(item.lineId, event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              commitManualTotalLbp(item.lineId, event.currentTarget.value);
                            }
                          }}
                          disabled={item.isWaste}
                          inputMode="numeric"
                        />
                        {(item.manualTotalUsd !== null && item.manualTotalUsd !== undefined) ||
                        (item.manualTotalLbp !== null && item.manualTotalLbp !== undefined) ? (
                          <Button
                            type="button"
                            className="self-start bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                            onClick={() => handleClearManualTotals(item.lineId)}
                          >
                            {t('reset')}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {items.length === 0 && <p className="text-center text-sm text-slate-500">Cart empty</p>}
        </div>
        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="flex justify-between">
            <span>{t('total')} USD</span>
            <span className="font-semibold">{formatCurrency(subtotalUsd(), 'USD', locale)}</span>
          </div>
          <div className="flex justify-between">
            <span>{t('total')} LBP</span>
            <span className="font-semibold">{formatCurrency(subtotalLbp(), 'LBP', locale)}</span>
          </div>
          {canEditTotals && (
            <div className="mt-3 space-y-2 border-t border-slate-200 pt-3 text-xs dark:border-slate-700">
              <p className="font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {t('cartManualCartTotals')}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  placeholder="USD"
                  value={cartTotalsDraft.usd}
                  onChange={(event) =>
                    setCartTotalsDraft((prev) => ({ ...prev, usd: event.target.value }))
                  }
                  onBlur={(event) => commitCartManualUsd(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      commitCartManualUsd(event.currentTarget.value);
                    }
                  }}
                  inputMode="decimal"
                />
                <Input
                  type="number"
                  placeholder="LBP"
                  value={cartTotalsDraft.lbp}
                  onChange={(event) =>
                    setCartTotalsDraft((prev) => ({ ...prev, lbp: event.target.value }))
                  }
                  onBlur={(event) => commitCartManualLbp(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      commitCartManualLbp(event.currentTarget.value);
                    }
                  }}
                  inputMode="numeric"
                />
              </div>
              {(manualCartTotalUsd !== null && manualCartTotalUsd !== undefined) ||
              (manualCartTotalLbp !== null && manualCartTotalLbp !== undefined) ? (
                <Button
                  type="button"
                  className="self-start bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                  onClick={() => {
                    clearCartManualTotals();
                    setCartTotalsDraft({ usd: '', lbp: '' });
                  }}
                >
                  {t('reset')}
                </Button>
              ) : null}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
