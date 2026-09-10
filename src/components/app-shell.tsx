import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  GitBranch,
  Sparkles,
  Mic,
  Users,
  FileText,
  Settings,
  LogOut,
  Search,
  Bell,
  Sun,
  Moon,
  Menu,
  X,
  ChevronDown,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import type { GitHubUserProfile } from "@/lib/github-oauth";
import { applyTheme, loadSettings, saveTheme, type AppSettings } from "@/lib/settings-service";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/repositories", label: "Repositories", icon: GitBranch },
  { to: "/ai-insights", label: "AI Insights", icon: Sparkles },
  { to: "/voice", label: "Voice Assistant", icon: Mic },
  { to: "/team", label: "Team Analytics", icon: Users },
  { to: "/reports", label: "Reports", icon: FileText },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

function useTheme() {
  const [theme, setTheme] = useState<AppSettings["theme"]>("system");
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const currentTheme = loadSettings().theme;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = (nextTheme: AppSettings["theme"]) => {
      setTheme(nextTheme);
      setDark(nextTheme === "dark" || (nextTheme === "system" && media.matches));
      applyTheme(nextTheme);
    };
    const handleThemeChange = (event: Event) => sync((event as CustomEvent<AppSettings["theme"]>).detail);
    const handleSystemChange = () => { if (theme === "system") sync("system"); };
    sync(currentTheme);
    window.addEventListener("gitinsight-theme-change", handleThemeChange);
    media.addEventListener("change", handleSystemChange);
    return () => {
      window.removeEventListener("gitinsight-theme-change", handleThemeChange);
      media.removeEventListener("change", handleSystemChange);
    };
  }, [theme]);
  const toggle = () => {
    saveTheme(dark ? "light" : "dark");
  };
  return { dark, toggle };
}

export function AppShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const { dark, toggle } = useTheme();
  const [user, setUser] = useState<GitHubUserProfile | null>(null);

  useEffect(() => {
    // Try localStorage cache first for fast display
    if (typeof window !== "undefined") {
      const cached = localStorage.getItem("github_user");
      if (cached) {
        try {
          setUser(JSON.parse(cached));
        } catch {
          // ignore parsing errors
        }
      }
    }

    // Fetch fresh user profile from backend
    fetch("/api/auth/user")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setUser(data);
          if (typeof window !== "undefined") {
            localStorage.setItem("github_user", JSON.stringify(data));
          }
        }
      })
      .catch(() => {
        // Fallback silently if not logged in
      });
  }, []);

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("github_token");
      localStorage.removeItem("github_user");
      window.location.href = "/api/auth/logout";
    }
  };

  const getInitials = (name?: string | null, login?: string) => {
    const target = name || login || "User";
    const parts = target.trim().split(" ");
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return target.slice(0, 2).toUpperCase();
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-sidebar border-r border-sidebar-border transform transition-transform lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center gap-2 px-5 border-b border-sidebar-border">
          <div className="h-9 w-9 rounded-xl bg-brand-gradient grid place-items-center text-white shadow-lg shadow-brand/20">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-sm text-brand-gradient">GitInsight AI</div>
            <div className="text-[11px] text-muted-foreground truncate">Project Intelligence</div>
          </div>
          <button
            className="ml-auto lg:hidden text-muted-foreground"
            onClick={() => setOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="p-3 space-y-1">
          {nav.map((item) => {
            const active =
              path === item.to || (item.to !== "/dashboard" && path.startsWith(item.to));
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                  active
                    ? "bg-brand-gradient text-white shadow-md shadow-brand/25"
                    : "text-sidebar-foreground hover:bg-sidebar-accent"
                }`}
              >
                <Icon
                  className={`h-4 w-4 ${active ? "" : "text-muted-foreground group-hover:text-foreground"}`}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-3 left-3 right-3">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-sidebar-accent transition cursor-pointer"
          >
            <LogOut className="h-4 w-4" /> Logout
          </button>
        </div>
      </aside>

      {open && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Main */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 h-16 border-b border-border bg-background/70 backdrop-blur-xl">
          <div className="h-full flex items-center gap-3 px-4 lg:px-8">
            <button className="lg:hidden" onClick={() => setOpen(true)}>
              <Menu className="h-5 w-5" />
            </button>
            <Link
              to="/repositories"
              className="hidden md:inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-border bg-card text-sm hover:bg-accent transition"
            >
              <GitBranch className="h-4 w-4 text-brand" />
              {user ? `${user.login} / Repositories` : "gitinsight / projects"}
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </Link>
            <div className="relative flex-1 max-w-md ml-auto md:ml-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                placeholder="Search repos, issues, developers…"
                className="w-full h-9 pl-9 pr-3 rounded-lg bg-card border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand/40"
              />
            </div>
            <button
              className="relative h-9 w-9 rounded-lg border border-border bg-card grid place-items-center hover:bg-accent transition"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-danger text-white text-[10px] font-semibold grid place-items-center">
                5
              </span>
            </button>
            <button
              onClick={toggle}
              className="h-9 w-9 rounded-lg border border-border bg-card grid place-items-center hover:bg-accent transition"
              aria-label="Toggle theme"
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {user?.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.login}
                className="h-9 w-9 rounded-full ring-2 ring-brand/30 object-cover shadow-md shadow-brand/25"
                title={user.name || user.login}
              />
            ) : (
              <div
                className="h-9 w-9 rounded-full bg-brand-gradient text-white grid place-items-center text-xs font-semibold shadow-md shadow-brand/25"
                title={user?.login || "User"}
              >
                {getInitials(user?.name, user?.login)}
              </div>
            )}
          </div>
        </header>

        <main className="px-4 lg:px-8 py-6 lg:py-8 pb-24 lg:pb-8">{children}</main>

        {/* Mobile bottom nav */}
        <nav className="fixed bottom-0 inset-x-0 lg:hidden bg-card/95 backdrop-blur-xl border-t border-border z-30">
          <div className="grid grid-cols-5">
            {nav.slice(0, 5).map((item) => {
              const active =
                path === item.to || (item.to !== "/dashboard" && path.startsWith(item.to));
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium ${
                    active ? "text-brand" : "text-muted-foreground"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {item.label.split(" ")[0]}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
