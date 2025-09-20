import { useEffect, useState } from "react";
import api from "../api/client";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { currencyFormatter } from "../lib/utils";
import { ResponsiveContainer, LineChart, Line, XAxis, Tooltip } from "recharts";
import { CalendarIcon, BarChart3 } from "lucide-react";

interface Summary {
  date: string;
  grossSales: number;
  discountTotal: number;
  taxTotal: number;
  netSales: number;
  topProducts: Array<{ productId: string; name: string; quantitySold: number; totalSales: number }>;
}

interface TopProduct {
  productId: string;
  name: string;
  quantitySold: number;
  totalSales: number;
}

export default function ReportsPage() {
  const [date, setDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [summary, setSummary] = useState<Summary | null>(null);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [currency, setCurrency] = useState("USD");

  const load = async () => {
    const [summaryResponse, topResponse, settingsResponse] = await Promise.all([
      api.get<Summary>("/reports/daily-summary", { params: { date } }),
      api.get<TopProduct[]>("/reports/top-products", { params: { days: 30 } }),
      api.get("/settings")
    ]);
    setSummary(summaryResponse.data);
    setTopProducts(topResponse.data);
    setCurrency(settingsResponse.data.currency);
  };

  useEffect(() => {
    load();
  }, [date]);

  const formatter = currencyFormatter(currency);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Reports</h2>
          <p className="text-sm text-muted-foreground">Visualise sales performance and identify top performers.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <CalendarIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input type="date" className="pl-9" value={date} onChange={(event) => setDate(event.target.value)} />
          </div>
          <Button variant="outline" onClick={load}>
            Refresh
          </Button>
        </div>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Daily revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 text-sm">
              <ReportRow label="Gross sales" value={summary ? formatter.format(summary.grossSales) : "—"} />
              <ReportRow label="Discounts" value={summary ? formatter.format(summary.discountTotal) : "—"} emphasize />
              <ReportRow label="Tax collected" value={summary ? formatter.format(summary.taxTotal) : "—"} />
              <ReportRow label="Net sales" value={summary ? formatter.format(summary.netSales) : "—"} bold />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <BarChart3 className="h-4 w-4 text-primary" /> 30-day leaderboard
            </CardTitle>
            <p className="text-xs text-muted-foreground">Top performing products by revenue</p>
          </CardHeader>
          <CardContent className="h-[240px]">
            {topProducts.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={topProducts}>
                  <XAxis dataKey="name" hide />
                  <Tooltip
                    formatter={(value: number) => formatter.format(value)}
                    labelFormatter={(label) => label}
                  />
                  <Line type="monotone" dataKey="totalSales" stroke="#6366F1" strokeWidth={3} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Not enough data yet.</div>
            )}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Top products ({summary?.topProducts.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary && summary.topProducts.length > 0 ? (
                summary.topProducts.map((product) => (
                  <TableRow key={product.productId}>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell className="text-right">{product.quantitySold}</TableCell>
                    <TableCell className="text-right">{formatter.format(product.totalSales)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="py-10 text-center text-sm text-muted-foreground">
                    No data available for the selected day.
                  </TableCell>
                </TableRow>
              )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ReportRow({ label, value, emphasize, bold }: { label: string; value: string; emphasize?: boolean; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={bold ? "text-base font-semibold" : emphasize ? "text-emerald-500" : ""}>{value}</span>
    </div>
  );
}
