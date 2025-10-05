import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ProductsService, Product } from '../../lib/ProductsService';
import { Input } from '../ui/input';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { cn, formatCurrency } from '../../lib/utils';
import { useCartStore } from '../../stores/cartStore';

interface ProductGridProps {
  onScan: (product: Product) => void;
}

export function ProductGrid({ onScan }: ProductGridProps) {
  const { t, i18n } = useTranslation();
  const [term, setTerm] = useState('');
  const addItem = useCartStore((state) => state.addItem);

  const [debouncedTerm, setDebouncedTerm] = useState('');

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedTerm(term);
    }, 300);
    return () => clearTimeout(handler);
  }, [term]);

  const trimmedTerm = debouncedTerm.trim();
  const shouldShowPinnedOnly = trimmedTerm.length === 0;

  const { data, isFetching } = ProductsService.useSearchProducts(debouncedTerm, {
    pinnedOnly: shouldShowPinnedOnly
  });

  const showPinnedEmptyState =
    shouldShowPinnedOnly && !isFetching && (data?.length ?? 0) === 0;

  const handleAdd = (product: Product) => {
    addItem({
      productId: product.id,
      name: product.name,
      sku: product.sku?.trim() || undefined,
      barcode: product.barcode,
      priceUsd: product.priceUsd,
      priceLbp: product.priceLbp,
      quantity: 1,
      discountPercent: 0
    });
    onScan(product);
  };

  return (
    <div className="flex h-full flex-col gap-2.5">
      <Input
        placeholder={t('searchProducts')}
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        autoFocus
        className="text-base"
      />
      <div className="relative flex-1 overflow-hidden">
        <div className="grid max-h-[26rem] grid-cols-2 gap-2.5 overflow-y-auto pr-1 sm:max-h-[30rem] sm:grid-cols-2 md:grid-cols-3 lg:max-h-[32rem] lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {data?.map((product) => (
            <button
              key={product.id}
              onClick={() => handleAdd(product)}
              className={cn(
                'rounded-md border border-slate-200 bg-white p-2.5 text-left text-sm shadow-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800',
                'hover:border-emerald-500'
              )}
            >
              <div className="flex items-start justify-between gap-1">
                <div className="min-w-0">
                  <p className="truncate font-medium">{product.name}</p>
                  <span className="text-[0.7rem] text-slate-500">{product.sku?.trim() || '—'}</span>
                </div>
                {product.isPinned && (
                  <Badge className="shrink-0 bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-200">
                    {t('pinnedBadge', 'Pinned')}
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-300">
                {formatCurrency(product.priceUsd, 'USD', i18n.language === 'ar' ? 'ar-LB' : 'en-US')}
              </p>
              <p className="text-[0.7rem] text-slate-500">{product.categoryName}</p>
            </button>
          ))}
          {showPinnedEmptyState && (
            <Card className="col-span-full text-center text-xs text-slate-500">
              {t('pinnedProductsEmpty', 'No curated products yet. Try searching to see the full catalog.')}
            </Card>
          )}
          {isFetching && <Card className="col-span-full text-center text-xs text-slate-500">Loading…</Card>}
        </div>
      </div>
    </div>
  );
}
