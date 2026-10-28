import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useIncome, useExpenses, useTransactions } from "@/lib/queries";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { brl } from "@/lib/format";
import { AddIncomeDialog } from "@/components/AddIncomeDialog";
import { AddExpenseDialog } from "@/components/AddExpenseDialog";
import { ChevronLeft, ChevronRight, Plus, TrendingUp } from "lucide-react";
import { OwnerIcon } from "@/components/OwnerBadge";
import { horizonMonth } from "@/lib/monthly-report";

export const Route = createFileRoute("/_authenticated/fluxo")({
  beforeLoad: () => { throw redirect({ to: "/lancamentos", replace: true }); },
  head: () => ({
    meta: [
      { title: "Fluxo de Caixa — Meu Caixa" },
      { name: "description", content: "Entradas e saídas dia a dia com saldo acumulado do mês." },
      { property: "og:title", content: "Fluxo de Caixa — Meu Caixa" },
      { property: "og:description", content: "Entradas e saídas dia a dia com saldo acumulado do mês." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Fluxo,
});

type View = "entradas" | "saidas";

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function Fluxo() {
  const { data: income = [] } = useIncome();
  const { data: expenses = [] } = useExpenses();
  const { data: transactions = [] } = useTransactions();

  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [view, setView] = useState<View>("entradas");
  const [addIncome, setAddIncome] = useState(false);
  const [addExpense, setAddExpense] = useState(false);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

  const { rows: dailyRows, totalIn, totalOut, startBalance, endBalance } = horizonMonth(income, expenses, transactions, cursor);
  const rows = dailyRows.map((row) => ({
    ...row,
    events: (view === "entradas" ? row.ins : row.outs).map((entry) => ({ ...entry, kind: entry.type })),
    value: view === "entradas" ? row.sumIn : row.sumOut,
    isToday: isCurrentMonth && today.getDate() === row.day,
  }));

  const shift = (n: number) => setCursor(new Date(year, month + n, 1));

  return (
    <div className="space-y-5">
      {/* Header mês */}
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
        <Button variant="ghost" size="icon" className="rounded-full" onClick={() => shift(-1)} aria-label="Mês anterior">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h1 className="truncate text-center text-xl font-semibold tracking-tight md:text-2xl">
          {MONTHS[month]}/{String(year).slice(2)}
        </h1>
        <Button variant="ghost" size="icon" className="rounded-full" onClick={() => shift(1)} aria-label="Próximo mês">
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Toggle Entradas / Saídas */}
      <div className="grid grid-cols-2 gap-1 rounded-full bg-muted p-1">
        {(["entradas", "saidas"] as View[]).map((v) => (
          <Button
            variant="ghost"
            key={v}
            onClick={() => setView(v)}
            className={`rounded-full py-2 text-sm font-medium transition-colors ${
              view === v ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            {v === "entradas" ? "Entradas" : "Saídas"}
          </Button>
        ))}
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="rounded-2xl p-4 shadow-none">
          <div className="text-xs text-muted-foreground">Total {view === "entradas" ? "entradas" : "saídas"}</div>
          <div
            className={`mt-1 text-lg font-semibold tabular-nums ${
              view === "entradas" ? "text-success" : "text-danger"
            }`}
          >
            {brl(view === "entradas" ? totalIn : totalOut)}
          </div>
        </Card>
        <Card className="rounded-2xl p-4 shadow-none">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5" /> Saldo fim do mês
          </div>
          <div className="mt-1 text-lg font-semibold tabular-nums">{brl(endBalance)}</div>
        </Card>
      </div>

      <div className="flex gap-2">
        <Button size="sm" variant="outline" className="flex-1 rounded-full" onClick={() => setAddIncome(true)}>
          <Plus className="mr-1 h-4 w-4" /> Receita
        </Button>
        <Button size="sm" variant="outline" className="flex-1 rounded-full" onClick={() => setAddExpense(true)}>
          <Plus className="mr-1 h-4 w-4" /> Despesa
        </Button>
      </div>

      <div className="text-sm text-muted-foreground">Saldo anterior ao mês <span className="font-medium tabular-nums text-foreground">{brl(startBalance)}</span></div>

      {/* Tabela dia a dia */}
      <Card className="overflow-hidden rounded-2xl p-0 shadow-none">
        <div className="grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-2 border-b border-border bg-muted/50 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          <span>Dia</span>
          <span>{view === "entradas" ? "Entradas" : "Saídas"}</span>
          <span className="text-right">Saldo</span>
        </div>
        <ul className="divide-y divide-border">
          {rows.map((r) => (
            <li
              key={r.day}
              className={`grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-2 px-3 py-2 ${
                r.isToday ? "bg-accent/60" : ""
              }`}
            >
              <span className={`text-sm tabular-nums ${r.isToday ? "font-semibold" : "text-muted-foreground"}`}>
                {r.day}
              </span>
              <div className="min-w-0">
                {r.events.length === 0 ? (
                  <span className="text-sm text-muted-foreground/50">—</span>
                ) : (
                  <div className="space-y-1">
                    {r.events.map((ev) => (
                      <div key={`${ev.kind}-${ev.id}`} className="flex min-w-0 items-center gap-2">
                        <OwnerIcon owner={ev.owner} />
                        <span className="truncate text-sm">{ev.description}</span>
                        <span
                          className={`shrink-0 text-sm font-medium tabular-nums ${
                            ev.kind === "receita" ? "text-success" : "text-danger"
                          }`}
                        >
                          {ev.kind === "receita" ? "+" : "−"}
                          {brl(ev.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <span
                className={`rounded-md px-2 py-1 text-right text-sm font-medium tabular-nums ${
                  r.balance < 0
                    ? "bg-danger/10 text-danger"
                    : r.value > 0
                    ? "bg-success/15 text-success"
                    : "text-muted-foreground"
                }`}
              >
                {brl(r.balance)}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <AddIncomeDialog open={addIncome} onOpenChange={setAddIncome} />
      <AddExpenseDialog open={addExpense} onOpenChange={setAddExpense} />
    </div>
  );
}
