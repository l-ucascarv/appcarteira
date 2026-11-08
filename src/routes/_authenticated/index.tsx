import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Segmented } from "@/components/ui/segmented";
import { monthlyEntries, categoryTotals } from "@/lib/monthly-report";
import { Button } from "@/components/ui/button";
import { ReserveDialog } from "@/components/ReserveDialog";
import {
  useAccounts,
  useReserves,
  useExpenses,
  useIncome,
  useProfile,
  useTransactions,
} from "@/lib/queries";
import {
  currentMonthExpenses,
  monthIncomeExpected,
  nextBill,
  parseLocalDate,
  realizedBalance,
  realizedOnDate,
} from "@/lib/finance";
import { brl, greet, shortMonth } from "@/lib/format";
import { fixedMonthlyExpenses, realizedOpeningBalance } from "@/lib/monthly-report";
import { KpiCard } from "@/components/KpiCard";
import { PersonalPlanner } from "@/components/PersonalPlanner";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, AreaChart, Area, CartesianGrid, PieChart, Pie, Cell,
} from "recharts";
import { CircleDollarSign, PiggyBank, ShieldCheck, TrendingUp, TrendingDown, CalendarClock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Visão geral — Meu Caixa" },
      { name: "description", content: "Acompanhe seu saldo realizado, receitas, despesas e reservas." },
      { property: "og:title", content: "Visão geral — Meu Caixa" },
      { property: "og:description", content: "Acompanhe seu saldo realizado, receitas, despesas e reservas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { data: profile } = useProfile();
  const { data: accounts = [] } = useAccounts();
  const { data: reserves = [] } = useReserves();
  const { data: expenses = [] } = useExpenses();
  const { data: income = [] } = useIncome();
  const { data: transactions = [] } = useTransactions();

  const accountBalance = realizedBalance(transactions);
  const openingBalance = realizedOpeningBalance(transactions, new Date());
  const [reserveOpen, setReserveOpen] = useState(false);
  const [balancePeriod, setBalancePeriod] = useState<"semana" | "mes" | "ano">("mes");
  const reservedBalance = reserves.reduce((sum, reserve) => sum + Number(reserve.current_amount), 0);
  const committedBalance = fixedMonthlyExpenses(expenses, new Date()).reduce((sum, expense) => sum + expense.amount, 0);
  const monthReceita = monthIncomeExpected(income);
  const monthExpenses = currentMonthExpenses(expenses);
  const monthDespesa = monthExpenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
  const emergencia = reserves.find((r) => r.name.toLowerCase().includes("emerg"));
  const patrimonio = accountBalance;
  const bill = nextBill(expenses);

  // Chart: últimos 6 meses a partir dos lançamentos reais
  const now = new Date();
  const sameMonth = (iso: string | null | undefined, d: Date) => {
    if (!iso) return false;
    const x = parseLocalDate(iso);
    return x.getFullYear() === d.getFullYear() && x.getMonth() === d.getMonth();
  };
  const monthsChart = Array.from({ length: 6 }, (_, idx) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - idx), 1);
    const rec = income
      .filter((i) => {
        if (!i.reference_month) return i.recurring;
        const reference = parseLocalDate(i.reference_month);
        const referenceMonth = new Date(reference.getFullYear(), reference.getMonth(), 1).getTime();
        return i.recurring ? referenceMonth <= d.getTime() : sameMonth(i.reference_month, d);
      })
      .reduce((s, i) => s + Number(i.amount), 0);
    const desp = expenses
      .filter((e) => {
        const due = parseLocalDate(e.due_date);
        const recurring = e.category === "fixa" || e.category === "parcelada";
        const dueMonth = new Date(due.getFullYear(), due.getMonth(), 1).getTime();
        return recurring ? dueMonth <= d.getTime() : sameMonth(e.due_date, d);
      })
      .reduce((s, e) => s + Number(e.amount), 0);
    return { m: shortMonth(d), Receitas: rec, Despesas: desp };
  });

  // Série baseada em movimentações realizadas, sem depender de balance_after.
  // Sempre fornece dois pontos para evitar gráficos vazios em períodos sem lançamentos.
  const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  const periodStart = balancePeriod === "semana"
    ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)
    : balancePeriod === "ano"
      ? new Date(now.getFullYear(), 0, 1)
      : new Date(now.getFullYear(), now.getMonth(), 1);
  const completed = transactions
    .filter((t) => (t.kind === "receita" || t.kind === "despesa") && Number.isFinite(Number(t.amount)))
    .map((t) => ({ time: new Date(t.occurred_at).getTime(), amount: Number(t.amount) }))
    .filter((t) => Number.isFinite(t.time) && t.time <= endDate.getTime())
    .sort((a, b) => a.time - b.time);
  const balanceAtStart = accountBalance - completed.filter(t => t.time >= periodStart.getTime()).reduce((sum,t)=>sum+t.amount,0);
  let runningBalance = balanceAtStart;
  const balanceSeries = [{ i: 0, saldo: balanceAtStart }, ...completed.filter(t=>t.time >= periodStart.getTime()).map((t,i)=>{
    runningBalance += t.amount;
    return { i: i+1, saldo: runningBalance };
  })];
  if (balanceSeries.length === 1) balanceSeries.push({i:1,saldo:accountBalance});

  const reportEntries = monthlyEntries(income, expenses, now);
  const expenseCategoryTotals = categoryTotals(reportEntries, "despesa");
  const incomeCategoryTotals = categoryTotals(reportEntries, "receita");
  const categoryColors = ["#E8A329","#1EB395","#F17A61","#7695DA","#AD84D5","#8C9A91"];
  const tooltipStyle = { borderRadius: 16, border: "none", boxShadow: "var(--shadow-float)", background: "var(--color-card)" };

  return (
    <div className="dashboard-view space-y-4 md:space-y-6">
      <div className="dashboard-heading">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          {greet(profile?.name ?? "Lucas")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Seu dinheiro em um só lugar.
        </p>
      </div>

      {/* Hero: saldo da conta com a evolução ao fundo */}
      <Card className="overflow-hidden p-0">
        <div className="px-5 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2"><div className="text-sm font-semibold text-muted-foreground">Saldo da conta</div><Segmented label="Período do saldo" value={balancePeriod} onChange={setBalancePeriod} options={[{value:"semana",label:"Semana"},{value:"mes",label:"Mês"},{value:"ano",label:"Ano"}]} /></div>
          <div className="hero-balance-value mt-1 tabular-nums">{brl(accountBalance)}</div>
          <p className="mt-1 text-xs text-muted-foreground">
            Somente realizado · saldo anterior ao mês: {brl(openingBalance)}
          </p>
        </div>
        <div className="mt-4 h-36 min-w-0" role="img" aria-label="Evolução do saldo nas últimas movimentações">
          <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
            <AreaChart data={balanceSeries} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="balance-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="i" hide />
              <YAxis hide domain={["dataMin", "dataMax"]} />
              <Tooltip formatter={(v) => brl(Number(v))} labelFormatter={() => "Saldo"} contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="saldo" stroke="var(--color-primary)" strokeWidth={2.5} fill="url(#balance-fill)" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <PersonalPlanner />

      {/* Dinheiro separado */}
      <div className="grid grid-cols-2 gap-3">
        <KpiCard label="Reservado" value={brl(reservedBalance)} hint={<Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setReserveOpen(true)}>Ajustar reserva</Button>} icon={<ShieldCheck className="h-4 w-4" />} />
        <KpiCard label="Comprometido" value={brl(committedBalance)} hint="Despesas fixas do mês" icon={<CircleDollarSign className="h-4 w-4" />} accent="negative" />
      </div>

      {/* Mês */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Receitas do mês" value={brl(monthReceita)} icon={<TrendingUp className="h-4 w-4" />} accent="positive" />
        <KpiCard label="Despesas do mês" value={brl(monthDespesa)} icon={<TrendingDown className="h-4 w-4" />} accent="negative" />
        <KpiCard label="Patrimônio" value={brl(patrimonio)} icon={<PiggyBank className="h-4 w-4" />} />
        <KpiCard
          label="Próxima conta"
          value={bill ? brl(bill.amount) : "—"}
          hint={bill ? `${bill.name} • dia ${bill.due_day}` : "Nenhuma"}
          icon={<CalendarClock className="h-4 w-4" />}
        />
      </div>



      {/* Barra da reserva */}
      {emergencia && (
        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-muted-foreground">Reserva de emergência</div>
              <div className="mt-1 text-xl font-bold tracking-tight tabular-nums">
                {brl(Number(emergencia.current_amount))} <span className="text-sm font-medium text-muted-foreground">/ {brl(Number(emergencia.goal_amount))}</span>
              </div>
            </div>
            <div className="rounded-full bg-primary/20 px-3 py-1 text-sm font-bold tabular-nums text-primary-ink">
              {((Number(emergencia.current_amount) / Number(emergencia.goal_amount)) * 100).toFixed(1)}%
            </div>
          </div>
          <Progress
            className="mt-4 h-3"
            value={(Number(emergencia.current_amount) / Number(emergencia.goal_amount)) * 100}
          />
        </Card>
      )}

      <Card className="p-4 sm:p-5">
        <div className="mb-4"><h2 className="text-base font-bold">Categorias do mês</h2><p className="text-xs text-muted-foreground">Distribuição de despesas e receitas por categoria</p></div>
        <div className="grid gap-5 lg:grid-cols-2">
          {([["despesa",expenseCategoryTotals],["receita",incomeCategoryTotals]] as const).map(([type,groups])=>{
            const total=groups.reduce((sum,g)=>sum+g.amount,0);
            return <div key={type} className="min-w-0 space-y-3">
              <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">{type==="despesa"?"Despesas":"Receitas"}</h3><strong className="text-sm tabular-nums">{brl(total)}</strong></div>
              {groups.length ? <>
                <div className="relative mx-auto h-44 w-44 shrink-0">
                  <PieChart width={176} height={176}><Pie data={groups} dataKey="amount" nameKey="category" innerRadius={54} outerRadius={80} paddingAngle={2} stroke="none" isAnimationActive={false}>{groups.map((g,i)=><Cell key={g.category} fill={categoryColors[i%categoryColors.length]}/>)}</Pie><Tooltip formatter={v=>brl(Number(v))}/></PieChart>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><span className="text-[10px] text-muted-foreground">{type==="despesa"?"GASTOS":"RECEBIDO"}</span><strong className="text-sm tabular-nums">{brl(total)}</strong></div>
                </div>
                <ul className="space-y-1.5">{groups.map((g,i)=><li key={g.category} className="flex min-w-0 items-center gap-2 rounded-xl bg-muted/40 px-3 py-2 text-xs"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{background:categoryColors[i%categoryColors.length]}}/><span className="min-w-0 flex-1 truncate capitalize">{g.category}</span><span className="shrink-0 font-semibold tabular-nums">{g.percent.toLocaleString("pt-BR",{maximumFractionDigits:1})}%</span></li>)}</ul>
              </> : <p className="py-5 text-sm text-muted-foreground">Nenhum lançamento no período.</p>}
            </div>;
          })}
        </div>
      </Card>

      {/* Receitas x Despesas */}
      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-base font-bold">Receitas x Despesas</h2>
          <div className="flex items-center gap-3 text-xs font-semibold text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-success" />Receitas</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-danger" />Despesas</span>
          </div>
        </div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
            <BarChart data={monthsChart} barCategoryGap="28%">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="m" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => brl(Number(v))} cursor={{ fill: "var(--color-muted)", opacity: 0.5 }} contentStyle={tooltipStyle} />
              <Bar dataKey="Receitas" fill="var(--color-success)" radius={[8, 8, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="Despesas" fill="var(--color-danger)" radius={[8, 8, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <ReserveDialog open={reserveOpen} onOpenChange={setReserveOpen} reserves={reserves} />
    </div>
  );
}

