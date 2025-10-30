import { type SVGProps, useEffect, useMemo, useRef, useState } from 'react';
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

type BaseProfitScope = 'daily' | 'weekly' | 'monthly' | 'yearly';

type ProfitScope = BaseProfitScope | 'custom';

type SelectedPeriods = Partial<Record<BaseProfitScope, string | undefined>>;

interface PeriodGroup {
  key: string;
  points: ProfitPoint[];
}

const baseScopes: BaseProfitScope[] = ['daily', 'weekly', 'monthly', 'yearly'];

const demoProfitSummary: ProfitSummaryResponse = createDemoProfitSummary();

function ChevronDownIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden="true"
      {...props}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m6 8 4 4 4-4" />
    </svg>
  );
}

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
  const local = new Date(date);
  local.setHours(0, 0, 0, 0);
  return local;
}

function toUtcStartOfWeek(date: Date) {
  const local = toUtcStartOfDay(date);
  const day = local.getDay();
  const diff = (day + 6) % 7;
  local.setDate(local.getDate() - diff);
  local.setHours(0, 0, 0, 0);
  return local;
}

function toUtcStartOfMonth(date: Date) {
  const local = toUtcStartOfDay(date);
  local.setDate(1);
  local.setHours(0, 0, 0, 0);
  return local;
}

function toUtcStartOfYear(date: Date) {
  const local = toUtcStartOfDay(date);
  local.setMonth(0, 1);
  local.setHours(0, 0, 0, 0);
  return local;
}

function parseKeyToLocalDate(key: string) {
  const date = new Date(key);
  if (Number.isNaN(date.valueOf())) {
    return undefined;
  }
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
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
  const startOfWeek = toUtcStartOfWeek(date);
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

function fromYearInputValue(value: string) {
  if (!/^\d{4}$/.test(value)) {
    return undefined;
  }
  const year = Number(value);
  if (!Number.isFinite(year)) {
    return undefined;
  }
  const date = new Date(year, 0, 1);
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

function toYearInputValue(key: string) {
  const date = parseKeyToLocalDate(key);
  if (!date) {
    return '';
  }
  return String(date.getFullYear());
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
    case 'custom':
      return new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium'
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

function formatPeriodSummaryLabel(scope: ProfitScope, isoDate: string, locale: string) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.valueOf())) {
    return isoDate;
  }

  switch (scope) {
    case 'daily':
      return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date);
    case 'custom':
      return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date);
    case 'weekly': {
      const start = toUtcStartOfWeek(date);
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 6);
      const startLabel = new Intl.DateTimeFormat(locale, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      }).format(start);
      const endLabel = new Intl.DateTimeFormat(locale, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      }).format(end);
      return `${startLabel} – ${endLabel}`;
    }
    case 'monthly':
      return new Intl.DateTimeFormat(locale, {
        month: 'long',
        year: 'numeric'
      }).format(date);
    case 'yearly':
      return new Intl.DateTimeFormat(locale, { year: 'numeric' }).format(date);
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
  const [customRange, setCustomRange] = useState<{ start?: string; end?: string }>({});
  const [yearInputValue, setYearInputValue] = useState('');
  const pickerRef = useRef<HTMLInputElement | null>(null);

  const { data, isLoading, isError } = useQuery<ProfitSummaryResponse>({
    queryKey: ['profit-summary', token],
    enabled: Boolean(token),
    queryFn: async () => {
      if (!token) {
        throw new Error('Unauthorized');
      }
      const resolvedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const params = new URLSearchParams();
      if (resolvedTimezone) {
        params.set('timezone', resolvedTimezone);
      }
      const path = params.size > 0 ? `/api/analytics/profit?${params.toString()}` : '/api/analytics/profit';
      return await apiFetch<ProfitSummaryResponse>(path, {}, token);
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
      } satisfies Record<BaseProfitScope, ProfitPoint[]>;
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
        weekly: groupPoints(sortedPoints.weekly, toUtcStartOfWeek),
        monthly: groupPoints(sortedPoints.monthly, toUtcStartOfMonth),
        yearly: groupPoints(sortedPoints.yearly, toUtcStartOfYear)
      } satisfies Record<BaseProfitScope, PeriodGroup[]>;
    },
    [sortedPoints]
  );

  useEffect(() => {
    if (customRange.start && customRange.end) {
      return;
    }

    const mostRecent = periodGroups.daily[0]?.key;
    if (!mostRecent) {
      return;
    }

    const oldest = periodGroups.daily[periodGroups.daily.length - 1]?.key;
    const mostRecentDate = new Date(mostRecent);
    const defaultStart = new Date(mostRecentDate);
    defaultStart.setUTCDate(defaultStart.getUTCDate() - 6);

    let startIso = defaultStart.toISOString();
    if (oldest) {
      const oldestDate = new Date(oldest);
      if (defaultStart < oldestDate) {
        startIso = oldestDate.toISOString();
      }
    }

    setCustomRange((prev) => ({
      start: prev.start ?? startIso,
      end: prev.end ?? mostRecent
    }));
  }, [customRange.end, customRange.start, periodGroups.daily]);

  useEffect(() => {
    setSelectedPeriods((prev) => {
      const next: SelectedPeriods = { ...prev };
      let updated = false;

      baseScopes.forEach((key) => {
        const groups = periodGroups[key];
        const current = next[key];

        if (current !== undefined) {
          return;
        }

        const fallback = groups[0]?.key;

        if (fallback !== undefined && current !== fallback) {
          next[key] = fallback;
          updated = true;
        }
      });

      return updated ? next : prev;
    });
  }, [periodGroups]);

  useEffect(() => {
    const selectedYear = selectedPeriods.yearly ?? periodGroups.yearly[0]?.key;
    if (!selectedYear) {
      setYearInputValue((prev) => (prev === '' ? prev : ''));
      return;
    }

    const next = toYearInputValue(selectedYear);
    setYearInputValue((prev) => {
      if (prev === next) {
        return prev;
      }

      if (prev && !/^\d{4}$/.test(prev)) {
        return prev;
      }

      return next;
    });
  }, [selectedPeriods.yearly, periodGroups.yearly]);

  const periodGroupsForScope = scope === 'custom' ? [] : periodGroups[scope];
  const fallbackPeriodKey = periodGroupsForScope[0]?.key;
  const explicitPeriodKey = scope === 'custom' ? undefined : selectedPeriods[scope];
  const selectedPeriodKey = scope === 'custom' ? undefined : explicitPeriodKey ?? fallbackPeriodKey;
  const isExplicitSelection =
    scope === 'custom' ? Boolean(customRange.start && customRange.end) : explicitPeriodKey !== undefined;

  const aggregatedDailyPoints = useMemo(() =>
    periodGroups.daily.map((group) => {
      const totals = group.points.reduce(
        (acc, point) => ({
          grossProfitUsd: acc.grossProfitUsd + Number(point.grossProfitUsd ?? 0),
          netProfitUsd: acc.netProfitUsd + Number(point.netProfitUsd ?? 0),
          revenueUsd: acc.revenueUsd + Number(point.revenueUsd ?? 0),
          costUsd: acc.costUsd + Number(point.costUsd ?? 0)
        }),
        { grossProfitUsd: 0, netProfitUsd: 0, revenueUsd: 0, costUsd: 0 }
      );

      return {
        periodStart: group.key,
        grossProfitUsd: totals.grossProfitUsd,
        netProfitUsd: totals.netProfitUsd,
        revenueUsd: totals.revenueUsd,
        costUsd: totals.costUsd
      } satisfies ProfitPoint;
    }),
    [periodGroups.daily]
  );

  const customRangePoints = useMemo(() => {
    if (!customRange.start || !customRange.end) {
      return [];
    }

    const startDate = new Date(customRange.start);
    const endDate = new Date(customRange.end);

    if (Number.isNaN(startDate.valueOf()) || Number.isNaN(endDate.valueOf()) || startDate > endDate) {
      return [];
    }

    return aggregatedDailyPoints
      .filter((point) => {
        const pointDate = new Date(point.periodStart);
        return pointDate >= startDate && pointDate <= endDate;
      })
      .sort((a, b) => new Date(a.periodStart).getTime() - new Date(b.periodStart).getTime());
  }, [aggregatedDailyPoints, customRange.end, customRange.start]);

  const customRangeLabel = useMemo(() => {
    if (!customRange.start || !customRange.end) {
      return undefined;
    }
    const startDate = new Date(customRange.start);
    const endDate = new Date(customRange.end);
    if (Number.isNaN(startDate.valueOf()) || Number.isNaN(endDate.valueOf()) || startDate > endDate) {
      return undefined;
    }
    const formatter = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
    return `${formatter.format(startDate)} – ${formatter.format(endDate)}`;
  }, [customRange.end, customRange.start, locale]);

  const isCustomRangeInvalid = useMemo(() => {
    if (!customRange.start || !customRange.end) {
      return false;
    }
    const startDate = new Date(customRange.start);
    const endDate = new Date(customRange.end);
    return Number.isNaN(startDate.valueOf()) || Number.isNaN(endDate.valueOf()) || startDate > endDate;
  }, [customRange.end, customRange.start]);

  const selectedPoints = useMemo(() => {
    if (scope === 'custom') {
      return customRangePoints;
    }
    const groups = periodGroups[scope];
    if (!selectedPeriodKey) {
      return groups[0]?.points ?? [];
    }
    const match = groups.find((group) => group.key === selectedPeriodKey);
    return match ? match.points : [];
  }, [customRangePoints, periodGroups, scope, selectedPeriodKey]);

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
  const netProfitMargin = totals.revenue > 0 ? totals.netProfit / totals.revenue : 0;
  const formattedNetProfitMargin = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: 'percent',
        maximumFractionDigits: 1,
        minimumFractionDigits: 0
      }).format(netProfitMargin),
    [locale, netProfitMargin]
  );
  const periodLabel =
    scope === 'daily' || scope === 'custom'
      ? t('profitPeriodDay')
      : scope === 'weekly'
        ? t('profitPeriodWeek')
        : scope === 'monthly'
          ? t('profitPeriodMonth')
          : t('profitPeriodYear');
  const selectedPeriodLabel =
    scope === 'custom'
      ? customRangeLabel
      : selectedPeriodKey
        ? formatPeriodSummaryLabel(scope, selectedPeriodKey, locale)
        : undefined;
  const placeholderRow =
    selectedPeriodLabel && isExplicitSelection && chartData.length === 0
      ? {
          label: selectedPeriodLabel,
          grossProfit: 0,
          netProfit: 0,
          revenue: 0,
          cost: 0
        }
      : undefined;
  const displayRows = chartData.length > 0 ? chartData : placeholderRow ? [placeholderRow] : [];
  const hasDisplayRows = displayRows.length > 0;
  const periodPickerLabel =
    scope === 'daily'
      ? t('profitPeriodPickerDaily')
      : scope === 'weekly'
        ? t('profitPeriodPickerWeekly')
        : scope === 'monthly'
          ? t('profitPeriodPickerMonthly')
          : scope === 'yearly'
            ? t('profitPeriodPickerYearly')
            : t('profitPeriodPickerCustom');
  const pickerInputClass =
    'h-10 min-w-[12rem] cursor-pointer appearance-none rounded-lg border border-slate-300 bg-white px-3 pr-10 text-sm font-medium text-slate-700 shadow-sm transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-emerald-400 dark:focus:ring-emerald-500/40';
  const pickerIconClass =
    'pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500';

  const openPicker = () => {
    const input = pickerRef.current;
    if (!input) {
      return;
    }
    const picker = input as HTMLInputElement & { showPicker?: () => void };
    if (typeof picker.showPicker === 'function') {
      picker.showPicker();
    }
    input.focus();
  };

  const handlePickerContainerPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const input = pickerRef.current;
    if (!input) {
      return;
    }

    const target = event.target;
    const isTextInput = input.type === 'text';
    if (target instanceof HTMLInputElement && target === input && isTextInput) {
      return;
    }

    event.preventDefault();
    openPicker();
  };

  const renderPeriodPicker = () => {
    if (scope === 'yearly') {
      return (
        <div className="relative" onPointerDown={handlePickerContainerPointerDown}>
          <input
            type="text"
            inputMode="numeric"
            pattern="\d*"
            maxLength={4}
            className={pickerInputClass}
            value={yearInputValue}
            placeholder="YYYY"
            ref={pickerRef}
            onChange={(event) => {
              let nextValue = event.target.value.replace(/[^\d]/g, '');
              if (nextValue.length > 4) {
                nextValue = nextValue.slice(0, 4);
              }
              setYearInputValue(nextValue);

              if (nextValue.length === 0) {
                setSelectedPeriods((prev) => ({ ...prev, yearly: undefined }));
                return;
              }

              if (nextValue.length === 4) {
                const iso = fromYearInputValue(nextValue);
                if (iso) {
                  setSelectedPeriods((prev) => ({
                    ...prev,
                    yearly: iso
                  }));
                }
              }
            }}
            onBlur={() => {
              if (yearInputValue && yearInputValue.length < 4) {
                const fallback = selectedPeriods.yearly ?? periodGroups.yearly[0]?.key;
                setYearInputValue(fallback ? toYearInputValue(fallback) : '');
              }
            }}
            autoComplete="off"
          />
          <ChevronDownIcon className={pickerIconClass} />
        </div>
      );
    }

    if (scope === 'monthly') {
      const value = selectedPeriodKey ? toMonthInputValue(selectedPeriodKey) : '';
      return (
        <div className="relative" onPointerDown={handlePickerContainerPointerDown}>
          <input
            type="month"
            className={pickerInputClass}
            value={value}
            ref={pickerRef}
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
            autoComplete="off"
          />
          <ChevronDownIcon className={pickerIconClass} />
        </div>
      );
    }

    if (scope === 'custom') {
      const startValue = customRange.start ? toDateInputValue(customRange.start) : '';
      const endValue = customRange.end ? toDateInputValue(customRange.end) : '';
      return (
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <input
              type="date"
              className={pickerInputClass}
              value={startValue}
              onChange={(event) => {
                const next = event.target.value;
                setCustomRange((prev) => ({
                  ...prev,
                  start: next ? fromDateInputValue(next) : undefined
                }));
              }}
              autoComplete="off"
            />
            <ChevronDownIcon className={pickerIconClass} />
          </div>
          <div className="relative">
            <input
              type="date"
              className={pickerInputClass}
              value={endValue}
              onChange={(event) => {
                const next = event.target.value;
                setCustomRange((prev) => ({
                  ...prev,
                  end: next ? fromDateInputValue(next) : undefined
                }));
              }}
              autoComplete="off"
            />
            <ChevronDownIcon className={pickerIconClass} />
          </div>
        </div>
      );
    }

    const value = selectedPeriodKey ? toDateInputValue(selectedPeriodKey) : '';
    return (
      <div className="relative" onPointerDown={handlePickerContainerPointerDown}>
        <input
          type="date"
          className={pickerInputClass}
          value={value}
          ref={pickerRef}
          onChange={(event) => {
            const next = event.target.value;
            if (!next) {
              if (scope === 'weekly' || scope === 'daily') {
                setSelectedPeriods((prev) => ({ ...prev, [scope]: undefined }));
              }
              return;
            }
            const iso = scope === 'weekly' ? fromWeekDateInputValue(next) : fromDateInputValue(next);
            if (scope === 'weekly' || scope === 'daily') {
              setSelectedPeriods((prev) => ({
                ...prev,
                [scope]: iso
              }));
            }
          }}
          autoComplete="off"
        />
        <ChevronDownIcon className={pickerIconClass} />
      </div>
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
                  <option value="custom">{t('profitScopeCustom')}</option>
                </select>
              </label>
              <label className="flex flex-col text-sm text-slate-600 dark:text-slate-300">
                <span className="mb-1 font-medium">{periodPickerLabel}</span>
                {renderPeriodPicker()}
                {scope === 'custom' && isCustomRangeInvalid && (
                  <span className="mt-1 text-xs text-red-600 dark:text-red-400">{t('profitCustomRangeInvalid')}</span>
                )}
              </label>
            </div>
          </div>
        </Card>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-6">
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
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{t('profitNetMargin')}</p>
            <p className="text-2xl font-semibold text-emerald-600 dark:text-emerald-300">
              {formattedNetProfitMargin}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t('profitNetMarginDescription')}</p>
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
        {hasDisplayRows ? (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={displayRows} barSize={28} maxBarSize={36} barCategoryGap="2%" barGap={2}>
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
              {hasDisplayRows ? (
                displayRows.map((point) => (
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

