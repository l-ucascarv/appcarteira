import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useMemo, useRef, useState } from "react";
import { useIncome, useExpenses, useTransactions, useDeleteEntry, useDeleteAllEntries } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Chip, ChipRow } from "@/components/ui/chip";
import { brl } from "@/lib/format";
import type { EditableIncome } from "@/components/AddIncomeDialog";
import type { EditableExpense } from "@/components/AddExpenseDialog";
import { Plus, Pencil, Trash2, Search, ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react";
import { OwnerIcon, OWNERS, ownerLabel, type Owner } from "@/components/OwnerBadge";
import { toast } from "sonner";
import { repeatsMonthly } from "@/lib/finance";
import { monthlyEntries, realizedDailyBalances, realizedOpeningBalance, entryChronology, compareEntryChronology } from "@/lib/monthly-report";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { EntryAiTools } from "@/components/EntryAiTools";
import { quickEntrySchedule, type EntryClassification } from "@/lib/quick-entry";
import { useFamilyOverview } from "@/lib/family";

const AddIncomeDialog = lazy(() => import("@/components/AddIncomeDialog").then((module) => ({ default: module.AddIncomeDialog })));
const AddExpenseDialog = lazy(() => import("@/components/AddExpenseDialog").then((module) => ({ default: module.AddExpenseDialog })));

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
  user_id: string;
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


export function Lancamentos({ mode = "statement" }: { mode?: "statement" | "add" }) {
  const { data: income = [] } = useIncome();
  const { data: expenses = [] } = useExpenses();
  const del = useDeleteEntry();
  const delAll = useDeleteAllEntries();

  const [memberFilter, setMemberFilter] = useState<string>("todos");
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
  const [activityFilter, setActivityFilter] = useState<"todos" | "despesa" | "receita" | "recorrente">("todos");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [advancedFilters, setAdvancedFilters] = useState(false);
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
  const [qPending, setQPending] = useState(false);
  const [saving, setSaving] = useState(false);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const [showQuickCategories, setShowQuickCategories] = useState(false);
  const [showAddOptions, setShowAddOptions] = useState(false);

  const { data: transactions = [] } = useTransactions();
  const { data: family } = useFamilyOverview();
  const qc = useQueryClient();
  const [toggling, setToggling] = useState<string | null>(null);
  const rows = useMemo<Row[]>(() => {
    const monthTx = transactions.filter((t) => { const d = new Date(t.occurred_at); return d.getFullYear() === year && d.getMonth() === month; });
    const incomeById = new Map(income.map((entry) => [entry.id, entry]));
    const expenseById = new Map(expenses.map((entry) => [entry.id, entry]));
    const movementByEntry = new Map<string, typeof monthTx[number]>();
    for (const movement of monthTx) {
      const key = `${movement.kind}-${movement.reference_id}`;
      if (!movementByEntry.has(key)) movementByEntry.set(key, movement);
    }
    const list: Row[] = monthlyEntries(income, expenses, cursor).map((entry) => {
      const isIncome = entry.type === "receita";
      const src = isIncome ? incomeById.get(entry.id) : expenseById.get(entry.id);
      const recurring = isIncome ? Boolean((src as { recurring?: boolean })?.recurring) : repeatsMonthly(src as never);
      const movement = movementByEntry.get(`${entry.type}-${entry.id}`);
      const paid = Boolean(movement);
      const recordedAt = movement?.occurred_at ?? (src as { created_at?: string } | undefined)?.created_at;
      return {
        id: entry.id, table: isIncome ? "income" as const : "expenses" as const, type: isIncome ? "entrada" as const : "saida" as const,
        description: entry.description, category: entry.category, amount: entry.amount,
        status: paid ? (isIncome ? "recebido" : "pago") : (isIncome ? "previsto" : "pendente"),
        when: new Date(year, month, entry.day).toLocaleDateString("pt-BR"), day: entry.day, paid, recurring,
        timestamp: entryChronology(cursor, entry.day, recordedAt),
        owner: entry.owner, user_id: entry.user_id, classification: isIncome ? undefined : (entry.fixed ? "fixa" as const : "variavel" as const),
        source: src as unknown as EditableIncome | EditableExpense,
      };
    }).sort((x, y) => compareEntryChronology(x, y, sortOrder));
    const term = q.trim().toLowerCase();
    return list.filter(
      (r) =>
        (memberFilter === "todos" || r.user_id === memberFilter) &&
        (classFilter === "todas" || r.classification === classFilter) &&
        (!term ||
          r.description.toLowerCase().includes(term) ||
          r.category.toLowerCase().includes(term) ||
          (r.classification === "fixa" ? "fixa" : r.classification ? "variável variavel" : "").includes(term)),
    );
  }, [income, expenses, transactions, memberFilter, classFilter, q, sortOrder, year, month, cursor]);

  const activityRows = rows.filter((row) => activityFilter === "todos" || (activityFilter === "recorrente" ? row.recurring : activityFilter === "receita" ? row.type === "entrada" : row.type === "saida"));
  const totalIn = rows.filter((r) => r.type === "entrada").reduce((s, r) => s + r.amount, 0);
  const totalOut = rows.filter((r) => r.type === "saida").reduce((s, r) => s + r.amount, 0);
  const dailyBalances = useMemo(() => realizedDailyBalances(transactions, cursor), [transactions, cursor]);
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
      const schedule = quickEntrySchedule(qType, qClass, qInstallments, !qPending && qDate <= today);
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

  const renderGroup = (title: string, subtitle: string, group: Row[], showBalance: boolean) => {
    const groupDays = Array.from(new Set(group.map((row) => row.day)));
    return (
      <div className="statement-group space-y-3">
        <div>
          <h3 className="text-base font-bold">{title}</h3>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        {groupDays.length === 0 && <p className="py-3 text-sm text-muted-foreground">Nenhum lançamento neste grupo.</p>}
        {groupDays.length > 0 && (
          <div className="divide-y divide-border border-y border-border">
            {groupDays.map((day) => {
              const balance = dailyBalances.find((item) => item.day === day)?.balance ?? 0;
              return <section key={day} aria-label={`Lançamentos do dia ${day}`} className="py-4">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 pb-3">
                  <div><h4 className="text-sm font-semibold">{new Date(year, month, day).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</h4></div>
                  {showBalance && <div className="text-right"><span className="block text-[11px] text-muted-foreground">Saldo do dia</span><span className={`text-sm font-semibold tabular-nums ${balance >= 0 ? "text-success" : "text-danger"}`}>{brl(balance)}</span></div>}
                </div>
                <div className="hidden grid-cols-[minmax(0,1fr)_7rem_7rem_10rem] gap-4 border-b border-border pb-2 text-xs text-muted-foreground md:grid">
                  <span>Lançamento</span><span className="text-right">Receitas</span><span className="text-right">Despesas</span><span className="text-right">Situação / ações</span>
                </div>
                <ul className="divide-y divide-border">
                  {group.filter((row) => row.day === day).map((r) => <li key={`${r.table}-${r.id}`} className="statement-row grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2 py-3 md:grid-cols-[minmax(0,1fr)_7rem_7rem_10rem] md:gap-4">
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
      </div>
    );
  };

  return (
    <div className={`entries-view mx-auto max-w-5xl space-y-6 ${mode === "add" ? "add-entry-view" : "statement-view"}`}>
      {mode === "statement" && <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-border pb-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Lançamentos</p>
          <h1 className="break-words text-xl font-bold first-letter:uppercase sm:text-2xl">{cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</h1>
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" onClick={() => shift(-1)} aria-label="Mês anterior"><ChevronLeft className="h-4 w-4" /></Button>
          <span className="min-w-14 rounded-full bg-card px-3 py-2 text-center text-xs font-bold sm:text-sm">{MONTHS[month]}/{String(year).slice(2)}</span>
          <Button size="sm" variant="outline" onClick={() => shift(1)} aria-label="Próximo mês"><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </header>}

      {mode === "statement" && <>
        <section aria-label="Resumo do mês" className="rounded-2xl bg-card p-3.5 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-3 text-xs">
            <span className="text-muted-foreground">💰 Saldo anterior</span>
            <strong className={`tabular-nums ${openingBalance>=0?"text-success":"text-danger"}`}>{brl(openingBalance)}</strong>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {([["↗ Entradas",totalIn,"text-success"],["↘ Saídas",totalOut,"text-danger"],["💵 Saldo",totalIn-totalOut,totalIn-totalOut>=0?"text-success":"text-danger"]] as const).map(([label,value,color])=>(
              <div key={label} className="min-w-0 rounded-xl bg-muted/35 px-2 py-3">
                <p className="text-[11px] text-muted-foreground">{label}</p>
                <p className={`mt-1 break-words text-[clamp(11px,3vw,16px)] font-semibold tabular-nums ${color}`}>{brl(value)}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="space-y-3" aria-label="Filtros do extrato">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-bold">📋 Extrato</h2>
            <Button variant="ghost" size="sm" aria-expanded={advancedFilters} aria-controls="advanced-statement-filters" onClick={()=>setAdvancedFilters(v=>!v)}><SlidersHorizontal className="mr-1.5 h-4 w-4"/>Filtros {advancedFilters?"−":"+"}</Button>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/>
            <Input value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar lançamento..." aria-label="Buscar lançamentos" className="h-11 rounded-xl pl-10"/>
          </div>
          <ChipRow label="Tipo de movimentação" className="statement-primary-filters">
            {([{value:"todos",label:"Todos"},{value:"despesa",label:"↘ Despesas"},{value:"receita",label:"↗ Receitas"},{value:"recorrente",label:"🔁 Fixos"}] as const).map(item=><Chip key={item.value} selected={activityFilter===item.value} onClick={()=>setActivityFilter(item.value)}>{item.label}</Chip>)}
          </ChipRow>
          {advancedFilters && <div id="advanced-statement-filters" className="space-y-3 rounded-2xl border border-border bg-card p-3">
            <label className="block space-y-1 text-xs text-muted-foreground">Pessoa
              <select value={memberFilter} onChange={e=>setMemberFilter(e.target.value)} className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground">
                <option value="todos">Toda a família</option>
                {(family?.members??[]).map(m=><option key={m.user_id} value={m.user_id}>{m.name}</option>)}
              </select>
            </label>
            <div className="space-y-1"><p className="text-xs text-muted-foreground">Classificação</p>
              <ChipRow label="Classificação">{([["todas","Todas"],["fixa","Fixas"],["variavel","Variáveis"]] as const).map(([value,label])=><Chip key={value} selected={classFilter===value} onClick={()=>setClassFilter(value)}>{label}</Chip>)}</ChipRow>
            </div>
            <label className="block space-y-1 text-xs text-muted-foreground">Ordenar
              <select value={sortOrder} onChange={e=>setSortOrder(e.target.value as "asc"|"desc")} className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground">
                <option value="desc">Mais recentes primeiro</option>
                <option value="asc">Mais antigos primeiro</option>
              </select>
            </label>
            <div className="border-t border-border pt-2"><Button variant="ghost" size="sm" className="text-danger" onClick={removeAll} disabled={delAll.isPending}><Trash2 className="mr-2 h-4 w-4"/>Limpar todos os lançamentos</Button></div>
          </div>}
        </section>
      </>}

      {mode === "add" && <section id="novo-lancamento" className="quick-entry add-entry-panel rounded-[24px] border border-border/70 bg-card p-4 shadow-[0_10px_35px_rgba(0,0,0,0.14)] sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div><h1 className="text-lg font-bold">✍️ Novo lançamento</h1><p className="mt-1 text-xs text-muted-foreground">Preencha os dados essenciais</p></div>
          <EntryAiTools photoOnly type={qType==="entrada"?"receita":"despesa"} description={qName} amount={qAmount} onSuggestion={suggestion=>{setQName(suggestion.description);setQAmount(suggestion.amount!==null?String(suggestion.amount):"");setQCat(suggestion.category);setQDate(suggestion.date??qDate);}}/>
        </div>
        <form onSubmit={quickAdd} className="space-y-4">
          <Segmented label="Tipo de lançamento" value={qType} onChange={t=>{if(qType!==t){setQType(t);setQClass(null);setQInstallments("");}}} options={[{value:"saida",label:"↘ Despesa",tone:"danger"},{value:"entrada",label:"↗ Receita",tone:"success"}]}/>
          <div className="rounded-2xl bg-muted/40 px-4 py-4">
            <label htmlFor="quick-amount" className="mb-1 block text-xs text-muted-foreground">💰 Valor (R$)</label>
            <Input id="quick-amount" aria-label="Valor" type="number" inputMode="decimal" step="0.01" min="0.01" placeholder="0,00" value={qAmount} onChange={e=>setQAmount(e.target.value)} required className="quick-amount h-14 border-0 bg-transparent px-0 text-3xl font-semibold shadow-none focus-visible:ring-0"/>
          </div>
          <div className="space-y-3">
            <div><label htmlFor="quick-description" className="mb-1.5 block text-xs font-medium">📝 Descrição</label><Input id="quick-description" maxLength={200} placeholder="Ex.: Mercado, salário..." value={qName} onChange={e=>setQName(e.target.value)} required className="h-12 rounded-xl"/></div>
            <div><label htmlFor="quick-category" className="mb-1.5 block text-xs font-medium">🏷️ Categoria</label><Input id="quick-category" list="known-categories" maxLength={80} placeholder="Ex.: Alimentação" value={qCat} onChange={e=>setQCat(e.target.value)} className="h-12 rounded-xl"/><datalist id="known-categories">{knownCategories.map(c=><option key={c} value={c}/>)}</datalist></div>
            <button type="button" className="text-xs font-medium text-primary" aria-expanded={showQuickCategories} onClick={()=>setShowQuickCategories(v=>!v)}>{showQuickCategories?"Ocultar categorias":"🏷️ Categorias rápidas +"}</button>
            {showQuickCategories && <ChipRow label="Categorias rápidas">{(knownCategories.length?knownCategories.slice(0,6):["Mercado","Transporte","Moradia","Saúde","Lazer","Outros"]).map(category=><Chip key={category} selected={qCat===category} onClick={()=>setQCat(category)}>{category}</Chip>)}</ChipRow>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="min-w-0"><label htmlFor="quick-date" className="mb-1.5 block text-xs font-medium">📅 Data</label><div className="relative"><Input ref={dateInputRef} id="quick-date" aria-label="Data" type="date" value={qDate} onChange={e=>setQDate(e.target.value)} required lang="pt-BR" className="h-12 w-full min-w-0 rounded-xl pr-2 text-sm" onClick={()=>{try{dateInputRef.current?.showPicker?.();}catch{/* O Safari abre seu seletor nativo ao tocar no campo. */}}}/></div></div>
            <fieldset className="min-w-0"><legend className="mb-1.5 text-xs font-medium">🔁 Frequência</legend><Segmented label="Fixa ou variável" value={qClass} onChange={setQClass} options={[{value:"variavel",label:"Variável"},{value:"fixa",label:"Fixa"}]}/></fieldset>
          </div>
          <button type="button" className="flex w-full items-center justify-between rounded-xl border border-border/70 bg-muted/30 px-3 py-3 text-sm font-medium" aria-expanded={showAddOptions} onClick={()=>setShowAddOptions(v=>!v)}><span>⚙️ Mais opções</span><span className="text-muted-foreground">{showAddOptions?"−":"+"}</span></button>
          {showAddOptions && <div className="space-y-4 rounded-xl border border-border/60 bg-muted/20 p-3">
            <div className="space-y-2"><p className="text-xs font-medium">👤 De quem é?</p><Segmented label="De quem é o lançamento" value={qOwner} onChange={setQOwner} options={OWNERS.map(o=>({value:o,label:<><OwnerIcon owner={o}/>{ownerLabel(o)}</>}))}/></div>
            {qType==="saida"&&qClass==="variavel"&&<div className="space-y-1"><label htmlFor="quick-installments" className="text-xs font-medium">Parcelas</label><Input id="quick-installments" type="number" min="1" step="1" placeholder="1 (à vista)" value={qInstallments} onChange={e=>setQInstallments(e.target.value)}/>{Number(qInstallments)>1&&<p className="text-xs text-muted-foreground">{qInstallments} × {brl(Number(qAmount)||0)} · Total {brl((Number(qAmount)||0)*Number(qInstallments))}</p>}</div>}
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={qPending} onChange={e=>setQPending(e.target.checked)}/>🕒 Marcar como pendente</label>
            <Button type="button" variant="link" size="sm" className="px-0" onClick={()=>(qType==="entrada"?setAddIncome(true):setAddExpense(true))}>Abrir formulário completo</Button>
          </div>}
          <Button type="submit" disabled={saving||!qClass} className="h-12 w-full rounded-xl text-sm font-semibold"><Plus className="mr-2 h-4 w-4"/>{saving?"Salvando...":"Salvar lançamento"}</Button>
        </form>
      </section>}

      {mode === "statement" && <section className="space-y-3">
      {activityRows.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">Nenhum lançamento encontrado.</p>
      )}
      {activityRows.length > 0 && (
        <div className="space-y-8">
          {renderGroup("✅ Realizados", "Já entraram no saldo.", activityRows.filter((r) => r.paid), true)}
          {renderGroup("🕒 Pendentes", "Entram no saldo quando pagos ou recebidos.", activityRows.filter((r) => !r.paid), false)}
        </div>
      )}
      <p className="text-xs text-muted-foreground">Só entram no saldo da conta quando marcados como pago ou recebido.</p>
      </section>}

      <Suspense fallback={<p role="status" className="text-sm text-muted-foreground">Abrindo lançamento…</p>}>
        {addIncome && <AddIncomeDialog open={addIncome} onOpenChange={setAddIncome} />}
        {addExpense && <AddExpenseDialog open={addExpense} onOpenChange={setAddExpense} />}
        {editIncome && <AddIncomeDialog open entry={editIncome} onOpenChange={(v) => !v && setEditIncome(null)} />}
        {editExpense && <AddExpenseDialog open entry={editExpense} onOpenChange={(v) => !v && setEditExpense(null)} />}
      </Suspense>
    </div>
  );
}

