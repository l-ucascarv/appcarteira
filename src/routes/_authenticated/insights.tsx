import { createFileRoute } from "@tanstack/react-router";
import {
  useInsights,
  useAccounts,
  useReserves,
  useExpenses,
  useIncome,
} from "@/lib/queries";
import { computeBalances, monthIncomeExpected } from "@/lib/finance";
import { Card } from "@/components/ui/card";
import { brl } from "@/lib/format";
import { AlertTriangle, Lightbulb, TrendingUp, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/insights")({
  head: () => ({ meta: [{ title: "Insights — Meu Caixa" }] }),
  component: Insights,
});

function Insights() {
  const { data: seeded = [] } = useInsights();
  const { data: accounts = [] } = useAccounts();
  const { data: reserves = [] } = useReserves();
  const { data: expenses = [] } = useExpenses();
  const { data: income = [] } = useIncome();

  const balances = computeBalances(accounts, reserves, expenses);
  const monthly = monthIncomeExpected(income);

  // Insights dinâmicos
  const dynamic: { kind: string; title: string; message: string; severity: string }[] = [];

  const carro = expenses.find((e) => e.name.toLowerCase().includes("carro"));
  if (carro && balances.saldoLivre + reserves.find((r) => r.name.includes("Carro"))!?.current_amount >= Number(carro.amount)) {
    dynamic.push({
      kind: "oportunidade",
      title: "Você já pode pagar a parcela do carro sem juros",
      message: `Sua reserva do carro + saldo livre já cobrem os ${brl(Number(carro.amount))}.`,
      severity: "success",
    });
  }

  dynamic.push({
    kind: "livre",
    title: "Dinheiro realmente livre",
    message: `Você possui ${brl(balances.saldoLivre)} realmente livres para gastar hoje, sem comprometer contas ou reservas.`,
    severity: "info",
  });

  const emergencia = reserves.find((r) => r.name.toLowerCase().includes("emerg"));
  if (emergencia) {
    const remaining = Number(emergencia.goal_amount) - Number(emergencia.current_amount);
    const monthlySave = monthly * 0.15;
    const eta = monthlySave > 0 ? Math.ceil(remaining / monthlySave) : Infinity;
    dynamic.push({
      kind: "projecao",
      title: "Reserva de Emergência",
      message:
        eta === Infinity
          ? "Aumente sua taxa de poupança para acelerar a Reserva de Emergência."
          : `Sua reserva atingirá ${brl(Number(emergencia.goal_amount))} em aproximadamente ${eta} meses.`,
      severity: "info",
    });
  }

  const totalExp = expenses.reduce((s, e) => s + Number(e.amount), 0);
  if (totalExp > monthly) {
    dynamic.push({
      kind: "alerta",
      title: "Fluxo de caixa apertado",
      message: `Suas despesas fixas (${brl(totalExp)}) superam a receita mensal (${brl(monthly)}). Use as comissões previstas para equilibrar.`,
      severity: "warning",
    });
  }

  const all = [
    ...dynamic,
    ...seeded.map((s) => ({
      kind: s.kind as string,
      title: s.title as string,
      message: s.message as string,
      severity: s.severity as string,
    })),
  ];

  const icon = (sev: string) => {
    if (sev === "warning") return <AlertTriangle className="h-4 w-4" />;
    if (sev === "success") return <TrendingUp className="h-4 w-4" />;
    if (sev === "info") return <Lightbulb className="h-4 w-4" />;
    return <Sparkles className="h-4 w-4" />;
  };

  const color = (sev: string) =>
    sev === "warning"
      ? "text-amber-600 bg-amber-500/10"
      : sev === "success"
      ? "text-emerald-600 bg-emerald-500/10"
      : "text-blue-600 bg-blue-500/10";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Insights</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Análises automáticas sobre o seu dinheiro.
        </p>
      </div>

      <div className="grid gap-3">
        {all.map((i, idx) => (
          <Card key={idx} className="flex items-start gap-3 rounded-2xl p-5 shadow-none">
            <div className={`flex h-9 w-9 flex-none items-center justify-center rounded-full ${color(i.severity)}`}>
              {icon(i.severity)}
            </div>
            <div className="min-w-0">
              <div className="font-semibold">{i.title}</div>
              <div className="mt-1 text-sm text-muted-foreground">{i.message}</div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
