import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import api from "../api/client";
import { currencyFormatter } from "../lib/utils";
import { TrendingUp, TrendingDown, RefreshCcw } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip, PieChart, Pie, Cell } from "recharts";

interface DailySummary {
  date: string;
  grossSales: number;
  discountTotal: number;
  taxTotal: number;
  netSales: number;
  topProducts: Array<{ productId: string; name: string; quantitySold: number; totalSales: number }>;
}

const COLORS = ["#6366F1", "#22D3EE", "#F97316", "#84CC16", "#EC4899", "#0EA5E9"];

export default function DashboardPage() {
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState("USD");

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [summaryResponse, settingsResponse] = await Promise.all([
          api.get<DailySummary>("/reports/daily-summary"),
          api.get("/settings")
        ]);
        setSummary(summaryResponse.data);
        setCurrency(settingsResponse.data.currency);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const formatCurrency = currencyFormatter(currency);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Today&apos;s performance snapshot</p>
          <h2 className="text-2xl font-semibold">Dashboard overview</h2>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => window.location.reload()}>
          <RefreshCcw className="h-4 w-4" /> Refresh data
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Gross sales"
          value={summary ? formatCurrency.format(summary.grossSales) : "-"}
          description="Before discounts and tax"
          trendLabel="vs yesterday"
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <StatCard
          title="Discounts"
          value={summary ? formatCurrency.format(summary.discountTotal) : "-"}
          description="Promotions applied"
          trendLabel="Campaign boost"
          trendNegative
          icon={<TrendingDown className="h-4 w-4" />}
        />
        <StatCard
          title="Tax collected"
          value={summary ? formatCurrency.format(summary.taxTotal) : "-"}
          description="Ready for remittance"
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <StatCard
          title="Net sales"
          value={summary ? formatCurrency.format(summary.netSales) : "-"}
          description="After tax and discounts"
          emphasis
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card className="h-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Top products today</CardTitle>
              <CardDescription>Fastest selling items by revenue</CardDescription>
            </div>
            <Badge variant="secondary">Updated {new Date().toLocaleTimeString()}</Badge>
          </CardHeader>
          <CardContent className="h-[320px]">
            {summary && summary.topProducts.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summary.topProducts}>
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} interval={0} angle={-20} dy={10} fontSize={12} height={60} />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted))" }}
                    content={({ payload }) => {
                      if (!payload?.length) return null;
                      const item: any = payload[0].payload;
                      return (
                        <div className="rounded-xl border bg-background/95 p-3 text-sm shadow-lg">
                          <p className="font-semibold">{item.name}</p>
                          <p>{formatCurrency.format(item.totalSales)}</p>
                          <p className="text-xs text-muted-foreground">{item.quantitySold} units sold</p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="totalSales" radius={[12, 12, 4, 4]}>
                    {summary.topProducts.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState loading={loading} />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Tender breakdown</CardTitle>
            <CardDescription>Cash vs card payments</CardDescription>
          </CardHeader>
          <CardContent className="flex h-[320px] flex-col items-center justify-center">
            {summary ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { label: "Net sales", value: summary.netSales - summary.taxTotal },
                      { label: "Tax", value: summary.taxTotal }
                    ]}
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={6}
                    dataKey="value"
                  >
                    {[summary.netSales - summary.taxTotal, summary.taxTotal].map((_, index) => (
                      <Cell key={index} fill={COLORS[index]} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ payload }) => {
                      if (!payload?.length) return null;
                      const item: any = payload[0].payload;
                      return (
                        <div className="rounded-xl border bg-background/95 p-3 text-sm shadow-lg">
                          <p className="font-semibold">{item.label}</p>
                          <p>{formatCurrency.format(item.value)}</p>
                        </div>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState loading={loading} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  description,
  trendLabel,
  icon,
  trendNegative,
  emphasis
}: {
  title: string;
  value: string;
  description: string;
  trendLabel?: string;
  icon?: React.ReactNode;
  trendNegative?: boolean;
  emphasis?: boolean;
}) {
  return (
    <Card className={emphasis ? "bg-gradient-to-br from-primary/10 to-primary/20" : undefined}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {icon && <span className="rounded-full bg-primary/10 p-2 text-primary">{icon}</span>}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        {trendLabel && (
          <p className={cn("mt-2 text-xs font-medium", trendNegative ? "text-rose-500" : "text-emerald-500")}>{trendLabel}</p>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyState({ loading }: { loading: boolean }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
      {loading ? "Loading analytics…" : "No sales yet today. Make a sale to populate your dashboard."}
    </div>
  );
}

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(" ");
}
