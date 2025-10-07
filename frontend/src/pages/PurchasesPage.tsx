import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '../components/pos/TopBar';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { API_BASE_URL } from '../lib/api';
import { ProductsService, type Product } from '../lib/ProductsService';
import { PurchasesService, type Purchase, type PurchaseItemInput } from '../lib/PurchasesService';
import { useAuthStore } from '../stores/authStore';
import { useStoreProfileStore } from '../stores/storeProfileStore';
import { formatCurrency } from '../lib/utils';
import { CategorySelect } from '../components/purchases/CategorySelect';

interface DraftItem {
  id: string;
  productId?: string;
  barcode: string;
  name: string;
  sku: string;
  categoryName: string;
  quantity: string;
  unitCost: string;
  currency: 'USD' | 'LBP';
  salePriceUsd: string;
  isExisting: boolean;
  quantityOnHand: number;
}

const createId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));

export function PurchasesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);
  const token = useAuthStore((state) => state.token);
  const role = useAuthStore((state) => state.role);
  const storeName = useStoreProfileStore((state) => state.name);

  const [barcode, setBarcode] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [reference, setReference] = useState('');
  const [exchangeRate, setExchangeRate] = useState('90000');
  const [items, setItems] = useState<DraftItem[]>([]);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [lastScannedItemId, setLastScannedItemId] = useState<string | null>(null);
  const quantityInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const barcodeInputRef = useRef<HTMLInputElement | null>(null);
  const barcodeBufferRef = useRef('');
  const barcodeTimeoutRef = useRef<number | null>(null);
  const lastScannerTimeRef = useRef(0);
  const pendingFirstCharRef = useRef('');
  const pendingEditableRef = useRef<{
    element: HTMLInputElement | HTMLTextAreaElement;
    value: string;
    selectionStart: number | null;
    selectionEnd: number | null;
  } | null>(null);
  const pendingEditableTimeoutRef = useRef<number | null>(null);

  const purchasesQuery = PurchasesService.usePurchases();
  const inventoryProductsQuery = ProductsService.useInventoryProducts();
  const createPurchase = PurchasesService.useCreatePurchase();
  const updatePurchase = PurchasesService.useUpdatePurchase();

  const canManageInventory = role?.toLowerCase() === 'admin' || role?.toLowerCase() === 'manager';

  const categoryOptions = useMemo(() => {
    const items = inventoryProductsQuery.data ?? [];
    const map = new Map<string, string>();
    for (const product of items) {
      const raw = (product.categoryName ?? product.category ?? '').trim();
      if (!raw) {
        continue;
      }
      const key = raw.toLocaleLowerCase();
      if (!map.has(key)) {
        map.set(key, raw);
      }
    }
    const collator = new Intl.Collator(undefined, { sensitivity: 'base' });
    return Array.from(map.values()).sort((a, b) => collator.compare(a, b));
  }, [inventoryProductsQuery.data]);

  const focusBarcodeInput = useCallback(() => {
    const element = barcodeInputRef.current;
    if (!element) {
      return;
    }
    element.focus();
    if (typeof element.setSelectionRange === 'function') {
      const length = element.value.length;
      element.setSelectionRange(length, length);
    }
  }, []);

  useEffect(() => {
    focusBarcodeInput();
  }, [focusBarcodeInput]);

  useEffect(() => {
    if (!banner) {
      return;
    }
    const timeout = window.setTimeout(() => setBanner(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [banner]);

  useEffect(() => {
    if (!editingPurchaseId) {
      setEditingLabel(null);
      return;
    }
    const match = purchasesQuery.data?.find((purchase) => purchase.id === editingPurchaseId);
    if (match) {
      const label = match.reference?.trim() || match.supplierName || match.id;
      setEditingLabel(label);
    }
  }, [editingPurchaseId, purchasesQuery.data]);

  const handleFetchProduct = useCallback(async (code: string): Promise<Product | null> => {
    const trimmed = code.trim();
    if (!trimmed) {
      return null;
    }
    const response = await fetch(`${API_BASE_URL}/api/products/scan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ barcode: trimmed })
    });
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || t('purchasesError'));
    }
    return (await response.json()) as Product;
  }, [t, token]);

  const resetDraft = () => {
    setItems([]);
    setSupplierName('');
    setReference('');
    setBarcode('');
    setEditingPurchaseId(null);
    setEditingLabel(null);
    setLastScannedItemId(null);
  };

  const handleEditPurchase = (purchase: Purchase) => {
    setEditingPurchaseId(purchase.id);
    const nextLabel = purchase.reference?.trim() || purchase.supplierName || purchase.id;
    setEditingLabel(nextLabel);
    setSupplierName(purchase.supplierName);
    setReference(purchase.reference ?? '');
    setExchangeRate(purchase.exchangeRateUsed.toString());
    setItems(
      purchase.lines.map((line) => ({
        id: line.id,
        productId: line.productId,
        barcode: line.barcode,
        name: line.productName,
        sku: line.productSku?.trim() ?? '',
        categoryName: line.categoryName?.trim() ?? '',
        quantity: line.quantity.toString(),
        unitCost: line.unitCostUsd.toString(),
        currency: 'USD',
        salePriceUsd: line.currentSalePriceUsd != null ? line.currentSalePriceUsd.toString() : '',
        isExisting: true,
        quantityOnHand: line.quantityOnHand ?? 0
      }))
    );
    setLastScannedItemId(null);
    setBarcode('');
    setBanner({ type: 'success', message: t('purchasesEditing') });
  };

  const handleCancelEdit = () => {
    resetDraft();
    setBanner(null);
  };

  const focusAndSelectQuantityInput = useCallback((input: HTMLInputElement) => {
    const focusInput = () => {
      if (typeof input.focus === 'function') {
        input.focus({ preventScroll: true });
      }
    };

    const runSelection = () => {
      try {
        if (typeof input.select === 'function') {
          input.select();
          return;
        }
        if (typeof input.setSelectionRange === 'function') {
          input.setSelectionRange(0, input.value.length);
        }
      } catch {
        // Some browsers throw for selection APIs on number inputs; ignore and retry.
      }
    };

    const focusAndSelect = () => {
      focusInput();
      runSelection();
    };

    focusAndSelect();

    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(focusAndSelect);
      requestAnimationFrame(focusAndSelect);
    }

    const retryDelays = [0, 24, 64, 120];
    for (const delay of retryDelays) {
      window.setTimeout(focusAndSelect, delay);
    }
  }, []);

  const addBarcode = useCallback(
    async (rawCode: string) => {
      const trimmed = rawCode.trim();
      if (!trimmed) {
        return;
      }
      try {
        const product = await handleFetchProduct(trimmed);
        const deriveNextItems = (previous: DraftItem[]) => {
          if (product) {
            const existingIndex = previous.findIndex((item) => item.productId === product.id);
            if (existingIndex >= 0) {
              const next = [...previous];
              const target = next[existingIndex];
              const nextQuantity = (Number(target.quantity) || 0) + 1;
              const updated = { ...target, quantity: nextQuantity.toString() };
              next[existingIndex] = updated;
              return { items: next, highlightId: updated.id };
            }
            const newItem: DraftItem = {
              id: product.id,
              productId: product.id,
              barcode: product.barcode,
              name: product.name,
              sku: product.sku?.trim() ?? '',
              categoryName: product.categoryName ?? product.category ?? '',
              quantity: '1',
              unitCost: (product.averageCostUsd ?? product.priceUsd ?? 0).toString(),
              currency: 'USD',
              salePriceUsd: product.priceUsd?.toString() ?? '',
              isExisting: true,
              quantityOnHand: product.quantityOnHand ?? 0
            };
            return { items: [...previous, newItem], highlightId: newItem.id };
          }
          const existingIndex = previous.findIndex((item) => item.barcode === trimmed);
          if (existingIndex >= 0) {
            const next = [...previous];
            const target = next[existingIndex];
            const nextQuantity = (Number(target.quantity) || 0) + 1;
            const updated = { ...target, quantity: nextQuantity.toString() };
            next[existingIndex] = updated;
            return { items: next, highlightId: updated.id };
          }
          const newItem: DraftItem = {
            id: createId(),
            barcode: trimmed,
            name: '',
            sku: '',
            categoryName: '',
            quantity: '1',
            unitCost: '0',
            currency: 'USD',
            salePriceUsd: '',
            isExisting: false,
            quantityOnHand: 0
          };
          return { items: [...previous, newItem], highlightId: newItem.id };
        };

        let nextHighlightedId: string | null = null;
        setItems((previous) => {
          const { items: nextItems, highlightId } = deriveNextItems(previous);
          nextHighlightedId = highlightId;
          return nextItems;
        });
        if (nextHighlightedId) {
          setLastScannedItemId(nextHighlightedId);
          window.setTimeout(() => {
            const input = quantityInputRefs.current[nextHighlightedId!];
            if (input) {
              focusAndSelectQuantityInput(input);
            }
          });
        }
        setBarcode('');
        setBanner(null);
      } catch (error) {
        const message = error instanceof Error ? error.message : t('purchasesError');
        setBanner({ type: 'error', message });
      }
    },
    [focusAndSelectQuantityInput, handleFetchProduct, t]
  );

  const handleBarcodeAdd = useCallback(async () => {
    await addBarcode(barcode);
  }, [addBarcode, barcode]);

  const handleItemChange = (id: string, field: keyof DraftItem, value: string) => {
    setItems((previous) => previous.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
    if (field === 'quantity' && lastScannedItemId === id) {
      setLastScannedItemId(null);
    }
  };

  const handleRemoveItem = (id: string) => {
    setItems((previous) => previous.filter((item) => item.id !== id));
    if (lastScannedItemId === id) {
      setLastScannedItemId(null);
    }
  };

  useEffect(() => {
    if (lastScannedItemId && !items.some((item) => item.id === lastScannedItemId)) {
      setLastScannedItemId(null);
    }
  }, [items, lastScannedItemId]);

  const highlightedQuantity = lastScannedItemId
    ? items.find((item) => item.id === lastScannedItemId)?.quantity
    : undefined;

  const focusAndSelectQuantityInput = useCallback((input: HTMLInputElement) => {
    const focusInput = () => {
      if (typeof input.focus === 'function') {
        input.focus({ preventScroll: true });
      }
    };

    const runSelection = () => {
      try {
        if (typeof input.select === 'function') {
          input.select();
          return;
        }
        if (typeof input.setSelectionRange === 'function') {
          input.setSelectionRange(0, input.value.length);
        }
      } catch {
        // Some browsers throw for selection APIs on number inputs; ignore and retry.
      }
    };

    const focusAndSelect = () => {
      focusInput();
      runSelection();
    };

    focusAndSelect();

    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(focusAndSelect);
      requestAnimationFrame(focusAndSelect);
    }

    const retryDelays = [0, 24, 64, 120];
    for (const delay of retryDelays) {
      window.setTimeout(focusAndSelect, delay);
    }
  }, []);

  useEffect(() => {
    if (!lastScannedItemId) {
      return;
    }
    const input = quantityInputRefs.current[lastScannedItemId];
    if (input) {
      focusAndSelectQuantityInput(input);
    }
  }, [focusAndSelectQuantityInput, lastScannedItemId, highlightedQuantity]);

  const submitScannedBarcode = useCallback(
    (code: string) => {
      void addBarcode(code);
    },
    [addBarcode]
  );

  useEffect(() => {
    const scannerThresholdMs = 100;

    const clearPendingEditable = () => {
      pendingFirstCharRef.current = '';
      pendingEditableRef.current = null;
      if (pendingEditableTimeoutRef.current !== null) {
        window.clearTimeout(pendingEditableTimeoutRef.current);
        pendingEditableTimeoutRef.current = null;
      }
    };

    const clearBuffer = (clearInput = false) => {
      barcodeBufferRef.current = '';
      if (barcodeTimeoutRef.current !== null) {
        window.clearTimeout(barcodeTimeoutRef.current);
        barcodeTimeoutRef.current = null;
      }
      if (clearInput) {
        setBarcode('');
      }
      clearPendingEditable();
    };

    const scheduleBufferReset = () => {
      if (barcodeTimeoutRef.current !== null) {
        window.clearTimeout(barcodeTimeoutRef.current);
      }
      barcodeTimeoutRef.current = window.setTimeout(() => {
        clearBuffer(true);
      }, scannerThresholdMs);
    };

    const applyPendingFirstChar = () => {
      if (!pendingFirstCharRef.current) {
        return '';
      }
      const firstChar = pendingFirstCharRef.current;
      const pendingEditable = pendingEditableRef.current;
      if (pendingEditable) {
        const { element, value, selectionStart, selectionEnd } = pendingEditable;
        element.value = value;
        if (typeof selectionStart === 'number' && typeof selectionEnd === 'number') {
          element.setSelectionRange(selectionStart, selectionEnd);
        }
      }
      clearPendingEditable();
      return firstChar;
    };

    const handleKeydown = (event: KeyboardEvent) => {
      const activeElement = document.activeElement as HTMLElement | null;
      if (activeElement === barcodeInputRef.current) {
        return;
      }

      if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      const isPrintableKey = event.key.length === 1 && event.key !== 'Enter';
      const isEnter = event.key === 'Enter';

      if (!isPrintableKey && !isEnter) {
        return;
      }

      const now = performance.now();
      const timeSinceLast = now - lastScannerTimeRef.current;
      lastScannerTimeRef.current = now;

      if (isPrintableKey) {
        const shouldHandle =
          barcodeBufferRef.current.length > 0 ||
          pendingFirstCharRef.current !== '' ||
          timeSinceLast <= scannerThresholdMs;

        if (!shouldHandle) {
          pendingFirstCharRef.current = event.key;

          const target = event.target;
          if (
            target instanceof HTMLInputElement ||
            target instanceof HTMLTextAreaElement
          ) {
            if (target !== barcodeInputRef.current && !target.readOnly && !target.disabled) {
              pendingEditableRef.current = {
                element: target,
                value: target.value,
                selectionStart: target.selectionStart,
                selectionEnd: target.selectionEnd
              };
            } else {
              pendingEditableRef.current = null;
            }
          } else {
            pendingEditableRef.current = null;
          }

          if (pendingEditableTimeoutRef.current !== null) {
            window.clearTimeout(pendingEditableTimeoutRef.current);
          }
          pendingEditableTimeoutRef.current = window.setTimeout(() => {
            pendingFirstCharRef.current = '';
            pendingEditableRef.current = null;
            pendingEditableTimeoutRef.current = null;
          }, scannerThresholdMs);
          return;
        }

        event.preventDefault();
        focusBarcodeInput();

        if (!barcodeBufferRef.current) {
          const firstChar = applyPendingFirstChar();
          barcodeBufferRef.current = firstChar;
        }

        const nextValue = `${barcodeBufferRef.current}${event.key}`;
        barcodeBufferRef.current = nextValue;
        setBarcode(nextValue);
        scheduleBufferReset();
        return;
      }

      const shouldHandleEnter =
        barcodeBufferRef.current.length > 0 || pendingFirstCharRef.current !== '';

      if (!shouldHandleEnter) {
        return;
      }

      event.preventDefault();
      focusBarcodeInput();

      if (!barcodeBufferRef.current) {
        const firstChar = applyPendingFirstChar();
        barcodeBufferRef.current = firstChar;
      }

      const pendingValue = barcodeBufferRef.current || barcodeInputRef.current?.value || '';
      const trimmed = pendingValue.trim();
      clearBuffer();

      if (trimmed) {
        setBarcode(trimmed);
        submitScannedBarcode(trimmed);
      }
    };

    window.addEventListener('keydown', handleKeydown);
    return () => {
      window.removeEventListener('keydown', handleKeydown);
      clearBuffer();
    };
  }, [focusBarcodeInput, submitScannedBarcode]);

  const totals = useMemo(() => {
    const rate = Number(exchangeRate) > 0 ? Number(exchangeRate) : 1;
    return items.reduce(
      (acc, item) => {
        const quantity = Number(item.quantity);
        const cost = Number(item.unitCost);
        if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(cost) || cost < 0) {
          return acc;
        }
        if (item.currency === 'USD') {
          acc.usd += quantity * cost;
          acc.lbp += quantity * cost * rate;
        } else {
          acc.lbp += quantity * cost;
          acc.usd += rate > 0 ? (quantity * cost) / rate : 0;
        }
        return acc;
      },
      { usd: 0, lbp: 0 }
    );
  }, [items, exchangeRate]);

  const isSaving = editingPurchaseId ? updatePurchase.isPending : createPurchase.isPending;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const rate = Number(exchangeRate);
    if (!Number.isFinite(rate) || rate <= 0) {
      setBanner({ type: 'error', message: t('purchasesValidationError') });
      return;
    }
    if (items.length === 0) {
      setBanner({ type: 'error', message: t('purchasesValidationError') });
      return;
    }

    const payloadItems: PurchaseItemInput[] = [];
    for (const item of items) {
      const quantity = Number(item.quantity);
      const unitCost = Number(item.unitCost);
      if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitCost) || unitCost < 0) {
        setBanner({ type: 'error', message: t('purchasesValidationError') });
        return;
      }
      const salePrice = Number(item.salePriceUsd);
      if (!item.isExisting) {
        if (!item.name.trim() || !item.categoryName.trim()) {
          setBanner({ type: 'error', message: t('purchasesValidationError') });
          return;
        }
      }
      payloadItems.push({
        productId: item.productId,
        barcode: item.barcode,
        name: item.isExisting ? undefined : item.name.trim(),
        sku:
          item.isExisting || !item.sku.trim()
            ? undefined
            : item.sku.trim(),
        categoryName: item.isExisting ? undefined : item.categoryName.trim(),
        quantity,
        unitCost,
        currency: item.currency,
        salePriceUsd: Number.isFinite(salePrice) && salePrice > 0 ? salePrice : undefined
      });
    }

    try {
      if (editingPurchaseId) {
        await updatePurchase.mutateAsync({
          id: editingPurchaseId,
          payload: {
            supplierName: supplierName.trim() || undefined,
            reference: reference.trim() || undefined,
            exchangeRate: rate,
            items: payloadItems
          }
        });
        resetDraft();
        setBanner({ type: 'success', message: t('purchasesUpdated') });
      } else {
        await createPurchase.mutateAsync({
          supplierName: supplierName.trim() || undefined,
          reference: reference.trim() || undefined,
          exchangeRate: rate,
          items: payloadItems
        });
        resetDraft();
        setBanner({ type: 'success', message: t('purchasesSuccess') });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : t('purchasesError');
      setBanner({ type: 'error', message });
    }
  };

  return (
    <div className="flex min-h-screen flex-col gap-4 bg-slate-100 p-4 dark:bg-slate-950">
      <TopBar
        onLogout={logout}
        onNavigatePos={() => navigate('/')}
        onNavigateAnalytics={canManageInventory ? () => navigate('/analytics') : undefined}
        onNavigateProfits={canManageInventory ? () => navigate('/profits') : undefined}
        onNavigateProducts={canManageInventory ? () => navigate('/products') : undefined}
        onNavigateInventory={canManageInventory ? () => navigate('/inventory') : undefined}
        onNavigateInvoices={canManageInventory ? () => navigate('/invoices') : undefined}
        onNavigateSettings={canManageInventory ? () => navigate('/settings') : undefined}
        onNavigatePurchases={canManageInventory ? () => navigate('/purchases') : undefined}
        isPurchases
      />
      {editingPurchaseId && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 shadow-sm dark:border-amber-700/40 dark:bg-amber-900/20 dark:text-amber-200">
          {editingLabel ? `${t('purchasesEditing')} — ${editingLabel}` : t('purchasesEditing')}
        </div>
      )}
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
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <Card className="space-y-4 p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{t('purchasesNew')}</h2>
                <p className="text-sm text-slate-500">{t('purchasesNewSubtitle', { storeName })}</p>
              </div>
              <div className="flex gap-2">
                <Input
                  id="purchases-barcode-input"
                  ref={barcodeInputRef}
                  value={barcode}
                  onChange={(event) => setBarcode(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      void handleBarcodeAdd();
                    }
                  }}
                  placeholder={t('purchasesScanPlaceholder')}
                  autoFocus
                />
                <Button type="button" className="bg-emerald-500 hover:bg-emerald-400" onClick={() => void handleBarcodeAdd()}>
                  {t('purchasesScanAdd')}
                </Button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-600 dark:text-slate-300" htmlFor="supplier">
                  {t('purchasesSupplier')}
                </label>
                <Input
                  id="supplier"
                  value={supplierName}
                  onChange={(event) => setSupplierName(event.target.value)}
                  placeholder={t('purchasesSupplierPlaceholder')}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-600 dark:text-slate-300" htmlFor="reference">
                  {t('purchasesReference')}
                </label>
                <Input
                  id="reference"
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                  placeholder="INV-12345"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-600 dark:text-slate-300" htmlFor="exchange-rate">
                  {t('purchasesExchangeRate')}
                </label>
                <Input
                  id="exchange-rate"
                  type="number"
                  min="1"
                  step="1"
                  value={exchangeRate}
                  onChange={(event) => setExchangeRate(event.target.value)}
                  required
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm dark:divide-slate-800">
                <thead className="bg-slate-50 dark:bg-slate-800/50">
                  <tr className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    <th className="px-4 py-3">{t('product')}</th>
                    <th className="px-4 py-3">{t('inventorySku')}</th>
                    <th className="px-4 py-3">{t('inventoryCategoryName')}</th>
                    <th className="px-4 py-3">{t('quantity')}</th>
                    <th className="px-4 py-3">{t('purchasesUnitCost')}</th>
                    <th className="px-4 py-3">{t('purchasesCurrency')}</th>
                    <th className="px-4 py-3">{t('purchasesSalePrice')}</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {items.length === 0 && (
                    <tr>
                      <td className="px-4 py-6 text-center text-sm text-slate-500" colSpan={8}>
                        {t('purchasesEmpty')}
                      </td>
                    </tr>
                  )}
                  {items.map((item) => {
                    const isHighlighted = lastScannedItemId === item.id;
                    const rowClasses = `align-top text-slate-700 transition-colors dark:text-slate-200 ${
                      isHighlighted ? 'bg-emerald-50 dark:bg-emerald-900/30' : ''
                    }`;
                    return (
                      <tr key={item.id} className={rowClasses}>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                              <Input
                                value={item.name}
                                onChange={(event) => handleItemChange(item.id, 'name', event.target.value)}
                                placeholder={t('inventoryNamePlaceholder', { storeName })}
                                disabled={item.isExisting}
                                required={!item.isExisting}
                              />
                              <Badge className={item.isExisting ? 'bg-emerald-500' : 'bg-blue-500'}>
                                {item.isExisting ? t('purchasesExistingBadge') : t('purchasesNewBadge')}
                              </Badge>
                            </div>
                            <span className="text-xs text-slate-500">
                              {t('inventoryBarcode')}: {item.barcode}
                            </span>
                            <span className="text-xs text-slate-500">
                              {t('purchasesOnHand', { count: item.quantityOnHand.toLocaleString() })}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Input
                            value={item.isExisting && !item.sku.trim() ? '—' : item.sku}
                            onChange={(event) => handleItemChange(item.id, 'sku', event.target.value)}
                            placeholder={t('inventorySkuPlaceholder')}
                            disabled={item.isExisting}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <CategorySelect
                            categories={categoryOptions}
                            value={item.categoryName}
                            onChange={(value) => handleItemChange(item.id, 'categoryName', value)}
                            placeholder={t('inventoryCategoryNamePlaceholder')}
                            disabled={item.isExisting}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.quantity}
                            ref={(element) => {
                              if (element) {
                                quantityInputRefs.current[item.id] = element;
                              } else {
                                delete quantityInputRefs.current[item.id];
                              }
                            }}
                            onChange={(event) => handleItemChange(item.id, 'quantity', event.target.value)}
                            required
                          />
                        </td>
                        <td className="px-4 py-3">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unitCost}
                            onChange={(event) => handleItemChange(item.id, 'unitCost', event.target.value)}
                            required
                          />
                        </td>
                        <td className="px-4 py-3">
                          <select
                            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900"
                            value={item.currency}
                            onChange={(event) => handleItemChange(item.id, 'currency', event.target.value)}
                          >
                            <option value="USD">USD</option>
                            <option value="LBP">LBP</option>
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.salePriceUsd}
                            onChange={(event) => handleItemChange(item.id, 'salePriceUsd', event.target.value)}
                            placeholder={t('purchasesSalePricePlaceholder')}
                          />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button type="button" className="bg-red-500 hover:bg-red-400" onClick={() => handleRemoveItem(item.id)}>
                            {t('removeItem')}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col gap-3 rounded-lg bg-slate-50 p-4 text-sm dark:bg-slate-900/50">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-600 dark:text-slate-300">{t('purchasesSummaryTotalUsd')}</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-300">
                  {formatCurrency(totals.usd, 'USD')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-600 dark:text-slate-300">{t('purchasesSummaryTotalLbp')}</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-300">
                  {formatCurrency(totals.lbp, 'LBP')}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                type="button"
                className="bg-blue-500 hover:bg-blue-400"
                onClick={() => {
                  const newItem: DraftItem = {
                    id: createId(),
                    barcode: '',
                    name: '',
                    sku: '',
                    categoryName: '',
                    quantity: '1',
                    unitCost: '0',
                    currency: 'USD',
                    salePriceUsd: '',
                    isExisting: false,
                    quantityOnHand: 0
                  };
                  setItems((previous) => [...previous, newItem]);
                  setLastScannedItemId(newItem.id);
                }}
              >
                {t('purchasesAddManual')}
              </Button>
              <div className="flex items-center gap-2">
                {editingPurchaseId && (
                  <Button type="button" className="bg-slate-200 text-slate-800 hover:bg-slate-300" onClick={handleCancelEdit}>
                    {t('purchasesCancelEdit')}
                  </Button>
                )}
                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-500" disabled={isSaving}>
                  {isSaving ? t('inventorySaving') : t(editingPurchaseId ? 'purchasesUpdate' : 'purchasesSubmit')}
                </Button>
              </div>
            </div>
          </Card>
        </form>
        <Card className="space-y-4 p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t('purchasesHistoryTitle')}</h2>
          {purchasesQuery.isLoading && <p className="text-sm text-slate-500">{t('inventoryLoading')}</p>}
          {purchasesQuery.isError && <p className="text-sm text-red-600">{t('purchasesError')}</p>}
          {purchasesQuery.data && purchasesQuery.data.length === 0 && !purchasesQuery.isLoading && (
            <p className="text-sm text-slate-500">{t('purchasesHistoryEmpty')}</p>
          )}
          <div className="space-y-3">
            {purchasesQuery.data?.map((purchase) => {
              const isEditingCard = editingPurchaseId === purchase.id;
              const cardClasses = `rounded-lg border p-4 text-sm transition-colors ${
                isEditingCard
                  ? 'border-emerald-400 bg-emerald-50 shadow-sm dark:border-emerald-700/60 dark:bg-emerald-900/20'
                  : 'border-slate-200 dark:border-slate-700'
              }`;
              return (
                <div key={purchase.id} className={cardClasses}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">{purchase.supplierName}</p>
                      <p className="text-xs text-slate-500">
                        {new Date(purchase.orderedAt).toLocaleString()} · {purchase.reference ?? t('purchasesNoReference')}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2 text-right">
                      <div>
                        <p className="font-semibold text-emerald-600 dark:text-emerald-300">
                          {formatCurrency(purchase.totalCostUsd, 'USD')}
                        </p>
                        <p className="text-xs text-slate-500">
                          {t('purchasesHistoryItems', { count: purchase.lines.length })}
                        </p>
                      </div>
                      {isEditingCard ? (
                        <Badge className="bg-emerald-500 text-white">{t('purchasesEditing')}</Badge>
                      ) : (
                        <Button
                          type="button"
                          className="bg-emerald-500 hover:bg-emerald-400"
                          onClick={() => handleEditPurchase(purchase)}
                        >
                          {t('purchasesEditAction')}
                        </Button>
                      )}
                    </div>
                  </div>
                  <ul className="mt-3 space-y-1 text-xs text-slate-500">
                    {purchase.lines.map((line) => (
                      <li key={line.id}>
                        {line.productName} · {line.quantity.toLocaleString()} × {formatCurrency(line.unitCostUsd, 'USD')}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
