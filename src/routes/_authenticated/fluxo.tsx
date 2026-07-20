import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useIncome, useExpenses, useTransactions } from "@/lib/queries";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { brl } from "@/lib/format";
import { ReceiveIncomeDialog } from "@/components/ReceiveIncomeDialog";
import { PayExpenseDialog } from "@/components/PayExpenseDialog";
import { ArrowDownRight, ArrowUpRight, PiggyBank, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/fluxo")({
  head: () => ({ meta: [{ title: "Fluxo de Caixa — Meu Caixa" }] }),
  component: Fluxo,
});

type Filter = "all" | "receita" | "despesa" | "reserva";

function Fluxo() {
  const { data: income = [] } = useIncome();
  const { data: expenses = [] } = useExpenses();
  const { data: transactions = [] } = useTransactions();
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [receiveOpen, setReceiveOpen] = useState<{ id: string; amount: number; name: string } | null>(null);
  const [payOpen, setPayOpen] = useState<{ id: string; amount: number; name: string } | null>(null);

  const items = useMemo(() => {
    const receitasPrevistas = income
      .filter((i) => i.status === "previsto")
      .map((i) => ({
        id: i.id,
        kind: "receita" as const,
        description: i.name,
        amount: Number(i.amount),
        date: i.reference_month ?? new Date().toISOString(),
        status: "previsto" as const,
        balance_after: null as number | null,
        actionable: true,
      }));
    const despesas = expenses.map((e) => ({
      id: e.id,
      kind: "despesa" as const,
      description: e.name,
      amount: -Number(e.amount),
      date: new Date(new Date().getFullYear(), new Date().getMonth(), e.due_day).toISOString(),
      status: e.status,
      balance_after: null as number | null,
      actionable: e.status !== "pago",
    }));
    const txs = transactions.map((t) => ({
      id: t.id,
      kind: t.kind as "receita" | "despesa" | "reserva",
      description: t.description,
      amount: Number(t.amount),
      date: t.occurred_at,
      status: "realizado" as const,
      balance_after: t.balance_after ? Number(t.balance_after) : null,
      actionable: false,
    }));

    let all = [...txs, ...receitasPrevistas, ...despesas];
    if (filter !== "all") all = all.filter((x) => x.kind === filter);
    if (q) all = all.filter((x) => x.description.toLowerCase().includes(q.toLowerCase()));
    return all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [income, expenses, transactions, filter, q]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Fluxo de Caixa</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Linha do tempo completa: receitas, despesas e reservas.
        </p>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Pesquisar..."
            className="pl-9 rounded-xl"
          />
        </div>
        <div className="flex gap-1 overflow-x-auto">
          {(["all", "receita", "despesa", "reserva"] as Filter[]).map((f) => (
            <Button
              key={f}
              variant={filter === f ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f)}
              className="rounded-full capitalize"
            >
              {f === "all" ? "Tudo" : f}
            </Button>
          ))}
        </div>
      </div>

      <Card className="rounded-2xl p-2 shadow-none">
        <ul className="divide-y divide-border">
          {items.length === 0 && (
            <li className="p-6 text-center text-sm text-muted-foreground">Sem movimentações</li>
          )}
          {items.map((it) => {
            const positive = it.amount >= 0;
            const Icon = it.kind === "reserva" ? PiggyBank : positive ? ArrowUpRight : ArrowDownRight;
            const color =
              it.kind === "reserva"
                ? "text-blue-500 bg-blue-500/10"
                : positive
                ? "text-emerald-600 bg-emerald-500/10"
                : "text-rose-600 bg-rose-500/10";
            return (
              <li key={`${it.kind}-${it.id}`} className="flex items-center gap-3 px-3 py-3">
                <div className={`flex h-9 w-9 items-center justify-center rounded-full ${color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{it.description}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(it.date).toLocaleDateString("pt-BR")} • {it.status}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-sm font-semibold tabular-nums ${positive ? "text-emerald-600" : "text-rose-600"}`}>
                    {positive ? "+" : ""}
                    {brl(it.amount)}
                  </div>
                  {it.balance_after !== null && (
                    <div className="text-[10px] text-muted-foreground">saldo {brl(it.balance_after)}</div>
                  )}
                </div>
                {it.actionable && it.kind === "receita" && (
                  <Button
                    size="sm"
                    className="rounded-full ml-2"
                    onClick={() =>
                      setReceiveOpen({ id: it.id, amount: Math.abs(it.amount), name: it.description })
                    }
                  >
                    Receber
                  </Button>
                )}
                {it.actionable && it.kind === "despesa" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full ml-2"
                    onClick={() =>
                      setPayOpen({ id: it.id, amount: Math.abs(it.amount), name: it.description })
                    }
                  >
                    Pagar
                  </Button>
                )}
              </li>
            );
          })}
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
    </div>
  );
}
