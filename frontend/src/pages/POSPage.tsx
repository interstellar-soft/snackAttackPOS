import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ProductGrid } from '../components/pos/ProductGrid';
import { CartPanel } from '../components/pos/CartPanel';
import { ReceiptPreview } from '../components/pos/ReceiptPreview';
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
}

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

export function POSPage() {
  const { t } = useTranslation();
  useLanguageDirection();
  const navigate = useNavigate();
  const token = useAuthStore((state) => state.token);
  const role = useAuthStore((state) => state.role);
  const logout = useAuthStore((state) => state.logout);
  const { addItem, clear, items, subtotalUsd, subtotalLbp, rate, setRate } = useCartStore((state) => ({
    addItem: state.addItem,
    clear: state.clear,
    items: state.items,
    subtotalUsd: state.subtotalUsd,
    subtotalLbp: state.subtotalLbp,
    rate: state.rate,
    setRate: state.setRate
  }));
  const [barcode, setBarcode] = useState('');
  const [lastScan, setLastScan] = useState<string | undefined>();
  const [paidUsd, setPaidUsd] = useState(0);
  const [paidLbp, setPaidLbp] = useState(0);
  const [balance, setBalance] = useState<BalanceResponse | null>(null);
  const [rateModalOpen, setRateModalOpen] = useState(false);
  const [overrideRequired, setOverrideRequired] = useState(false);
  const [overrideReason, setOverrideReason] = useState<string | null>(null);

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

  const scanMutation = useMutation({
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
        sku: product.sku,
        barcode: product.barcode,
        priceUsd: product.priceUsd,
        priceLbp: product.priceLbp,
        quantity: 1,
        discountPercent: 0
      });
      setLastScan(`${product.name} (${product.sku})`);
      setBarcode('');
      if (product.isFlagged) {
        setOverrideRequired(true);
        setOverrideReason(product.flagReason ?? 'Anomaly detected');
      }
    }
  });

  const currencyQuery = useQuery({
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

  const computeBalance = useMutation({
    mutationFn: async (payload: { totalUsd: number; paidUsd: number; paidLbp: number; exchangeRate?: number }) => {
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

  const handleScanSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (barcode.trim()) {
      scanMutation.mutate(barcode.trim());
    }
  };

  const totalUsd = useMemo(() => Number(subtotalUsd().toFixed(2)), [items, subtotalUsd]);
  const totalLbp = useMemo(() => Number(subtotalLbp().toFixed(0)), [items, subtotalLbp]);

  useEffect(() => {
    if (!token) return;
    computeBalance.mutate({ totalUsd, paidUsd, paidLbp, exchangeRate: rate });
  }, [token, totalUsd, paidUsd, paidLbp, rate]);

  useEffect(() => {
    if (items.length === 0) {
      setPaidUsd(0);
      setPaidLbp(0);
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
    const response = await apiFetch<CheckoutResponse>(
      '/api/transactions/checkout',
      {
        method: 'POST',
        body: JSON.stringify({
          exchangeRate: rate,
          paidUsd,
          paidLbp,
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

    setBalance(response);
    clear();
    setPaidUsd(0);
    setPaidLbp(0);
    alert(`Transaction ${response.transactionNumber} complete. Balance USD: ${response.balanceUsd}, LBP: ${response.balanceLbp}`);
  };

  const canEditRate = role === 'Admin' || role === 'Manager';
  const canSeeAnalytics = canEditRate;

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
    <div className="flex min-h-screen flex-col gap-4 bg-slate-100 p-4 dark:bg-slate-950">
      <TopBar
        onLogout={logout}
        lastScan={lastScan}
        onNavigateAnalytics={canSeeAnalytics ? () => navigate('/analytics') : undefined}
      />
      <form onSubmit={handleScanSubmit} className="flex items-center gap-3">
        <Input
          id="barcode-input"
          value={barcode}
          onChange={(event) => setBarcode(event.target.value)}
          placeholder={t('barcodePlaceholder')}
          className="text-lg"
        />
        <Button type="submit">Scan</Button>
      </form>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ProductGrid onScan={(product) => setLastScan(`${product.name} (${product.sku})`)} />
        </div>
        <div className="flex max-h-[calc(100vh-8rem)] flex-col gap-4">
          <div className="flex-1 overflow-y-auto">
            <CartPanel onClear={clear} />
          </div>
          <div className="flex flex-col gap-4 lg:sticky lg:top-24">
            <TenderPanel
              paidUsd={paidUsd}
              paidLbp={paidLbp}
              onChangePaidUsd={setPaidUsd}
              onChangePaidLbp={setPaidLbp}
              onCheckout={handleCheckout}
              balanceUsd={balance?.balanceUsd ?? 0}
              balanceLbp={balance?.balanceLbp ?? 0}
              exchangeRate={rate}
              onOpenRateModal={() => canEditRate && setRateModalOpen(true)}
              canEditRate={canEditRate}
              disabled={overrideRequired}
            />
            <ReceiptPreview />
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
