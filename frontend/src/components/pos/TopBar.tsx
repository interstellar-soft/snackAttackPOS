import { useTranslation } from 'react-i18next';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { useAuthStore } from '../../stores/authStore';
import { useTheme } from '../../hooks/useTheme';

interface TopBarProps {
  onLogout: () => void;
  lastScan?: string;
  onNavigateAnalytics?: () => void;
  onNavigatePos?: () => void;
  isAnalytics?: boolean;
}

export function TopBar({ onLogout, lastScan, onNavigateAnalytics, onNavigatePos, isAnalytics }: TopBarProps) {
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useTheme();
  const displayName = useAuthStore((state) => state.displayName);

  const toggleLanguage = () => {
    const next = i18n.language === 'en' ? 'ar' : 'en';
    i18n.changeLanguage(next);
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-4 shadow-sm dark:bg-slate-900">
      <div>
        <h1 className="text-2xl font-bold text-emerald-600 dark:text-emerald-300">Aurora POS</h1>
        <p className="text-xs text-slate-500">Asia/Beirut</p>
        {lastScan && (
          <Badge className="mt-2">Last scan: {lastScan}</Badge>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {onNavigateAnalytics && !isAnalytics && (
          <Button type="button" className="bg-emerald-500 hover:bg-emerald-400" onClick={onNavigateAnalytics}>
            {t('analytics')}
          </Button>
        )}
        {onNavigatePos && isAnalytics && (
          <Button type="button" className="bg-emerald-500 hover:bg-emerald-400" onClick={onNavigatePos}>
            {t('backToPos')}
          </Button>
        )}
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
    </div>
  );
}
