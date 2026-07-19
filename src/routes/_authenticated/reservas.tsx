import { createFileRoute } from "@tanstack/react-router";
import { useReserves, useIncome } from "@/lib/queries";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { brl } from "@/lib/format";
import { reserveEta, monthIncomeExpected } from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/reservas")({
  head: () => ({ meta: [{ title: "Reservas — Meu Caixa" }] }),
  component: Reservas,
});

function Reservas() {
  const { data: reserves = [] } = useReserves();
  const { data: income = [] } = useIncome();
  const monthly = monthIncomeExpected(income) * 0.15; // heurística: ~15% da receita mensal alocável

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Reservas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cada reserva com progresso, meta e tempo estimado.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {reserves.map((r) => {
          const pct = (Number(r.current_amount) / Number(r.goal_amount)) * 100;
          const remaining = Number(r.goal_amount) - Number(r.current_amount);
          const eta = reserveEta(monthly, remaining);
          const etaStr = eta === Infinity ? "—" : `${eta} ${eta === 1 ? "mês" : "meses"}`;
          return (
            <Card key={r.id} className="rounded-2xl p-5 shadow-none">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Reserva</div>
                  <div className="text-lg font-semibold tracking-tight">{r.name}</div>
                </div>
                <span
                  className="inline-block h-3 w-3 rounded-full"
                  style={{ backgroundColor: r.color ?? "#10b981" }}
                />
              </div>
              <div className="mt-4 flex items-end justify-between">
                <div>
                  <div className="text-2xl font-semibold tabular-nums">{brl(Number(r.current_amount))}</div>
                  <div className="text-xs text-muted-foreground">de {brl(Number(r.goal_amount))}</div>
                </div>
                <div className="text-right text-sm">
                  <div className="font-medium">{pct.toFixed(1)}%</div>
                  <div className="text-xs text-muted-foreground">ETA {etaStr}</div>
                </div>
              </div>
              <Progress className="mt-4 h-2" value={pct} />
            </Card>
          );
        })}
      </div>
    </div>
  );
}
