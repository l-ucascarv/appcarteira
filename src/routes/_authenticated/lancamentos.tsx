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
import { monthlyEntries, realizedDailyBalances, realizedOpeningBalance, entryChronology, compareEntryChronology } from "@/lib/monthly-report";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { EntryAiTools } from "@/components/EntryAiTools";
import { quickEntrySchedule, type EntryClassification } from "@/lib/quick-entry";

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
  timestamp: number;
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
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [classFilter, setClassFilter] = useState<"todas" | "fixa" | "variavel">("todas");
  const [addIncome, setAddIncome] = useState(false);
  const [addExpense, setAddExpense] = useState(false);
  const [qType, setQType] = useState<"entrada" | "saida">("saida");
  const [qAmount, setQAmount] = useState("");
  const [qName, setQName] = useState("");
  const [qCat, setQCat] = useState("");
  const [qClass, setQClass] = useState<EntryClassification | null>(null);
  const [qInstallments, setQInstallments] = useState("");
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
      const movement = monthTx.find((t) => t.reference_id === entry.id && t.kind === entry.type);
      const paid = Boolean(movement);
      const recordedAt = movement?.occurred_at ?? (src as { created_at?: string } | undefined)?.created_at;
      return {
        id: entry.id, table: isIncome ? "income" as const : "expenses" as const, type: isIncome ? "entrada" as const : "saida" as const,
        description: entry.description, category: entry.category, amount: entry.amount,
        status: paid ? (isIncome ? "recebido" : "pago") : (isIncome ? "previsto" : "pendente"),
        when: new Date(year, month, entry.day).toLocaleDateString("pt-BR"), day: entry.day, paid, recurring,
        timestamp: entryChronology(cursor, entry.day, recordedAt),
        owner: entry.owner, classification: isIncome ? undefined : (entry.fixed ? "fixa" as const : "variavel" as const),
        source: src as unknown as EditableIncome | EditableExpense,
      };
    }).sort((x, y) => compareEntryChronology(x, y, sortOrder));
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
  }, [income, expenses, transactions, ownerFilter, classFilter, q, sortOrder, year, month, cursor]);

  const totalIn = rows.filter((r) => r.type === "entrada").reduce((s, r) => s + r.amount, 0);
  const totalOut = rows.filter((r) => r.type === "saida").reduce((s, r) => s + r.amount, 0);
  const dailyBalances = useMemo(() => realizedDailyBalances(transactions, cursor), [transactions, cursor]);
  const days = Array.from(new Set(rows.map((row) => row.day)));
  const openingBalance = realizedOpeningBalance(transactions, cursor);
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
    if (!qClass) { toast.error("Selecione Fixa ou Variável."); return; }
    setSaving(true);
    try {
      const isIn = qType === "entrada";
      const schedule = quickEntrySchedule(qType, qClass, qInstallments);
      const { error } = await supabase.rpc("save_financial_entry", {
        p_type: isIn ? "receita" : "despesa", p_name: qName, p_amount: Number(qAmount), p_date: qDate,
        ...schedule, p_label: qCat || (isIn ? "Receita" : qClass), p_owner: qOwner,
      });
      if (error) throw error;
      toast.success(isIn ? "Entrada lançada" : "Saída lançada");
      setQAmount(""); setQName(""); setQCat(""); setQInstallments(""); setQClass(null);
      qc.invalidateQueries();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Erro ao lançar"); }
    finally { setSaving(false); }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-border pb-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Lançamentos</p>
          <h1 className="break-words text-lg font-semibold first-letter:uppercase sm:text-2xl">{cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</h1>
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" onClick={() => shift(-1)} aria-label="Mês anterior"><ChevronLeft className="h-4 w-4" /></Button>
          <span className="min-w-14 rounded-md bg-muted px-1.5 py-1.5 text-center text-xs font-semibold sm:px-3 sm:text-sm">{MONTHS[month]}/{String(year).slice(2)}</span>
          <Button size="sm" variant="outline" onClick={() => shift(1)} aria-label="Próximo mês"><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border pb-3">
        <div className="min-w-0"><p className="text-sm font-medium">Saldo anterior ao mês</p><p className="text-xs text-muted-foreground">Saldo realizado acumulado até o mês anterior</p></div>
        <span className={`text-sm font-semibold tabular-nums ${openingBalance >= 0 ? "text-success" : "text-danger"}`}>{brl(openingBalance)}</span>
      </div>

      <section className="grid grid-cols-3 gap-2 sm:gap-3">
        {([["Entradas", totalIn, "text-success"], ["Saídas", totalOut, "text-danger"], ["Saldo do mês", totalIn - totalOut, totalIn - totalOut >= 0 ? "text-success" : "text-danger"]] as const).map(([l, v, c]) => (
          <div key={l} className="min-w-0 rounded-lg border bg-card p-2.5 sm:p-4">
            <p className="text-xs text-muted-foreground">{l}</p>
            <p className={`mt-1 break-words text-sm font-semibold tabular-nums sm:text-lg ${c}`}>{brl(v)}</p>
          </div>
        ))}
      </section>

      <section className="border-b border-border pb-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="pt-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Novo lançamento</h2>
          <div className="max-w-[180px]">
            <EntryAiTools photoOnly type={qType === "entrada" ? "receita" : "despesa"} description={qName} amount={qAmount} onSuggestion={(suggestion) => {
              setQName(suggestion.description); setQAmount(suggestion.amount !== null ? String(suggestion.amount) : "");
              setQCat(suggestion.category); setQDate(suggestion.date ?? "");
            }} />
          </div>
        </div>
        <form onSubmit={quickAdd} className="grid gap-3 sm:grid-cols-6">
          <div className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1 sm:col-span-2">
            {(["saida", "entrada"] as const).map((t) => (
              <Button key={t} type="button" variant="ghost" aria-pressed={qType === t} onClick={() => { if (qType !== t) { setQType(t); setQClass(null); setQInstallments(""); } }} className={`rounded-sm py-1.5 text-sm font-medium transition-colors ${qType === t ? (t === "entrada" ? "bg-background text-success shadow-sm" : "bg-background text-danger shadow-sm") : "text-muted-foreground"}`}>
                {t === "entrada" ? "Entrada" : "Saída"}
              </Button>
            ))}
          </div>
          <Input aria-label="Valor" type="number" step="0.01" min="0.01" placeholder={qType === "saida" && qClass === "variavel" && Number(qInstallments) > 1 ? "Valor da parcela (R$)" : "Valor (R$)"} value={qAmount} onChange={(e) => setQAmount(e.target.value)} required className="sm:col-span-2" />
          <Input aria-label="Data" type="date" value={qDate} onChange={(e) => setQDate(e.target.value)} required className="sm:col-span-2" />
          <Input aria-label="Descrição" maxLength={200} placeholder="Descrição" value={qName} onChange={(e) => setQName(e.target.value)} required className="sm:col-span-3" />
          <Input aria-label="Categoria" list="known-categories" maxLength={80} placeholder="Categoria (ex.: Mercado)" value={qCat} onChange={(e) => setQCat(e.target.value)} className="sm:col-span-3" />
          <datalist id="known-categories">{knownCategories.map((c) => <option key={c} value={c} />)}</datalist>
          <fieldset className="space-y-2 sm:col-span-6">
            <legend className="text-sm font-medium">{qType === "saida" ? "A despesa é fixa ou variável?" : "A receita é fixa ou variável?"}</legend>
            <div className="grid max-w-sm grid-cols-2 gap-1 rounded-md bg-muted p-1">
              {(["variavel", "fixa"] as const).map((c) => (
                <Button key={c} type="button" variant="ghost" aria-pressed={qClass === c} onClick={() => setQClass(c)} className={`rounded-sm py-1.5 text-sm font-medium ${qClass === c ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}>{c === "fixa" ? "Fixa" : "Variável"}</Button>
              ))}
            </div>
          </fieldset>
          {qType === "saida" && qClass === "variavel" && (
            <div className="space-y-1.5 sm:col-span-6">
              <label htmlFor="quick-installments" className="text-sm font-medium">Quantidade de parcelas</label>
              <Input id="quick-installments" type="number" min="1" step="1" placeholder="1 (à vista)" value={qInstallments} onChange={(e) => setQInstallments(e.target.value)} className="max-w-sm" />
              {Number(qInstallments) > 1 && <p className="text-xs text-muted-foreground">{qInstallments} × {brl(Number(qAmount) || 0)} · Total {brl((Number(qAmount) || 0) * Number(qInstallments))}</p>}
            </div>
          )}
          <div className={`grid grid-cols-2 gap-1 rounded-md bg-muted p-1 ${qType === "saida" ? "sm:col-span-2" : "sm:col-span-3"}`}>
            {OWNERS.map((o) => (
              <Button key={o} type="button" variant="ghost" aria-pressed={qOwner === o} onClick={() => setQOwner(o)} className={`flex items-center justify-center gap-1.5 rounded-sm py-1.5 text-sm font-medium ${qOwner === o ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}><OwnerIcon owner={o} />{ownerLabel(o)}</Button>
            ))}
          </div>
          <Button type="submit" disabled={saving || !qClass} className={qType === "saida" ? "sm:col-span-2" : "sm:col-span-3"}><Plus className="mr-1 h-4 w-4" />{saving ? "Salvando..." : "Adicionar"}</Button>
        </form>
        <div className="mt-3 flex gap-3 text-xs text-muted-foreground">
          <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => (qType === "entrada" ? setAddIncome(true) : setAddExpense(true))}>Mais opções</Button>
          <span>· {qDate > today ? "Futuro" : "Pendente"} até marcar como pago</span>
        </div>
      </section>

      <section className="space-y-3">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Extrato do mês</h2>
          <Button variant="ghost" size="sm" className="text-danger" onClick={removeAll} disabled={delAll.isPending}><Trash2 className="mr-1 h-4 w-4" /> Limpar tudo</Button>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
          <div className="relative col-span-2 sm:col-span-1">
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
          <select aria-label="Ordem dos lançamentos" value={sortOrder} onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")} className="col-span-2 h-10 rounded-md border bg-background px-3 text-sm sm:col-span-1">
            <option value="asc">Data crescente · antigos primeiro</option>
            <option value="desc">Data decrescente · recentes primeiro</option>
          </select>
        </div>

      {rows.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">Nenhum lançamento encontrado.</p>
      )}
      {rows.length > 0 && (
        <div className="divide-y divide-border border-y border-border">
          {days.map((day) => {
            const balance = dailyBalances.find((item) => item.day === day)?.balance ?? 0;
            return <section key={day} aria-label={`Lançamentos do dia ${day}`} className="py-4">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 pb-3">
                <h3 className="text-sm font-semibold">{new Date(year, month, day).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</h3>
                <div className="text-right"><span className="block text-[11px] text-muted-foreground">Saldo do dia</span><span className={`text-sm font-semibold tabular-nums ${balance >= 0 ? "text-success" : "text-danger"}`}>{brl(balance)}</span></div>
              </div>
              <div className="hidden grid-cols-[minmax(0,1fr)_7rem_7rem_10rem] gap-4 border-b border-border pb-2 text-xs text-muted-foreground md:grid">
                <span>Lançamento</span><span className="text-right">Receitas</span><span className="text-right">Despesas</span><span className="text-right">Situação / ações</span>
              </div>
              <ul className="divide-y divide-border">
                {rows.filter((row) => row.day === day).map((r) => <li key={`${r.table}-${r.id}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2 py-3 md:grid-cols-[minmax(0,1fr)_7rem_7rem_10rem] md:gap-4">
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-start gap-1.5"><OwnerIcon owner={r.owner} /><span className="min-w-0 break-words text-sm font-medium">{r.description}</span></div>
                    <p className="mt-1 break-words text-xs text-muted-foreground">{r.category}{r.classification ? ` · ${r.classification === "fixa" ? "Fixa" : "Variável"}` : " · Receita"}</p>
                  </div>
                  <div className={`text-right text-sm font-semibold tabular-nums md:row-start-1 ${r.type === "entrada" ? "text-success md:col-start-2" : "text-danger md:col-start-3"}`}>
                    <span className="mb-0.5 block text-[10px] font-normal md:hidden">{r.type === "entrada" ? "Receita" : "Despesa"}</span>
                    {r.type === "entrada" ? "+" : "−"} {brl(r.amount)}
                  </div>
                  <div className="col-span-2 flex items-center justify-end gap-1 md:col-span-1 md:col-start-4 md:row-start-1">
                    <Button variant={r.paid ? "secondary" : "outline"} size="sm" className="h-8 px-2 text-xs" disabled={toggling === `${r.table}-${r.id}`} onClick={() => togglePaid(r)} aria-label={`${r.paid ? "Desmarcar" : "Marcar"} ${r.description}`}>
                      {r.paid ? <><Check className="mr-1 h-3.5 w-3.5" />{r.type === "entrada" ? "Recebido" : "Pago"}</> : r.type === "entrada" ? "Receber" : "Pagar"}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" title="Editar lançamento" aria-label={`Editar ${r.description}`} onClick={() => r.table === "income" ? setEditIncome(r.source as EditableIncome) : setEditExpense(r.source as EditableExpense)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-danger" title="Excluir lançamento" aria-label={`Excluir ${r.description}`} onClick={() => { if (confirm(`Excluir "${r.description}"?`)) remove(r); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </li>)}
              </ul>
            </section>;
          })}
        </div>
      )}
      <p className="text-xs text-muted-foreground">Só entram no saldo da conta quando marcados como pago ou recebido.</p>
      </section>

      <AddIncomeDialog open={addIncome} onOpenChange={setAddIncome} />
      <AddExpenseDialog open={addExpense} onOpenChange={setAddExpense} />
      <AddIncomeDialog open={!!editIncome} entry={editIncome} onOpenChange={(v) => !v && setEditIncome(null)} />
      <AddExpenseDialog open={!!editExpense} entry={editExpense} onOpenChange={(v) => !v && setEditExpense(null)} />
    </div>
  );
}
