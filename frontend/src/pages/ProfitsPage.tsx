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
  revenueUsd?: number;
  costUsd?: number;
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

interface PeriodGroup {
  key: string;
  points: ProfitPoint[];
}

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

function toUtcStartOfDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function toUtcStartOfMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function toUtcStartOfYear(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
}

function formatSelectionLabel(scope: ProfitScope, isoDate: string, locale: string) {
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
        month: 'long',
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

function formatPointLabel(scope: ProfitScope, isoDate: string, locale: string) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.valueOf())) {
    return isoDate;
  }
  switch (scope) {
    case 'daily':
      return new Intl.DateTimeFormat(locale, {
        hour: 'numeric',
        minute: '2-digit'
      }).format(date);
    case 'monthly':
      return new Intl.DateTimeFormat(locale, {
        month: 'short',
        day: 'numeric'
      }).format(date);
    case 'yearly':
      return new Intl.DateTimeFormat(locale, {
        month: 'short'
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

  const periodGroups = useMemo(
    () => {
      const groupPoints = (
        points: ProfitPoint[],
        resolver: (date: Date) => Date
      ): PeriodGroup[] => {
        const buckets = new Map<string, ProfitPoint[]>();

        for (const point of points) {
          const parsed = new Date(point.periodStart);
          if (Number.isNaN(parsed.valueOf())) {
            continue;
          }

          const bucketDate = resolver(parsed);
          const key = bucketDate.toISOString();
          const existing = buckets.get(key);
          if (existing) {
            existing.push(point);
          } else {
            buckets.set(key, [point]);
          }
        }

        return Array.from(buckets.entries())
          .map(([key, bucketPoints]) => ({
            key,
            points: bucketPoints.sort(
              (a, b) => new Date(a.periodStart).getTime() - new Date(b.periodStart).getTime()
            )
          }))
          .sort((a, b) => new Date(b.key).getTime() - new Date(a.key).getTime());
      };

      return {
        daily: groupPoints(sortedPoints.daily, toUtcStartOfDay),
        monthly: groupPoints(sortedPoints.monthly, toUtcStartOfMonth),
        yearly: groupPoints(sortedPoints.yearly, toUtcStartOfYear)
      } satisfies Record<ProfitScope, PeriodGroup[]>;
    },
    [sortedPoints]
  );

  useEffect(() => {
    setSelectedPeriods((prev) => {
      const next: SelectedPeriods = { ...prev };
      let updated = false;

      scopes.forEach((key) => {
        const groups = periodGroups[key];
        if (groups.length === 0) {
          if (next[key] !== undefined) {
            next[key] = undefined;
            updated = true;
          }
          return;
        }

        const current = next[key];
        const hasCurrent = typeof current === 'string' && groups.some((group) => group.key === current);
        const fallback = groups[0]?.key;

        if (!hasCurrent && fallback !== undefined && current !== fallback) {
          next[key] = fallback;
          updated = true;
        }
      });

      return updated ? next : prev;
    });
  }, [periodGroups]);

  const periodOptions = useMemo(
    () =>
      periodGroups[scope].map((group) => ({
        value: group.key,
        label: formatSelectionLabel(scope, group.key, locale)
      })),
    [locale, scope, periodGroups]
  );

  const selectedPoints = useMemo(() => {
    const groups = periodGroups[scope];
    const selected = selectedPeriods[scope];

    if (selected) {
      const match = groups.find((group) => group.key === selected);
      if (match) {
        return match.points;
      }
    }

    return groups[0]?.points ?? [];
  }, [periodGroups, scope, selectedPeriods]);

  const chartData = useMemo(
    () =>
      selectedPoints.map((point) => ({
        label: formatPointLabel(scope, point.periodStart, locale),
        grossProfit: Number(point.grossProfitUsd ?? 0),
        netProfit: Number(point.netProfitUsd ?? 0),
        revenue: Number(point.revenueUsd ?? 0),
        cost: Number(point.costUsd ?? 0)
      })),
    [selectedPoints, locale, scope]
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

  const averageProfit = chartData.length > 0 ? totals.netProfit / chartData.length : 0;
  const averageSale = chartData.length > 0 ? totals.revenue / chartData.length : 0;
  const periodLabel =
    scope === 'daily'
      ? t('profitPeriodDay')
      : scope === 'monthly'
        ? t('profitPeriodMonth')
        : t('profitPeriodYear');
  const hasData = chartData.length > 0;
  const selectedPeriodValue = selectedPeriods[scope] ?? periodOptions[0]?.value ?? '';
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
          </Card>
          <Card className="space-y-2 p-4">
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{t('profitTotalRevenue')}</p>
            <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
              {formatCurrency(totals.revenue, 'USD', locale)}
            </p>
          </Card>
          <Card className="space-y-2 p-4">
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{t('profitAverageSale')}</p>
            <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
              {formatCurrency(averageSale, 'USD', locale)}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t('profitAveragePerPeriod', { period: periodLabel })}
            </p>
          </Card>
          <Card className="space-y-2 p-4">
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{t('profitAverageProfit')}</p>
            <p className="text-2xl font-semibold text-emerald-600 dark:text-emerald-300">
              {formatCurrency(averageProfit, 'USD', locale)}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t('profitAveragePerPeriod', { period: periodLabel })}
            </p>
          </Card>
        </div>

      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <CardTitle>{t('profitChartTitle')}</CardTitle>
        </div>
        {hasData ? (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={chartData} barSize={28} maxBarSize={36}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip
                formatter={(value: number) => [formatCurrency(Number(value), 'USD', locale), t('profitTableNet')]}
              />
              <Legend formatter={() => t('profitTableNet')} />
              <Bar dataKey="netProfit" name={t('profitTableNet')} fill="#10b981" radius={[6, 6, 0, 0]} />
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

