import { useEffect, useState } from "react";
import api from "../api/client";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import { Button } from "../components/ui/button";
import { Loader2, Save } from "lucide-react";

interface StoreSettings {
  storeName: string;
  currency: string;
  defaultTaxRate: number;
  receiptHeader: string;
  receiptFooter: string;
  address?: string;
  phone?: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<StoreSettings>("/settings").then((response) => setSettings(response.data));
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!settings) return;
    setSaving(true);
    try {
      await api.put("/settings", settings);
    } finally {
      setSaving(false);
    }
  };

  if (!settings) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading settings…
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Store profile</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="storeName">Store name</Label>
              <Input id="storeName" value={settings.storeName} onChange={(event) => setSettings({ ...settings, storeName: event.target.value })} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Input id="currency" value={settings.currency} onChange={(event) => setSettings({ ...settings, currency: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tax">Default tax rate</Label>
                <Input id="tax" type="number" step="0.01" value={settings.defaultTaxRate} onChange={(event) => setSettings({ ...settings, defaultTaxRate: Number(event.target.value) })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Textarea id="address" value={settings.address ?? ""} onChange={(event) => setSettings({ ...settings, address: event.target.value })} rows={2} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" value={settings.phone ?? ""} onChange={(event) => setSettings({ ...settings, phone: event.target.value })} />
            </div>
            <Button type="submit" disabled={saving} className="w-full gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save changes
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Receipt template</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="header">Header</Label>
            <Textarea id="header" value={settings.receiptHeader} onChange={(event) => setSettings({ ...settings, receiptHeader: event.target.value })} rows={4} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="footer">Footer</Label>
            <Textarea id="footer" value={settings.receiptFooter} onChange={(event) => setSettings({ ...settings, receiptFooter: event.target.value })} rows={4} />
          </div>
          <div className="rounded-3xl border bg-muted/40 p-5 text-sm leading-relaxed">
            <p className="font-semibold">Preview</p>
            <p className="mt-3 whitespace-pre-line text-xs text-muted-foreground">{settings.receiptHeader}</p>
            <p className="mt-6 text-xs uppercase tracking-wide text-muted-foreground">Thank you for shopping with {settings.storeName}</p>
            <p className="mt-4 whitespace-pre-line text-xs text-muted-foreground">{settings.receiptFooter}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
