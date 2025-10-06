import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ProductGrid } from '../components/pos/ProductGrid';
import { CartPanel } from '../components/pos/CartPanel';
import { TopBar } from '../components/pos/TopBar';
import { apiFetch } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { Input } from '../components/ui/input';
import { useCartStore } from '../stores/cartStore';
import { Button } from '../components/ui/button';
import { useLanguageDirection } from '../hooks/useLanguageDirection';
import { TenderPanel } from '../components/pos/TenderPanel';
import { CurrencyRateModal } from '../components/pos/CurrencyRateModal';
import { OverrideModal } from '../components/pos/OverrideModal';
import { ReceiptPreview } from '../components/pos/ReceiptPreview';

interface BalanceResponse {
  exchangeRate: number;
  totalUsd: number;
  totalLbp: number;
  paidUsd: number;
  paidLbp: number;
  balanceUsd: number;
  balanceLbp: number;
}

interface CheckoutResponse extends BalanceResponse {
  transactionId: string;
  transactionNumber: string;
  receiptPdfBase64: string;
  requiresOverride: boolean;
  overrideReason?: string | null;
}

interface ProductResponse {
  id: string;
  sku?: string | null;
  name: string;
  barcode: string;
  priceUsd: number;
  priceLbp: number;
  category: string;
  isFlagged?: boolean;
  flagReason?: string;
}

export function POSPage() {
  const { t } = useTranslation();
  useLanguageDirection();
  const navigate = useNavigate();
  const token = useAuthStore((state) => state.token);
  const role = useAuthStore((state) => state.role);
  const logout = useAuthStore((state) => state.logout);
  const { addItem, clear, items, subtotalUsd, rate, setRate, lastAddedItemId, setLastAddedItemId } = useCartStore((state) => ({
    addItem: state.addItem,
    clear: state.clear,
    items: state.items,
    subtotalUsd: state.subtotalUsd,
    rate: state.rate,
    setRate: state.setRate,
    lastAddedItemId: state.lastAddedItemId,
    setLastAddedItemId: state.setLastAddedItemId
  }));
  const [barcode, setBarcode] = useState('');
  const [lastScan, setLastScan] = useState<string | undefined>();
  const [paidUsdText, setPaidUsdText] = useState('');
  const [paidUsdAmount, setPaidUsdAmount] = useState(0);
  const [paidLbpText, setPaidLbpText] = useState('');
  const [paidLbpAmount, setPaidLbpAmount] = useState(0);
  const [balance, setBalance] = useState<BalanceResponse | null>(null);
  const [rateModalOpen, setRateModalOpen] = useState(false);
  const [overrideRequired, setOverrideRequired] = useState(false);
  const [overrideReason, setOverrideReason] = useState<string | null>(null);
  const barcodeInputRef = useRef<HTMLInputElement | null>(null);

  const focusBarcodeInput = useCallback(() => {
    barcodeInputRef.current?.focus();
  }, []);

  useEffect(() => {
    focusBarcodeInput();
  }, [focusBarcodeInput]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        const element = document.getElementById('barcode-input') as HTMLInputElement | null;
        element?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const scanMutation = useMutation<ProductResponse, Error, string>({
    mutationFn: async (code: string) => {
      if (!token) throw new Error('Not authenticated');
      return await apiFetch<ProductResponse>(
        '/api/products/scan',
        {
          method: 'POST',
          body: JSON.stringify({ barcode: code })
        },
        token
      );
    },
    onSuccess: (product) => {
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
      setLastAddedItemId(product.id);
      const displaySku = product.sku?.trim();
      setLastScan(displaySku ? `${product.name} (${displaySku})` : product.name);
      setBarcode('');
      focusBarcodeInput();
      if (product.isFlagged) {
        setOverrideRequired(true);
        setOverrideReason(product.flagReason ?? 'Anomaly detected');
      }
    }
  });

  const currencyQuery = useQuery<BalanceResponse>({
    queryKey: ['currency-rate', token],
    queryFn: async () => {
      if (!token) throw new Error('Not authenticated');
      return await apiFetch<BalanceResponse>('/api/settings/currency-rate', {}, token);
    },
    enabled: !!token,
    onSuccess: (data) => {
      setRate(data.exchangeRate);
      setBalance(data);
    }
  });

  const computeBalance = useMutation<
    BalanceResponse,
    Error,
    { totalUsd: number; paidUsd: number; paidLbp: number; exchangeRate?: number }
  >({
    mutationFn: async (payload) => {
      if (!token) throw new Error('Not authenticated');
      return await apiFetch<BalanceResponse>(
        '/api/transactions/compute-balance',
        {
          method: 'POST',
          body: JSON.stringify(payload)
        },
        token
      );
    },
    onSuccess: (data) => setBalance(data)
  });
  const computeBalanceMutate = computeBalance.mutate;

  const handleScanSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (barcode.trim()) {
      scanMutation.mutate(barcode.trim());
    }
  };

  const totalUsd = Number(subtotalUsd().toFixed(2));

  const parseTenderAmount = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return 0;
    }
    const parsed = Number(trimmed.replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  };

  useEffect(() => {
    if (!token) return;
    const parsedUsd = parseTenderAmount(paidUsdText);
    const parsedLbp = parseTenderAmount(paidLbpText);
    if (parsedUsd !== paidUsdAmount) {
      setPaidUsdAmount(parsedUsd);
    }
    if (parsedLbp !== paidLbpAmount) {
      setPaidLbpAmount(parsedLbp);
    }
    computeBalanceMutate({ totalUsd, paidUsd: parsedUsd, paidLbp: parsedLbp, exchangeRate: rate });
  }, [
    token,
    totalUsd,
    paidUsdText,
    paidLbpText,
    rate,
    computeBalanceMutate,
    paidUsdAmount,
    paidLbpAmount
  ]);

  useEffect(() => {
    if (items.length === 0) {
      setPaidUsdText('');
      setPaidUsdAmount(0);
      setPaidLbpText('');
      setPaidLbpAmount(0);
      setOverrideRequired(false);
      setOverrideReason(null);
    }
  }, [items.length]);

  const handleCheckout = async () => {
    if (!token || items.length === 0) return;
    if (overrideRequired) {
      setOverrideReason((reason) => reason ?? 'Override pending');
      return;
    }
    const parsedUsd = parseTenderAmount(paidUsdText);
    const parsedLbp = parseTenderAmount(paidLbpText);
    if (parsedUsd !== paidUsdAmount) {
      setPaidUsdAmount(parsedUsd);
    }
    if (parsedLbp !== paidLbpAmount) {
      setPaidLbpAmount(parsedLbp);
    }
    const response = await apiFetch<CheckoutResponse>(
      '/api/transactions/checkout',
      {
        method: 'POST',
        body: JSON.stringify({
          exchangeRate: rate,
          paidUsd: parsedUsd,
          paidLbp: parsedLbp,
          items: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            manualDiscountPercent: item.discountPercent
          }))
        })
      },
      token
    );

    if (response.requiresOverride) {
      setOverrideRequired(true);
      setOverrideReason(response.overrideReason ?? 'Supervisor review required');
      return;
    }

    setOverrideRequired(false);
    setOverrideReason(null);
    setBalance(response);
    clear();
    setPaidUsdText('');
    setPaidUsdAmount(0);
    setPaidLbpText('');
    setPaidLbpAmount(0);
    alert(`Transaction ${response.transactionNumber} complete. Balance USD: ${response.balanceUsd}, LBP: ${response.balanceLbp}`);
  };

  const normalizedRole = role?.toLowerCase();
  const canManageInventory = normalizedRole === 'admin' || normalizedRole === 'manager';
  const canEditRate = canManageInventory;
  const canSeeAnalytics = canManageInventory;

  const handleSaveRate = async (nextRate: number, notes?: string) => {
    if (!token) return;
    await apiFetch<void>(
      '/api/settings/currency-rate',
      {
        method: 'PUT',
        body: JSON.stringify({ rate: nextRate, notes })
      },
      token
    );
    await currencyQuery.refetch();
  };

  return (
    <div className="grid h-screen grid-rows-[auto_1fr] gap-3 overflow-hidden bg-slate-100 p-4 lg:p-6 dark:bg-slate-950">
      <TopBar
        onLogout={logout}
        lastScan={lastScan}
        onNavigateAnalytics={canSeeAnalytics ? () => navigate('/analytics') : undefined}
        onNavigateInvoices={canManageInventory ? () => navigate('/invoices') : undefined}
        onNavigatePurchases={canManageInventory ? () => navigate('/purchases') : undefined}
        onNavigateInventory={canManageInventory ? () => navigate('/inventory') : undefined}
        onNavigateSettings={canManageInventory ? () => navigate('/settings') : undefined}
      />
      <div className="row-start-2 h-full min-h-0">
        <div className="grid h-full min-h-0 gap-3 overflow-hidden lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)] xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1.5fr)]">
          <div className="flex h-full min-h-0 flex-col gap-3 lg:pr-2">
            <form onSubmit={handleScanSubmit} className="flex items-center gap-2.5">
              <Input
                id="barcode-input"
                ref={barcodeInputRef}
                value={barcode}
                onChange={(event) => setBarcode(event.target.value)}
                placeholder={t('barcodePlaceholder')}
                className="text-base"
              />
              <Button type="submit" size="sm">
                Scan
              </Button>
            </form>
            <div className="flex-1 min-h-0 overflow-hidden">
              <ProductGrid
                onScan={(product) => {
                  const displaySku = product.sku?.trim();
                  setLastScan(displaySku ? `${product.name} (${displaySku})` : product.name);
                }}
              />
            </div>
          </div>
          <div className="grid h-full min-h-0 grid-cols-1 gap-3 overflow-hidden lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="min-h-0 overflow-hidden rounded-xl bg-white p-4 shadow-sm dark:bg-slate-900">
              <TenderPanel
                paidUsdText={paidUsdText}
                paidLbpText={paidLbpText}
                onChangePaidUsdText={setPaidUsdText}
                onChangePaidLbpText={setPaidLbpText}
                onCommitPaidUsdAmount={setPaidUsdAmount}
                onCommitPaidLbpAmount={setPaidLbpAmount}
                onCheckout={handleCheckout}
                balanceUsd={balance?.balanceUsd ?? 0}
                balanceLbp={balance?.balanceLbp ?? 0}
                exchangeRate={rate}
                onOpenRateModal={() => canEditRate && setRateModalOpen(true)}
                canEditRate={canEditRate}
                disabled={overrideRequired}
              />
            </div>
            <div className="grid h-full min-h-0 auto-rows-[minmax(0,1fr)] grid-cols-1 gap-3 overflow-hidden lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="flex h-full min-h-0 w-full overflow-hidden">
                <CartPanel
                  onClear={clear}
                  highlightedItemId={lastAddedItemId}
                  onQuantityConfirm={() => {
                    setLastAddedItemId(null);
                    focusBarcodeInput();
                  }}
                />
              </div>
              <div className="flex h-full min-h-0 w-full overflow-hidden">
                <ReceiptPreview />
              </div>
            </div>
          </div>
        </div>
      </div>
      <CurrencyRateModal
        isOpen={rateModalOpen}
        onClose={() => setRateModalOpen(false)}
        onSave={handleSaveRate}
        currentRate={rate}
      />
      {overrideRequired && overrideReason && (
        <OverrideModal
          reason={overrideReason}
          onApprove={() => {
            setOverrideRequired(false);
            setOverrideReason(null);
          }}
          onCancel={() => {
            setOverrideRequired(false);
            setOverrideReason(null);
            clear();
          }}
        />
      )}
    </div>
  );
}
