import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { TopBar } from '../components/pos/TopBar';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { useAuthStore } from '../stores/authStore';
import { apiFetch } from '../lib/api';
import { formatCurrency } from '../lib/utils';
import { useLanguageDirection } from '../hooks/useLanguageDirection';

interface ProfitPoint {
  periodStart: string;
  grossProfitUsd: number;
  netProfitUsd: number;
  revenueUsd: number;
  costUsd: number;
}

interface ProfitSeries {
  points: ProfitPoint[];
}

interface ProfitSummaryResponse {
  daily: ProfitSeries;
  weekly: ProfitSeries;
  monthly: ProfitSeries;
  yearly: ProfitSeries;
}

type ProfitScope = 'daily' | 'monthly' | 'yearly';

type SelectedPeriods = Partial<Record<ProfitScope, string | undefined>>;

const scopes: ProfitScope[] = ['daily', 'monthly', 'yearly'];

const demoProfitSummary: ProfitSummaryResponse = createDemoProfitSummary();

function createDemoProfitSummary(): ProfitSummaryResponse {
  const today = new Date();

  const dailyPoints = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(today);
    date.setDate(date.getDate() - (13 - index));
    const revenue = 760 + index * 18;
    const cost = revenue * 0.69;
    const gross = revenue - cost;
    return {
      periodStart: date.toISOString(),
      revenueUsd: Number(revenue.toFixed(2)),
      costUsd: Number(cost.toFixed(2)),
      grossProfitUsd: Number(gross.toFixed(2)),
      netProfitUsd: Number((gross * 0.96).toFixed(2))
    } satisfies ProfitPoint;
  });

  const monthlyPoints = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(today);
    date.setMonth(date.getMonth() - (11 - index));
    date.setDate(1);
    const revenue = 22800 + index * 640;
    const cost = revenue * 0.7;
    const gross = revenue - cost;
    return {
      periodStart: date.toISOString(),
      revenueUsd: Number(revenue.toFixed(2)),
      costUsd: Number(cost.toFixed(2)),
      grossProfitUsd: Number(gross.toFixed(2)),
      netProfitUsd: Number((gross * 0.95).toFixed(2))
    } satisfies ProfitPoint;
  });

  const yearlyPoints = Array.from({ length: 5 }, (_, index) => {
    const date = new Date(today);
    date.setFullYear(date.getFullYear() - (4 - index));
    date.setMonth(0, 1);
    const revenue = 240000 + index * 12000;
    const cost = revenue * 0.71;
    const gross = revenue - cost;
    return {
      periodStart: date.toISOString(),
      revenueUsd: Number(revenue.toFixed(2)),
      costUsd: Number(cost.toFixed(2)),
      grossProfitUsd: Number(gross.toFixed(2)),
      netProfitUsd: Number((gross * 0.94).toFixed(2))
    } satisfies ProfitPoint;
  });

  return {
    daily: { points: dailyPoints },
    weekly: { points: dailyPoints },
    monthly: { points: monthlyPoints },
    yearly: { points: yearlyPoints }
  };
}

function formatPeriodLabel(scope: ProfitScope, isoDate: string, locale: string) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.valueOf())) {
    return isoDate;
  }
  switch (scope) {
    case 'daily':
      return new Intl.DateTimeFormat(locale, {
        month: 'short',
        day: 'numeric'
      }).format(date);
    case 'monthly':
      return new Intl.DateTimeFormat(locale, {
        month: 'short',
        year: 'numeric'
      }).format(date);
    case 'yearly':
      return new Intl.DateTimeFormat(locale, {
        year: 'numeric'
      }).format(date);
    default:
      return date.toLocaleDateString(locale);
  }
}

export function ProfitsPage() {
  const { t, i18n } = useTranslation();
  useLanguageDirection();
  const navigate = useNavigate();

  const token = useAuthStore((state) => state.token);
  const logout = useAuthStore((state) => state.logout);
  const role = useAuthStore((state) => state.role);

  const [scope, setScope] = useState<ProfitScope>('daily');
  const [selectedPeriods, setSelectedPeriods] = useState<SelectedPeriods>({});

  const { data, isLoading, isError } = useQuery<ProfitSummaryResponse>({
    queryKey: ['profit-summary', token],
    enabled: Boolean(token),
    queryFn: async () => {
      if (!token) {
        throw new Error('Unauthorized');
      }
      return await apiFetch<ProfitSummaryResponse>('/api/analytics/profit', {}, token);
    }
  });

  const profitSummary = data ?? demoProfitSummary;
  const locale = i18n.language === 'ar' ? 'ar-LB' : 'en-US';
  const canManageInventory = role?.toLowerCase() === 'admin' || role?.toLowerCase() === 'manager';

  const sortedPoints = useMemo(
    () => {
      const sortPoints = (points?: ProfitPoint[]) =>
        [...(points ?? [])].sort(
          (a, b) => new Date(b.periodStart).getTime() - new Date(a.periodStart).getTime()
        );
      return {
        daily: sortPoints(profitSummary.daily?.points),
        monthly: sortPoints(profitSummary.monthly?.points),
        yearly: sortPoints(profitSummary.yearly?.points)
      } satisfies Record<ProfitScope, ProfitPoint[]>;
    },
    [profitSummary]
  );

  useEffect(() => {
    setSelectedPeriods((prev) => {
      const next: SelectedPeriods = { ...prev };
      let updated = false;

      scopes.forEach((key) => {
        const points = sortedPoints[key];
        if (points.length === 0) {
          if (next[key] !== undefined) {
            next[key] = undefined;
            updated = true;
          }
          return;
        }

        const current = next[key];
        const hasCurrent = typeof current === 'string' && points.some((point) => point.periodStart === current);
        const fallback = points[0]?.periodStart;

        if (!hasCurrent && fallback !== undefined && current !== fallback) {
          next[key] = fallback;
          updated = true;
        }
      });

      return updated ? next : prev;
    });
  }, [sortedPoints]);

  const periodOptions = useMemo(
    () =>
      sortedPoints[scope].map((point) => ({
        value: point.periodStart,
        label: formatPeriodLabel(scope, point.periodStart, locale)
      })),
    [locale, scope, sortedPoints]
  );

  const filteredPoints = useMemo(() => {
    const selected = selectedPeriods[scope];
    const points = sortedPoints[scope];

    if (!selected) {
      return points;
    }

    return points.filter((point) => point.periodStart === selected);
  }, [scope, selectedPeriods, sortedPoints]);

  const chartData = useMemo(
    () =>
      [...filteredPoints]
        .sort((a, b) => new Date(a.periodStart).getTime() - new Date(b.periodStart).getTime())
        .map((point) => ({
          label: formatPeriodLabel(scope, point.periodStart, locale),
          grossProfit: Number(point.grossProfitUsd ?? 0),
          netProfit: Number(point.netProfitUsd ?? 0),
          revenue: Number(point.revenueUsd ?? 0),
          cost: Number(point.costUsd ?? 0)
        })),
    [filteredPoints, locale, scope]
  );

  const totals = useMemo(
    () =>
      chartData.reduce(
        (acc, point) => ({
          grossProfit: acc.grossProfit + point.grossProfit,
          netProfit: acc.netProfit + point.netProfit,
          revenue: acc.revenue + point.revenue,
          cost: acc.cost + point.cost
        }),
        { grossProfit: 0, netProfit: 0, revenue: 0, cost: 0 }
      ),
    [chartData]
  );

  const averageNet = chartData.length > 0 ? totals.netProfit / chartData.length : 0;
  const periodLabel =
    scope === 'daily'
      ? t('profitPeriodDay')
      : scope === 'monthly'
        ? t('profitPeriodMonth')
        : t('profitPeriodYear');
  const hasData = chartData.length > 0;
  const selectedPeriodValue = selectedPeriods[scope] ?? '';
  const periodPickerLabel =
    scope === 'daily'
      ? t('profitPeriodPickerDaily')
      : scope === 'monthly'
        ? t('profitPeriodPickerMonthly')
        : t('profitPeriodPickerYearly');

  return (
    <div className="flex min-h-screen flex-col gap-4 bg-slate-100 p-4 dark:bg-slate-950">
      <TopBar
        onLogout={logout}
        isProfits
        onNavigatePos={() => navigate('/')}
        onNavigateAnalytics={canManageInventory ? () => navigate('/analytics') : undefined}
        onNavigateProfits={canManageInventory ? () => navigate('/profits') : undefined}
        onNavigateProducts={canManageInventory ? () => navigate('/products') : undefined}
        onNavigateOffers={role?.toLowerCase() === 'admin' ? () => navigate('/offers') : undefined}
        onNavigateInventory={canManageInventory ? () => navigate('/inventory') : undefined}
        onNavigatePurchases={canManageInventory ? () => navigate('/purchases') : undefined}
        onNavigateAlarms={canManageInventory ? () => navigate('/alarms') : undefined}
        onNavigateInvoices={canManageInventory ? () => navigate('/invoices') : undefined}
        onNavigateSettings={canManageInventory ? () => navigate('/settings') : undefined}
        onNavigateMyCart={role?.toLowerCase() === 'admin' ? () => navigate('/my-cart') : undefined}
      />

      {isLoading && <Card className="p-6 text-sm text-slate-500">{t('profitLoading')}</Card>}
      {isError && (
        <Card className="border-amber-400 bg-amber-50 p-4 text-sm text-amber-700 dark:border-amber-500 dark:bg-amber-900/30 dark:text-amber-100">
          {t('profitError')}
        </Card>
      )}

      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <CardTitle>{t('profitOverviewTitle')}</CardTitle>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('profitOverviewDescription')}</p>
          </div>
            <div className="flex flex-wrap items-end gap-4">
              <label className="flex flex-col text-sm text-slate-600 dark:text-slate-300">
                <span className="mb-1 font-medium">{t('profitScopeLabel')}</span>
                <select
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                  value={scope}
                  onChange={(event) => {
                    const value = event.target.value as ProfitScope;
                    setScope(value);
                  }}
                >
                  <option value="daily">{t('profitScopeDaily')}</option>
                  <option value="monthly">{t('profitScopeMonthly')}</option>
                  <option value="yearly">{t('profitScopeYearly')}</option>
                </select>
              </label>
              <label className="flex flex-col text-sm text-slate-600 dark:text-slate-300">
                <span className="mb-1 font-medium">{periodPickerLabel}</span>
                <select
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                  value={selectedPeriodValue}
                  onChange={(event) => {
                    const value = event.target.value;
                    setSelectedPeriods((prev) => ({
                      ...prev,
                      [scope]: value || undefined
                    }));
                  }}
                  disabled={periodOptions.length === 0}
                >
                  {periodOptions.length === 0 ? (
                    <option value="">{t('profitPeriodUnavailable')}</option>
                  ) : (
                    periodOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))
                  )}
                </select>
              </label>
            </div>
          </div>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="space-y-2 p-4">
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{t('profitTotalNet')}</p>
            <p className="text-2xl font-semibold text-emerald-600 dark:text-emerald-300">
              {formatCurrency(totals.netProfit, 'USD', locale)}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t('profitAveragePerPeriod', { period: periodLabel })}: {formatCurrency(averageNet, 'USD', locale)}
            </p>
          </Card>
          <Card className="space-y-2 p-4">
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{t('profitTotalGross')}</p>
            <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
              {formatCurrency(totals.grossProfit, 'USD', locale)}
            </p>
          </Card>
          <Card className="space-y-2 p-4">
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{t('profitTotalRevenue')}</p>
            <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
              {formatCurrency(totals.revenue, 'USD', locale)}
            </p>
          </Card>
          <Card className="space-y-2 p-4">
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{t('profitTotalCost')}</p>
            <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
              {formatCurrency(totals.cost, 'USD', locale)}
            </p>
          </Card>
        </div>

      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <CardTitle>{t('profitChartTitle')}</CardTitle>
        </div>
        {hasData ? (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={chartData} barCategoryGap="18%">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip
                formatter={(value: number, name: string) => {
                  const labelKey =
                    name === 'netProfit'
                      ? 'profitTableNet'
                      : name === 'grossProfit'
                        ? 'profitTableGross'
                        : name === 'revenue'
                          ? 'profitTableRevenue'
                          : 'profitTableCost';
                  return [formatCurrency(Number(value), 'USD', locale), t(labelKey)];
                }}
              />
              <Legend
                formatter={(value: string) =>
                  value === 'netProfit'
                    ? t('profitTableNet')
                    : value === 'grossProfit'
                      ? t('profitTableGross')
                      : value === 'revenue'
                        ? t('profitTableRevenue')
                        : t('profitTableCost')
                }
              />
              <Bar dataKey="grossProfit" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
              <Bar dataKey="netProfit" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('profitEmpty')}</p>
        )}
      </Card>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>{t('profits')}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto px-0">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
            <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
              <tr>
                <th className="px-4 py-2 text-left">{t('profitTablePeriod')}</th>
                <th className="px-4 py-2 text-right">{t('profitTableRevenue')}</th>
                <th className="px-4 py-2 text-right">{t('profitTableCost')}</th>
                <th className="px-4 py-2 text-right">{t('profitTableGross')}</th>
                <th className="px-4 py-2 text-right">{t('profitTableNet')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {hasData ? (
                chartData.map((point) => (
                  <tr key={point.label}>
                    <td className="px-4 py-2 text-left font-medium text-slate-700 dark:text-slate-200">{point.label}</td>
                    <td className="px-4 py-2 text-right text-slate-700 dark:text-slate-200">
                      {formatCurrency(point.revenue, 'USD', locale)}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-700 dark:text-slate-200">
                      {formatCurrency(point.cost, 'USD', locale)}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-700 dark:text-slate-200">
                      {formatCurrency(point.grossProfit, 'USD', locale)}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-700 dark:text-slate-200">
                      {formatCurrency(point.netProfit, 'USD', locale)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                    {t('profitEmpty')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

