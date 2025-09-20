import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { authStore } from "../store/auth-store";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from?.pathname ?? "/";
  const { login, loading, error } = authStore();
  const [email, setEmail] = useState("admin@litepos.dev");
  const [password, setPassword] = useState("Admin123!");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const ok = await login(email, password);
    if (ok) {
      navigate(from, { replace: true });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="grid w-full max-w-5xl gap-8 rounded-3xl bg-background/20 p-1 shadow-2xl backdrop-blur-lg md:grid-cols-[1.1fr_0.9fr]">
        <div className="relative hidden overflow-hidden rounded-3xl bg-gradient-to-br from-sky-500 via-indigo-500 to-purple-500 md:flex">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.35),_transparent)]" />
          <div className="relative flex flex-col justify-between p-10 text-white">
            <div>
              <h2 className="text-3xl font-bold">LitePOS</h2>
              <p className="mt-2 max-w-sm text-sm text-sky-50/80">
                A sleek, cloud-first POS crafted for independent retailers. Manage products, track stock, and complete sales at lightning speed.
              </p>
            </div>
            <div className="rounded-2xl bg-white/15 p-6 text-sm leading-relaxed text-sky-50/90">
              <p className="font-semibold">Demo credentials</p>
              <p className="mt-2">Admin: admin@litepos.dev / Admin123!</p>
              <p>Manager: manager@litepos.dev / Manager123!</p>
              <p>Cashier: cashier@litepos.dev / Cashier123!</p>
            </div>
          </div>
        </div>
        <Card className="m-4 border-none bg-background/95 shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl">Sign in to LitePOS</CardTitle>
            <CardDescription>Enter your credentials to access the dashboard.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Signing in
                  </span>
                ) : (
                  "Sign in"
                )}
              </Button>
            </form>
            <div className="mt-6 rounded-xl bg-muted/60 p-4 text-xs text-muted-foreground">
              <p className="font-medium text-muted-foreground">Tip</p>
              <p className="mt-1">Use the manager or cashier accounts to experience restricted permissions.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
