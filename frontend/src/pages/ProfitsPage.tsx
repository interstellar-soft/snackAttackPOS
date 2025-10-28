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
import { TransactionsService } from '../lib/TransactionsService';
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

type ProfitScope = 'daily' | 'weekly' | 'monthly' | 'yearly';

type SelectedPeriods = Partial<Record<ProfitScope, string | undefined>>;

interface PeriodGroup {
  key: string;
  points: ProfitPoint[];
}

const scopes: ProfitScope[] = ['daily', 'weekly', 'monthly', 'yearly'];

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

function toLocalStartOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function toLocalStartOfWeek(date: Date) {
  const local = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = local.getDay();
  const diff = (day + 6) % 7;
  local.setDate(local.getDate() - diff);
  return local;
}

function toLocalStartOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function toLocalStartOfYear(date: Date) {
  return new Date(date.getFullYear(), 0, 1);
}

function parseKeyToLocalDate(key: string) {
  const date = new Date(key);
  if (Number.isNaN(date.valueOf())) {
    return undefined;
  }
  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function toDateInputValue(key: string) {
  const date = parseKeyToLocalDate(key);
  if (!date) {
    return '';
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toMonthInputValue(key: string) {
  const date = parseKeyToLocalDate(key);
  if (!date) {
    return '';
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function fromDateInputValue(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return undefined;
  }
  const [yearStr, monthStr, dayStr] = value.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return undefined;
  }
  const date = new Date(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

function fromWeekDateInputValue(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return undefined;
  }
  const [yearStr, monthStr, dayStr] = value.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return undefined;
  }
  const date = new Date(year, month - 1, day);
  const startOfWeek = toLocalStartOfWeek(date);
  startOfWeek.setHours(0, 0, 0, 0);
  return startOfWeek.toISOString();
}

function fromMonthInputValue(value: string) {
  if (!/^\d{4}-\d{2}$/.test(value)) {
    return undefined;
  }
  const [yearStr, monthStr] = value.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return undefined;
  }
  const date = new Date(year, month - 1, 1);
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
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
    case 'weekly':
      return new Intl.DateTimeFormat(locale, {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
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
  const debtsQuery = TransactionsService.useDebts();

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
        weekly: sortPoints(profitSummary.weekly?.points),
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
        daily: groupPoints(sortedPoints.daily, toLocalStartOfDay),
        weekly: groupPoints(sortedPoints.weekly, toLocalStartOfWeek),
        monthly: groupPoints(sortedPoints.monthly, toLocalStartOfMonth),
        yearly: groupPoints(sortedPoints.yearly, toLocalStartOfYear)
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

  const periodGroupsForScope = periodGroups[scope];
  const fallbackPeriodKey = periodGroupsForScope[0]?.key;
  const selectedPeriodKey = selectedPeriods[scope] ?? fallbackPeriodKey;

  const selectedPoints = useMemo(() => {
    const groups = periodGroups[scope];
    if (!selectedPeriodKey) {
      return groups[0]?.points ?? [];
    }
    const match = groups.find((group) => group.key === selectedPeriodKey);
    return match ? match.points : [];
  }, [periodGroups, scope, selectedPeriodKey]);

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

  const outstandingDebt = useMemo(
    () => {
      const debts = debtsQuery.data ?? [];
      return debts.reduce(
        (acc, debt) => ({
          usd: acc.usd + Math.max(0, Number(debt.balanceUsd ?? 0)),
          lbp: acc.lbp + Math.max(0, Number(debt.balanceLbp ?? 0))
        }),
        { usd: 0, lbp: 0 }
      );
    },
    [debtsQuery.data]
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
      : scope === 'weekly'
        ? t('profitPeriodWeek')
        : scope === 'monthly'
          ? t('profitPeriodMonth')
          : t('profitPeriodYear');
  const hasData = chartData.length > 0;
  const periodPickerLabel =
    scope === 'daily'
      ? t('profitPeriodPickerDaily')
      : scope === 'weekly'
        ? t('profitPeriodPickerWeekly')
        : scope === 'monthly'
          ? t('profitPeriodPickerMonthly')
          : t('profitPeriodPickerYearly');

  const periodMinKey =
    periodGroupsForScope.length > 0
      ? periodGroupsForScope[periodGroupsForScope.length - 1]?.key
      : undefined;
  const periodMaxKey = periodGroupsForScope[0]?.key;

  const renderPeriodPicker = () => {
    if (scope === 'yearly') {
      return (
        <select
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          value={selectedPeriodKey ?? ''}
          onChange={(event) => {
            const value = event.target.value;
            setSelectedPeriods((prev) => ({
              ...prev,
              [scope]: value || undefined
            }));
          }}
          disabled={periodGroupsForScope.length === 0}
        >
          {periodGroupsForScope.length === 0 ? (
            <option value="">{t('profitPeriodUnavailable')}</option>
          ) : (
            periodGroupsForScope.map((group) => {
              const date = parseKeyToLocalDate(group.key);
              const label =
                date !== undefined
                  ? new Intl.DateTimeFormat(locale, { year: 'numeric' }).format(date)
                  : group.key;
              return (
                <option key={group.key} value={group.key}>
                  {label}
                </option>
              );
            })
          )}
        </select>
      );
    }

    if (scope === 'monthly') {
      const value = selectedPeriodKey ? toMonthInputValue(selectedPeriodKey) : '';
      const min = periodMinKey ? toMonthInputValue(periodMinKey) : undefined;
      const max = periodMaxKey ? toMonthInputValue(periodMaxKey) : undefined;
      return (
        <input
          type="month"
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          value={value}
          min={min}
          max={max}
          onChange={(event) => {
            const next = event.target.value;
            if (!next) {
              setSelectedPeriods((prev) => ({ ...prev, [scope]: undefined }));
              return;
            }
            const iso = fromMonthInputValue(next);
            setSelectedPeriods((prev) => ({
              ...prev,
              [scope]: iso
            }));
          }}
          disabled={periodGroupsForScope.length === 0}
          placeholder={periodGroupsForScope.length === 0 ? t('profitPeriodUnavailable') : undefined}
        />
      );
    }

    const value = selectedPeriodKey ? toDateInputValue(selectedPeriodKey) : '';
    const min = periodMinKey ? toDateInputValue(periodMinKey) : undefined;
    const max = periodMaxKey ? toDateInputValue(periodMaxKey) : undefined;
    return (
      <input
        type="date"
        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
        value={value}
        min={min}
        max={max}
        onChange={(event) => {
          const next = event.target.value;
          if (!next) {
            setSelectedPeriods((prev) => ({ ...prev, [scope]: undefined }));
            return;
          }
          const iso = scope === 'weekly' ? fromWeekDateInputValue(next) : fromDateInputValue(next);
          setSelectedPeriods((prev) => ({
            ...prev,
            [scope]: iso
          }));
        }}
        disabled={periodGroupsForScope.length === 0}
        placeholder={periodGroupsForScope.length === 0 ? t('profitPeriodUnavailable') : undefined}
      />
    );
  };

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
        onNavigateDebts={canManageInventory ? () => navigate('/debts') : undefined}
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
                  <option value="weekly">{t('profitScopeWeekly')}</option>
                  <option value="monthly">{t('profitScopeMonthly')}</option>
                  <option value="yearly">{t('profitScopeYearly')}</option>
                </select>
              </label>
              <label className="flex flex-col text-sm text-slate-600 dark:text-slate-300">
                <span className="mb-1 font-medium">{periodPickerLabel}</span>
                {renderPeriodPicker()}
              </label>
            </div>
          </div>
        </Card>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
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
          <Card className="space-y-2 p-4">
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{t('profitTotalDebt')}</p>
            <p className="text-lg font-semibold text-red-600 dark:text-red-400">
              {formatCurrency(outstandingDebt.usd, 'USD', locale)} •{' '}
              {formatCurrency(outstandingDebt.lbp, 'LBP', locale)}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {debtsQuery.isLoading
                ? t('profitDebtLoading')
                : debtsQuery.isError
                  ? t('profitDebtError')
                  : t('profitTotalDebtDescription')}
            </p>
          </Card>
        </div>

      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <CardTitle>{t('profitChartTitle')}</CardTitle>
        </div>
        {hasData ? (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={chartData} barSize={28} maxBarSize={36} barCategoryGap="2%" barGap={2}>
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

