import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useIncome, useExpenses, useTransactions, useDeleteEntry, useDeleteAllEntries } from "@/lib/queries";
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
  const [qType, setQType] = useState<"entrada" | "saida">("saida");
  const [qAmount, setQAmount] = useState("");
  const [qName, setQName] = useState("");
  const [qCat, setQCat] = useState("");
  const [qClass, setQClass] = useState<"fixa" | "variavel">("variavel");
  const [qOwner, setQOwner] = useState<Owner>("ele");
  const [qDate, setQDate] = useState(() => new Date().toLocaleDateString("en-CA"));
  const [saving, setSaving] = useState(false);

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

  const today = new Date().toLocaleDateString("en-CA");
  const knownCategories = Array.from(new Set([...income, ...expenses].map((e) => (e as { category_label?: string | null }).category_label).filter(Boolean) as string[])).sort();
  const quickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qAmount || !qName) return;
    setSaving(true);
    try {
      const isIn = qType === "entrada";
      const category = isIn ? "extra" : qClass;
      const { error } = await supabase.rpc("save_financial_entry", {
        p_type: isIn ? "receita" : "despesa", p_name: qName, p_amount: Number(qAmount), p_date: qDate,
        p_category: category, p_label: qCat || category, p_owner: qOwner,
        p_recurring: !isIn && qClass === "fixa", p_realized: false,
      });
      if (error) throw error;
      toast.success(isIn ? "Entrada lançada" : "Saída lançada");
      setQAmount(""); setQName(""); setQCat("");
      qc.invalidateQueries();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Erro ao lançar"); }
    finally { setSaving(false); }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex items-center justify-between rounded-2xl border bg-card p-4 shadow-sm">
        <div>
          <p className="text-xs text-muted-foreground">Lançamentos</p>
          <h1 className="text-xl font-bold capitalize sm:text-2xl">{cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</h1>
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" onClick={() => shift(-1)} aria-label="Mês anterior"><ChevronLeft className="h-4 w-4" /></Button>
          <span className="min-w-[72px] rounded-md bg-muted px-3 py-1.5 text-center text-sm font-semibold">{MONTHS[month]}/{String(year).slice(2)}</span>
          <Button size="sm" variant="outline" onClick={() => shift(1)} aria-label="Próximo mês"><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </header>

      <section className="grid grid-cols-3 gap-3">
        {([["Entradas", totalIn, "text-success"], ["Saídas", totalOut, "text-danger"], ["Saldo do mês", totalIn - totalOut, totalIn - totalOut >= 0 ? "text-success" : "text-danger"]] as const).map(([l, v, c]) => (
          <div key={l} className="rounded-2xl border bg-card p-4 shadow-sm">
            <p className="text-xs text-muted-foreground">{l}</p>
            <p className={`mt-1 text-base font-bold tabular-nums sm:text-lg ${c}`}>{brl(v)}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border bg-card p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Novo lançamento</h2>
        <form onSubmit={quickAdd} className="grid gap-3 sm:grid-cols-6">
          <div className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1 sm:col-span-2">
            {(["saida", "entrada"] as const).map((t) => (
              <button key={t} type="button" onClick={() => setQType(t)} className={`rounded-sm py-1.5 text-sm font-medium transition-colors ${qType === t ? (t === "entrada" ? "bg-background text-success shadow-sm" : "bg-background text-danger shadow-sm") : "text-muted-foreground"}`}>
                {t === "entrada" ? "Entrada" : "Saída"}
              </button>
            ))}
          </div>
          <Input aria-label="Valor" type="number" step="0.01" min="0.01" placeholder="Valor (R$)" value={qAmount} onChange={(e) => setQAmount(e.target.value)} required className="sm:col-span-2" />
          <Input aria-label="Data" type="date" value={qDate} onChange={(e) => setQDate(e.target.value)} required className="sm:col-span-2" />
          <Input aria-label="Descrição" maxLength={200} placeholder="Descrição" value={qName} onChange={(e) => setQName(e.target.value)} required className="sm:col-span-3" />
          <Input aria-label="Categoria" list="known-categories" maxLength={80} placeholder="Categoria (ex.: Mercado)" value={qCat} onChange={(e) => setQCat(e.target.value)} className="sm:col-span-3" />
          <datalist id="known-categories">{knownCategories.map((c) => <option key={c} value={c} />)}</datalist>
          {qType === "saida" && (
            <div className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1 sm:col-span-2">
              {(["variavel", "fixa"] as const).map((c) => (
                <button key={c} type="button" onClick={() => setQClass(c)} className={`rounded-sm py-1.5 text-sm font-medium ${qClass === c ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}>{c === "fixa" ? "Fixa" : "Variável"}</button>
              ))}
            </div>
          )}
          <div className={`grid grid-cols-2 gap-1 rounded-md bg-muted p-1 ${qType === "saida" ? "sm:col-span-2" : "sm:col-span-3"}`}>
            {OWNERS.map((o) => (
              <button key={o} type="button" onClick={() => setQOwner(o)} className={`flex items-center justify-center gap-1.5 rounded-sm py-1.5 text-sm font-medium ${qOwner === o ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}><OwnerIcon owner={o} />{ownerLabel(o)}</button>
            ))}
          </div>
          <Button type="submit" disabled={saving} className={qType === "saida" ? "sm:col-span-2" : "sm:col-span-3"}><Plus className="mr-1 h-4 w-4" />{saving ? "Salvando..." : "Adicionar"}</Button>
        </form>
        <div className="mt-3 flex gap-3 text-xs text-muted-foreground">
          <button type="button" className="underline-offset-2 hover:underline" onClick={() => (qType === "entrada" ? setAddIncome(true) : setAddExpense(true))}>Mais opções (parcelas, foto, IA)</button>
          <span>· {qDate > today ? "Futuro" : "Pendente"} até marcar como pago</span>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Lançamentos do mês</h2>
          <Button variant="ghost" size="sm" className="text-danger" onClick={removeAll} disabled={delAll.isPending}><Trash2 className="mr-1 h-4 w-4" /> Limpar tudo</Button>
        </div>
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar nome, categoria, fixa/variável" className="pl-9" />
          </div>
          <select aria-label="Quem lançou" value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value as Owner | "todos")} className="h-10 rounded-md border bg-background px-3 text-sm">
            <option value="todos">Casal</option>
            {OWNERS.map((o) => <option key={o} value={o}>{ownerLabel(o)}</option>)}
          </select>
          <select aria-label="Classificação" value={classFilter} onChange={(e) => setClassFilter(e.target.value as typeof classFilter)} className="h-10 rounded-md border bg-background px-3 text-sm">
            <option value="todas">Todas</option><option value="fixa">Fixas</option><option value="variavel">Variáveis</option>
          </select>
        </div>

      {rows.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">Nenhum lançamento encontrado.</p>
      )}
      {rows.length > 0 && (
        <div className="overflow-hidden rounded-xl border">
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li key={`${r.table}-${r.id}`} className={`flex flex-wrap items-center gap-3 px-4 py-3 ${r.paid ? "" : "opacity-80"}`}>
                    <OwnerIcon owner={r.owner} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{r.description}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground"><span>{r.when}</span><span className="rounded-md bg-muted px-1.5 py-0.5 font-medium capitalize text-foreground">{r.category}</span>
                      {r.classification && (
                        <span className={`inline-block rounded-md px-1.5 py-0.5 text-[10px] font-medium ${r.classification === "fixa" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                          {r.classification === "fixa" ? "Fixa" : "Variável"}
                        </span>
                      )}</div>
                    </div>
                    <span className={`shrink-0 font-mono text-sm font-semibold tabular-nums ${r.type === "entrada" ? "text-success" : "text-danger"}`}>
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
        </div>
      )}
      <p className="text-xs text-muted-foreground">Em ordem de data. Só entram no saldo da conta quando marcados como pago ou recebido.</p>
      </section>

      <AddIncomeDialog open={addIncome} onOpenChange={setAddIncome} />
      <AddExpenseDialog open={addExpense} onOpenChange={setAddExpense} />
      <AddIncomeDialog open={!!editIncome} entry={editIncome} onOpenChange={(v) => !v && setEditIncome(null)} />
      <AddExpenseDialog open={!!editExpense} entry={editExpense} onOpenChange={(v) => !v && setEditExpense(null)} />
    </div>
  );
}
