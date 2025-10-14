import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '../components/pos/TopBar';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { OffersService, type Offer, type OfferItemInput, type CreateOfferInput } from '../lib/OffersService';
import { ProductsService } from '../lib/ProductsService';
import { formatCurrency } from '../lib/utils';
import { useAuthStore } from '../stores/authStore';
import { useStoreProfileStore } from '../stores/storeProfileStore';

interface OfferFormValues {
  name: string;
  description: string;
  price: string;
  currency: 'USD' | 'LBP';
  isActive: boolean;
  items: { productId: string; quantity: string }[];
}

const emptyFormValues: OfferFormValues = {
  name: '',
  description: '',
  price: '',
  currency: 'USD',
  isActive: true,
  items: [{ productId: '', quantity: '1' }]
};

function toFormValues(offer: Offer): OfferFormValues {
  return {
    name: offer.name,
    description: offer.description ?? '',
    price: offer.priceUsd.toString(),
    currency: 'USD',
    isActive: offer.isActive,
    items: offer.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity.toString()
    }))
  };
}

export function OffersPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);
  const role = useAuthStore((state) => state.role);
  useStoreProfileStore((state) => state.name);

  const offersQuery = OffersService.useOffers();
  const createOffer = OffersService.useCreateOffer();
  const updateOffer = OffersService.useUpdateOffer();
  const deleteOffer = OffersService.useDeleteOffer();
  const productsQuery = ProductsService.useInventoryProducts();

  const [dialog, setDialog] = useState<
    | { type: 'create' }
    | { type: 'edit'; offer: Offer }
    | { type: 'delete'; offer: Offer }
    | null
  >(null);
  const [formValues, setFormValues] = useState<OfferFormValues>(emptyFormValues);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const locale = useMemo(() => (i18n.language === 'ar' ? 'ar-LB' : 'en-US'), [i18n.language]);
  const isAdmin = role?.toLowerCase() === 'admin';
  const canSeeAnalytics = role?.toLowerCase() === 'admin' || role?.toLowerCase() === 'manager';

  const products = productsQuery.data;
  const isProductsLoading = productsQuery.isLoading;
  const productsLoadError = productsQuery.isError;
  const productOptions = useMemo(
    () =>
      (products ?? [])
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((product) => ({
          id: product.id,
          label: `${product.name}${product.sku ? ` (${product.sku})` : ''}`
        })),
    [products]
  );
  const canAddOfferItems = !isProductsLoading && productOptions.length > 0;

  useEffect(() => {
    if (!banner) {
      return;
    }

    const timeout = window.setTimeout(() => setBanner(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [banner]);

  const closeDialog = () => {
    setDialog(null);
    setDialogError(null);
    setFormValues(emptyFormValues);
    createOffer.reset();
    updateOffer.reset();
    deleteOffer.reset();
  };

  const openCreateDialog = () => {
    setFormValues(emptyFormValues);
    setDialog({ type: 'create' });
    setDialogError(null);
  };

  const openEditDialog = (offer: Offer) => {
    setFormValues(toFormValues(offer));
    setDialog({ type: 'edit', offer });
    setDialogError(null);
  };

  const openDeleteDialog = (offer: Offer) => {
    setDialog({ type: 'delete', offer });
    setDialogError(null);
  };

  const validateValues = (
    values: OfferFormValues
  ): { error: string } | { payload: CreateOfferInput } => {
    const name = values.name.trim();
    const description = values.description.trim();
    const parsedPrice = Number(values.price);

    if (!name || !Number.isFinite(parsedPrice) || parsedPrice < 0) {
      return { error: t('offersFormIncomplete') };
    }

    const normalizedItems: OfferItemInput[] = [];
    const seen = new Set<string>();

    for (const item of values.items) {
      const productId = item.productId.trim();
      const quantityValue = Number(item.quantity);

      if (!productId || !Number.isFinite(quantityValue) || quantityValue <= 0) {
        return { error: t('offersFormIncomplete') };
      }

      if (seen.has(productId)) {
        return { error: t('offersFormIncomplete') };
      }

      seen.add(productId);
      normalizedItems.push({ productId, quantity: quantityValue });
    }

    if (normalizedItems.length === 0) {
      return { error: t('offersFormIncomplete') };
    }

    return {
      payload: {
        name,
        description: description ? description : undefined,
        price: parsedPrice,
        currency: values.currency,
        isActive: values.isActive,
        items: normalizedItems
      }
    };
  };

  const handleCreateSubmit = async () => {
    const result = validateValues(formValues);
    if ('error' in result) {
      setDialogError(result.error);
      return;
    }

    try {
      await createOffer.mutateAsync(result.payload);
      setBanner({ type: 'success', message: t('offersCreateSuccess') });
      closeDialog();
    } catch (error) {
      const message = error instanceof Error ? error.message : t('offersFormIncomplete');
      setDialogError(message);
    }
  };

  const handleEditSubmit = async (offer: Offer) => {
    const result = validateValues(formValues);
    if ('error' in result) {
      setDialogError(result.error);
      return;
    }

    try {
      await updateOffer.mutateAsync({ id: offer.id, ...result.payload });
      setBanner({ type: 'success', message: t('offersUpdateSuccess') });
      closeDialog();
    } catch (error) {
      const message = error instanceof Error ? error.message : t('offersFormIncomplete');
      setDialogError(message);
    }
  };

  const handleDelete = async (offer: Offer) => {
    try {
      await deleteOffer.mutateAsync({ id: offer.id });
      setBanner({ type: 'success', message: t('offersDeleteSuccess') });
      closeDialog();
    } catch (error) {
      const message = error instanceof Error ? error.message : t('offersFormIncomplete');
      setDialogError(message);
    }
  };

  const handleToggleActive = async (offer: Offer) => {
    try {
      await updateOffer.mutateAsync({
        id: offer.id,
        name: offer.name,
        description: offer.description ?? undefined,
        price: offer.priceUsd,
        currency: 'USD',
        isActive: !offer.isActive,
        items: offer.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity
        }))
      });
      setBanner({
        type: 'success',
        message: !offer.isActive ? t('offersActivateSuccess') : t('offersDeactivateSuccess')
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : t('offersFormIncomplete');
      setBanner({ type: 'error', message });
    }
  };

  const updateItemField = (index: number, key: 'productId' | 'quantity', value: string) => {
    setFormValues((previous) => {
      const items = previous.items.slice();
      if (!items[index]) {
        return previous;
      }
      items[index] = { ...items[index], [key]: value };
      return { ...previous, items };
    });
  };

  const addItemRow = () => {
    if (!canAddOfferItems) {
      return;
    }
    setFormValues((previous) => ({
      ...previous,
      items: [...previous.items, { productId: '', quantity: '1' }]
    }));
  };

  const removeItemRow = (index: number) => {
    setFormValues((previous) => {
      if (previous.items.length <= 1) {
        return {
          ...previous,
          items: [{ productId: '', quantity: '1' }]
        };
      }
      return {
        ...previous,
        items: previous.items.filter((_, idx) => idx !== index)
      };
    });
  };

  const offers = offersQuery.data ?? [];
  const totalOffers = offers.length;
  const isSubmitDisabled = createOffer.isPending || updateOffer.isPending || isProductsLoading;

  return (
    <div className="flex min-h-screen flex-col gap-4 bg-slate-100 p-4 dark:bg-slate-950">
      <TopBar
        onLogout={logout}
        onNavigatePos={() => navigate('/')}
        onNavigateAnalytics={canSeeAnalytics ? () => navigate('/analytics') : undefined}
        onNavigateProfits={canSeeAnalytics ? () => navigate('/profits') : undefined}
        onNavigateInvoices={canSeeAnalytics ? () => navigate('/invoices') : undefined}
        onNavigatePurchases={canSeeAnalytics ? () => navigate('/purchases') : undefined}
        onNavigateAlarms={canSeeAnalytics ? () => navigate('/alarms') : undefined}
        onNavigateSettings={canSeeAnalytics ? () => navigate('/settings') : undefined}
        onNavigateProducts={canSeeAnalytics ? () => navigate('/products') : undefined}
        onNavigateInventory={canSeeAnalytics ? () => navigate('/inventory') : undefined}
        onNavigateOffers={isAdmin ? () => navigate('/offers') : undefined}
        onNavigateMyCart={isAdmin ? () => navigate('/my-cart') : undefined}
        isOffers
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

      {dialog && dialog.type !== 'delete' && (
        <Card className="space-y-4 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              {dialog.type === 'create' ? t('offersCreateTitle') : t('offersEditTitle')}
            </h2>
            <Button type="button" className="bg-slate-200 text-slate-900 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100" onClick={closeDialog}>
              {t('inventoryCancel')}
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-medium">
              <span>{t('offersName')}</span>
              <Input value={formValues.name} onChange={(event) => setFormValues((previous) => ({ ...previous, name: event.target.value }))} />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              <span>{t('offersPrice')}</span>
              <Input
                value={formValues.price}
                onChange={(event) => setFormValues((previous) => ({ ...previous, price: event.target.value }))}
                type="number"
                min={0}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              <span>{t('offersCurrency')}</span>
              <select
                value={formValues.currency}
                onChange={(event) =>
                  setFormValues((previous) => ({ ...previous, currency: event.target.value as 'USD' | 'LBP' }))
                }
                className="rounded-md border border-slate-300 bg-white p-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-600 dark:bg-slate-900"
              >
                <option value="USD">USD</option>
                <option value="LBP">LBP</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={formValues.isActive}
                onChange={(event) => setFormValues((previous) => ({ ...previous, isActive: event.target.checked }))}
                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 dark:border-slate-600 dark:bg-slate-800"
              />
              <span>{t('offersStatusLabel')}</span>
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm font-medium">
            <span>{t('offersDescription')}</span>
            <textarea
              value={formValues.description}
              onChange={(event) => setFormValues((previous) => ({ ...previous, description: event.target.value }))}
              rows={3}
              className="rounded-md border border-slate-300 bg-white p-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-600 dark:bg-slate-900"
            />
          </label>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t('offersItems')}</h3>
              <Button
                type="button"
                onClick={addItemRow}
                className="bg-emerald-500 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!canAddOfferItems}
              >
                {t('offersAddItem')}
              </Button>
            </div>
            <div className="space-y-2 text-sm">
              {isProductsLoading && (
                <p className="text-slate-500 dark:text-slate-400">{t('offersProductsLoading')}</p>
              )}
              {productsLoadError && (
                <p className="text-red-600 dark:text-red-300">{t('offersProductsError')}</p>
              )}
              {!isProductsLoading && !productsLoadError && productOptions.length === 0 && (
                <p className="text-slate-500 dark:text-slate-400">{t('offersProductsEmpty')}</p>
              )}
            </div>
            <div className="space-y-3">
              {formValues.items.map((item, index) => (
                <div key={`${index}-${item.productId}`} className="grid gap-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700 md:grid-cols-2">
                  <label className="flex flex-col gap-1 text-sm font-medium">
                    <span>{t('product')}</span>
                    <select
                      value={item.productId}
                      onChange={(event) => updateItemField(index, 'productId', event.target.value)}
                      className="rounded-md border border-slate-300 bg-white p-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900"
                      disabled={isProductsLoading}
                    >
                      <option value="">{t('offersProductPlaceholder')}</option>
                      {productOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-sm font-medium">
                    <span>{t('offersQuantity')}</span>
                    <Input
                      value={item.quantity}
                      onChange={(event) => updateItemField(index, 'quantity', event.target.value)}
                      type="number"
                      min={0}
                    />
                  </label>
                  <div className="md:col-span-2">
                    <Button
                      type="button"
                      className="bg-red-500 hover:bg-red-400"
                      onClick={() => removeItemRow(index)}
                    >
                      {t('offersRemoveItem')}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {dialogError && <p className="text-sm text-red-600 dark:text-red-300">{dialogError}</p>}
          <div className="flex gap-2">
            <Button
              type="button"
              className="bg-emerald-500 hover:bg-emerald-400"
              onClick={() =>
                dialog?.type === 'edit'
                  ? handleEditSubmit(dialog.offer)
                  : handleCreateSubmit()
              }
              disabled={isSubmitDisabled}
            >
              {dialog?.type === 'edit' ? t('offersSubmitUpdate') : t('offersSubmitCreate')}
            </Button>
            <Button type="button" className="bg-slate-200 text-slate-900 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100" onClick={closeDialog}>
              {t('inventoryCancel')}
            </Button>
          </div>
        </Card>
      )}

      {dialog && dialog.type === 'delete' && (
        <Card className="space-y-4 p-6">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{t('offersDeleteTitle')}</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {t('offersDeleteConfirm', { name: dialog.offer.name })}
          </p>
          {dialogError && <p className="text-sm text-red-600 dark:text-red-300">{dialogError}</p>}
          <div className="flex gap-2">
            <Button
              type="button"
              className="bg-red-500 hover:bg-red-400"
              onClick={() => handleDelete(dialog.offer)}
              disabled={deleteOffer.isPending}
            >
              {t('inventoryConfirm')}
            </Button>
            <Button type="button" className="bg-slate-200 text-slate-900 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100" onClick={closeDialog}>
              {t('inventoryCancel')}
            </Button>
          </div>
        </Card>
      )}

      <Card className="space-y-4 p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{t('offersListTitle')}</h2>
            <p className="text-sm text-slate-500">{t('offersItemSummary', { count: totalOffers })}</p>
          </div>
          {isAdmin && (
            <Button type="button" onClick={openCreateDialog}>
              {t('offersCreateTitle')}
            </Button>
          )}
        </div>
        {offersQuery.isLoading && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/40">
            {t('offersLoading')}
          </div>
        )}
        {offersQuery.isError && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-700/50 dark:bg-red-900/20 dark:text-red-200">
            {t('offersError')}
          </div>
        )}
        {!offersQuery.isLoading && !offersQuery.isError && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
              <thead className="bg-slate-50 dark:bg-slate-900/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {t('offersName')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {t('offersPrice')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {t('offersStatusLabel')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {t('offersItems')}
                  </th>
                  {isAdmin && (
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {t('inventoryActions')}
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {offers.length === 0 && (
                  <tr>
                    <td className="px-4 py-6 text-center text-sm text-slate-500" colSpan={isAdmin ? 5 : 4}>
                      {t('offersNoResults')}
                    </td>
                  </tr>
                )}
                {offers.map((offer) => (
                  <tr key={offer.id} className="text-slate-700 dark:text-slate-200">
                    <td className="px-4 py-3 text-sm font-medium">{offer.name}</td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex flex-col">
                        <span>{formatCurrency(offer.priceUsd, 'USD', locale)}</span>
                        <span className="text-xs text-slate-500">{formatCurrency(offer.priceLbp, 'LBP', locale)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <Badge className={offer.isActive ? 'bg-emerald-500' : 'bg-slate-400'}>
                        {offer.isActive ? t('offersActive') : t('offersInactive')}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex flex-col gap-1">
                        {offer.items.map((item) => (
                          <span key={item.productId} className="text-sm">
                            {item.productName} × {item.quantity}
                          </span>
                        ))}
                      </div>
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2 justify-end">
                          <Button
                            type="button"
                            className="bg-slate-200 text-slate-900 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100"
                            onClick={() => openEditDialog(offer)}
                          >
                            {t('inventoryEdit')}
                          </Button>
                          <Button
                            type="button"
                            className="bg-indigo-500 hover:bg-indigo-400"
                            onClick={() => handleToggleActive(offer)}
                            disabled={updateOffer.isPending}
                          >
                            {t('offersToggleActive')}
                          </Button>
                          <Button
                            type="button"
                            className="bg-red-500 hover:bg-red-400"
                            onClick={() => openDeleteDialog(offer)}
                          >
                            {t('inventoryDelete')}
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
