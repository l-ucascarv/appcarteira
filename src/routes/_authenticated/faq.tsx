import { createFileRoute } from "@tanstack/react-router";
import { CircleHelp, Sparkles } from "lucide-react";
import { FinanceChat } from "@/components/FinanceChat";
import { SpendingAnalysis } from "@/components/SpendingAnalysis";
import { useExpenses, useIncome, useReserves, useTransactions } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/faq")({
  head: () => ({ meta: [{ title: "FAQ e assistente financeiro | Meu Caixa" }] }),
  component: FaqPage,
});

function FaqPage() {
  const { data: income = [] } = useIncome();
  const { data: expenses = [] } = useExpenses();
  const { data: transactions = [] } = useTransactions();
  const { data: reserves = [] } = useReserves();
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold"><CircleHelp className="h-6 w-6 text-primary" />FAQ e IA</h1>
        <p className="text-sm text-muted-foreground">Tire dúvidas e receba dicas a partir dos seus lançamentos, usando o assistente que já existe no Meu Caixa.</p>
      </header>
      <SpendingAnalysis signature={JSON.stringify([income,expenses,transactions,reserves])} />
      <section className="rounded-2xl bg-card p-5 shadow-[var(--shadow-card)]">
        <h2 className="flex items-center gap-2 text-base font-bold"><Sparkles className="h-4 w-4 text-primary" />Pergunte ao assessor financeiro</h2>
        <FinanceChat />
      </section>
      <p className="text-xs text-muted-foreground">As respostas são orientativas e podem conter imprecisões. Confirme valores e datas antes de tomar decisões.</p>
    </div>
  );
}
