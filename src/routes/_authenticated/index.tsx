import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Segmented } from "@/components/ui/segmented";
import { monthlyEntries, categoryTotals } from "@/lib/monthly-report";
import { Button } from "@/components/ui/button";
import { SpendingAnalysis } from "@/components/SpendingAnalysis";
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
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, AreaChart, Area, CartesianGrid, PieChart, Pie, Cell,
} from "recharts";
import { CircleDollarSign, PiggyBank, ShieldCheck, Wallet, TrendingUp, TrendingDown, Sparkles, CalendarClock } from "lucide-react";

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

  // Evolução patrimonial (baseada em transactions.balance_after)
  const evo = transactions
    .filter((t) => t.balance_after !== null)
    .slice(0, 12)
    .reverse()
    .map((t, i) => ({ i, saldo: Number(t.balance_after) }));
  if (evo.length === 0) evo.push({ i: 0, saldo: patrimonio });

  const recentTransactions = transactions
    .filter((transaction) => transaction.kind === "receita" || transaction.kind === "despesa")
    .slice(0, 8);

  const expenseCategoryTotals = categoryTotals(monthlyEntries(income, expenses, new Date()), "despesa");
  const categoryColors = ["#E7A93B", "#35A58B", "#E4775D", "#7C8FC7", "#B38ACB", "#8C9A91"];
  const balanceSeries = balancePeriod === "semana"
    ? transactions.filter((t) => t.balance_after !== null && new Date(t.occurred_at).getTime() >= Date.now() - 7 * 86400000).slice(0, 7).reverse().map((t, i) => ({ i, saldo: Number(t.balance_after) }))
    : balancePeriod === "ano"
      ? Array.from({length:12},(_,i)=>{const d=new Date(now.getFullYear(),i+1,0);const t=transactions.filter(x=>x.balance_after!==null&&new Date(x.occurred_at)<=d).at(-1);return {i,saldo:Number(t?.balance_after??0)};})
      : evo;

  const tooltipStyle = { borderRadius: 16, border: "none", boxShadow: "var(--shadow-float)", background: "var(--color-card)" };

  return (
    <div className="dashboard-view space-y-4 md:space-y-6">
      <div className="dashboard-heading">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          {greet(profile?.name ?? "Lucas")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Aqui está a visão real do seu dinheiro hoje.
        </p>
      </div>

      {/* Hero: saldo da conta com a evolução ao fundo */}
      <Card className="overflow-hidden p-0">
        <div className="px-5 pt-5">
          <div className="text-sm font-semibold text-muted-foreground">Saldo da conta</div>
          <div className="hero-balance-value mt-1 tabular-nums">{brl(accountBalance)}</div>
          <p className="mt-1 text-xs text-muted-foreground">
            Somente realizado · saldo anterior ao mês: {brl(openingBalance)}
          </p>
        </div>
        <div className="mt-4 h-28" role="img" aria-label="Evolução do saldo nas últimas movimentações">
          <ResponsiveContainer>
            <AreaChart data={evo} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
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

      {/* Disponível para gastar (análise por IA) */}
      <SpendingAnalysis signature={JSON.stringify([income, expenses, transactions, reserves])} />

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

      {/* Últimos lançamentos */}
      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-5">
          <div>
            <h2 className="text-base font-bold">Últimos lançamentos</h2>
            <p className="text-xs text-muted-foreground">Movimentações que formam o saldo da conta.</p>
          </div>
          <Link to="/lancamentos" className="shrink-0 rounded-full bg-muted px-3 py-1.5 text-xs font-semibold hover:bg-accent">Ver extrato</Link>
        </div>
        {recentTransactions.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">Nenhuma movimentação realizada ainda. Toque em + para lançar a primeira.</div>
        ) : (
          <ul className="px-2 pb-2">
            {recentTransactions.map((transaction) => {
              const amount = Number(transaction.amount);
              return (
                <li key={transaction.id as string} className="flex items-center gap-3 rounded-2xl px-3 py-3">
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${amount >= 0 ? "bg-success/15 text-success" : "bg-danger/15 text-danger"}`}>
                    {amount >= 0 ? <TrendingUp className="h-[18px] w-[18px]" /> : <TrendingDown className="h-[18px] w-[18px]" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{transaction.description as string}</div>
                    <div className="text-xs text-muted-foreground">{new Date(transaction.occurred_at as string).toLocaleDateString("pt-BR")}</div>
                  </div>
                  <span className={`text-sm font-bold tabular-nums ${amount >= 0 ? "text-success" : "text-foreground"}`}>
                    {amount >= 0 ? "+" : "−"}{brl(Math.abs(amount))}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card className="p-5">
        <div className="mb-3"><h2 className="text-base font-bold">Gastos por categoria</h2><p className="text-xs text-muted-foreground">Distribuição das despesas previstas no mês, conforme Tags.</p></div>
        {expenseCategoryTotals.length ? <div className="grid grid-cols-[minmax(120px,1fr)_minmax(0,1fr)] items-center gap-2">
          <div className="h-44"><ResponsiveContainer><PieChart><Pie data={expenseCategoryTotals} dataKey="amount" nameKey="category" innerRadius="62%" outerRadius="88%" paddingAngle={3}>{expenseCategoryTotals.map((g,i)=><Cell key={g.category} fill={categoryColors[i%categoryColors.length]}/>)}</Pie><Tooltip formatter={(v)=>brl(Number(v))}/></PieChart></ResponsiveContainer></div>
          <ul className="space-y-2">{expenseCategoryTotals.slice(0,6).map((g,i)=><li key={g.category} className="flex items-center justify-between gap-2 text-xs"><span className="flex min-w-0 items-center gap-2"><i className="h-2 w-2 shrink-0 rounded-full" style={{background:categoryColors[i%categoryColors.length]}}/><span className="truncate capitalize">{g.category}</span></span><b className="tabular-nums">{g.percent.toLocaleString("pt-BR",{maximumFractionDigits:0})}%</b></li>)}</ul>
        </div> : <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma despesa categorizada neste mês.</p>}
      </Card>
\n      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-base font-bold">Evolução do saldo</h2><Segmented value={balancePeriod} onChange={setBalancePeriod} options={[{value:"semana",label:"Semana"},{value:"mes",label:"Mês"},{value:"ano",label:"Ano"}]} /></div>
        <div className="h-44"><ResponsiveContainer><AreaChart data={balanceSeries}><XAxis dataKey="i" hide/><YAxis hide domain={["dataMin","dataMax"]}/><Tooltip formatter={(v)=>brl(Number(v))}/><Area dataKey="saldo" stroke="#D99B2B" fill="#D99B2B" fillOpacity={0.15} isAnimationActive={false}/></AreaChart></ResponsiveContainer></div>
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
          <ResponsiveContainer>
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

