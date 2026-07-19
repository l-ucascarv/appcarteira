import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAccounts, useIncome, useExpenses } from "@/lib/queries";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { brl } from "@/lib/format";
import { forecast, monthIncomeExpected } from "@/lib/finance";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_authenticated/previsao")({
  head: () => ({ meta: [{ title: "Previsão — Meu Caixa" }] }),
  component: Previsao,
});

const RANGES = [30, 60, 90, 180, 365];

function Previsao() {
  const { data: accounts = [] } = useAccounts();
  const { data: income = [] } = useIncome();
  const { data: expenses = [] } = useExpenses();
  const [days, setDays] = useState(90);

  const balance = accounts.reduce((s, a) => s + Number(a.balance), 0);
  const monthly = monthIncomeExpected(income);
  const monthlyExp = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const data = forecast(balance, monthly, monthlyExp, days);
  const final = data[data.length - 1]?.balance ?? balance;
  const delta = final - balance;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Previsão</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Projeção do seu saldo com base nas receitas previstas e despesas fixas.
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto">
        {RANGES.map((d) => (
          <Button
            key={d}
            variant={days === d ? "default" : "outline"}
            size="sm"
            className="rounded-full"
            onClick={() => setDays(d)}
          >
            {d === 365 ? "12 meses" : `${d} dias`}
          </Button>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="rounded-2xl p-5 shadow-none">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Saldo hoje</div>
          <div className="text-2xl font-semibold">{brl(balance)}</div>
        </Card>
        <Card className="rounded-2xl p-5 shadow-none">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Saldo previsto</div>
          <div className="text-2xl font-semibold">{brl(final)}</div>
        </Card>
        <Card className="rounded-2xl p-5 shadow-none">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Variação</div>
          <div className={`text-2xl font-semibold ${delta >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
            {delta >= 0 ? "+" : ""}
            {brl(delta)}
          </div>
        </Card>
      </div>

      <Card className="rounded-2xl p-5 shadow-none">
        <div className="h-72">
          <ResponsiveContainer>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="date" stroke="var(--color-muted-foreground)" fontSize={11} tickFormatter={(v) => v.slice(5)} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={11} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => brl(Number(v))} contentStyle={{ borderRadius: 12 }} />
              <Line type="monotone" dataKey="balance" stroke="var(--color-foreground)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
