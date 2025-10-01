import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Suspense } from 'react';
import { POSPage } from './pages/POSPage';
import { LoginPage } from './pages/LoginPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { queryClient } from './lib/api';
import { useAuthStore } from './stores/authStore';

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const token = useAuthStore((state) => state.token);
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export default function App() {
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
                <ProtectedRoute>
                  <AnalyticsPage />
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
