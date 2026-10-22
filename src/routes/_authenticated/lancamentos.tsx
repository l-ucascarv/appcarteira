import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useIncome, useExpenses, useTransactions, useDeleteEntry, useDeleteAllEntries } from "@/lib/queries";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { brl } from "@/lib/format";
import { AddIncomeDialog, type EditableIncome } from "@/components/AddIncomeDialog";
import { AddExpenseDialog, type EditableExpense } from "@/components/AddExpenseDialog";
import { Plus, Pencil, Trash2, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { OwnerIcon, OWNERS, ownerLabel, type Owner } from "@/components/OwnerBadge";
import { toast } from "sonner";
import { repeatsMonthly } from "@/lib/finance";
import { monthlyEntries } from "@/lib/monthly-report";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";

export const Route = createFileRoute("/_authenticated/lancamentos")({
  head: () => ({
    meta: [
      { title: "Adicionar — Lançamentos | Meu Caixa" },
      { name: "description", content: "Lance, edite e exclua suas receitas e despesas." },
      { property: "og:title", content: "Adicionar — Lançamentos | Meu Caixa" },
      { property: "og:description", content: "Lance, edite e exclua suas receitas e despesas." },
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
  day: number;
  paid: boolean;
  recurring: boolean;
  owner: string;
  classification?: "fixa" | "variavel";
  source: EditableIncome | EditableExpense;
};

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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


function Lancamentos() {
  const { data: income = [] } = useIncome();
  const { data: expenses = [] } = useExpenses();
  const del = useDeleteEntry();
  const delAll = useDeleteAllEntries();

  const [ownerFilter, setOwnerFilter] = useState<Owner | "todos">("todos");
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const shift = (n: number) => setCursor(new Date(year, month + n, 1));
  const [editIncome, setEditIncome] = useState<EditableIncome | null>(null);
  const [editExpense, setEditExpense] = useState<EditableExpense | null>(null);
  const [q, setQ] = useState("");
  const [classFilter, setClassFilter] = useState<"todas" | "fixa" | "variavel">("todas");
  const [addIncome, setAddIncome] = useState(false);
  const [addExpense, setAddExpense] = useState(false);

  const { data: transactions = [] } = useTransactions();
  const qc = useQueryClient();
  const [toggling, setToggling] = useState<string | null>(null);
  const rows = useMemo<Row[]>(() => {
    const monthTx = transactions.filter((t) => { const d = new Date(t.occurred_at); return d.getFullYear() === year && d.getMonth() === month; });
    const list: Row[] = monthlyEntries(income, expenses, cursor).map((entry) => {
      const isIncome = entry.type === "receita";
      const src = isIncome ? income.find((i) => i.id === entry.id) : expenses.find((e) => e.id === entry.id);
      const recurring = isIncome ? Boolean((src as { recurring?: boolean })?.recurring) : repeatsMonthly(src as never);
      const paid = monthTx.some((t) => t.reference_id === entry.id && t.kind === entry.type);
      return {
        id: entry.id, table: isIncome ? "income" as const : "expenses" as const, type: isIncome ? "entrada" as const : "saida" as const,
        description: entry.description, category: entry.category, amount: entry.amount,
        status: paid ? (isIncome ? "recebido" : "pago") : (isIncome ? "previsto" : "pendente"),
        when: new Date(year, month, entry.day).toLocaleDateString("pt-BR"), day: entry.day, paid, recurring,
        owner: entry.owner, classification: isIncome ? undefined : (entry.fixed ? "fixa" as const : "variavel" as const),
        source: src as unknown as EditableIncome | EditableExpense,
      };
    }).sort((x, y) => x.day - y.day || x.description.localeCompare(y.description));
    const term = q.trim().toLowerCase();
    return list.filter(
      (r) =>
        (ownerFilter === "todos" || r.owner === ownerFilter) &&
        (classFilter === "todas" || r.classification === classFilter) &&
        (!term ||
          r.description.toLowerCase().includes(term) ||
          r.category.toLowerCase().includes(term) ||
          (r.classification === "fixa" ? "fixa" : r.classification ? "variável variavel" : "").includes(term)),
    );
  }, [income, expenses, transactions, ownerFilter, classFilter, q, year, month, cursor]);

  const totalIn = rows.filter((r) => r.type === "entrada").reduce((s, r) => s + r.amount, 0);
  const totalOut = rows.filter((r) => r.type === "saida").reduce((s, r) => s + r.amount, 0);
  const togglePaid = async (r: Row) => {
    setToggling(`${r.table}-${r.id}`);
    try {
      const kind = r.type === "entrada" ? "receita" : "despesa";
      const start = new Date(year, month, 1).toISOString(); const end = new Date(year, month + 1, 1).toISOString();
      if (r.paid) {
        const { error } = await supabase.from("transactions").delete().eq("reference_id", r.id).eq("kind", kind).gte("occurred_at", start).lt("occurred_at", end);
        if (error) throw error;
      } else {
        const { data: u } = await supabase.auth.getUser();
        if (!u.user) throw new Error("Sem sessão");
        const { error } = await supabase.from("transactions").insert({ user_id: u.user.id, kind, reference_id: r.id, owner: r.owner, description: r.description,
          amount: kind === "receita" ? r.amount : -r.amount, occurred_at: new Date(year, month, r.day, 12).toISOString() });
        if (error) throw error;
      }
      if (!r.recurring) {
        const status = r.paid ? (r.table === "income" ? "previsto" : "pendente") : (r.table === "income" ? "recebido" : "pago");
        const { error } = await supabase.from(r.table).update({ status } as never).eq("id", r.id);
        if (error) throw error;
      }
      toast.success(r.paid ? "Marcado como não pago" : r.type === "entrada" ? "Marcado como recebido" : "Marcado como pago");
      qc.invalidateQueries();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao atualizar"); }
    finally { setToggling(null); }
  };

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
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">Adicionar</h1>
          
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

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nome, categoria ou fixa/variável"
          className="rounded-full pl-9"
        />
      </div>

      <div className="grid grid-cols-3 gap-1 rounded-full bg-muted p-1">
        {([["todas", "Todas"], ["fixa", "Fixas"], ["variavel", "Variáveis"]] as const).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setClassFilter(value)}
            className={`rounded-full py-1.5 text-sm font-medium transition-colors ${classFilter === value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <Button size="sm" className="flex-1 rounded-full" onClick={() => setAddIncome(true)}>
          <Plus className="mr-1 h-4 w-4" /> Entrada
        </Button>
        <Button size="sm" variant="outline" className="flex-1 rounded-full" onClick={() => setAddExpense(true)}>
          <Plus className="mr-1 h-4 w-4" /> Saída
        </Button>
      </div>

      {rows.length === 0 && (
        <Card className="p-10 text-center text-sm text-muted-foreground shadow-none">Nenhum lançamento encontrado.</Card>
      )}
      {rows.length > 0 && (
        <Card className="overflow-hidden p-0 shadow-none">
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li key={`${r.table}-${r.id}`} className={`flex flex-wrap items-center gap-3 px-4 py-3 ${r.paid ? "" : "opacity-80"}`}>
                    <OwnerIcon owner={r.owner} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{r.description}</div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground"><span className="capitalize">{r.when} · {r.category}</span></div>
                      {r.classification && (
                        <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${r.classification === "fixa" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                          {r.classification === "fixa" ? "Fixa" : "Variável"}
                        </span>
                      )}
                    </div>
                    <span className={`shrink-0 text-sm font-semibold tabular-nums ${r.type === "entrada" ? "text-success" : "text-danger"}`}>
                      {r.type === "entrada" ? "+" : "−"}{brl(r.amount)}
                    </span>
                    <Button variant={r.paid ? "secondary" : "outline"} size="sm" className="h-8 shrink-0 rounded-full px-3 text-xs" disabled={toggling === `${r.table}-${r.id}`} onClick={() => togglePaid(r)} aria-label={`${r.paid ? "Desmarcar" : "Marcar"} ${r.description}`}>
                      {r.paid ? <><Check className="mr-1 h-3.5 w-3.5" />{r.type === "entrada" ? "Recebido" : "Pago"}</> : r.type === "entrada" ? "Receber" : "Pagar"}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 rounded-full text-muted-foreground" aria-label={`Editar ${r.description}`} onClick={() => r.table === "income" ? setEditIncome(r.source as EditableIncome) : setEditExpense(r.source as EditableExpense)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 rounded-full text-muted-foreground hover:text-danger" aria-label={`Excluir ${r.description}`} onClick={() => { if (confirm(`Excluir "${r.description}"?`)) remove(r); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <p className="text-xs text-muted-foreground">Lançamentos em ordem de data. Só entram no saldo da conta quando marcados como pago ou recebido.</p>

      <AddIncomeDialog open={addIncome} onOpenChange={setAddIncome} />
      <AddExpenseDialog open={addExpense} onOpenChange={setAddExpense} />
      <AddIncomeDialog open={!!editIncome} entry={editIncome} onOpenChange={(v) => !v && setEditIncome(null)} />
      <AddExpenseDialog open={!!editExpense} entry={editExpense} onOpenChange={(v) => !v && setEditExpense(null)} />
    </div>
  );
}
