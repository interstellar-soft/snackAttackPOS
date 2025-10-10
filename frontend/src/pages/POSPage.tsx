import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ProductGrid } from '../components/pos/ProductGrid';
import { CartPanel } from '../components/pos/CartPanel';
import { TopBar } from '../components/pos/TopBar';
import { apiFetch } from '../lib/api';
import {
  TransactionsService,
  type PriceCartItemInput,
  type PriceCartResponse,
  type CheckoutResponse,
  type TransactionLineLookup
} from '../lib/TransactionsService';
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
  averageCostUsd?: number;
}

export function POSPage() {
  const { t } = useTranslation();
  useLanguageDirection();
  const navigate = useNavigate();
  const token = useAuthStore((state) => state.token);
  const role = useAuthStore((state) => state.role);
  const logout = useAuthStore((state) => state.logout);
  const {
    addItem,
    clear,
    items,
    subtotalUsd,
    subtotalLbp,
    rate,
    setRate,
    lastAddedItemId,
    setLastAddedItemId,
    manualCartTotalUsd,
    manualCartTotalLbp
  } = useCartStore((state) => ({
    addItem: state.addItem,
    clear: state.clear,
    items: state.items,
    subtotalUsd: state.subtotalUsd,
    subtotalLbp: state.subtotalLbp,
    rate: state.rate,
    setRate: state.setRate,
    lastAddedItemId: state.lastAddedItemId,
    setLastAddedItemId: state.setLastAddedItemId,
    manualCartTotalUsd: state.manualCartTotalUsd,
    manualCartTotalLbp: state.manualCartTotalLbp
  }));
  const normalizedRole = role?.toLowerCase();
  const canManageInventory = normalizedRole === 'admin' || normalizedRole === 'manager';
  const canSeeAnalytics = canManageInventory;
  const canEditRate = canManageInventory;
  const canSaveToMyCart = normalizedRole === 'admin';
  const canEditCartTotals = normalizedRole === 'admin';
  const { mutate: priceCartMutate } = TransactionsService.usePriceCart();
  const returnTransaction = TransactionsService.useReturnTransaction();
  const [priceQuote, setPriceQuote] = useState<PriceCartResponse | null>(null);
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
  const [saveToMyCart, setSaveToMyCart] = useState(false);
  const [isRefund, setIsRefund] = useState(false);
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
  const pricingRequestIdRef = useRef(0);

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

  useEffect(() => {
    focusBarcodeInput();
  }, [focusBarcodeInput]);

  useEffect(() => {
    pricingRequestIdRef.current += 1;
    const requestId = pricingRequestIdRef.current;

    if (!token) {
      setPriceQuote(null);
      return;
    }

    if (items.length === 0) {
      setPriceQuote(null);
      return;
    }

    const payloadItems: PriceCartItemInput[] = items.map((item) => {
      const requestItem: PriceCartItemInput = {
        productId: item.productId,
        quantity: item.quantity,
        isWaste: item.isWaste
      };

      if (item.discountPercent > 0) {
        requestItem.manualDiscountPercent = item.discountPercent;
      }

      if (item.manualTotalUsd !== null && item.manualTotalUsd !== undefined) {
        requestItem.manualTotalUsd = item.manualTotalUsd;
      }

      if (item.manualTotalLbp !== null && item.manualTotalLbp !== undefined) {
        requestItem.manualTotalLbp = item.manualTotalLbp;
      }

      return requestItem;
    });

    priceCartMutate(
      {
        exchangeRate: rate,
        saveToMyCart: canSaveToMyCart && !isRefund ? saveToMyCart : false,
        isRefund,
        items: payloadItems
      },
      {
        onSuccess: (data) => {
          if (pricingRequestIdRef.current === requestId) {
            setPriceQuote(data);
          }
        },
        onError: () => {
          if (pricingRequestIdRef.current === requestId) {
            setPriceQuote(null);
          }
        }
      }
    );
  }, [
    token,
    items,
    rate,
    canSaveToMyCart,
    saveToMyCart,
    priceCartMutate,
    isRefund
  ]);

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
    onSuccess: async (product) => {
      let handled = false;

      if (token && product.barcode) {
        try {
          const query = new URLSearchParams({ barcode: product.barcode });
          const candidates = await apiFetch<TransactionLineLookup[]>(
            `/api/transactions/lookup-by-barcode?${query.toString()}`,
            {},
            token
          );

          const eligible = candidates.filter((candidate) => candidate.quantity > 0 && !candidate.isWaste);
          if (eligible.length > 0) {
            const latest = eligible[0];
            const saleDate = latest.createdAt ? new Date(latest.createdAt) : null;
            const formattedDate = saleDate ? saleDate.toLocaleString() : '';
            const totalUsd = Math.abs(latest.totalUsd);
            const promptLines = [
              `${product.name} was last sold in transaction ${latest.transactionNumber}.`,
              totalUsd > 0 ? `Amount: $${totalUsd.toFixed(2)}.` : undefined,
              formattedDate ? `Date: ${formattedDate}.` : undefined,
              '',
              'Would you like to refund this item instead of selling it?'
            ].filter(Boolean);

            const shouldRefund = window.confirm(promptLines.join('\n'));
            if (shouldRefund) {
              try {
                await returnTransaction.mutateAsync({
                  transactionId: latest.transactionId,
                  lineIds: [latest.lineId]
                });
                setLastScan(`${product.name} refunded from transaction ${latest.transactionNumber}.`);
                setBarcode('');
                setOverrideRequired(false);
                setOverrideReason(null);
                focusBarcodeInput();
                handled = true;
              } catch (error) {
                const message =
                  error instanceof Error && error.message
                    ? error.message
                    : 'Unable to process refund.';
                window.alert(message);
                setBarcode('');
                focusBarcodeInput();
                handled = true;
              }
            }
          }
        } catch (error) {
          console.error('Failed to lookup previous sales for refund', error);
        }
      }

      if (handled) {
        return;
      }

      const averageCostUsd =
        typeof product.averageCostUsd === 'number' && product.averageCostUsd > 0
          ? product.averageCostUsd
          : product.priceUsd;
      const unitCostLbp = Math.round(averageCostUsd * rate);
      addItem({
        productId: product.id,
        name: product.name,
        sku: product.sku?.trim() || undefined,
        barcode: product.barcode,
        priceUsd: product.priceUsd,
        priceLbp: product.priceLbp,
        costUsd: averageCostUsd,
        costLbp: unitCostLbp,
        quantity: 1,
        discountPercent: 0,
        isWaste: false
      });
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
  const { mutate: mutateBarcode } = scanMutation;

  useEffect(() => {
    let buffer = '';
    let sequenceActive = false;
    let lastKeyTime = 0;
    let resetTimer: number | undefined;
    let sourceElement: HTMLInputElement | HTMLTextAreaElement | null = null;
    let sourceInitialValue = '';

    const clearTimer = () => {
      if (resetTimer !== undefined) {
        window.clearTimeout(resetTimer);
        resetTimer = undefined;
      }
    };

    const resetSequence = () => {
      buffer = '';
      sequenceActive = false;
      lastKeyTime = 0;
      sourceElement = null;
      sourceInitialValue = '';
      clearTimer();
    };

    const scheduleReset = () => {
      clearTimer();
      resetTimer = window.setTimeout(() => {
        resetSequence();
      }, 250);
    };

    const revertSource = () => {
      if (sourceElement) {
        sourceElement.value = sourceInitialValue;
        sourceElement.dispatchEvent(new Event('input', { bubbles: true }));
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing) {
        return;
      }

      const target = event.target as HTMLElement | null;
      if (target === barcodeInputRef.current) {
        resetSequence();
        return;
      }

      if (event.ctrlKey || event.metaKey || event.altKey) {
        resetSequence();
        return;
      }

      const key = event.key;
      const isCharacterKey = key.length === 1;
      const isEnter = key === 'Enter';

      if (!isCharacterKey && !isEnter) {
        resetSequence();
        return;
      }

      const now = Date.now();
      const delta = now - lastKeyTime;

      if (!buffer) {
        if (isCharacterKey) {
          buffer = key;
          lastKeyTime = now;
          scheduleReset();
          if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
            sourceElement = target;
            sourceInitialValue = target.value;
          } else {
            sourceElement = null;
            sourceInitialValue = '';
          }
        }
        return;
      }

      if (!sequenceActive) {
        const rapidCharacter = isCharacterKey && delta <= 80;
        const rapidEnter = isEnter && delta <= 120;
        if (rapidCharacter || rapidEnter) {
          sequenceActive = true;
          revertSource();
          focusBarcodeInput();
          if (rapidCharacter) {
            event.preventDefault();
            buffer += key;
            setBarcode(buffer);
            scheduleReset();
          } else if (rapidEnter) {
            event.preventDefault();
            const code = buffer.trim();
            if (code) {
              setBarcode(code);
              mutateBarcode(code);
            }
            resetSequence();
          }
        } else {
          resetSequence();
        }
        lastKeyTime = now;
        return;
      }

      event.preventDefault();
      focusBarcodeInput();
      if (isCharacterKey) {
        buffer += key;
        setBarcode(buffer);
        scheduleReset();
      } else if (isEnter) {
        const code = buffer.trim();
        if (code) {
          setBarcode(code);
          mutateBarcode(code);
        }
        resetSequence();
      }
      lastKeyTime = now;
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimer();
    };
  }, [focusBarcodeInput, mutateBarcode]);

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

  const { mutate: mutateScan } = scanMutation;

  const submitScan = useCallback(
    (code: string) => {
      mutateScan(code);
    },
    [mutateScan]
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
        if (
          typeof selectionStart === 'number' &&
          typeof selectionEnd === 'number'
        ) {
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
            if (
              target !== barcodeInputRef.current &&
              !target.readOnly &&
              !target.disabled
            ) {
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

      const pendingValue =
        barcodeBufferRef.current || barcodeInputRef.current?.value || '';
      const trimmed = pendingValue.trim();
      clearBuffer();

      if (trimmed) {
        setBarcode(trimmed);
        submitScan(trimmed);
      }
    };

    window.addEventListener('keydown', handleKeydown);
    return () => {
      window.removeEventListener('keydown', handleKeydown);
      clearBuffer();
    };
  }, [focusBarcodeInput, submitScan]);

  const handleScanSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (barcode.trim()) {
      focusBarcodeInput();
      mutateBarcode(barcode.trim());
    }
  };

  const rawSubtotalUsd = subtotalUsd();
  const rawSubtotalLbp = subtotalLbp();

  const hasManualCartUsd = manualCartTotalUsd !== null && manualCartTotalUsd !== undefined;
  const hasManualCartLbp = manualCartTotalLbp !== null && manualCartTotalLbp !== undefined;

  const manualOverrideUsd = hasManualCartUsd
    ? manualCartTotalUsd!
    : hasManualCartLbp && rate > 0
      ? Math.round((manualCartTotalLbp! / rate) * 100) / 100
      : null;

  const manualOverrideLbp = hasManualCartLbp
    ? manualCartTotalLbp!
    : hasManualCartUsd && rate > 0
      ? Math.round(manualCartTotalUsd! * rate)
      : null;

  const computedTotalUsd = priceQuote?.totalUsd ?? rawSubtotalUsd;
  const computedTotalLbp = priceQuote?.totalLbp ?? rawSubtotalLbp;

  const effectiveTotalUsd = manualOverrideUsd ?? computedTotalUsd;
  const effectiveTotalLbp = manualOverrideLbp ?? computedTotalLbp;

  const totalUsd = Number(effectiveTotalUsd.toFixed(2));
  const totalLbpDisplay = Math.round(effectiveTotalLbp);

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
      setSaveToMyCart(false);
      setIsRefund(false);
      setBalance(null);
    }
  }, [items.length]);

  const handleToggleRefund = (next: boolean) => {
    setIsRefund(next);
    if (next) {
      setSaveToMyCart(false);
      setOverrideRequired(false);
      setOverrideReason(null);
    }
    setBalance(null);
  };

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
    const checkoutPayload: Record<string, unknown> = {
      exchangeRate: rate,
      paidUsd: parsedUsd,
      paidLbp: parsedLbp,
      items: items.map((item) => {
        const payload: Record<string, unknown> = {
          productId: item.productId,
          quantity: item.quantity,
          isWaste: item.isWaste
        };

        if (item.discountPercent > 0) {
          payload.manualDiscountPercent = item.discountPercent;
        }

        if (item.manualTotalUsd !== null && item.manualTotalUsd !== undefined) {
          payload.manualTotalUsd = item.manualTotalUsd;
        }

        if (item.manualTotalLbp !== null && item.manualTotalLbp !== undefined) {
          payload.manualTotalLbp = item.manualTotalLbp;
        }

        return payload;
      })
    };

    checkoutPayload.isRefund = isRefund;

    if (manualCartTotalUsd !== null && manualCartTotalUsd !== undefined) {
      checkoutPayload.manualTotalUsd = manualCartTotalUsd;
    }

    if (manualCartTotalLbp !== null && manualCartTotalLbp !== undefined) {
      checkoutPayload.manualTotalLbp = manualCartTotalLbp;
    }

    if (normalizedRole === 'admin' && !isRefund) {
      checkoutPayload.saveToMyCart = saveToMyCart;
    }

    const response = await apiFetch<CheckoutResponse>(
      '/api/transactions/checkout',
      {
        method: 'POST',
        body: JSON.stringify(checkoutPayload)
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
    setIsRefund(false);
    setSaveToMyCart(false);
    alert(`Transaction ${response.transactionNumber} complete. Balance USD: ${response.balanceUsd}, LBP: ${response.balanceLbp}`);
  };

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
        onNavigateProfits={canSeeAnalytics ? () => navigate('/profits') : undefined}
        onNavigateOffers={canManageInventory ? () => navigate('/offers') : undefined}
        onNavigateInvoices={canManageInventory ? () => navigate('/invoices') : undefined}
        onNavigatePurchases={canManageInventory ? () => navigate('/purchases') : undefined}
        onNavigateProducts={canManageInventory ? () => navigate('/products') : undefined}
        onNavigateInventory={canManageInventory ? () => navigate('/inventory') : undefined}
        onNavigateSettings={canManageInventory ? () => navigate('/settings') : undefined}
        onNavigateMyCart={canSaveToMyCart ? () => navigate('/my-cart') : undefined}
      />
      <div className="row-start-2 h-full min-h-0">
        <div className="grid h-full min-h-0 gap-3 overflow-hidden lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.55fr)] xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.65fr)]">
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
          <div className="grid h-full min-h-0 grid-cols-1 gap-3 overflow-hidden lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
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
                canSaveToMyCart={canSaveToMyCart}
                saveToMyCart={saveToMyCart}
                onToggleSaveToMyCart={setSaveToMyCart}
                isRefund={isRefund}
                onToggleRefund={handleToggleRefund}
              />
            </div>
            <div className="grid h-full min-h-0 auto-rows-[minmax(0,1fr)] grid-cols-1 gap-3 overflow-hidden lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
              <div className="flex h-full min-h-0 w-full overflow-hidden">
                <CartPanel
                  onClear={clear}
                  highlightedItemId={lastAddedItemId}
                  onQuantityConfirm={() => {
                    setLastAddedItemId(null);
                    focusBarcodeInput();
                  }}
                  canMarkWaste={normalizedRole === 'admin'}
                  canEditTotals={canEditCartTotals}
                  totalUsdOverride={totalUsd}
                  totalLbpOverride={totalLbpDisplay}
                />
              </div>
              <div className="flex h-full min-h-0 w-full overflow-hidden">
                <ReceiptPreview
                  totalUsdOverride={totalUsd}
                  totalLbpOverride={totalLbpDisplay}
                />
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
