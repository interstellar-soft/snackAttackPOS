import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { useAuthStore } from '../../stores/authStore';
import { useTheme } from '../../hooks/useTheme';
import { useStoreProfileStore } from '../../stores/storeProfileStore';
import { useStoreProfileQuery } from '../../lib/SettingsService';

interface TopBarProps {
  onLogout: () => void;
  lastScan?: string;
  onNavigateAnalytics?: () => void;
  onNavigateProfits?: () => void;
  onNavigatePos?: () => void;
  isAnalytics?: boolean;
  isProfits?: boolean;
  onNavigateMyCart?: () => void;
  isMyCart?: boolean;
  onNavigateProducts?: () => void;
  isProducts?: boolean;
  onNavigateOffers?: () => void;
  isOffers?: boolean;
  onNavigateAlarms?: () => void;
  isAlarms?: boolean;
  onNavigateInventory?: () => void;
  isInventory?: boolean;
  onNavigatePurchases?: () => void;
  isPurchases?: boolean;
  onNavigateInvoices?: () => void;
  isInvoices?: boolean;
  onNavigateSettings?: () => void;
  isSettings?: boolean;
  onNavigateDebts?: () => void;
  isDebts?: boolean;
}

export function TopBar({
  onLogout,
  lastScan,
  onNavigateAnalytics,
  onNavigateProfits,
  onNavigatePos,
  isAnalytics,
  isProfits,
  onNavigateMyCart,
  isMyCart,
  onNavigateProducts,
  isProducts,
  onNavigateOffers,
  isOffers,
  onNavigateAlarms,
  isAlarms,
  onNavigateInventory,
  isInventory,
  onNavigatePurchases,
  isPurchases,
  onNavigateInvoices,
  isInvoices,
  onNavigateSettings,
  isSettings,
  onNavigateDebts,
  isDebts
}: TopBarProps) {
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useTheme();
  const displayName = useAuthStore((state) => state.displayName);
  const storeName = useStoreProfileStore((state) => state.name);
  useStoreProfileQuery();

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const isPosActive =
    Boolean(onNavigatePos) &&
    !isAnalytics &&
    !isProfits &&
    !isMyCart &&
    !isOffers &&
    !isAlarms &&
    !isInventory &&
    !isPurchases &&
    !isInvoices &&
    !isSettings &&
    !isDebts &&
    !isProducts;

  const navItems = [
    {
      key: 'pos',
      label: t('pos'),
      onClick: onNavigatePos,
      isActive: isPosActive
    },
    {
      key: 'myCart',
      label: t('myCart'),
      onClick: onNavigateMyCart,
      isActive: Boolean(isMyCart)
    },
    {
      key: 'debts',
      label: t('debts'),
      onClick: onNavigateDebts,
      isActive: Boolean(isDebts)
    },
    {
      key: 'analytics',
      label: t('analytics'),
      onClick: onNavigateAnalytics,
      isActive: Boolean(isAnalytics)
    },
    {
      key: 'profits',
      label: t('profits'),
      onClick: onNavigateProfits,
      isActive: Boolean(isProfits)
    },
    {
      key: 'offers',
      label: t('offers'),
      onClick: onNavigateOffers,
      isActive: Boolean(isOffers)
    },
    {
      key: 'products',
      label: t('products'),
      onClick: onNavigateProducts,
      isActive: Boolean(isProducts)
    },
    {
      key: 'alarms',
      label: t('alarms'),
      onClick: onNavigateAlarms,
      isActive: Boolean(isAlarms)
    },
    {
      key: 'inventory',
      label: t('inventory'),
      onClick: onNavigateInventory,
      isActive: Boolean(isInventory)
    },
    {
      key: 'invoices',
      label: t('invoices'),
      onClick: onNavigateInvoices,
      isActive: Boolean(isInvoices)
    },
    {
      key: 'purchases',
      label: t('purchases'),
      onClick: onNavigatePurchases,
      isActive: Boolean(isPurchases)
    },
    {
      key: 'settings',
      label: t('settings'),
      onClick: onNavigateSettings,
      isActive: Boolean(isSettings)
    }
  ].filter((item) => Boolean(item.onClick));

  const toggleLanguage = () => {
    const next = i18n.language === 'en' ? 'ar' : 'en';
    i18n.changeLanguage(next);
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const openDrawer = () => setIsDrawerOpen(true);
  const closeDrawer = () => setIsDrawerOpen(false);
  const handleNavigate = (callback?: () => void) => {
    if (!callback) {
      return;
    }
    callback();
    closeDrawer();
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-4 shadow-sm dark:bg-slate-900">
      <div className="flex items-start gap-3">
        {navItems.length > 0 && (
          <Button
            type="button"
            className="bg-slate-200 text-slate-900 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100"
            onClick={openDrawer}
            aria-expanded={isDrawerOpen}
            aria-controls="topbar-drawer"
          >
            {t('menu')}
          </Button>
        )}
        <div>
          <h1 className="text-2xl font-bold text-emerald-600 dark:text-emerald-300">{storeName}</h1>
          <p className="text-xs text-slate-500">Asia/Beirut</p>
          {lastScan && (
            <Badge className="mt-2">Last scan: {lastScan}</Badge>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" className="bg-slate-200 text-slate-900 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100" onClick={toggleTheme}>
          {theme === 'dark' ? t('lightMode') : t('darkMode')}
        </Button>
        <Button type="button" className="bg-indigo-500 hover:bg-indigo-400" onClick={toggleLanguage}>
          {t('changeLanguage')}
        </Button>
        <Badge>{displayName}</Badge>
        <Button type="button" className="bg-red-500 hover:bg-red-400" onClick={onLogout}>
          {t('logout')}
        </Button>
      </div>
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-slate-900/40"
            onClick={closeDrawer}
            aria-hidden="true"
          />
          <aside
            id="topbar-drawer"
            className="absolute left-0 top-0 flex h-full w-72 flex-col gap-6 bg-white p-6 shadow-xl dark:bg-slate-900"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t('menu')}</h2>
              <Button
                type="button"
                className="bg-slate-200 text-slate-900 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100"
                onClick={closeDrawer}
              >
                ×
              </Button>
            </div>
            <nav className="flex flex-1 flex-col gap-2">
              {navItems.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">{t('menuEmpty')}</p>
              ) : (
                navItems.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => handleNavigate(item.onClick)}
                    className={`rounded-md px-4 py-2 text-left text-sm font-medium transition ${
                      item.isActive
                        ? 'bg-emerald-500 text-white hover:bg-emerald-400'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700'
                    }`}
                    aria-current={item.isActive ? 'page' : undefined}
                  >
                    {item.label}
                  </button>
                ))
              )}
            </nav>
          </aside>
        </div>
      )}
    </div>
  );
}
