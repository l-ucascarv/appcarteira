import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buildCashPlan, suggestDebtPayment } from "@/lib/cash-planner";
import { useExpenses, useIncome, useReserves, useTransactions } from "@/lib/queries";
import { brl } from "@/lib/format";
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { CalendarClock, ShieldCheck, Sparkles } from "lucide-react";

export function PersonalPlanner() {
  const {data:income=[]}=useIncome();
  const {data:expenses=[]}=useExpenses();
  const {data:transactions=[]}=useTransactions();
  const {data:reserves=[]}=useReserves();
  const [safety,setSafety]=useState("0");
  const [selected,setSelected]=useState("");
  const [discount,setDiscount]=useState("0");
  const margin=Math.max(0,Number(safety)||0);
  const plan=useMemo(()=>buildCashPlan({income,expenses,transactions,reserves,safetyMargin:margin,horizonDays:90}),[income,expenses,transactions,reserves,margin]);
  const debts=expenses.filter(e=>plan.movements.some(m=>m.id===e.id&&m.type==="despesa"));
  const debt=debts.find(e=>e.id===selected);
  const advice=debt?suggestDebtPayment(plan,debt,{discount:Number(discount)||0,safetyMargin:margin}):null;
  const shortDate=(date:string)=>date.split("-").reverse().join("/");
  const chart=plan.daily.filter((_,i)=>i%3===0||i===plan.daily.length-1).map(d=>({date:d.date.slice(5).split("-").reverse().join("/"),saldo:d.balance}));
  return <Card className="space-y-4 p-4 sm:p-5">
    <div className="space-y-1"><h2 className="flex items-center gap-2 text-base font-bold"><Sparkles className="h-4 w-4 text-primary"/>🧭 Meu planejamento</h2><p className="text-xs text-muted-foreground">Saldo real separado do dinheiro comprometido. Simulações não movimentam sua conta.</p></div>
    <div className="rounded-2xl bg-muted/40 p-4">
      <p className="text-xs text-muted-foreground">💚 Disponível para gastar agora</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-success">{brl(plan.spendableNow)}</p>
      <p className="mt-1 text-xs text-muted-foreground">Saldo atual {brl(plan.currentBalance)} − contas pendentes {brl(plan.committed)} − reservas {brl(plan.reserved)} − margem {brl(margin)}</p>
    </div>
    <div className="grid grid-cols-2 gap-2 text-sm">
      <div className="min-w-0 rounded-xl border border-border p-3"><p className="text-xs text-muted-foreground">🔒 Contas a pagar no mês</p><strong className="tabular-nums">{brl(plan.committed)}</strong></div>
      <div className="min-w-0 rounded-xl border border-border p-3"><p className="text-xs text-muted-foreground">📥 Receitas previstas</p><strong className="tabular-nums">{brl(plan.pendingIncome)}</strong><p className="text-[11px] text-muted-foreground">Não incluídas no disponível</p></div>
      <div className="min-w-0 rounded-xl border border-border p-3"><p className="text-xs text-muted-foreground">📅 Saldo previsto no fim do mês</p><strong className="tabular-nums">{brl(plan.projectedMonthEnd)}</strong></div>
      <div className="min-w-0 rounded-xl border border-border p-3"><p className="text-xs text-muted-foreground">⚠️ Menor saldo em 90 dias</p><strong className="tabular-nums">{brl(plan.minimumBalance)}</strong></div>
    </div>
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-semibold"><CalendarClock className="h-4 w-4"/> Projeção diária — 90 dias</div>
      <div className="h-44 min-w-0" role="img" aria-label="Gráfico de saldo projetado nos próximos 90 dias">
        <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}><AreaChart data={chart} margin={{top:8,right:8,bottom:0,left:0}}><XAxis dataKey="date" tick={{fontSize:10}} minTickGap={30}/><Tooltip formatter={v=>brl(Number(v))}/><ReferenceLine y={plan.reserved+margin} stroke="var(--color-danger)" strokeDasharray="4 4"/><Area type="monotone" dataKey="saldo" stroke="var(--color-primary)" fill="var(--color-primary)" fillOpacity={0.12} isAnimationActive={false}/></AreaChart></ResponsiveContainer>
      </div>
      <p className="text-[11px] text-muted-foreground">Linha pontilhada: reservas e margem. Recebimentos futuros são estimativas, não garantias.</p>
    </div>
    <div className="space-y-3 rounded-xl border border-border p-3">
      <h3 className="flex items-center gap-2 text-sm font-bold"><ShieldCheck className="h-4 w-4"/> 🎯 Planejar quitação de dívida</h3>
      <label className="block space-y-1 text-xs">Margem mínima de segurança (R$)<Input type="number" inputMode="decimal" min="0" step="0.01" value={safety} onChange={e=>setSafety(e.target.value)} className="h-11 text-base"/></label>
      <label className="block space-y-1 text-xs">Dívida ou parcela cadastrada
        <select value={selected} onChange={e=>setSelected(e.target.value)} className="h-11 w-full min-w-0 rounded-xl border border-input bg-background px-3 text-sm">
          <option value="">Selecione uma conta</option>{debts.map(e=><option key={e.id} value={e.id}>{e.name} · {brl(Number(e.amount))}</option>)}
        </select>
      </label>
      {debt&&<label className="block space-y-1 text-xs">Desconto para quitar (R$)<Input type="number" inputMode="decimal" min="0" max={debt.amount} step="0.01" value={discount} onChange={e=>setDiscount(e.target.value)} className="h-11 text-base"/></label>}
      {advice&&<div className="space-y-1 rounded-xl bg-muted/50 p-3 text-sm"><strong>{advice.possible&&advice.date?`📆 Data candidata: ${shortDate(advice.date)}`:"⚠️ Sem data segura até o vencimento"}</strong><p className="text-xs text-muted-foreground">{advice.reason}</p>{advice.balanceAfter!==null&&<p className="text-xs">Saldo projetado após pagar: {brl(advice.balanceAfter)}</p>}</div>}
      {!debts.length&&<p className="text-xs text-muted-foreground">Cadastre uma conta pendente em Adicionar para simular a melhor data.</p>}
      <p className="text-[11px] text-muted-foreground">A simulação considera o fluxo cadastrado. Não inclui juros, multas ou descontos não informados. Não realiza pagamentos.</p>
    </div>
    {plan.warnings.map(w=><p key={w} className="rounded-lg bg-muted/50 p-2 text-xs text-muted-foreground">⚠️ {w}</p>)}
    <Button type="button" variant="outline" size="sm" onClick={()=>document.getElementById("planning-explanation")?.scrollIntoView({behavior:"smooth"})}>Como interpretar?</Button>
    <p id="planning-explanation" className="text-xs text-muted-foreground">O saldo real só muda com lançamentos realizados. O disponível protege todas as despesas pendentes cadastradas até o fim do mês, mesmo variáveis, e não antecipa receitas futuras. O gráfico mostra um cenário condicional de recebimentos e pagamentos nas datas previstas.</p>
  </Card>;
}
