import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useIncome, useExpenses, useTransactions, useAccounts } from "@/lib/queries";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { brl } from "@/lib/format";
import { ReceiveIncomeDialog } from "@/components/ReceiveIncomeDialog";
import { PayExpenseDialog } from "@/components/PayExpenseDialog";
import { AddIncomeDialog } from "@/components/AddIncomeDialog";
import { AddExpenseDialog } from "@/components/AddExpenseDialog";
import { ChevronLeft, ChevronRight, Plus, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/_authenticated/fluxo")({
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

type DayEvent = {
  id: string;
  kind: "receita" | "despesa";
  description: string;
  amount: number; // sempre positivo
  actionable: boolean;
};

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function Fluxo() {
  const { data: income = [] } = useIncome();
  const { data: expenses = [] } = useExpenses();
  const { data: transactions = [] } = useTransactions();
  const { data: accounts = [] } = useAccounts();

  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [view, setView] = useState<View>("entradas");
  const [receiveOpen, setReceiveOpen] = useState<{ id: string; amount: number; name: string } | null>(null);
  const [payOpen, setPayOpen] = useState<{ id: string; amount: number; name: string } | null>(null);
  const [addIncome, setAddIncome] = useState(false);
  const [addExpense, setAddExpense] = useState(false);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

  const startBalance = accounts.reduce((s, a) => s + Number(a.balance), 0);

  const { rows, totalIn, totalOut } = useMemo(() => {
    const inByDay: Record<number, DayEvent[]> = {};
    const outByDay: Record<number, DayEvent[]> = {};
    const push = (map: Record<number, DayEvent[]>, day: number, ev: DayEvent) => {
      if (day < 1 || day > daysInMonth) return;
      (map[day] ??= []).push(ev);
    };

    const inMonth = (iso: string) => {
      const d = new Date(iso);
      return d.getFullYear() === year && d.getMonth() === month ? d.getDate() : null;
    };

    for (const t of transactions) {
      if (t.kind === "reserva") continue;
      const day = inMonth(t.occurred_at as string);
      if (!day) continue;
      const amt = Number(t.amount);
      const ev: DayEvent = {
        id: t.id as string,
        kind: amt >= 0 ? "receita" : "despesa",
        description: t.description as string,
        amount: Math.abs(amt),
        actionable: false,
      };
      push(amt >= 0 ? inByDay : outByDay, day, ev);
    }

    for (const i of income) {
      if (i.status !== "previsto") continue;
      const ref = i.reference_month ? new Date(i.reference_month) : null;
      if (ref && (ref.getFullYear() !== year || ref.getMonth() !== month) && !i.recurring) continue;
      const day = ref && ref.getFullYear() === year && ref.getMonth() === month ? ref.getDate() : 5;
      push(inByDay, day, {
        id: i.id,
        kind: "receita",
        description: i.name,
        amount: Number(i.amount),
        actionable: isCurrentMonth,
      });
    }

    for (const e of expenses) {
      if (e.status === "pago") continue;
      push(outByDay, e.due_day, {
        id: e.id,
        kind: "despesa",
        description: e.name,
        amount: Number(e.amount),
        actionable: isCurrentMonth,
      });
    }

    let running = startBalance;
    let totalIn = 0;
    let totalOut = 0;
    const rows = Array.from({ length: daysInMonth }, (_, idx) => {
      const day = idx + 1;
      const ins = inByDay[day] ?? [];
      const outs = outByDay[day] ?? [];
      const sumIn = ins.reduce((s, e) => s + e.amount, 0);
      const sumOut = outs.reduce((s, e) => s + e.amount, 0);
      totalIn += sumIn;
      totalOut += sumOut;
      running += sumIn - sumOut;
      return {
        day,
        events: view === "entradas" ? ins : outs,
        value: view === "entradas" ? sumIn : sumOut,
        balance: running,
        isToday: isCurrentMonth && today.getDate() === day,
      };
    });

    return { rows, totalIn, totalOut };
  }, [transactions, income, expenses, year, month, daysInMonth, view, startBalance, isCurrentMonth, today]);

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
          <button
            key={v}
            onClick={() => setView(v)}
            className={`rounded-full py-2 text-sm font-medium transition-colors ${
              view === v ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            {v === "entradas" ? "Entradas" : "Saídas"}
          </button>
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
          <div className="mt-1 text-lg font-semibold tabular-nums">{brl(rows[rows.length - 1]?.balance ?? startBalance)}</div>
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
                        <span className="truncate text-sm">{ev.description}</span>
                        <span
                          className={`shrink-0 text-sm font-medium tabular-nums ${
                            ev.kind === "receita" ? "text-success" : "text-danger"
                          }`}
                        >
                          {ev.kind === "receita" ? "+" : "−"}
                          {brl(ev.amount)}
                        </span>
                        {ev.actionable && (
                          <Button
                            size="sm"
                            variant={ev.kind === "receita" ? "default" : "outline"}
                            className="ml-auto h-6 shrink-0 rounded-full px-2 text-[11px]"
                            onClick={() =>
                              ev.kind === "receita"
                                ? setReceiveOpen({ id: ev.id, amount: ev.amount, name: ev.description })
                                : setPayOpen({ id: ev.id, amount: ev.amount, name: ev.description })
                            }
                          >
                            {ev.kind === "receita" ? "Receber" : "Pagar"}
                          </Button>
                        )}
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

      {receiveOpen && (
        <ReceiveIncomeDialog
          open={!!receiveOpen}
          onOpenChange={(v) => !v && setReceiveOpen(null)}
          incomeId={receiveOpen.id}
          amount={receiveOpen.amount}
          description={receiveOpen.name}
        />
      )}
      {payOpen && (
        <PayExpenseDialog
          open={!!payOpen}
          onOpenChange={(v) => !v && setPayOpen(null)}
          expenseId={payOpen.id}
          amount={payOpen.amount}
          description={payOpen.name}
        />
      )}
      <AddIncomeDialog open={addIncome} onOpenChange={setAddIncome} />
      <AddExpenseDialog open={addExpense} onOpenChange={setAddExpense} />
    </div>
  );
}
