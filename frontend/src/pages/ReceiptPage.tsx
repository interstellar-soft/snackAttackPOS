import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../api/client";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Loader2, Printer } from "lucide-react";
import { currencyFormatter } from "../lib/utils";

interface ReceiptItem {
  productName: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  taxAmount: number;
  lineTotal: number;
}

interface ReceiptData {
  id: string;
  saleNumber: string;
  createdAt: string;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  cashPayment: number;
  cardPayment: number;
  changeDue: number;
  notes?: string;
  customer?: { id: string; name: string; email?: string } | null;
  items: ReceiptItem[];
  settings: { storeName: string; currency: string; receiptHeader: string; receiptFooter: string };
}

export default function ReceiptPage() {
  const { saleId } = useParams();
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

  useEffect(() => {
    if (!saleId) return;
    api.get<ReceiptData>(`/sales/${saleId}`).then((response) => setReceipt(response.data));
  }, [saleId]);

  if (!receipt) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading receipt…
      </div>
    );
  }

  const formatter = currencyFormatter(receipt.settings.currency);

  return (
    <div className="flex justify-center">
      <Card className="w-full max-w-3xl">
        <CardHeader className="flex flex-col items-center gap-2 text-center">
          <CardTitle>{receipt.settings.storeName}</CardTitle>
          <pre className="whitespace-pre-wrap text-xs text-muted-foreground">{receipt.settings.receiptHeader}</pre>
          <p className="text-xs text-muted-foreground">Receipt #{receipt.saleNumber}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{new Date(receipt.createdAt).toLocaleString()}</span>
            {receipt.customer && <span>{receipt.customer.name}</span>}
          </div>
          <div className="rounded-2xl border bg-muted/40 p-4 text-sm">
            {receipt.items.map((item, index) => (
              <div key={index} className="flex items-center justify-between border-b border-dashed py-2 last:border-none">
                <div>
                  <p className="font-medium">{item.productName}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.quantity} × {formatter.format(item.unitPrice)}
                    {item.discountPercent > 0 && ` — ${item.discountPercent}% off`}
                  </p>
                </div>
                <span className="font-semibold">{formatter.format(item.lineTotal)}</span>
              </div>
            ))}
          </div>
          <div className="space-y-1 text-sm">
            <SummaryRow label="Subtotal" value={formatter.format(receipt.subtotal)} />
            <SummaryRow label="Discounts" value={`-${formatter.format(receipt.discountTotal)}`} emphasize />
            <SummaryRow label="Tax" value={formatter.format(receipt.taxTotal)} />
            <SummaryRow label="Total" value={formatter.format(receipt.total)} bold />
            <SummaryRow label="Cash" value={formatter.format(receipt.cashPayment)} />
            <SummaryRow label="Card" value={formatter.format(receipt.cardPayment)} />
            <SummaryRow label="Change" value={formatter.format(receipt.changeDue)} />
          </div>
          {receipt.notes && (
            <div className="rounded-xl bg-muted/30 p-3 text-xs text-muted-foreground">
              {receipt.notes}
            </div>
          )}
          <div className="rounded-3xl bg-muted/40 p-4 text-center text-xs text-muted-foreground">
            <pre className="whitespace-pre-wrap">{receipt.settings.receiptFooter}</pre>
          </div>
          <div className="flex justify-center">
            <Button className="gap-2" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Print receipt
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryRow({ label, value, emphasize, bold }: { label: string; value: string; emphasize?: boolean; bold?: boolean }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={bold ? "font-semibold" : emphasize ? "text-emerald-500" : ""}>{value}</span>
    </div>
  );
}
