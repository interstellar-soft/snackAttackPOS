import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Suspense, useEffect } from 'react';
import { POSPage } from './pages/POSPage';
import { LoginPage } from './pages/LoginPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { InventoryPage } from './pages/InventoryPage';
import { ProductsPage } from './pages/ProductsPage';
import { SettingsPage } from './pages/SettingsPage';
import { PurchasesPage } from './pages/PurchasesPage';
import { InvoicesPage } from './pages/InvoicesPage';
import { queryClient } from './lib/api';
import { useAuthStore } from './stores/authStore';
import { useStoreProfileStore } from './stores/storeProfileStore';

interface ProtectedRouteProps {
  children: JSX.Element;
  roles?: string[];
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

  return (
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<div className="p-6">Loading…</div>}>
        <BrowserRouter>
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
              path="/settings"
              element={
                <ProtectedRoute roles={['admin', 'manager']}>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </Suspense>
    </QueryClientProvider>
  );
}
