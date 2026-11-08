import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { analyzeSpending } from "@/lib/ai-finance.functions";
import { Button } from "@/components/ui/button";
import { brl } from "@/lib/format";
import { FinanceChat } from "@/components/FinanceChat";
import { Sparkles, RefreshCw } from "lucide-react";

export function SpendingAnalysis({ signature }: { signature: string }) {
  const analyze = useServerFn(analyzeSpending);
  const [result, setResult] = useState<Awaited<ReturnType<typeof analyzeSpending>> | null>(null);
  const [savedSignature, setSavedSignature] = useState("");
  const [busy, setBusy] = useState(false);
  const stale = Boolean(result?.data) && savedSignature !== signature;
  async function run() {
    setBusy(true);
    try { setResult(await analyze()); setSavedSignature(signature); }
    catch (error) { setResult({ data: null, error: error instanceof Error ? error.message : "Erro na análise" }); }
    finally { setBusy(false); }
  }
  return <section className="spending-analysis space-y-3 rounded-2xl bg-card p-5 shadow-[var(--shadow-card)]">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-base font-bold"><Sparkles className="h-4 w-4 text-primary-ink" />Disponível para gastar</h2>
      <Button variant="dark" size="sm" disabled={busy} onClick={run}><RefreshCw className={`mr-2 h-4 w-4 ${busy ? "animate-spin" : ""}`} />{busy ? "Analisando…" : "Analisar com IA"}</Button>
    </div>
    <div className="text-3xl font-bold tracking-tight tabular-nums">{!stale && result?.data ? brl(result.data.available) : "—"}</div>
    {stale && <p className="text-sm text-muted-foreground">Lançamentos alterados. Atualize a análise.</p>}
    {result?.error && <p role="alert" className="text-sm text-danger">{result.error}</p>}
    {!stale && result?.data && <>
      <p className="text-sm text-muted-foreground">{result.data.explanation}</p>
      <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
        <div><dt className="text-muted-foreground">Entradas projetadas</dt><dd>{brl(result.data.projectedIncome)}</dd></div>
        <div><dt className="text-muted-foreground">Saídas projetadas</dt><dd>{brl(result.data.projectedExpenses)}</dd></div>
        <div><dt className="text-muted-foreground">Margem de segurança</dt><dd>{brl(result.data.safetyMargin)}</dd></div>
      </dl>
      {result.data.warnings.map((warning, i) => <p key={i} className="text-xs text-muted-foreground">{warning}</p>)}
      <p className="text-xs text-muted-foreground">Estimativa até o fim do mês; receitas previstas não são saldo disponível.</p>
    </>}
    <FinanceChat />
  </section>;
}