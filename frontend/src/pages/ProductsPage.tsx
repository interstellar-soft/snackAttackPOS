import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '../components/pos/TopBar';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { ProductsService, type CreateProductInput, type Product } from '../lib/ProductsService';
import { formatCurrency } from '../lib/utils';
import { useAuthStore } from '../stores/authStore';
import { useStoreProfileStore } from '../stores/storeProfileStore';

type DialogState =
  | { type: 'create'; error?: string }
  | { type: 'edit'; product: Product; error?: string }
  | { type: 'delete'; product: Product; error?: string };

type BannerState = { type: 'success' | 'error'; message: string };

type ProductFormValues = {
  name: string;
  sku: string;
  barcode: string;
  categoryName: string;
  price: string;
  currency: 'USD' | 'LBP';
  isPinned: boolean;
  reorderPoint: string;
};

const emptyValues: ProductFormValues = {
  name: '',
  sku: '',
  barcode: '',
  categoryName: '',
  price: '',
  currency: 'USD',
  isPinned: false,
  reorderPoint: '3'
};

export function ProductsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const logout = useAuthStore((state) => state.logout);
  const role = useAuthStore((state) => state.role);
  const storeName = useStoreProfileStore((state) => state.name);

  const productsQuery = ProductsService.useInventoryProducts();
  const createProduct = ProductsService.useCreateProduct();
  const updateProduct = ProductsService.useUpdateProduct();
  const togglePinnedProduct = ProductsService.useUpdateProduct();
  const deleteProduct = ProductsService.useDeleteProduct();

  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [banner, setBanner] = useState<BannerState | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const canSeeAnalytics = role?.toLowerCase() === 'admin' || role?.toLowerCase() === 'manager';

  const currencyLocale = useMemo(
    () => (i18n.language === 'ar' ? 'ar-LB' : 'en-US'),
    [i18n.language]
  );
  const filteredProducts = useMemo(() => {
    const products = productsQuery.data ?? [];
    const term = searchTerm.trim().toLowerCase();

    if (!term) {
      return products;
    }

    return products.filter((product) => {
      const fields = [
        product.name,
        product.sku,
        product.barcode,
        product.categoryName,
        product.category
      ];

      return fields.some((field) => field?.toLowerCase().includes(term));
    });
  }, [productsQuery.data, searchTerm]);

  const totalProducts = productsQuery.data?.length ?? 0;
  const isFiltering = searchTerm.trim().length > 0;
  const hasProducts = totalProducts > 0;
  const hasFilteredResults = filteredProducts.length > 0;
  const renderTableRows = () => {
    if (!hasProducts) {
      return (
        <tr>
          <td className="px-4 py-6 text-center text-sm text-slate-500" colSpan={10}>
            {t('inventoryEmpty')}
          </td>
        </tr>
      );
    }

    if (!hasFilteredResults) {
      return (
        <tr>
          <td className="px-4 py-6 text-center text-sm text-slate-500" colSpan={10}>
            {t('inventoryNoResults')}
          </td>
        </tr>
      );
    }

    return filteredProducts.map((product) => (
      <tr key={product.id} className="text-slate-700 dark:text-slate-200">
        <td className="px-4 py-3 text-sm font-medium">{product.name}</td>
        <td className="px-4 py-3 text-xs uppercase text-slate-500">{product.sku?.trim() || '—'}</td>
        <td className="px-4 py-3 text-sm text-slate-500">{product.barcode}</td>
        <td className="px-4 py-3 text-sm text-slate-500">
          <div className="flex flex-col">
            <span>{product.categoryName ?? product.category ?? t('inventoryCategoryUnknown')}</span>
            {product.category && product.categoryName && product.category !== product.categoryName && (
              <span className="text-xs text-slate-400">{product.category}</span>
            )}
          </div>
        </td>
        <td className="px-4 py-3 text-sm font-semibold text-emerald-600 dark:text-emerald-300">
          {formatCurrency(product.priceUsd, 'USD', currencyLocale)}
        </td>
        <td className="px-4 py-3 text-sm text-slate-500">
          {formatCurrency(product.priceLbp, 'LBP', currencyLocale)}
        </td>
        <td className="px-4 py-3 text-sm text-slate-500">{product.quantityOnHand?.toLocaleString() ?? '0'}</td>
        <td className="px-4 py-3 text-sm text-slate-500">
          {formatCurrency(product.averageCostUsd ?? 0, 'USD', currencyLocale)}
        </td>
        <td className="px-4 py-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 disabled:cursor-not-allowed dark:border-slate-600 dark:bg-slate-800"
              checked={product.isPinned}
              onChange={() => handleTogglePinned(product)}
              disabled={togglePinnedProduct.isPending}
              aria-label={t('inventoryPinToPos')}
            />
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {product.isPinned ? t('inventoryPinnedYes') : t('inventoryPinnedNo')}
            </span>
          </label>
        </td>
        <td className="px-4 py-3">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className="bg-slate-200 text-slate-900 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
              onClick={() => setDialog({ type: 'edit', product })}
            >
              {t('inventoryEdit')}
            </Button>
            <Button
              type="button"
              className="bg-red-500 hover:bg-red-400"
              onClick={() => setDialog({ type: 'delete', product })}
            >
              {t('inventoryDelete')}
            </Button>
          </div>
        </td>
      </tr>
    ));
  };

  useEffect(() => {
    if (!banner) {
      return;
    }
    const timeout = window.setTimeout(() => setBanner(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [banner]);

  const closeDialog = () => {
    setDialog(null);
    createProduct.reset();
    updateProduct.reset();
    deleteProduct.reset();
  };

  const setDialogError = (message: string) => {
    setDialog((previous) => {
      if (!previous) return previous;
      return { ...previous, error: message } as DialogState;
    });
  };

  const validateValues = (values: ProductFormValues):
    | { error: string }
    | { error?: undefined; payload: Omit<CreateProductInput, 'description'> } => {
    const name = values.name.trim();
    const sku = values.sku.trim();
    const barcode = values.barcode.trim();
    const categoryName = values.categoryName.trim();
    const parsedPrice = Number(values.price);
    const parsedReorderPoint = Number(values.reorderPoint);

    if (
      !name ||
      !barcode ||
      !categoryName ||
      !Number.isFinite(parsedPrice) ||
      parsedPrice < 0 ||
      !Number.isFinite(parsedReorderPoint) ||
      parsedReorderPoint < 0
    ) {
      return { error: t('inventoryFormIncomplete') };
    }

    return {
      payload: {
        name,
        barcode,
        categoryName,
        price: parsedPrice,
        currency: values.currency,
        isPinned: values.isPinned,
        reorderPoint: parsedReorderPoint,
        ...(sku ? { sku } : {})
      }
    };
  };

  const handleCreateSubmit = async (values: ProductFormValues) => {
    const result = validateValues(values);
    if ('error' in result) {
      setDialogError(result.error);
      return;
    }

    try {
      await createProduct.mutateAsync(result.payload);
      setBanner({ type: 'success', message: t('inventoryCreateSuccess') });
      closeDialog();
    } catch (error) {
      const message = error instanceof Error ? error.message : t('inventoryCreateError');
      setDialogError(message);
    }
  };

  const handleEditSubmit = async (values: ProductFormValues, product: Product) => {
    const result = validateValues(values);
    if ('error' in result) {
      setDialogError(result.error);
      return;
    }

    try {
      await updateProduct.mutateAsync({ id: product.id, ...result.payload });
      setBanner({ type: 'success', message: t('inventoryUpdateSuccess') });
      closeDialog();
    } catch (error) {
      const message = error instanceof Error ? error.message : t('inventoryUpdateError');
      setDialogError(message);
    }
  };

  const handleTogglePinned = async (product: Product) => {
    try {
      await togglePinnedProduct.mutateAsync({
        id: product.id,
        name: product.name,
        barcode: product.barcode,
        categoryName: product.categoryName ?? product.category,
        price: product.priceUsd,
        currency: 'USD',
        isPinned: !product.isPinned,
        reorderPoint: product.reorderPoint ?? 3,
        ...(product.sku && product.sku.trim() ? { sku: product.sku } : {})
      });
      setBanner({
        type: 'success',
        message: product.isPinned ? t('inventoryUnpinnedSuccess') : t('inventoryPinnedSuccess')
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : t('inventoryPinToggleError');
      setBanner({ type: 'error', message });
    }
  };

  const handleDeleteSubmit = async (product: Product) => {
    try {
      await deleteProduct.mutateAsync({ id: product.id });
      setBanner({ type: 'success', message: t('inventoryDeleteSuccess') });
      closeDialog();
    } catch (error) {
      const message = error instanceof Error ? error.message : t('inventoryDeleteError');
      setDialogError(message);
    }
  };

  return (
    <div className="flex min-h-screen flex-col gap-4 bg-slate-100 p-4 dark:bg-slate-950">
      <TopBar
        onLogout={logout}
        onNavigatePos={() => navigate('/')}
        onNavigateAnalytics={canSeeAnalytics ? () => navigate('/analytics') : undefined}
        onNavigateProfits={canSeeAnalytics ? () => navigate('/profits') : undefined}
        onNavigateInvoices={canSeeAnalytics ? () => navigate('/invoices') : undefined}
        onNavigatePurchases={canSeeAnalytics ? () => navigate('/purchases') : undefined}
        onNavigateSettings={canSeeAnalytics ? () => navigate('/settings') : undefined}
        onNavigateProducts={canSeeAnalytics ? () => navigate('/products') : undefined}
        onNavigateOffers={role?.toLowerCase() === 'admin' ? () => navigate('/offers') : undefined}
        onNavigateInventory={canSeeAnalytics ? () => navigate('/inventory') : undefined}
        onNavigateMyCart={role?.toLowerCase() === 'admin' ? () => navigate('/my-cart') : undefined}
        isProducts
      />
      {banner && (
        <div
          className={`rounded-lg border p-4 text-sm ${
            banner.type === 'success'
              ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700/50 dark:bg-emerald-900/20 dark:text-emerald-200'
              : 'border-red-300 bg-red-50 text-red-700 dark:border-red-700/50 dark:bg-red-900/20 dark:text-red-200'
          }`}
        >
          {banner.message}
        </div>
      )}
      <Card className="space-y-4 p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{t('inventoryListTitle')}</h2>
            <p className="text-sm text-slate-500">
              {isFiltering
                ? t('inventoryFilteredTotal', {
                    filtered: filteredProducts.length,
                    total: totalProducts
                  })
                : t('inventoryTotal', { count: totalProducts })}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-2">
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={t('inventorySearchPlaceholder')}
              className="min-w-[220px]"
            />
            <Button type="button" onClick={() => setDialog({ type: 'create' })}>
              {t('inventoryAddTitle')}
            </Button>
          </div>
        </div>
        {productsQuery.isLoading && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/40">
            {t('inventoryLoading')}
          </div>
        )}
        {productsQuery.isError && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-700/50 dark:bg-red-900/20 dark:text-red-200">
            {t('inventoryError')}
          </div>
        )}
        {!productsQuery.isLoading && !productsQuery.isError && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm dark:divide-slate-700">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  <th scope="col" className="px-4 py-3 font-medium">
                    {t('inventoryName')}
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    {t('inventorySku')}
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    {t('inventoryBarcode')}
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    {t('inventoryCategory')}
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    {t('inventoryPriceUsd')}
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    {t('inventoryPriceLbp')}
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    {t('inventoryOnHand')}
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    {t('inventoryAvgCost')}
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    {t('inventoryPinned')}
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    {t('inventoryActions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">{renderTableRows()}</tbody>
            </table>
          </div>
        )}
      </Card>

      {dialog?.type === 'create' && (
        <ProductFormDialog
          title={t('inventoryAddTitle')}
          submitLabel={t('inventorySave')}
          values={{ ...emptyValues }}
          onClose={closeDialog}
          onSubmit={handleCreateSubmit}
          isSubmitting={createProduct.isPending}
          errorMessage={dialog.error ?? (createProduct.error ? createProduct.error.message : undefined)}
          storeName={storeName}
        />
      )}
      {dialog?.type === 'edit' && (
        <ProductFormDialog
          title={t('inventoryUpdateTitle')}
          submitLabel={t('inventoryUpdateAction')}
          values={{
            name: dialog.product.name,
            sku: dialog.product.sku ?? '',
            barcode: dialog.product.barcode,
            categoryName: dialog.product.categoryName ?? dialog.product.category ?? '',
            price: dialog.product.priceUsd.toString(),
            currency: 'USD',
            isPinned: dialog.product.isPinned,
            reorderPoint: (dialog.product.reorderPoint ?? 3).toString()
          }}
          onClose={closeDialog}
          onSubmit={(nextValues) => handleEditSubmit(nextValues, dialog.product)}
          isSubmitting={updateProduct.isPending}
          errorMessage={dialog.error ?? (updateProduct.error ? updateProduct.error.message : undefined)}
          storeName={storeName}
        />
      )}
      {dialog?.type === 'delete' && (
        <DeleteProductDialog
          product={dialog.product}
          onClose={closeDialog}
          onConfirm={() => handleDeleteSubmit(dialog.product)}
          isSubmitting={deleteProduct.isPending}
          errorMessage={dialog.error ?? (deleteProduct.error ? deleteProduct.error.message : undefined)}
        />
      )}
    </div>
  );
}

interface ProductFormDialogProps {
  title: string;
  submitLabel: string;
  values: ProductFormValues;
  onClose: () => void;
  onSubmit: (values: ProductFormValues) => void | Promise<void>;
  isSubmitting: boolean;
  errorMessage?: string;
  storeName?: string;
}

function ProductFormDialog({
  title,
  submitLabel,
  values,
  onClose,
  onSubmit,
  isSubmitting,
  errorMessage,
  storeName
}: ProductFormDialogProps) {
  const { t } = useTranslation();
  const [formValues, setFormValues] = useState<ProductFormValues>(values);

  useEffect(() => {
    setFormValues(values);
  }, [values]);

  const handleChange = (field: Exclude<keyof ProductFormValues, 'isPinned'>) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setFormValues((previous) => ({ ...previous, [field]: event.target.value }));
    };

  const handlePinnedChange = (event: ChangeEvent<HTMLInputElement>) => {
    setFormValues((previous) => ({ ...previous, isPinned: event.target.checked }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit(formValues);
  };

  return (
    <DialogShell title={title} onClose={onClose}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-600 dark:text-slate-300" htmlFor="product-name">
              {t('inventoryName')}
            </label>
            <Input
              id="product-name"
              value={formValues.name}
              onChange={handleChange('name')}
              placeholder={t('inventoryNamePlaceholder', { storeName })}
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-600 dark:text-slate-300" htmlFor="product-sku">
              {t('inventorySku')}
            </label>
            <Input
              id="product-sku"
              value={formValues.sku}
              onChange={handleChange('sku')}
              placeholder={t('inventorySkuPlaceholder')}
            />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-600 dark:text-slate-300" htmlFor="product-barcode">
              {t('inventoryBarcode')}
            </label>
            <Input
              id="product-barcode"
              value={formValues.barcode}
              onChange={handleChange('barcode')}
              placeholder={t('inventoryBarcodePlaceholder')}
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-600 dark:text-slate-300" htmlFor="product-category">
              {t('inventoryCategoryName')}
            </label>
            <Input
              id="product-category"
              value={formValues.categoryName}
              onChange={handleChange('categoryName')}
              placeholder={t('inventoryCategoryNamePlaceholder')}
              required
            />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-600 dark:text-slate-300" htmlFor="product-price">
              {t('inventoryPrice')}
            </label>
            <Input
              id="product-price"
              type="number"
              min="0"
              step="0.01"
              value={formValues.price}
              onChange={handleChange('price')}
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-600 dark:text-slate-300" htmlFor="product-currency">
              {t('inventoryCurrency')}
            </label>
            <select
              id="product-currency"
              value={formValues.currency}
              onChange={handleChange('currency')}
              className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              <option value="USD">USD</option>
              <option value="LBP">LBP</option>
            </select>
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-600 dark:text-slate-300" htmlFor="product-reorder-point">
            {t('inventoryReorderPointLabel')}
          </label>
          <Input
            id="product-reorder-point"
            type="number"
            min="0"
            step="1"
            value={formValues.reorderPoint}
            onChange={handleChange('reorderPoint')}
            required
          />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t('inventoryReorderPointDescription')}
          </p>
        </div>
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/40">
          <div className="flex items-start gap-3">
            <input
              id="product-pinned"
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 dark:border-slate-600 dark:bg-slate-800"
              checked={formValues.isPinned}
              onChange={handlePinnedChange}
            />
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor="product-pinned">
                {t('inventoryPinToPos')}
              </label>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t('inventoryPinToPosDescription')}</p>
            </div>
          </div>
        </div>
        {errorMessage && (
          <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-700/50 dark:bg-red-900/20 dark:text-red-200">
            {errorMessage}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            className="bg-slate-200 text-slate-900 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100"
            onClick={onClose}
          >
            {t('inventoryCancel')}
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? t('inventorySaving') : submitLabel}
          </Button>
        </div>
      </form>
    </DialogShell>
  );
}

interface DeleteProductDialogProps {
  product: Product;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  isSubmitting: boolean;
  errorMessage?: string;
}

function DeleteProductDialog({ product, onClose, onConfirm, isSubmitting, errorMessage }: DeleteProductDialogProps) {
  const { t } = useTranslation();

  return (
    <DialogShell title={t('inventoryDeleteTitle')} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {t('inventoryDeleteConfirm', { name: product.name })}
        </p>
        {errorMessage && (
          <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-700/50 dark:bg-red-900/20 dark:text-red-200">
            {errorMessage}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            className="bg-slate-200 text-slate-900 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100"
            onClick={onClose}
          >
            {t('inventoryCancel')}
          </Button>
          <Button type="button" className="bg-red-500 hover:bg-red-400" onClick={onConfirm} disabled={isSubmitting}>
            {isSubmitting ? t('inventoryDeleting') : t('inventoryConfirm')}
          </Button>
        </div>
      </div>
    </DialogShell>
  );
}

interface DialogShellProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

function DialogShell({ title, onClose, children }: DialogShellProps) {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div
        className="absolute inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="relative z-10 w-full max-w-xl rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
          <button
            type="button"
            className="text-slate-500 transition hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            onClick={onClose}
            aria-label={t('inventoryCancel')}
          >
            ×
          </button>
        </div>
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>
  );
}
