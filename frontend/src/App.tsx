import { BrowserRouter, HashRouter, Route, Routes, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Suspense, useEffect, lazy, useMemo } from 'react';
import type { ReactNode } from 'react';
import { queryClient } from './lib/api';
import { useAuthStore } from './stores/authStore';
import { useStoreProfileStore } from './stores/storeProfileStore';
import type { UpdaterMessage } from './types/electron';

const POSPage = lazy(async () => ({
  default: (await import('./pages/POSPage')).POSPage
}));
const LoginPage = lazy(async () => ({
  default: (await import('./pages/LoginPage')).LoginPage
}));
const AnalyticsPage = lazy(async () => ({
  default: (await import('./pages/AnalyticsPage')).AnalyticsPage
}));
const ProfitsPage = lazy(async () => ({
  default: (await import('./pages/ProfitsPage')).ProfitsPage
}));
const InventoryPage = lazy(async () => ({
  default: (await import('./pages/InventoryPage')).InventoryPage
}));
const ProductsPage = lazy(async () => ({
  default: (await import('./pages/ProductsPage')).ProductsPage
}));
const SettingsPage = lazy(async () => ({
  default: (await import('./pages/SettingsPage')).SettingsPage
}));
const PurchasesPage = lazy(async () => ({
  default: (await import('./pages/PurchasesPage')).PurchasesPage
}));
const InvoicesPage = lazy(async () => ({
  default: (await import('./pages/InvoicesPage')).InvoicesPage
}));
const MyCartPage = lazy(async () => ({
  default: (await import('./pages/MyCartPage')).MyCartPage
}));

interface ProtectedRouteProps {
  children: JSX.Element;
  roles?: string[];
}

function RouterProvider({ children }: { children: ReactNode }) {
  const router = useMemo(() => {
    if (typeof window !== 'undefined') {
      const hasElectronApi = Boolean(window.electronAPI);
      const isFileProtocol = window.location?.protocol === 'file:';

      if (hasElectronApi || isFileProtocol) {
        return HashRouter;
      }
    }

    return BrowserRouter;
  }, []);

  const RouterComponent = router;

  return <RouterComponent>{children}</RouterComponent>;
}

function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
  const token = useAuthStore((state) => state.token);
  const role = useAuthStore((state) => state.role);
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  if (roles && roles.length > 0) {
    const normalized = role?.toLowerCase();
    const allowed = roles.map((value) => value.toLowerCase());
    if (!normalized || !allowed.includes(normalized)) {
      return <Navigate to="/" replace />;
    }
  }
  return children;
}

export default function App() {
  const storeName = useStoreProfileStore((state) => state.name);

  useEffect(() => {
    document.title = `${storeName} POS`;
  }, [storeName]);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onUpdateStatus) {
      return;
    }

    const unsubscribe = api.onUpdateStatus((message: UpdaterMessage) => {
      if (message.status === 'downloaded') {
        const shouldRestart = window.confirm(
          'A new Aurora POS update is ready. Restart now to install it?'
        );
        if (shouldRestart) {
          api.restartToUpdate?.();
        }
      } else if (message.status === 'disabled') {
        console.info('Aurora POS updater disabled.');
      } else if (message.status === 'error') {
        const errorMessage =
          typeof message.message === 'string' ? message.message : undefined;
        const isResolvableNetworkError =
          errorMessage === 'net::ERR_NAME_NOT_RESOLVED' ||
          errorMessage === 'net::ERR_INTERNET_DISCONNECTED';

        if (isResolvableNetworkError) {
          console.warn(
            'Aurora POS updater network issue detected. Update check will be retried later.',
            message
          );
        } else {
          console.error('Aurora POS updater error:', message);
        }
      } else {
        console.info('Aurora POS updater:', message);
      }
    });

    api.checkForUpdates?.();

    return () => {
      unsubscribe?.();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<div className="p-6">Loading…</div>}>
        <RouterProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <POSPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/analytics"
              element={
                <ProtectedRoute roles={['admin', 'manager']}>
                  <AnalyticsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profits"
              element={
                <ProtectedRoute roles={['admin', 'manager']}>
                  <ProfitsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/inventory"
              element={
                <ProtectedRoute roles={['admin', 'manager']}>
                  <InventoryPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/products"
              element={
                <ProtectedRoute roles={['admin', 'manager']}>
                  <ProductsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/purchases"
              element={
                <ProtectedRoute roles={['admin', 'manager']}>
                  <PurchasesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/invoices"
              element={
                <ProtectedRoute roles={['admin', 'manager']}>
                  <InvoicesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/my-cart"
              element={
                <ProtectedRoute roles={['admin']}>
                  <MyCartPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute roles={['admin', 'manager']}>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </RouterProvider>
      </Suspense>
    </QueryClientProvider>
  );
}
