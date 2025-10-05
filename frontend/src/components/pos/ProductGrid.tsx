import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ProductsService, Product } from '../../lib/ProductsService';
import { Input } from '../ui/input';
import { Card, CardContent, CardHeader } from '../ui/card';
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

  const {
    data: pinnedProducts = [],
    isFetching: isPinnedFetching
  } = ProductsService.useSearchProducts(debouncedTerm, {
    pinnedOnly: true
  });

  const showPinnedEmptyState = !isPinnedFetching && pinnedProducts.length === 0;

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

  const renderProductButton = (product: Product) => (
    <button
      key={product.id}
      onClick={() => handleAdd(product)}
      className={cn(
        'w-full rounded-md border border-slate-200 bg-white p-2.5 text-left text-sm shadow-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800',
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
  );

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="mb-4 flex-col items-stretch gap-3 p-0">
        <Input
          placeholder={t('searchProducts')}
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          autoFocus
          className="w-full text-base"
        />
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto space-y-3 px-4 pb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
          {t('pinnedShelfTitle', 'Pinned shelf')}
        </p>
        <div className="grid grid-cols-2 gap-2.5 pr-1 sm:grid-cols-3 lg:grid-cols-4">
          {pinnedProducts.map((product) => renderProductButton(product))}
          {showPinnedEmptyState && (
            <div className="col-span-full rounded-md border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500 dark:border-slate-700">
              {t('pinnedProductsEmpty', 'No curated products yet. Try searching to see the full catalog.')}
            </div>
          )}
          {isPinnedFetching && (
            <div className="col-span-full rounded-md border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500 dark:border-slate-700">
              Loading…
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
