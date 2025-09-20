import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../api/client";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Switch } from "../components/ui/switch";
import { Label } from "../components/ui/label";
import { Select } from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogClose } from "../components/ui/dialog";
import { currencyFormatter } from "../lib/utils";
import { Loader2, Plus, Search, Edit3 } from "lucide-react";

interface Category {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  barcode?: string;
  description?: string;
  price: number;
  cost: number;
  taxClass: string;
  isActive: boolean;
  categoryId: string;
  categoryName: string;
  stockQuantity: number;
  lowStockThreshold: number;
  taxRate: number;
}

interface Paged<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [currency, setCurrency] = useState("USD");
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [refreshFlag, setRefreshFlag] = useState(0);

  useEffect(() => {
    const loadInitial = async () => {
      const [categoriesResponse, settingsResponse] = await Promise.all([api.get("/categories"), api.get("/settings")]);
      setCategories(categoriesResponse.data);
      setCurrency(settingsResponse.data.currency);
    };
    loadInitial();
  }, []);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get<Paged<Product>>("/products", { params: { page, pageSize, search } });
      setProducts(response.data.items);
      setTotalItems(response.data.totalItems);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, refreshFlag]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const currencyFormat = useMemo(() => currencyFormatter(currency), [currency]);

  const pageCount = Math.ceil(totalItems / pageSize);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Products</h2>
          <p className="text-sm text-muted-foreground">Manage catalog items, pricing, and availability.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingProduct(null); }}>
          <DialogTrigger asChild>
            <Button className="gap-2" onClick={() => { setEditingProduct(null); setDialogOpen(true); }}>
              <Plus className="h-4 w-4" /> Add product
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingProduct ? "Update product" : "Create new product"}</DialogTitle>
              <DialogDescription>Set the details and stock levels available in your store.</DialogDescription>
            </DialogHeader>
            <ProductForm
              categories={categories}
              product={editingProduct}
              onComplete={() => {
                setEditingProduct(null);
                setDialogOpen(false);
                setPage(1);
                setRefreshFlag((prev) => prev + 1);
              }}
            />
          </DialogContent>
        </Dialog>
      </header>
      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <CardTitle className="text-base font-semibold">Catalog overview</CardTitle>
          <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:items-center">
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search by name, SKU, or barcode"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground">{totalItems} products</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center">
                      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" /> Loading products…
                      </div>
                    </TableCell>
                  </TableRow>
                ) : products.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                      No products found. Create your first item to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  products.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{product.name}</span>
                          <span className="text-xs text-muted-foreground">{product.description}</span>
                        </div>
                      </TableCell>
                      <TableCell>{product.sku}</TableCell>
                      <TableCell>{product.categoryName}</TableCell>
                      <TableCell className="text-right">{currencyFormat.format(product.price)}</TableCell>
                      <TableCell className="text-right">{product.stockQuantity}</TableCell>
                      <TableCell>
                        <Badge variant={product.isActive ? "success" : "secondary"}>{product.isActive ? "Active" : "Archived"}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-2"
                          onClick={() => {
                            setEditingProduct(product);
                            setDialogOpen(true);
                          }}
                        >
                          <Edit3 className="h-4 w-4" /> Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {pageCount > 1 && (
            <div className="flex items-center justify-end gap-3 text-sm">
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

function ProductForm({ categories, product, onComplete }: { categories: Category[]; product: Product | null; onComplete: () => void }) {
  const [name, setName] = useState(product?.name ?? "");
  const [sku, setSku] = useState(product?.sku ?? "");
  const [price, setPrice] = useState(product?.price ?? 0);
  const [cost, setCost] = useState(product?.cost ?? 0);
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? (categories[0]?.id ?? ""));
  const [description, setDescription] = useState(product?.description ?? "");
  const [barcode, setBarcode] = useState(product?.barcode ?? "");
  const [stockQuantity, setStockQuantity] = useState(product?.stockQuantity ?? 0);
  const [lowStockThreshold, setLowStockThreshold] = useState(product?.lowStockThreshold ?? 5);
  const [taxRate, setTaxRate] = useState(product?.taxRate ?? 0.075);
  const [isActive, setIsActive] = useState(product?.isActive ?? true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (product) {
      setName(product.name);
      setSku(product.sku);
      setPrice(product.price);
      setCost(product.cost);
      setCategoryId(product.categoryId);
      setDescription(product.description ?? "");
      setBarcode(product.barcode ?? "");
      setStockQuantity(product.stockQuantity);
      setLowStockThreshold(product.lowStockThreshold);
      setTaxRate(product.taxRate);
      setIsActive(product.isActive);
    } else if (!categoryId && categories.length) {
      setCategoryId(categories[0].id);
    }
  }, [product, categories, categoryId]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name,
        sku,
        barcode,
        description,
        price,
        cost,
        taxClass: "Standard",
        isActive,
        categoryId,
        stockQuantity,
        lowStockThreshold,
        taxRate,
        imageUrl: null,
        variants: [],
        modifiers: []
      };
      if (product) {
        await api.put(`/products/${product.id}`, payload);
      } else {
        await api.post("/products", payload);
      }
      onComplete();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" value={name} onChange={(event) => setName(event.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sku">SKU</Label>
          <Input id="sku" value={sku} onChange={(event) => setSku(event.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="barcode">Barcode</Label>
          <Input id="barcode" value={barcode} onChange={(event) => setBarcode(event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Select id="category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)} required>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="price">Price</Label>
          <Input id="price" type="number" step="0.01" value={price} onChange={(event) => setPrice(Number(event.target.value))} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cost">Cost</Label>
          <Input id="cost" type="number" step="0.01" value={cost} onChange={(event) => setCost(Number(event.target.value))} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="stock">Initial stock</Label>
          <Input id="stock" type="number" value={stockQuantity} onChange={(event) => setStockQuantity(Number(event.target.value))} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="low-stock">Low stock warning</Label>
          <Input id="low-stock" type="number" value={lowStockThreshold} onChange={(event) => setLowStockThreshold(Number(event.target.value))} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tax-rate">Tax rate</Label>
          <Input id="tax-rate" type="number" step="0.01" value={taxRate} onChange={(event) => setTaxRate(Number(event.target.value))} />
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <div className="flex items-center gap-3 rounded-xl border bg-muted/40 p-3">
            <Switch checked={isActive} onCheckedChange={(checked) => setIsActive(Boolean(checked))} />
            <span className="text-sm text-muted-foreground">Active products are available at the register.</span>
          </div>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" value={description} onChange={(event) => setDescription(event.target.value)} rows={3} placeholder="Short description for staff" />
      </div>
      <div className="flex items-center justify-end gap-3">
        <DialogClose asChild>
          <Button variant="ghost">Cancel</Button>
        </DialogClose>
        <Button type="submit" disabled={saving}>
          {saving ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Saving
            </span>
          ) : product ? (
            "Update product"
          ) : (
            "Create product"
          )}
        </Button>
      </div>
    </form>
  );
}
