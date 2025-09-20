import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { Moon, Sun, LogOut, LayoutDashboard, Boxes, PackageSearch, ShoppingCart, Users2, BarChart3, Settings, Receipt } from "lucide-react";
import { useTheme } from "./theme-provider";
import { authStore } from "../../store/auth-store";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/products", label: "Products", icon: Boxes },
  { to: "/inventory", label: "Inventory", icon: PackageSearch },
  { to: "/sales", label: "Sales Register", icon: ShoppingCart },
  { to: "/customers", label: "Customers", icon: Users2 },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings }
];

export default function DashboardLayout() {
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const { user, logout } = authStore();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="flex h-screen bg-muted/40">
      <aside className="hidden border-r bg-card/60 p-6 shadow-lg backdrop-blur md:flex md:w-64 md:flex-col">
        <div className="mb-10 flex items-center gap-3">
          <Receipt className="h-9 w-9 text-primary" />
          <div>
            <p className="text-lg font-semibold">LitePOS</p>
            <span className="text-sm text-muted-foreground">Modern retail POS</span>
          </div>
        </div>
        <nav className="space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-xl px-4 py-2 text-sm font-medium transition-all hover:bg-primary/10",
                  isActive ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground"
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto rounded-xl bg-muted/70 p-4 text-xs text-muted-foreground">
          <p className="font-semibold text-sm text-foreground">Shift Tips</p>
          <p className="mt-2">Tap the barcode icon on the register to quickly scan with an attached scanner.</p>
        </div>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b bg-background/60 p-4 backdrop-blur">
          <div className="flex flex-1 items-center gap-3">
            <div>
              <h1 className="text-xl font-semibold text-foreground">
                {user ? `Welcome back, ${user.fullName.split(" ")[0]}!` : "LitePOS"}
              </h1>
              <p className="text-sm text-muted-foreground">Smart insights and blazing-fast checkout for your store.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
              {theme === "light" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <div className="rounded-full bg-primary/10 px-3 py-2 text-left">
              <p className="text-xs uppercase text-muted-foreground">Signed in</p>
              <p className="text-sm font-medium">{user?.fullName}</p>
            </div>
            <Button variant="ghost" className="gap-2" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
