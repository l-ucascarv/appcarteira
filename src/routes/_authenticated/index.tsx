import { createFileRoute } from "@tanstack/react-router";
import {
  useAccounts,
  useReserves,
  useExpenses,
  useIncome,
  useProfile,
  useTransactions,
} from "@/lib/queries";
import { computeBalances, monthIncomeExpected, nextBill } from "@/lib/finance";
import { brl, greet, shortMonth } from "@/lib/format";
import { KpiCard } from "@/components/KpiCard";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, LineChart, Line, CartesianGrid,
} from "recharts";
import { CircleDollarSign, PiggyBank, ShieldCheck, Wallet, TrendingUp, TrendingDown, Sparkles, CalendarClock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({ meta: [{ title: "Dashboard — Meu Caixa" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { data: profile } = useProfile();
  const { data: accounts = [] } = useAccounts();
  const { data: reserves = [] } = useReserves();
  const { data: expenses = [] } = useExpenses();
  const { data: income = [] } = useIncome();
  const { data: transactions = [] } = useTransactions();

  const balances = computeBalances(accounts, reserves, expenses);
  const monthReceita = monthIncomeExpected(income);
  const monthDespesa = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const emergencia = reserves.find((r) => r.name.toLowerCase().includes("emerg"));
  const patrimonio = balances.saldoConta + balances.saldoReservado;
  const bill = nextBill(expenses);
  const comissaoPrevista = income
    .filter((i) => i.kind === "comissao" && i.status === "previsto")
    .reduce((s, i) => s + Number(i.amount), 0);

  // Chart: últimos 6 meses a partir dos lançamentos reais
  const now = new Date();
  const sameMonth = (iso: string | null | undefined, d: Date) => {
    if (!iso) return false;
    const x = new Date(iso);
    return x.getFullYear() === d.getFullYear() && x.getMonth() === d.getMonth();
  };
  const monthsChart = Array.from({ length: 6 }, (_, idx) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - idx), 1);
    const isCurrent = d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    const rec = income
      .filter((i) => (i.recurring ? true : sameMonth(i.reference_month, d)))
      .reduce((s, i) => s + Number(i.amount), 0);
    const desp = expenses
      .filter((e) => e.category === "fixa" || e.category === "parcelada" || isCurrent)
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
      <KpiCard
        accent="primary"
        label="Disponível para gastar"
        value={brl(balances.saldoLivre)}
        hint="Saldo em conta − reservas − contas comprometidas"
        icon={<Sparkles className="h-5 w-5" />}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Saldo em conta" value={brl(balances.saldoConta)} icon={<Wallet className="h-4 w-4" />} />
        <KpiCard label="Reservado" value={brl(balances.saldoReservado)} icon={<ShieldCheck className="h-4 w-4" />} />
        <KpiCard label="Comprometido" value={brl(balances.saldoComprometido)} icon={<CircleDollarSign className="h-4 w-4" />} accent="negative" />
        <KpiCard label="Patrimônio" value={brl(patrimonio)} icon={<PiggyBank className="h-4 w-4" />} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Receita do mês" value={brl(monthReceita)} icon={<TrendingUp className="h-4 w-4" />} accent="positive" />
        <KpiCard label="Despesas do mês" value={brl(monthDespesa)} icon={<TrendingDown className="h-4 w-4" />} accent="negative" />
        <KpiCard label="Comissão prevista" value={brl(comissaoPrevista)} icon={<Sparkles className="h-4 w-4" />} />
        <KpiCard
          label="Próxima conta"
          value={bill ? brl(bill.amount) : "—"}
          hint={bill ? `${bill.name} • dia ${bill.due_day}` : "Nenhuma"}
          icon={<CalendarClock className="h-4 w-4" />}
        />
      </div>

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
                <Bar dataKey="Receitas" fill="#10b981" radius={[6, 6, 0, 0]} />
                <Bar dataKey="Despesas" fill="#f43f5e" radius={[6, 6, 0, 0]} />
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
    </div>
  );
}
