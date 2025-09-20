import { useEffect, useState } from "react";
import api from "../api/client";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { Loader2, Plus, Search } from "lucide-react";

interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  notes?: string;
}

interface Paged<T> {
  items: T[];
  page: number;
  totalItems: number;
  pageSize: number;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const response = await api.get<Paged<Customer>>("/customers", { params: { page, pageSize, search } });
      setCustomers(response.data.items);
      setTotalItems(response.data.totalItems);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, [page, pageSize, search]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Customers</h2>
          <p className="text-sm text-muted-foreground">Keep track of regulars and attach them to sales for loyalty.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" /> Add customer
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New customer</DialogTitle>
              <DialogDescription>Capture contact information to enrich your CRM.</DialogDescription>
            </DialogHeader>
            <CustomerForm
              onSuccess={() => {
                setDialogOpen(false);
                setPage(1);
                loadCustomers();
              }}
            />
          </DialogContent>
        </Dialog>
      </header>
      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <CardTitle className="text-base font-semibold">Customer directory</CardTitle>
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search by name, email, or phone"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> Loading customers…
                      </div>
                    </TableCell>
                  </TableRow>
                ) : customers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                      No customers yet. Add someone to start building relationships.
                    </TableCell>
                  </TableRow>
                ) : (
                  customers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell className="font-medium">{customer.name}</TableCell>
                      <TableCell>{customer.email ?? "—"}</TableCell>
                      <TableCell>{customer.phone ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{customer.notes ?? ""}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {Math.ceil(totalItems / pageSize) > 1 && (
            <div className="mt-4 flex items-center justify-end gap-3 text-sm">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>
                Previous
              </Button>
              <span className="text-muted-foreground">
                Page {page} of {Math.ceil(totalItems / pageSize)}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page * pageSize >= totalItems}
                onClick={() => setPage((prev) => prev + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CustomerForm({ onSuccess }: { onSuccess: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api.post("/customers", { name, email, phone, notes });
      setName("");
      setEmail("");
      setPhone("");
      setNotes("");
      onSuccess();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" value={name} onChange={(event) => setName(event.target.value)} required />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="VIP, allergies, preferences…" />
      </div>
      <Button type="submit" className="w-full" disabled={saving}>
        {saving ? (
          <span className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Saving
          </span>
        ) : (
          "Save customer"
        )}
      </Button>
    </form>
  );
}
