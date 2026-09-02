import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useIncome, useExpenses, useTransactions, useDeleteEntry, useDeleteAllEntries } from "@/lib/queries";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { brl } from "@/lib/format";
import { AddIncomeDialog } from "@/components/AddIncomeDialog";
import { AddExpenseDialog } from "@/components/AddExpenseDialog";
import { Plus, Trash2, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { OwnerIcon, OWNERS, ownerLabel, type Owner } from "@/components/OwnerBadge";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/lancamentos")({
  head: () => ({
    meta: [
      { title: "Lançamentos — Meu Caixa" },
      { name: "description", content: "Visão completa de todas as entradas e saídas lançadas, com categoria, descrição e valor." },
      { property: "og:title", content: "Lançamentos — Meu Caixa" },
      { property: "og:description", content: "Visão completa de todas as entradas e saídas lançadas, com categoria, descrição e valor." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Lancamentos,
});

type Row = {
  id: string;
  table: "income" | "expenses" | "transactions";
  type: "entrada" | "saida";
  description: string;
  category: string;
  amount: number;
  status: string;
  when: string;
  owner: string;
};

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const CAT_DOT: Record<string, string> = {
  salario: "bg-cat-entrada",
  plantao: "bg-cat-entrada",
  comissao: "bg-cat-economia",
  extra: "bg-cat-diario",
  fixa: "bg-cat-saida",
  variavel: "bg-cat-diario",
  parcelada: "bg-cat-cartao",
  movimentacao: "bg-cat-cartao",
};

type Filter = "todos" | "entrada" | "saida";

function Lancamentos() {
  const { data: income = [] } = useIncome();
  const { data: expenses = [] } = useExpenses();
  const { data: transactions = [] } = useTransactions();
  const del = useDeleteEntry();
  const delAll = useDeleteAllEntries();

  const [filter, setFilter] = useState<Filter>("todos");
  const [ownerFilter, setOwnerFilter] = useState<Owner | "todos">("todos");
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const shift = (n: number) => setCursor(new Date(year, month + n, 1));
  const [q, setQ] = useState("");
  const [addIncome, setAddIncome] = useState(false);
  const [addExpense, setAddExpense] = useState(false);

  const rows = useMemo<Row[]>(() => {
    const inMonth = (iso: string | null) => {
      if (!iso) return false;
      const d = new Date(iso);
      return d.getFullYear() === year && d.getMonth() === month;
    };

    const list: Row[] = [
      ...income
        .filter((i) => i.recurring || inMonth(i.reference_month))
        .map((i) => ({
          id: i.id,
          table: "income" as const,
          type: "entrada" as const,
          description: i.name,
          category: i.kind,
          amount: Number(i.amount),
          status: i.status,
          when: i.reference_month ? String(i.reference_month).slice(0, 7) : "recorrente",
          owner: (i as { owner?: string }).owner ?? "ele",
        })),
      ...expenses.map((e) => ({
        id: e.id,
        table: "expenses" as const,
        type: "saida" as const,
        description: e.name,
        category: e.category,
        amount: Number(e.amount),
        status: e.status,
        when: `dia ${e.due_day}`,
        owner: (e as { owner?: string }).owner ?? "ele",
      })),
      ...transactions
        .filter((t) => t.kind !== "reserva" && inMonth(t.occurred_at as string))
        .map((t) => ({
          id: t.id as string,
          table: "transactions" as const,
          type: (Number(t.amount) >= 0 ? "entrada" : "saida") as "entrada" | "saida",
          description: t.description as string,
          category: "movimentacao",
          amount: Math.abs(Number(t.amount)),
          status: "realizado",
          when: new Date(t.occurred_at as string).toLocaleDateString("pt-BR"),
          owner: (t as { owner?: string }).owner ?? "ele",
        })),
    ];
    const term = q.trim().toLowerCase();
    return list.filter(
      (r) =>
        (filter === "todos" || r.type === filter) &&
        (ownerFilter === "todos" || r.owner === ownerFilter) &&
        (!term || r.description.toLowerCase().includes(term) || r.category.toLowerCase().includes(term)),
    );
  }, [income, expenses, transactions, filter, ownerFilter, q, year, month]);

  const totalIn = rows.filter((r) => r.type === "entrada").reduce((s, r) => s + r.amount, 0);
  const totalOut = rows.filter((r) => r.type === "saida").reduce((s, r) => s + r.amount, 0);

  const remove = (r: Row) =>
    del.mutate(
      { table: r.table, id: r.id },
      { onSuccess: () => toast.success("Lançamento excluído"), onError: (e) => toast.error(e.message) },
    );

  const removeAll = () => {
    if (!confirm("Excluir TODOS os lançamentos (entradas, saídas e movimentações)?")) return;
    delAll.mutate(undefined, {
      onSuccess: () => toast.success("Todos os lançamentos foram excluídos"),
      onError: (e) => toast.error(e.message),
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">Lançamentos</h1>
          <p className="text-sm text-muted-foreground">Tudo o que foi lançado, com categoria e descrição.</p>
        </div>
        <Button variant="ghost" size="sm" className="rounded-full text-danger" onClick={removeAll} disabled={delAll.isPending}>
          <Trash2 className="mr-1 h-4 w-4" /> Limpar tudo
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card className="rounded-2xl p-4 shadow-none">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-cat-entrada" /> Entradas
          </div>
          <div className="mt-1 text-lg font-semibold tabular-nums text-success">{brl(totalIn)}</div>
        </Card>
        <Card className="rounded-2xl p-4 shadow-none">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-cat-saida" /> Saídas
          </div>
          <div className="mt-1 text-lg font-semibold tabular-nums text-danger">{brl(totalOut)}</div>
        </Card>
      </div>

      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
        <Button variant="ghost" size="icon" className="rounded-full" onClick={() => shift(-1)} aria-label="Mês anterior">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="text-center text-base font-semibold tracking-tight">
          {MONTHS[month]}/{String(year).slice(2)}
        </div>
        <Button variant="ghost" size="icon" className="rounded-full" onClick={() => shift(1)} aria-label="Próximo mês">
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-1 rounded-full bg-muted p-1">
        {(["todos", ...OWNERS] as (Owner | "todos")[]).map((o) => (
          <button
            key={o}
            onClick={() => setOwnerFilter(o)}
            className={`flex items-center justify-center gap-1.5 rounded-full py-1.5 text-sm font-medium transition-colors ${
              ownerFilter === o ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            {o !== "todos" && <OwnerIcon owner={o} />}
            {o === "todos" ? "Casal" : ownerLabel(o)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-1 rounded-full bg-muted p-1">
        {(["todos", "entrada", "saida"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full py-2 text-sm font-medium transition-colors ${
              filter === f ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            {f === "todos" ? "Todos" : f === "entrada" ? "Entradas" : "Saídas"}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por descrição ou categoria"
          className="rounded-full pl-9"
        />
      </div>

      <div className="flex gap-2">
        <Button size="sm" className="flex-1 rounded-full" onClick={() => setAddIncome(true)}>
          <Plus className="mr-1 h-4 w-4" /> Entrada
        </Button>
        <Button size="sm" variant="outline" className="flex-1 rounded-full" onClick={() => setAddExpense(true)}>
          <Plus className="mr-1 h-4 w-4" /> Saída
        </Button>
      </div>

      <Card className="overflow-hidden rounded-2xl p-0 shadow-none">
        <ul className="divide-y divide-border">
          {rows.length === 0 && (
            <li className="px-4 py-10 text-center text-sm text-muted-foreground">Nenhum lançamento encontrado.</li>
          )}
          {rows.map((r) => (
            <li key={`${r.table}-${r.id}`} className="flex items-center gap-3 px-4 py-3">
              <OwnerIcon owner={r.owner} />
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${CAT_DOT[r.category] ?? "bg-muted-foreground"}`} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{r.description}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="rounded-full bg-muted px-2 py-0.5 capitalize">{r.category}</span>
                  <span className="capitalize">{r.status}</span>
                  <span>· {r.when}</span>
                </div>
              </div>
              <span
                className={`shrink-0 text-sm font-semibold tabular-nums ${
                  r.type === "entrada" ? "text-success" : "text-danger"
                }`}
              >
                {r.type === "entrada" ? "+" : "−"}
                {brl(r.amount)}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 rounded-full text-muted-foreground hover:text-danger"
                aria-label={`Excluir ${r.description}`}
                onClick={() => remove(r)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      </Card>

      <AddIncomeDialog open={addIncome} onOpenChange={setAddIncome} />
      <AddExpenseDialog open={addExpense} onOpenChange={setAddExpense} />
    </div>
  );
}
