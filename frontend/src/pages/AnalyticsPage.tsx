import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { apiFetch } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { TopBar } from '../components/pos/TopBar';
import { useLanguageDirection } from '../hooks/useLanguageDirection';
import { formatCurrency } from '../lib/utils';

interface MetricValue {
  label: string;
  value: number;
}

interface MarginPoint {
  label: string;
  marginPercent: number;
  revenueUsd: number;
}

interface TimeseriesPoint {
  date: string;
  value: number;
}

interface TimeseriesBandPoint extends TimeseriesPoint {
  lower: number;
  upper: number;
}

interface CurrencySplitPoint {
  date: string;
  usd: number;
  lbp: number;
}

interface AnalyticsDashboardResponse {
  profitLeaders: MetricValue[];
  lossLeaders: MetricValue[];
  markdownRecovery: MetricValue[];
  currencyMix: MetricValue[];
  changeIssuance: MetricValue[];
  dailySales: TimeseriesPoint[];
  profitMargins: MarginPoint[];
  seasonalForecast: TimeseriesBandPoint[];
  currencyMixTrend: CurrencySplitPoint[];
  changeIssuanceTrend: CurrencySplitPoint[];
}

const demoDashboard: AnalyticsDashboardResponse = {
  profitLeaders: [
    { label: 'Sample Apples', value: 1200 },
    { label: 'Sample Bananas', value: 980 },
    { label: 'Sample Almonds', value: 860 }
  ],
  lossLeaders: [
    { label: 'Sample Milk', value: -150 },
    { label: 'Sample Bread', value: -90 },
    { label: 'Sample Juice', value: -45 }
  ],
  markdownRecovery: [
    { label: 'Dairy', value: 420 },
    { label: 'Produce', value: 300 },
    { label: 'Bakery', value: 180 }
  ],
  currencyMix: [
    { label: 'USD', value: 65 },
    { label: 'LBP', value: 35 }
  ],
  changeIssuance: [
    { label: 'USD', value: 80 },
    { label: 'LBP', value: 120 }
  ],
  dailySales: Array.from({ length: 14 }, (_, index) => ({
    date: new Date(Date.now() - (13 - index) * 24 * 60 * 60 * 1000).toISOString(),
    value: 480 + index * 15
  })),
  profitMargins: [
    { label: 'Sample Apples', marginPercent: 32.5, revenueUsd: 2400 },
    { label: 'Sample Bananas', marginPercent: 28.4, revenueUsd: 1800 },
    { label: 'Sample Almonds', marginPercent: 26.1, revenueUsd: 1600 }
  ],
  seasonalForecast: Array.from({ length: 14 }, (_, index) => ({
    date: new Date(Date.now() + (index + 1) * 24 * 60 * 60 * 1000).toISOString(),
    value: 540 + index * 12,
    lower: 520 + index * 8,
    upper: 560 + index * 16
  })),
  currencyMixTrend: Array.from({ length: 14 }, (_, index) => ({
    date: new Date(Date.now() - (13 - index) * 24 * 60 * 60 * 1000).toISOString(),
    usd: 300 + index * 10,
    lbp: 260 + index * 12
  })),
  changeIssuanceTrend: Array.from({ length: 14 }, (_, index) => ({
    date: new Date(Date.now() - (13 - index) * 24 * 60 * 60 * 1000).toISOString(),
    usd: 40 + index * 1.5,
    lbp: 120 + index * 4
  }))
};

function toDateLabel(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric'
  }).format(new Date(value));
}

function formatPercent(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 1
  }).format(value / 100);
}

export function AnalyticsPage() {
  const { t, i18n } = useTranslation();
  useLanguageDirection();
  const token = useAuthStore((state) => state.token);
  const logout = useAuthStore((state) => state.logout);
  const role = useAuthStore((state) => state.role);
  const navigate = useNavigate();

  const { data, isLoading, isError } = useQuery<AnalyticsDashboardResponse>({
    queryKey: ['analytics-dashboard', token],
    queryFn: async () => {
      if (!token) throw new Error('Unauthorized');
      return await apiFetch<AnalyticsDashboardResponse>('/api/analytics/dashboard', {}, token);
    },
    enabled: !!token
  });

  const dashboard = data ?? demoDashboard;

  const locale = i18n.language === 'ar' ? 'ar-LB' : 'en-US';
  const canManageInventory = role?.toLowerCase() === 'admin' || role?.toLowerCase() === 'manager';

  const profitLeaderList = dashboard.profitLeaders.slice(0, 5);
  const lossLeaderList = dashboard.lossLeaders.slice(0, 5);

  const dailySalesData = useMemo(
    () =>
      dashboard.dailySales.map((point) => ({
        label: toDateLabel(point.date, locale),
        value: Number(point.value)
      })),
    [dashboard.dailySales, locale]
  );

  const forecastData = useMemo(
    () =>
      dashboard.seasonalForecast.map((point) => ({
        label: toDateLabel(point.date, locale),
        base: Number(point.value),
        lower: Number(point.lower),
        upper: Number(point.upper)
      })),
    [dashboard.seasonalForecast, locale]
  );

  const currencyMixTrend = useMemo(
    () =>
      dashboard.currencyMixTrend.map((point) => ({
        label: toDateLabel(point.date, locale),
        usd: Number(point.usd),
        lbp: Number(point.lbp)
      })),
    [dashboard.currencyMixTrend, locale]
  );

  const changeIssuanceTrend = useMemo(
    () =>
      dashboard.changeIssuanceTrend.map((point) => ({
        label: toDateLabel(point.date, locale),
        usd: Number(point.usd),
        lbp: Number(point.lbp)
      })),
    [dashboard.changeIssuanceTrend, locale]
  );

  return (
    <div className="flex min-h-screen flex-col gap-4 bg-slate-100 p-4 dark:bg-slate-950">
      <TopBar
        onLogout={logout}
        isAnalytics
        onNavigatePos={() => navigate('/')}
        onNavigateProducts={canManageInventory ? () => navigate('/products') : undefined}
        onNavigateInvoices={canManageInventory ? () => navigate('/invoices') : undefined}
        onNavigatePurchases={canManageInventory ? () => navigate('/purchases') : undefined}
        onNavigateInventory={canManageInventory ? () => navigate('/inventory') : undefined}
        onNavigateSettings={canManageInventory ? () => navigate('/settings') : undefined}
      />
      {isLoading && <Card className="p-6 text-sm text-slate-500">{t('loadingAnalytics')}</Card>}
      {isError && (
        <Card className="border-amber-400 bg-amber-50 p-4 text-amber-700 dark:border-amber-500 dark:bg-amber-900/40 dark:text-amber-200">
          {t('analyticsError')}
        </Card>
      )}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>{t('profitLeaders')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={profitLeaderList}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" hide />
                <YAxis />
                <Tooltip
                  formatter={(value: number, name: string) =>
                    formatCurrency(value, name === 'lbp' ? 'LBP' : 'USD', locale)
                  }
                />
                <Bar dataKey="value" fill="#10b981" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <ul className="mt-4 space-y-1 text-sm">
              {profitLeaderList.map((metric) => (
                <li key={metric.label} className="flex justify-between">
                  <span>{metric.label}</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-300">
                    {formatCurrency(metric.value, 'USD', locale)}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('lossLeaders')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={lossLeaderList}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" hide />
                <YAxis />
                <Tooltip
                  formatter={(value: number, name: string) =>
                    formatCurrency(value, name === 'lbp' ? 'LBP' : 'USD', locale)
                  }
                />
                <Bar dataKey="value" fill="#ef4444" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <ul className="mt-4 space-y-1 text-sm">
              {lossLeaderList.map((metric) => (
                <li key={metric.label} className="flex justify-between">
                  <span>{metric.label}</span>
                  <span className="font-semibold text-rose-600 dark:text-rose-300">
                    {formatCurrency(metric.value, 'USD', locale)}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('markdownRecovery')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={dashboard.markdownRecovery}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip formatter={(value: number) => formatCurrency(value, 'USD', locale)} />
                <Bar dataKey="value" fill="#6366f1" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('dailySales')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={dailySalesData}>
                <defs>
                  <linearGradient id="sales" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip formatter={(value: number) => formatCurrency(value, 'USD', locale)} />
                <Area type="monotone" dataKey="value" stroke="#0284c7" fill="url(#sales)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('seasonalForecast')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={forecastData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value, 'USD', locale)}
                  labelFormatter={(label) => `${t('forecastFor')} ${label}`}
                />
                <Area type="monotone" dataKey="upper" stroke="#a855f7" fill="#a855f7" fillOpacity={0.1} />
                <Area type="monotone" dataKey="lower" stroke="#a855f7" fill="#a855f7" fillOpacity={0.05} />
                <Line type="monotone" dataKey="base" stroke="#7c3aed" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('currencyMixTrend')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
                <LineChart data={currencyMixTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip
                    formatter={(value: number, name: string) =>
                      formatCurrency(value, name === 'lbp' ? 'LBP' : 'USD', locale)
                    }
                  />
                <Legend />
                <Line type="monotone" dataKey="usd" stroke="#10b981" strokeWidth={2} />
                <Line type="monotone" dataKey="lbp" stroke="#f59e0b" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('changeIssuanceTrend')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
                <LineChart data={changeIssuanceTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip
                    formatter={(value: number, name: string) =>
                      formatCurrency(value, name === 'lbp' ? 'LBP' : 'USD', locale)
                    }
                  />
                <Legend />
                <Line type="monotone" dataKey="usd" stroke="#3b82f6" strokeWidth={2} />
                <Line type="monotone" dataKey="lbp" stroke="#ef4444" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t('profitMargins')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
              <thead className="bg-slate-100 dark:bg-slate-800">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {t('product')}
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {t('marginPercent')}
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {t('revenue')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {dashboard.profitMargins.map((metric) => (
                  <tr key={metric.label}>
                    <td className="whitespace-nowrap px-4 py-2 text-sm">{metric.label}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-sm font-semibold">
                      {formatPercent(metric.marginPercent, locale)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-sm font-semibold">
                      {formatCurrency(metric.revenueUsd, 'USD', locale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('currencyMix')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={dashboard.currencyMix}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip
                  formatter={(value: number, _name: string, props) =>
                    formatCurrency(
                      value,
                      props?.payload?.label === 'LBP' ? 'LBP' : 'USD',
                      locale
                    )
                  }
                />
                <Bar dataKey="value" fill="#0f172a" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('changeIssuance')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={dashboard.changeIssuance}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip
                  formatter={(value: number, _name: string, props) =>
                    formatCurrency(
                      value,
                      props?.payload?.label === 'LBP' ? 'LBP' : 'USD',
                      locale
                    )
                  }
                />
                <Bar dataKey="value" fill="#eab308" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
