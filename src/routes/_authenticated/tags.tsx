import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useIncome, useExpenses } from "@/lib/queries";
import { monthlyEntries, categoryTotals } from "@/lib/monthly-report";
import { ReportMonthPicker } from "@/components/ReportMonthPicker";
import { Button } from "@/components/ui/button";
import { OwnerIcon } from "@/components/OwnerBadge";
import { brl } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/tags")({
  head: () => ({ meta: [
    { title: "Tags — Categorias | Meu Caixa" },
    { name: "description", content: "Demonstrativo mensal de gastos e receitas por categoria, com valores e participação no total." },
    { property: "og:title", content: "Tags — Categorias | Meu Caixa" },
    { property: "og:description", content: "Veja suas maiores despesas e fontes de receita por categoria." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }), component: Tags,
});

function Tags() {
  const { data: income = [] } = useIncome(); const { data: expenses = [] } = useExpenses();
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [owner, setOwner] = useState("todos");
  const entries = monthlyEntries(income, expenses, month).filter((entry) => owner === "todos" || entry.owner === owner);
  return <div className="space-y-6">
    <h1 className="text-2xl font-semibold">Tags</h1>
    <ReportMonthPicker month={month} onChange={setMonth} />
    <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">{["todos", "ele", "ela"].map((value) => <Button key={value} variant={owner === value ? "secondary" : "ghost"} onClick={() => setOwner(value)}>{value !== "todos" && <OwnerIcon owner={value} />}{value === "todos" ? "Casal" : value === "ele" ? "Ele" : "Ela"}</Button>)}</div>
    <div className="grid gap-8 lg:grid-cols-2">
      {(["despesa", "receita"] as const).map((type) => {
        const groups = categoryTotals(entries, type); const total = groups.reduce((sum, group) => sum + group.amount, 0);
        const tone = type === "despesa" ? "text-danger" : "text-success";
        return <section key={type} className="min-w-0 space-y-4">
          <div className="flex items-end justify-between gap-3 border-b border-border pb-4"><h2 className="text-lg font-semibold">{type === "despesa" ? "Gastos" : "Receitas"}</h2><span className={`text-xl font-semibold tabular-nums ${tone}`}>{brl(total)}</span></div>
          {groups.length === 0 && <p className="py-8 text-sm text-muted-foreground">Nenhuma {type === "despesa" ? "despesa" : "receita"} neste mês.</p>}
          {groups.map((group, index) => <details key={group.category} className="border-b border-border pb-4">
            <summary className="cursor-pointer list-none space-y-2">
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="break-words text-sm font-semibold capitalize">{group.category}</div>{index === 0 && <span className={`text-xs ${tone}`}>{type === "despesa" ? "Maior gasto" : "Maior fonte de receita"}</span>}</div><div className="shrink-0 text-right"><div className={`text-sm font-semibold tabular-nums ${tone}`}>{brl(group.amount)}</div><div className="text-xs text-muted-foreground">{group.percent.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</div></div></div>
              <progress className={`category-progress h-1.5 w-full ${type === "despesa" ? "category-progress-expense" : "category-progress-income"}`} max={100} value={group.percent} />
            </summary>
            <ul className="mt-3 divide-y divide-border">{group.entries.map((entry) => <li key={entry.id} className="flex items-start gap-2 py-2"><OwnerIcon owner={entry.owner} /><span className="min-w-0 flex-1 break-words text-sm">{entry.description}<span className="block text-xs text-muted-foreground">Dia {entry.day}</span></span><span className="shrink-0 text-sm tabular-nums">{brl(entry.amount)}</span></li>)}</ul>
          </details>)}
        </section>;
      })}
    </div>
  </div>;
}