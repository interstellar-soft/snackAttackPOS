import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '../components/pos/TopBar';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { useInventorySummary } from '../lib/InventoryService';
import { formatCurrency } from '../lib/utils';
import { useAuthStore } from '../stores/authStore';

type InventoryViewMode = 'categories' | 'items';

const UNCATEGORIZED_KEY = '__uncategorized__';

export function InventoryPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const logout = useAuthStore((state) => state.logout);
  const role = useAuthStore((state) => state.role);

  const canManageInventory = role?.toLowerCase() === 'admin' || role?.toLowerCase() === 'manager';

  const inventorySummary = useInventorySummary();
  const [viewMode, setViewMode] = useState<InventoryViewMode>('categories');
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);

  const currencyLocale = useMemo(
    () => (i18n.language === 'ar' ? 'ar-LB' : 'en-US'),
    [i18n.language]
  );
  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(i18n.language === 'ar' ? 'ar-LB' : 'en-US'),
    [i18n.language]
  );

  const summaryData = inventorySummary.data;
  const categories = useMemo(() => summaryData?.categories ?? [], [summaryData]);
  const items = useMemo(() => summaryData?.items ?? [], [summaryData]);

  const itemsByCategory = useMemo(() => {
    const map = new Map<string, typeof items>();
    for (const item of items) {
      const key = item.categoryId ?? UNCATEGORIZED_KEY;
      const existing = map.get(key);
      if (existing) {
        existing.push(item);
      } else {
        map.set(key, [item]);
      }
    }
    return map;
  }, [items]);

  useEffect(() => {
    if (viewMode !== 'categories') {
      setExpandedCategoryId(null);
    }
  }, [viewMode]);

  useEffect(() => {
    if (viewMode !== 'categories' || !expandedCategoryId) {
      return;
    }
    const availableKeys = categories.map((category) => category.categoryId || UNCATEGORIZED_KEY);
    if (!availableKeys.includes(expandedCategoryId)) {
      setExpandedCategoryId(null);
    }
  }, [categories, expandedCategoryId, viewMode]);

  const handleViewChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value === 'items' ? 'items' : 'categories';
    setViewMode(value);
  };

  return (
    <div className="flex min-h-screen flex-col gap-4 bg-slate-100 p-4 dark:bg-slate-950">
      <TopBar
        onLogout={logout}
        onNavigatePos={() => navigate('/')}
        onNavigateAnalytics={canManageInventory ? () => navigate('/analytics') : undefined}
        onNavigateProfits={canManageInventory ? () => navigate('/profits') : undefined}
        onNavigateInvoices={canManageInventory ? () => navigate('/invoices') : undefined}
        onNavigatePurchases={canManageInventory ? () => navigate('/purchases') : undefined}
        onNavigateAlarms={canManageInventory ? () => navigate('/alarms') : undefined}
        onNavigateSettings={canManageInventory ? () => navigate('/settings') : undefined}
        onNavigateProducts={canManageInventory ? () => navigate('/products') : undefined}
        onNavigateOffers={role?.toLowerCase() === 'admin' ? () => navigate('/offers') : undefined}
        onNavigateInventory={canManageInventory ? () => navigate('/inventory') : undefined}
        onNavigateMyCart={role?.toLowerCase() === 'admin' ? () => navigate('/my-cart') : undefined}
        onNavigateDebts={canManageInventory ? () => navigate('/debts') : undefined}
        isInventory
      />
      {inventorySummary.isLoading ? (
        <Card className="p-6 text-sm text-slate-500 dark:text-slate-400">
          {t('inventorySummaryLoading')}
        </Card>
      ) : inventorySummary.isError ? (
        <Card className="flex flex-col gap-3 p-6">
          <div className="text-sm text-red-600 dark:text-red-400">{t('inventorySummaryError')}</div>
          <div>
            <Button type="button" onClick={() => inventorySummary.refetch()} className="w-fit">
              {t('retry')}
            </Button>
          </div>
        </Card>
      ) : !summaryData ? (
        <Card className="p-6 text-sm text-slate-500 dark:text-slate-400">
          {t('inventorySummaryEmpty')}
        </Card>
      ) : (
        <div className="space-y-4">
          <Card className="p-6">
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                  {t('inventorySummaryTitle')}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {t('inventorySummaryTotalsDescription')}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    {t('inventorySummaryTotalUsd')}
                  </div>
                  <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                    {formatCurrency(summaryData.totalCostUsd ?? 0, 'USD', currencyLocale)}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    {t('inventorySummaryTotalLbp')}
                  </div>
                  <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                    {formatCurrency(summaryData.totalCostLbp ?? 0, 'LBP', currencyLocale)}
                  </div>
                </div>
              </div>
            </div>
          </Card>
          <Card className="space-y-4 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                  {viewMode === 'categories'
                    ? t('inventorySummaryCategoriesTitle')
                    : t('inventorySummaryItemsTitle')}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {viewMode === 'categories'
                    ? t('inventorySummaryCategoriesDescription')
                    : t('inventorySummaryItemsDescription')}
                </p>
              </div>
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="inventory-view-mode"
                  className="text-sm font-medium text-slate-600 dark:text-slate-300"
                >
                  {t('inventoryViewModeLabel')}
                </label>
                <select
                  id="inventory-view-mode"
                  value={viewMode}
                  onChange={handleViewChange}
                  className="h-10 min-w-[220px] rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="categories">{t('inventoryViewModeOptionCategories')}</option>
                  <option value="items">{t('inventoryViewModeOptionItems')}</option>
                </select>
              </div>
            </div>
            {viewMode === 'categories' ? (
              categories.length > 0 ? (
                <ul className="space-y-3">
                  {categories.map((category) => {
                    const categoryKey = category.categoryId || UNCATEGORIZED_KEY;
                    const categoryItems = itemsByCategory.get(categoryKey) ?? [];
                    const isExpanded = expandedCategoryId === categoryKey;

                    return (
                      <li
                        key={categoryKey}
                        className="rounded-lg border border-slate-200 p-3 dark:border-slate-700"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-slate-900 dark:text-slate-100">
                              {category.categoryName || t('inventoryCategoryUnknown')}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {t('inventorySummaryQuantityLabel', {
                                count: numberFormatter.format(category.quantityOnHand ?? 0)
                              })}
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 space-y-1 text-sm">
                          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                            <span>{t('inventorySummaryTotalUsd')}</span>
                            <span className="font-semibold text-slate-900 dark:text-slate-100">
                              {formatCurrency(category.totalCostUsd ?? 0, 'USD', currencyLocale)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                            <span>{t('inventorySummaryTotalLbp')}</span>
                            <span className="font-semibold text-slate-900 dark:text-slate-100">
                              {formatCurrency(category.totalCostLbp ?? 0, 'LBP', currencyLocale)}
                            </span>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <span>
                            {t('inventorySummaryCategoryProductCount', {
                              count: numberFormatter.format(categoryItems.length)
                            })}
                          </span>
                          {categoryItems.length > 0 && (
                            <button
                              type="button"
                              className="font-semibold text-emerald-600 transition hover:text-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:text-emerald-300 dark:hover:text-emerald-200 dark:focus:ring-offset-slate-900"
                              onClick={() =>
                                setExpandedCategoryId((current) => (current === categoryKey ? null : categoryKey))
                              }
                            >
                              {isExpanded
                                ? t('inventorySummaryCategoryHideItems')
                                : t('inventorySummaryCategoryShowItems')}
                            </button>
                          )}
                        </div>
                        {isExpanded && (
                          <div className="mt-3 space-y-2">
                            {categoryItems.map((item) => (
                              <div
                                key={item.productId}
                                className="rounded-md border border-slate-200 bg-white p-3 text-xs dark:border-slate-700 dark:bg-slate-900/40"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="font-medium text-slate-900 dark:text-slate-100">{item.productName}</span>
                                  {item.needsReorder && (
                                    <Badge className="bg-red-600 text-white hover:bg-red-500 dark:bg-red-500 dark:text-white">
                                      {t('inventoryReorderAlarmBadge')}
                                    </Badge>
                                  )}
                                </div>
                                <div className="mt-2 grid gap-1 text-slate-500 dark:text-slate-400">
                                  <div className="flex items-center justify-between">
                                    <span>
                                      {t('inventorySummaryQuantityLabel', {
                                        count: numberFormatter.format(item.quantityOnHand ?? 0)
                                      })}
                                    </span>
                                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                                      {formatCurrency(item.totalCostUsd ?? 0, 'USD', currencyLocale)}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span>{t('inventorySummaryTotalLbp')}</span>
                                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                                      {formatCurrency(item.totalCostLbp ?? 0, 'LBP', currencyLocale)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {t('inventorySummaryCategoriesEmpty')}
                </p>
              )
            ) : items.length > 0 ? (
              <ul className="space-y-3">
                {items.map((item) => (
                  <li
                    key={item.productId}
                    className="rounded-lg border border-slate-200 p-3 dark:border-slate-700"
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="font-medium text-slate-900 dark:text-slate-100">
                          {item.productName}
                        </p>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {t('inventorySummaryQuantityLabel', {
                            count: numberFormatter.format(item.quantityOnHand ?? 0)
                          })}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {item.sku ? (
                          <span>
                            {t('inventorySku')}: {item.sku}
                          </span>
                        ) : (
                          <span>
                            {t('inventoryBarcodeLabel')}: {item.barcode}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {item.categoryName || t('inventoryCategoryUnknown')}
                      </p>
                    </div>
                    {item.isReorderAlarmEnabled && (
                      <div
                        className={`mt-2 flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-xs font-medium ${
                          item.needsReorder
                            ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200'
                            : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/50 dark:bg-amber-500/10 dark:text-amber-200'
                        }`}
                      >
                        <span>
                          {item.needsReorder
                            ? t('inventoryReorderAlarmTriggered')
                            : t('inventoryReorderAlarmEnabled', {
                                reorderPoint: numberFormatter.format(item.reorderPoint ?? 0)
                              })}
                        </span>
                        {item.needsReorder && (
                          <Badge className="bg-red-600 text-white hover:bg-red-500 dark:bg-red-500 dark:text-white">
                            {t('inventoryReorderAlarmBadge')}
                          </Badge>
                        )}
                      </div>
                    )}
                    <div className="mt-3 grid gap-1 text-sm">
                      <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                        <span>{t('inventorySummaryTotalUsd')}</span>
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {formatCurrency(item.totalCostUsd ?? 0, 'USD', currencyLocale)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                        <span>{t('inventorySummaryTotalLbp')}</span>
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {formatCurrency(item.totalCostLbp ?? 0, 'LBP', currencyLocale)}
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t('inventorySummaryItemsEmpty')}
              </p>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
