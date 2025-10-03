import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '../components/pos/TopBar';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card } from '../components/ui/card';
import { ProductsService } from '../lib/ProductsService';
import { useAuthStore } from '../stores/authStore';
import { formatCurrency } from '../lib/utils';

interface ToastState {
  type: 'success' | 'error';
  message: string;
}

const initialFormState = {
  name: '',
  sku: '',
  barcode: '',
  priceUsd: '',
  priceLbp: '',
  category: '',
  description: ''
};

export function InventoryPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);
  const role = useAuthStore((state) => state.role);

  const [form, setForm] = useState(initialFormState);
  const [toast, setToast] = useState<ToastState | null>(null);

  const inventoryQuery = ProductsService.useInventoryProducts();
  const createProduct = ProductsService.useCreateProduct();

  const canSeeAnalytics = role?.toLowerCase() === 'admin' || role?.toLowerCase() === 'manager';

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(id);
  }, [toast]);

  const handleChange = (field: keyof typeof form) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((previous) => ({ ...previous, [field]: event.target.value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const parsedUsd = parseFloat(form.priceUsd);
    const parsedLbp = parseFloat(form.priceLbp);

    const payload = {
      name: form.name.trim(),
      sku: form.sku.trim(),
      barcode: form.barcode.trim(),
      category: form.category.trim(),
      description: form.description.trim() || undefined,
      priceUsd: Number.isFinite(parsedUsd) ? parsedUsd : 0,
      priceLbp: Number.isFinite(parsedLbp) ? parsedLbp : 0
    };

    if (!payload.name || !payload.sku || !payload.barcode || !payload.category) {
      setToast({ type: 'error', message: t('inventoryFormIncomplete') });
      return;
    }

    try {
      await createProduct.mutateAsync(payload);
      setToast({ type: 'success', message: t('inventoryCreateSuccess') });
      setForm(initialFormState);
    } catch (error) {
      const message = error instanceof Error ? error.message : t('inventoryCreateError');
      setToast({ type: 'error', message });
    }
  };

  const currencyLocale = useMemo(() => (i18n.language === 'ar' ? 'ar-LB' : 'en-US'), [i18n.language]);

  return (
    <div className="flex min-h-screen flex-col gap-4 bg-slate-100 p-4 dark:bg-slate-950">
      <TopBar
        onLogout={logout}
        onNavigatePos={() => navigate('/')}
        onNavigateAnalytics={canSeeAnalytics ? () => navigate('/analytics') : undefined}
        isInventory
      />
      <div className="grid gap-6 lg:grid-cols-[1.2fr_2fr]">
        <Card className="space-y-4 p-6">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{t('inventoryAddTitle')}</h2>
            <p className="text-sm text-slate-500">{t('inventoryAddSubtitle')}</p>
          </div>
          {toast && (
            <div
              className={`rounded-lg border p-3 text-sm ${
                toast.type === 'success'
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700/50 dark:bg-emerald-900/20 dark:text-emerald-200'
                  : 'border-red-300 bg-red-50 text-red-700 dark:border-red-700/50 dark:bg-red-900/20 dark:text-red-200'
              }`}
            >
              {toast.message}
            </div>
          )}
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-600 dark:text-slate-300" htmlFor="name">
                  {t('inventoryName')}
                </label>
                <Input id="name" value={form.name} onChange={handleChange('name')} placeholder={t('inventoryNamePlaceholder')} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-600 dark:text-slate-300" htmlFor="sku">
                  {t('inventorySku')}
                </label>
                <Input id="sku" value={form.sku} onChange={handleChange('sku')} placeholder={t('inventorySkuPlaceholder')} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-600 dark:text-slate-300" htmlFor="barcode">
                  {t('inventoryBarcode')}
                </label>
                <Input
                  id="barcode"
                  value={form.barcode}
                  onChange={handleChange('barcode')}
                  placeholder={t('inventoryBarcodePlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-600 dark:text-slate-300" htmlFor="category">
                  {t('inventoryCategory')}
                </label>
                <Input
                  id="category"
                  value={form.category}
                  onChange={handleChange('category')}
                  placeholder={t('inventoryCategoryPlaceholder')}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-600 dark:text-slate-300" htmlFor="priceUsd">
                  {t('inventoryPriceUsd')}
                </label>
                <Input
                  id="priceUsd"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.priceUsd}
                  onChange={handleChange('priceUsd')}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-600 dark:text-slate-300" htmlFor="priceLbp">
                  {t('inventoryPriceLbp')}
                </label>
                <Input
                  id="priceLbp"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.priceLbp}
                  onChange={handleChange('priceLbp')}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-600 dark:text-slate-300" htmlFor="description">
                {t('inventoryDescription')}
              </label>
              <textarea
                id="description"
                value={form.description}
                onChange={handleChange('description')}
                placeholder={t('inventoryDescriptionPlaceholder')}
                className="min-h-[96px] w-full rounded-md border border-slate-200 bg-white p-3 text-sm shadow-sm transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>
            <Button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-400" disabled={createProduct.isPending}>
              {createProduct.isPending ? t('inventorySaving') : t('inventorySave')}
            </Button>
          </form>
        </Card>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{t('inventoryListTitle')}</h2>
            <p className="text-sm text-slate-500">
              {t('inventoryTotal', { count: inventoryQuery.data?.length ?? 0 })}
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {inventoryQuery.isLoading && (
              <Card className="col-span-full space-y-2 p-6 text-sm text-slate-500">
                <p>{t('inventoryLoading')}</p>
              </Card>
            )}
            {inventoryQuery.isError && (
              <Card className="col-span-full space-y-2 border-red-300 bg-red-50 p-6 text-sm text-red-700 dark:border-red-700/50 dark:bg-red-900/20 dark:text-red-200">
                <p>{t('inventoryError')}</p>
              </Card>
            )}
            {inventoryQuery.data?.map((product) => (
              <Card key={product.id} className="space-y-2 p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{product.name}</h3>
                  <span className="text-xs uppercase tracking-wide text-slate-500">{product.sku}</span>
                </div>
                <p className="text-sm text-slate-500">{product.category}</p>
                <div className="space-y-1 text-sm">
                  <p className="font-medium text-emerald-600 dark:text-emerald-300">
                    {formatCurrency(product.priceUsd, 'USD', currencyLocale)}
                  </p>
                  <p className="text-slate-500">
                    {formatCurrency(product.priceLbp, 'LBP', currencyLocale)}
                  </p>
                </div>
                <p className="text-xs text-slate-500">{t('inventoryBarcodeLabel')}: {product.barcode}</p>
                {product.description && <p className="text-xs text-slate-500">{product.description}</p>}
              </Card>
            ))}
            {inventoryQuery.data && inventoryQuery.data.length === 0 && !inventoryQuery.isLoading && (
              <Card className="col-span-full space-y-2 p-6 text-sm text-slate-500">
                <p>{t('inventoryEmpty')}</p>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
