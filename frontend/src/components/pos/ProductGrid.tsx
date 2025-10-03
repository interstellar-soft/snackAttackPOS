import { useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../../lib/api';
import { Input } from '../ui/input';
import { Card } from '../ui/card';
import { cn, formatCurrency } from '../../lib/utils';
import { useCartStore } from '../../stores/cartStore';
import { useAuthStore } from '../../stores/authStore';

interface ProductResponse {
  id: string;
  sku: string;
  name: string;
  barcode: string;
  priceUsd: number;
  priceLbp: number;
  category: string;
  isFlagged?: boolean;
  flagReason?: string;
}

interface ProductGridProps {
  onScan: (product: ProductResponse) => void;
}

export function ProductGrid({ onScan }: ProductGridProps) {
  const { t, i18n } = useTranslation();
  const [term, setTerm] = useState('');
  const token = useAuthStore((state) => state.token);
  const addItem = useCartStore((state) => state.addItem);

  const { data, refetch, isFetching } = useQuery<ProductResponse[], Error>({
    queryKey: ['products', term, token],
    queryFn: async () => {
      const searchParam = term ? `?q=${encodeURIComponent(term)}` : '?q=';
      return await apiFetch<ProductResponse[]>(`/api/products/search${searchParam}`, {}, token ?? undefined);
    },
    enabled: !!token
  });

  useEffect(() => {
    const handler = setTimeout(() => {
      if (token) {
        refetch();
      }
    }, 300);
    return () => clearTimeout(handler);
  }, [term, token, refetch]);

  const handleAdd = (product: ProductResponse) => {
    addItem({
      productId: product.id,
      name: product.name,
      sku: product.sku,
      barcode: product.barcode,
      priceUsd: product.priceUsd,
      priceLbp: product.priceLbp,
      quantity: 1,
      discountPercent: 0
    });
    onScan(product);
  };

  return (
    <div className="space-y-3">
      <Input
        placeholder={t('searchProducts')}
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        autoFocus
        className="text-lg"
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {data?.map((product) => (
          <button
            key={product.id}
            onClick={() => handleAdd(product)}
            className={cn(
              'rounded-lg border border-slate-200 bg-white p-3 text-left shadow-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800',
              'hover:border-emerald-500'
            )}
          >
            <div className="flex items-center justify-between">
              <p className="font-semibold">{product.name}</p>
              <span className="text-xs text-slate-500">{product.sku}</span>
            </div>
            <p className="mt-2 text-sm text-emerald-600 dark:text-emerald-300">
              {formatCurrency(product.priceUsd, 'USD', i18n.language === 'ar' ? 'ar-LB' : 'en-US')}
            </p>
            <p className="text-xs text-slate-500">{product.category}</p>
          </button>
        ))}
        {isFetching && <Card className="col-span-full text-center text-sm text-slate-500">Loading…</Card>}
      </div>
    </div>
  );
}
