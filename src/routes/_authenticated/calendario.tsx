import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useExpenses } from "@/lib/queries";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { brl } from "@/lib/format";
import { PayExpenseDialog } from "@/components/PayExpenseDialog";

export const Route = createFileRoute("/_authenticated/calendario")({
  head: () => ({ meta: [{ title: "Calendário — Meu Caixa" }] }),
  component: Calendario,
});

function Calendario() {
  const { data: expenses = [] } = useExpenses();
  const [payOpen, setPayOpen] = useState<{ id: string; amount: number; name: string } | null>(null);
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const firstWeekday = new Date(y, m, 1).getDay();
  const today = now.getDate();

  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const byDay = new Map<number, typeof expenses>();
  expenses.forEach((e) => {
    if (!byDay.has(e.due_day)) byDay.set(e.due_day, []);
    byDay.get(e.due_day)!.push(e);
  });

  const statusColor = (day: number) => {
    const list = byDay.get(day);
    if (!list || list.length === 0) return "";
    const hasAtrasado = list.some((e) => e.status === "atrasado" || (e.status === "pendente" && day < today));
    const allPaid = list.every((e) => e.status === "pago");
    if (allPaid) return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";
    if (hasAtrasado) return "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30";
    return "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30";
  };

  const monthName = now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Calendário</h1>
        <p className="mt-1 text-sm text-muted-foreground capitalize">{monthName}</p>
      </div>

      <Card className="rounded-2xl p-4 shadow-none md:p-6">
        <div className="grid grid-cols-7 gap-2 text-center text-xs font-medium text-muted-foreground">
          {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-2">
          {cells.map((day, i) => (
            <div
              key={i}
              className={`min-h-20 rounded-xl border p-2 text-left text-xs ${
                day === null ? "border-transparent" : "border-border"
              } ${day === today ? "ring-2 ring-foreground/40" : ""}`}
            >
              {day !== null && (
                <>
                  <div className="mb-1 font-medium">{day}</div>
                  {byDay.get(day)?.map((e) => (
                    <div
                      key={e.id}
                      className={`mb-1 truncate rounded-md border px-1.5 py-0.5 text-[10px] ${statusColor(day)}`}
                      title={`${e.name} — ${brl(Number(e.amount))}`}
                    >
                      {e.name}
                    </div>
                  ))}
                </>
              )}
            </div>
          ))}
        </div>
      </Card>

      <div className="flex gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" />Pago</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-500" />Próximo</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-500" />Atrasado</span>
      </div>

      <Card className="rounded-2xl p-4 shadow-none md:p-6">
        <div className="mb-3 text-sm font-medium">Contas do mês</div>
        <ul className="divide-y divide-border">
          {[...expenses].sort((a, b) => a.due_day - b.due_day).map((e) => {
            const overdue = e.status !== "pago" && e.due_day < today;
            return (
              <li key={e.id} className="flex items-center gap-3 py-3">
                <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-muted text-xs font-semibold">
                  {e.due_day}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{e.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {e.status === "pago" ? "Pago" : overdue ? "Atrasado" : "Pendente"}
                    {e.installment_current && e.installment_total ? ` • ${e.installment_current}/${e.installment_total}` : ""}
                  </div>
                </div>
                <div className="text-sm font-semibold tabular-nums">{brl(Number(e.amount))}</div>
                {e.status !== "pago" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => setPayOpen({ id: e.id, amount: Number(e.amount), name: e.name })}
                  >
                    Pagar
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </Card>

      {payOpen && (
        <PayExpenseDialog
          open={!!payOpen}
          onOpenChange={(v) => !v && setPayOpen(null)}
          expenseId={payOpen.id}
          amount={payOpen.amount}
          description={payOpen.name}
        />
      )}
    </div>
  );
}
