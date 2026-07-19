import { createFileRoute } from "@tanstack/react-router";
import { useGoals, useIncome } from "@/lib/queries";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { brl } from "@/lib/format";
import { monthIncomeExpected, reserveEta } from "@/lib/finance";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_authenticated/metas")({
  head: () => ({ meta: [{ title: "Metas — Meu Caixa" }] }),
  component: Metas,
});

function Metas() {
  const { data: goals = [] } = useGoals();
  const { data: income = [] } = useIncome();
  const monthlySave = monthIncomeExpected(income) * 0.15;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Metas</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sua trilha até cada objetivo.</p>
      </div>

      {goals.map((g) => {
        const remaining = Number(g.target_amount) - Number(g.current_amount);
        const pct = (Number(g.current_amount) / Number(g.target_amount)) * 100;
        const eta = reserveEta(monthlySave, remaining);
        const evo = Array.from({ length: 12 }, (_, i) => ({
          m: i + 1,
          v: Math.min(Number(g.target_amount), Number(g.current_amount) + monthlySave * (i + 1)),
        }));
        return (
          <Card key={g.id} className="rounded-2xl p-6 shadow-none">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Meta</div>
                <div className="text-xl font-semibold tracking-tight">{g.name}</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-semibold tabular-nums">{brl(Number(g.current_amount))}</div>
                <div className="text-xs text-muted-foreground">de {brl(Number(g.target_amount))}</div>
              </div>
            </div>
            <Progress className="mt-4 h-2" value={pct} />
            <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Falta</div>
                <div className="font-medium">{brl(remaining)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Guardar/mês</div>
                <div className="font-medium">{brl(monthlySave)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Tempo estimado</div>
                <div className="font-medium">{eta === Infinity ? "—" : `${eta} meses`}</div>
              </div>
            </div>
            <div className="mt-6 h-48">
              <ResponsiveContainer>
                <LineChart data={evo}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="m" stroke="var(--color-muted-foreground)" fontSize={11} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={11} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v) => brl(Number(v))} contentStyle={{ borderRadius: 12 }} />
                  <Line type="monotone" dataKey="v" stroke="var(--color-foreground)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
