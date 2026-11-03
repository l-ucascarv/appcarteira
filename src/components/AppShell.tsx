import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  Wallet,
  Tags,
  PlusCircle,
  CalendarClock,
  CalendarCheck,
  LogOut,
  Moon,
  Sun,
} from "lucide-react";
import logoLight from "@/assets/logo-full.png";
import logoDark from "@/assets/logo-full-dark.png";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/hooks/use-theme";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

const NAV = [
  { to: "/", label: "saldos", icon: Wallet },
  { to: "/tags", label: "tags", icon: Tags },
  { to: "/comprometido", label: "comprometido", icon: CalendarCheck },
] as const;

const ACTIONS = [
  { to: "/lancamentos", label: "adicionar", icon: PlusCircle },
  { to: "/calendario", label: "ir pra hoje", icon: CalendarClock },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const loc = useLocation();
  const navigate = useNavigate();
  const [theme, setTheme] = useTheme();

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: { mode: "signin" }, replace: true });
  };

  const itemClass = (active: boolean) =>
    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] lowercase tracking-tight transition-colors ${
      active
        ? "bg-primary/10 font-semibold text-primary"
        : "text-foreground/70 hover:bg-muted hover:text-foreground"
    }`;

  return (
    <div className="min-h-dvh bg-background text-foreground">
      {/* Sidebar (desktop) */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 border-r border-border bg-card/60 px-3 py-6 backdrop-blur md:flex md:flex-col">
        <div className="mb-7 flex items-center gap-2.5 px-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
            <PiggyBank className="h-4 w-4" />
          </span>
          <span className="truncate text-[15px] font-semibold lowercase tracking-tight">meu caixa</span>
        </div>

        <nav className="flex flex-col gap-0.5">
          {NAV.map((n) => {
            const Icon = n.icon;
            return (
              <Link key={n.label} to={n.to} className={itemClass(loc.pathname === n.to)}>
                <Icon className="h-[18px] w-[18px] shrink-0" />
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div className="my-4 h-px bg-border" />

        <nav className="flex flex-1 flex-col gap-0.5">
          {ACTIONS.map((n) => {
            const Icon = n.icon;
            return (
              <Link key={n.label} to={n.to} className={itemClass(loc.pathname === n.to)}>
                <Icon className="h-[18px] w-[18px] shrink-0" />
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-4 flex items-center justify-between px-1">
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Alternar tema"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="sm" className="rounded-full" onClick={signOut}>
            <LogOut className="mr-1 h-4 w-4" /> sair
          </Button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="mobile-top-bar sticky top-0 z-20 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur-xl md:hidden">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
            <PiggyBank className="h-3.5 w-3.5" />
          </span>
          <span className="truncate text-[15px] font-semibold lowercase tracking-tight">meu caixa</span>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            aria-label="Alternar tema"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="rounded-full" aria-label="Sair" onClick={signOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="app-main min-w-0 md:pb-12 md:pl-60">
        <div className="mx-auto min-w-0 max-w-5xl px-3 py-4 sm:px-5 sm:py-6 md:px-8 md:py-8">{children}</div>
      </main>

      {/* Bottom nav (mobile) */}
      <nav aria-label="Navegação principal" className="mobile-bottom-bar fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-background/95 backdrop-blur-xl md:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-[1fr_.8fr_1.5fr_1.1fr_1fr] items-stretch">
          {[NAV[0], NAV[1], NAV[2], ACTIONS[0], ACTIONS[1]].map((n) => {
            const active = loc.pathname === n.to;
            const Icon = n.icon;
            return (
              <Link
                key={n.label}
                to={n.to}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-0.5 text-[10px] lowercase ${
                  active ? "font-semibold text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="max-w-full whitespace-nowrap text-center leading-tight">{n.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
