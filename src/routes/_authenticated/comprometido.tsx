import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useExpenses } from "@/lib/queries";
import { fixedMonthlyExpenses } from "@/lib/monthly-report";
import { ReportMonthPicker } from "@/components/ReportMonthPicker";
import { OwnerIcon } from "@/components/OwnerBadge";
import { brl } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/comprometido")({
  head: () => ({ meta: [
    { title: "Comprometido — Custo de vida | Meu Caixa" },
    { name: "description", content: "Seu custo fixo mensal com todas as despesas fixas e suas datas de vencimento." },
    { property: "og:title", content: "Comprometido — Custo de vida | Meu Caixa" },
    { property: "og:description", content: "Painel do custo de vida mensal e vencimentos das despesas fixas." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }), component: Comprometido,
});

function Comprometido() {
  const { data: expenses = [] } = useExpenses();
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const entries = fixedMonthlyExpenses(expenses, month);
  return <div className="space-y-6">
    <h1 className="text-2xl font-semibold">Comprometido</h1>
    <ReportMonthPicker month={month} onChange={setMonth} />
    <section className="border-y border-border py-6"><h2 className="text-sm text-muted-foreground">Custo de vida mensal</h2><div className="mt-2 text-3xl font-semibold tabular-nums">{brl(entries.reduce((sum, entry) => sum + entry.amount, 0))}</div><div className="mt-2 text-xs text-muted-foreground">{entries.length} despesas fixas</div></section>
    <section><div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-border pb-3 text-xs text-muted-foreground"><h2>Despesa / vencimento</h2><span>Valor mensal</span></div>
      {entries.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma despesa fixa neste mês.</p>}
      <ul className="divide-y divide-border">{entries.map((entry) => <li key={entry.id} className="flex items-center gap-3 py-4"><OwnerIcon owner={entry.owner} /><div className="min-w-0 flex-1"><div className="break-words text-sm font-medium">{entry.description}</div><div className="mt-1 text-xs text-muted-foreground">{new Date(month.getFullYear(), month.getMonth(), entry.day).toLocaleDateString("pt-BR")} · {entry.category}</div></div><span className="shrink-0 text-sm font-semibold tabular-nums">{brl(entry.amount)}</span></li>)}</ul>
    </section>
  </div>;
}