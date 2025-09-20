import { useEffect, useMemo, useState } from "react";
import api from "../api/client";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Select } from "../components/ui/select";
import { Badge } from "../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../components/ui/dialog";
import { currencyFormatter } from "../lib/utils";
import { Minus, Plus, ShoppingBag, Trash, CreditCard, ScanBarcode, Receipt } from "lucide-react";
import { authStore } from "../store/auth-store";

interface Product {
  id: string;
  name: string;
  price: number;
  taxRate: number;
  stockQuantity: number;
  barcode?: string;
  sku: string;
  categoryName: string;
}

interface Customer {
  id: string;
  name: string;
}

interface StoreSettings {
  defaultTaxRate: number;
  currency: string;
}

interface CartItem {
  product: Product;
  quantity: number;
  discount: number;
  note?: string;
}

export default function SalesRegisterPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [settings, setSettings] = useState<StoreSettings>({ defaultTaxRate: 0.075, currency: "USD" });
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [paymentCash, setPaymentCash] = useState(0);
  const [paymentCard, setPaymentCard] = useState(0);
  const [note, setNote] = useState("");
  const [processing, setProcessing] = useState(false);
  const { user } = authStore();

  useEffect(() => {
    const load = async () => {
      const [productsResponse, customersResponse, settingsResponse] = await Promise.all([
        api.get("/products", { params: { page: 1, pageSize: 100, isActive: true } }),
        api.get("/customers", { params: { page: 1, pageSize: 100 } }),
        api.get("/settings")
      ]);
      const mappedProducts = (productsResponse.data.items ?? []).map((item: any) => ({
        id: item.id,
        name: item.name,
        price: item.price,
        taxRate: item.taxRate,
        stockQuantity: item.stockQuantity,
        barcode: item.barcode,
        sku: item.sku,
        categoryName: item.categoryName
      }));
      setProducts(mappedProducts);
      setFilteredProducts(mappedProducts);
      const customerPayload = (customersResponse.data as any);
      setCustomers((customerPayload.items ?? customerPayload) as Customer[]);
      setSettings({ defaultTaxRate: settingsResponse.data.defaultTaxRate, currency: settingsResponse.data.currency });
    };
    load();
  }, []);

  useEffect(() => {
    if (!search) {
      setFilteredProducts(products);
      return;
    }
    const lower = search.toLowerCase();
    setFilteredProducts(
      products.filter(
        (product) =>
          product.name.toLowerCase().includes(lower) ||
          product.sku.toLowerCase().includes(lower) ||
          (product.barcode && product.barcode.toLowerCase().includes(lower))
      )
    );
  }, [search, products]);

  const totals = useMemo(() => {
    const subtotal = cart.reduce((acc, item) => acc + item.product.price * item.quantity, 0);
    const discount = cart.reduce((acc, item) => acc + item.product.price * item.quantity * (item.discount / 100), 0);
    const tax = cart.reduce((acc, item) => {
      const rate = item.product.taxRate ?? settings.defaultTaxRate;
      const taxable = item.product.price * item.quantity * (1 - item.discount / 100);
      return acc + taxable * rate;
    }, 0);
    const total = subtotal - discount + tax;
    return { subtotal, discount, tax, total };
  }, [cart, settings.defaultTaxRate]);

  const currency = currencyFormatter(settings.currency);

  const addToCart = (product: Product) => {
    setCart((current) => {
      const existing = current.find((item) => item.product.id === product.id);
      if (existing) {
        return current.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...current, { product, quantity: 1, discount: 0 }];
    });
  };

  const updateQuantity = (productId: string, quantity: number) => {
    setCart((current) =>
      current
        .map((item) =>
          item.product.id === productId ? { ...item, quantity: Math.max(1, quantity) } : item
        )
    );
  };

  const updateDiscount = (productId: string, discount: number) => {
    setCart((current) =>
      current.map((item) => (item.product.id === productId ? { ...item, discount: Math.max(0, Math.min(100, discount)) } : item))
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((current) => current.filter((item) => item.product.id !== productId));
  };

  const beginCheckout = () => {
    setCheckoutOpen(true);
    setPaymentCash(totals.total);
    setPaymentCard(0);
  };

  const completeSale = async () => {
    if (cart.length === 0) return;
    setProcessing(true);
    try {
      await api.post("/sales", {
        customerId: selectedCustomer || null,
        items: cart.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
          discountPercent: item.discount,
          note: item.note
        })),
        cashPayment: paymentCash,
        cardPayment: paymentCard,
        notes: note
      });
      setCart([]);
      setPaymentCash(0);
      setPaymentCard(0);
      setNote("");
      setSelectedCustomer("");
      setCheckoutOpen(false);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <div className="space-y-4">
        <header className="flex flex-col gap-3 rounded-3xl border bg-card/60 p-4 shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase text-muted-foreground">Register</p>
              <h2 className="text-xl font-semibold">Quick sale</h2>
            </div>
            <Badge variant="secondary">{user?.role} mode</Badge>
          </div>
          <div className="grid gap-3 md:grid-cols-[2fr_1fr]">
            <div className="relative">
              <ScanBarcode className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search or scan barcode"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <Select value={selectedCustomer} onChange={(event) => setSelectedCustomer(event.target.value)}>
              <option value="">Walk-in customer</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </Select>
          </div>
        </header>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filteredProducts.map((product) => (
            <button
              key={product.id}
              onClick={() => addToCart(product)}
              className="group flex flex-col justify-between rounded-3xl border bg-card/70 p-4 text-left shadow hover:-translate-y-1 hover:shadow-lg transition"
            >
              <div>
                <p className="text-sm font-semibold text-muted-foreground">{product.categoryName}</p>
                <h3 className="mt-1 text-lg font-semibold">{product.name}</h3>
              </div>
              <div className="mt-6 flex items-center justify-between text-sm">
                <span className="font-semibold text-primary">{currency.format(product.price)}</span>
                <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">{product.stockQuantity} in stock</span>
              </div>
            </button>
          ))}
        </div>
      </div>
      <Card className="h-full">
        <CardHeader className="border-b pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShoppingBag className="h-5 w-5 text-primary" /> Cart summary
          </CardTitle>
        </CardHeader>
        <CardContent className="flex h-full flex-col">
          <div className="flex-1 space-y-3 overflow-y-auto">
            {cart.length === 0 ? (
              <div className="flex h-48 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                <ShoppingBag className="h-8 w-8" />
                Add products from the grid to build your cart.
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.product.id} className="rounded-2xl border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{item.product.name}</p>
                      <p className="text-xs text-muted-foreground">{item.product.sku}</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removeFromCart(item.product.id)}>
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                    <div className="flex items-center rounded-full border bg-muted/50">
                      <Button variant="ghost" size="icon" onClick={() => updateQuantity(item.product.id, item.quantity - 1)}>
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="min-w-[3rem] text-center font-semibold">{item.quantity}</span>
                      <Button variant="ghost" size="icon" onClick={() => updateQuantity(item.product.id, item.quantity + 1)}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs uppercase text-muted-foreground">Discount %</span>
                      <Input
                        className="h-9 w-16"
                        type="number"
                        min={0}
                        max={100}
                        value={item.discount}
                        onChange={(event) => updateDiscount(item.product.id, Number(event.target.value))}
                      />
                    </div>
                    <span className="ml-auto text-sm font-semibold">
                      {currency.format(item.product.price * item.quantity * (1 - item.discount / 100))}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="mt-4 space-y-2 rounded-2xl bg-muted/60 p-4 text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{currency.format(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between text-emerald-500">
              <span>Discounts</span>
              <span>-{currency.format(totals.discount)}</span>
            </div>
            <div className="flex justify-between">
              <span>Tax</span>
              <span>{currency.format(totals.tax)}</span>
            </div>
            <div className="flex justify-between text-base font-semibold">
              <span>Total</span>
              <span>{currency.format(totals.total)}</span>
            </div>
          </div>
          <Button className="mt-4 h-12 gap-2 text-base" disabled={cart.length === 0} onClick={beginCheckout}>
            <CreditCard className="h-5 w-5" /> Continue to checkout
          </Button>
        </CardContent>
      </Card>
      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete sale</DialogTitle>
            <DialogDescription>Collect payment and confirm this transaction.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-xs text-muted-foreground">Cash payment</label>
                <Input type="number" value={paymentCash} onChange={(event) => setPaymentCash(Number(event.target.value))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Card payment</label>
                <Input type="number" value={paymentCard} onChange={(event) => setPaymentCard(Number(event.target.value))} />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Order note</label>
              <Textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Special instructions" />
            </div>
            <div className="rounded-xl bg-muted/50 p-3 text-sm">
              <p className="flex justify-between">
                <span>Amount due</span>
                <span>{currency.format(totals.total)}</span>
              </p>
              <p className="flex justify-between text-emerald-500">
                <span>Change</span>
                <span>{currency.format(Math.max(paymentCash + paymentCard - totals.total, 0))}</span>
              </p>
            </div>
            <Button className="w-full" disabled={processing} onClick={completeSale}>
              {processing ? (
                <span className="flex items-center gap-2">
                  <Receipt className="h-4 w-4 animate-spin" /> Processing
                </span>
              ) : (
                "Confirm sale"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
