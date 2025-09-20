import { useEffect, useState } from "react";
import api from "../api/client";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Select } from "../components/ui/select";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Loader2, PackageMinus, PackagePlus } from "lucide-react";

interface ProductSummary {
  id: string;
  name: string;
  stockQuantity: number;
  lowStockThreshold: number;
  price: number;
}

interface Adjustment {
  id: string;
  productId: string;
  productName: string;
  quantityChange: number;
  reason: string;
  note?: string;
  createdAt: string;
}

interface ProductOption {
  id: string;
  name: string;
  stockQuantity: number;
}

export default function InventoryPage() {
  const [lowStock, setLowStock] = useState<ProductSummary[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalAdjustments, setTotalAdjustments] = useState(0);
  const [loadingAdjustments, setLoadingAdjustments] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [lowStockResponse, productResponse] = await Promise.all([
        api.get<ProductSummary[]>("/inventory/low-stock"),
        api.get("/products", { params: { page: 1, pageSize: 100 } })
      ]);
      setLowStock(lowStockResponse.data);
      setProducts(
        (productResponse.data.items ?? []).map((item: any) => ({
          id: item.id,
          name: item.name,
          stockQuantity: item.stockQuantity
        }))
      );
    };
    load();
  }, []);

  useEffect(() => {
    const loadAdjustments = async () => {
      setLoadingAdjustments(true);
      try {
        const response = await api.get("/inventory/adjustments", { params: { page, pageSize } });
        setAdjustments(response.data.items);
        setTotalAdjustments(response.data.totalItems);
      } finally {
        setLoadingAdjustments(false);
      }
    };
    loadAdjustments();
  }, [page, pageSize]);

  const pageCount = Math.ceil(totalAdjustments / pageSize);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Stock adjustment</CardTitle>
          </CardHeader>
          <CardContent>
            <AdjustmentForm
              products={products}
              onSuccess={() => {
                setPage(1);
                api.get<ProductSummary[]>("/inventory/low-stock").then((response) => setLowStock(response.data));
              }}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Low stock alerts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {lowStock.length === 0 ? (
              <p className="text-sm text-muted-foreground">All products are healthy on stock. 🎉</p>
            ) : (
              lowStock.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-xl border p-4">
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.stockQuantity} on hand — reorder threshold {item.lowStockThreshold}
                    </p>
                  </div>
                  <Badge variant="destructive">Restock soon</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <CardTitle className="text-base font-semibold">Adjustment history</CardTitle>
          <p className="text-xs text-muted-foreground">Track every stock correction for accountability.</p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingAdjustments ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center">
                      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" /> Loading adjustments…
                      </div>
                    </TableCell>
                  </TableRow>
                ) : adjustments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                      No adjustments recorded yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  adjustments.map((adjustment) => (
                    <TableRow key={adjustment.id}>
                      <TableCell className="font-medium">{adjustment.productName}</TableCell>
                      <TableCell>{adjustment.reason}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{adjustment.note}</TableCell>
                      <TableCell className="text-right">
                        <span className={adjustment.quantityChange >= 0 ? "text-emerald-500" : "text-rose-500"}>
                          {adjustment.quantityChange > 0 ? `+${adjustment.quantityChange}` : adjustment.quantityChange}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {new Date(adjustment.createdAt).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {pageCount > 1 && (
            <div className="mt-4 flex items-center justify-end gap-3 text-sm">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>
                Previous
              </Button>
              <span className="text-muted-foreground">
                Page {page} of {pageCount}
              </span>
              <Button variant="outline" size="sm" disabled={page === pageCount} onClick={() => setPage((prev) => Math.min(pageCount, prev + 1))}>
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AdjustmentForm({ products, onSuccess }: { products: ProductOption[]; onSuccess: () => void }) {
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [quantityChange, setQuantityChange] = useState(1);
  const [reason, setReason] = useState("Stock Count");
  const [note, setNote] = useState("Counted and reconciled by manager");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!productId && products.length) {
      setProductId(products[0].id);
    }
  }, [products, productId]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api.post("/inventory/adjust", { productId, quantityChange, reason, note });
      setQuantityChange(1);
      setReason("Stock Count");
      setNote("");
      onSuccess();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="product">Product</Label>
        <Select id="product" value={productId} onChange={(event) => setProductId(event.target.value)}>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name} — {product.stockQuantity} on hand
            </option>
          ))}
        </Select>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="quantity">Quantity change</Label>
          <Input id="quantity" type="number" value={quantityChange} onChange={(event) => setQuantityChange(Number(event.target.value))} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="reason">Reason</Label>
          <Select id="reason" value={reason} onChange={(event) => setReason(event.target.value)}>
            <option>Stock Count</option>
            <option>Damage</option>
            <option>Return to Vendor</option>
            <option>Promotional Giveaway</option>
            <option>Manual Correction</option>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="note">Notes</Label>
        <Textarea id="note" value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="Optional context for this adjustment" />
      </div>
      <div className="flex items-center justify-end gap-3">
        <Button type="button" variant="ghost" onClick={() => { setQuantityChange(1); setReason("Stock Count"); setNote(""); }}>
          Reset
        </Button>
        <Button type="submit" disabled={saving || !productId}>
          {saving ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Applying
            </span>
          ) : quantityChange >= 0 ? (
            <span className="flex items-center gap-2">
              <PackagePlus className="h-4 w-4" /> Increase stock
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <PackageMinus className="h-4 w-4" /> Decrease stock
            </span>
          )}
        </Button>
      </div>
    </form>
  );
}
