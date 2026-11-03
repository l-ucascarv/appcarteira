import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
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
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, LineChart, Line, CartesianGrid,
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          {greet(profile?.name ?? "Lucas")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Aqui está a visão real do seu dinheiro hoje.
        </p>
      </div>

      {/* Hero: Disponível */}
      <SpendingAnalysis signature={JSON.stringify([income, expenses, transactions, reserves])} />

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard label="Saldo da conta" value={brl(accountBalance)} hint={<>Somente realizado<span className="mt-1 block">Saldo anterior ao mês: {brl(openingBalance)}</span></>} icon={<Wallet className="h-4 w-4" />} />
        <KpiCard label="Reservado" value={brl(reservedBalance)} hint={<Button variant="link" size="sm" className="h-auto p-0" onClick={() => setReserveOpen(true)}>Ajustar reserva</Button>} icon={<ShieldCheck className="h-4 w-4" />} />
        <KpiCard label="Comprometido" value={brl(committedBalance)} hint="Despesas fixas do mês" icon={<CircleDollarSign className="h-4 w-4" />} accent="negative" />
      </div>

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

      <Card className="overflow-hidden rounded-2xl p-0 shadow-none">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">Últimos lançamentos realizados</h2>
            <p className="text-xs text-muted-foreground">Movimentações que formam o saldo da conta.</p>
          </div>
          <span className="text-xs text-muted-foreground">{recentTransactions.length}</span>
        </div>
        {recentTransactions.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">Nenhuma movimentação realizada.</div>
        ) : (
          <ul className="divide-y divide-border">
            {recentTransactions.map((transaction) => {
              const amount = Number(transaction.amount);
              return (
                <li key={transaction.id as string} className="flex items-center gap-3 px-4 py-3">
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${amount >= 0 ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>
                    {amount >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{transaction.description as string}</div>
                    <div className="text-xs text-muted-foreground">{new Date(transaction.occurred_at as string).toLocaleDateString("pt-BR")}</div>
                  </div>
                  <span className={`text-sm font-semibold tabular-nums ${amount >= 0 ? "text-success" : "text-danger"}`}>
                    {amount >= 0 ? "+" : "−"}{brl(Math.abs(amount))}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Barra da Reserva */}
      {emergencia && (
        <Card className="rounded-2xl p-5 shadow-none">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Reserva de Emergência</div>
              <div className="text-xl font-semibold tracking-tight">
                {brl(Number(emergencia.current_amount))} <span className="text-sm text-muted-foreground">/ {brl(Number(emergencia.goal_amount))}</span>
              </div>
            </div>
            <div className="text-right text-sm text-muted-foreground">
              {((Number(emergencia.current_amount) / Number(emergencia.goal_amount)) * 100).toFixed(1)}%
            </div>
          </div>
          <Progress
            className="mt-4 h-2"
            value={(Number(emergencia.current_amount) / Number(emergencia.goal_amount)) * 100}
          />
        </Card>
      )}

      {/* Gráficos */}
      <div className="grid gap-3 md:grid-cols-2">
        <Card className="rounded-2xl p-5 shadow-none">
          <div className="mb-3 text-sm font-medium">Receitas x Despesas</div>
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={monthsChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="m" stroke="var(--color-muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={11} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => brl(Number(v))} contentStyle={{ borderRadius: 12 }} />
                <Bar dataKey="Receitas" fill="var(--color-success)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="Despesas" fill="var(--color-danger)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="rounded-2xl p-5 shadow-none">
          <div className="mb-3 text-sm font-medium">Evolução patrimonial</div>
          <div className="h-56">
            <ResponsiveContainer>
              <LineChart data={evo}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="i" hide />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={11} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => brl(Number(v))} contentStyle={{ borderRadius: 12 }} />
                <Line type="monotone" dataKey="saldo" stroke="var(--color-foreground)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
      <ReserveDialog open={reserveOpen} onOpenChange={setReserveOpen} reserves={reserves} />
    </div>
  );
}
