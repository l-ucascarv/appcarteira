import { monthlyEntries } from "./monthly-report";
import { realizedBalance, type Expense, type Income, type Reserve, type Transaction } from "./finance";

export type PlannedMovement = { id: string; date: string; label: string; amount: number; type: "receita" | "despesa"; fixed: boolean };
export type CashDay = { date: string; balance: number; conservativeBalance: number; incoming: number; outgoing: number };
export type CashPlan = {
  currentBalance: number; reserved: number; committed: number; pendingIncome: number;
  spendableNow: number; projectedMonthEnd: number; minimumBalance: number;
  daily: CashDay[]; movements: PlannedMovement[]; warnings: string[];
};
const dateKey = (d: Date) => [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
const day = (d: Date) => new Date(d.getFullYear(),d.getMonth(),d.getDate());
const cents = (v: number) => Math.round(v*100)/100;
const valid = (n: unknown) => Number.isFinite(Number(n)) ? Number(n) : 0;
function wasRealized(t: Transaction[], id: string, kind: "receita" | "despesa", year: number, month: number) {
  return t.some(x => x.reference_id === id && x.kind === kind && new Date(x.occurred_at).getFullYear() === year && new Date(x.occurred_at).getMonth() === month);
}
/** Pure forecast. Never writes to accounts, expenses, income, or transactions. */
export function buildCashPlan(input: { income: Income[]; expenses: Expense[]; transactions: Transaction[]; reserves: Reserve[]; today?: Date; horizonDays?: number; safetyMargin?: number }): CashPlan {
  const today=day(input.today??new Date());
  const horizon=Math.min(365,Math.max(1,Math.trunc(input.horizonDays??90)));
  const last=day(new Date(today.getFullYear(),today.getMonth(),today.getDate()+horizon));
  const monthEnd=day(new Date(today.getFullYear(),today.getMonth()+1,0));
  const currentBalance=cents(realizedBalance(input.transactions,today));
  const reserved=cents(input.reserves.reduce((s,r)=>s+Math.max(0,valid(r.current_amount)),0));
  const safetyMargin=Math.max(0,valid(input.safetyMargin));
  const movements: PlannedMovement[]=[];
  for(let month=new Date(today.getFullYear(),today.getMonth(),1);month<=last;month=new Date(month.getFullYear(),month.getMonth()+1,1)){
    const entries=monthlyEntries(input.income,input.expenses,month);
    for(const e of entries){
      const occurrence=day(new Date(month.getFullYear(),month.getMonth(),e.day));
      if(occurrence<today || occurrence>last) continue;
      if(wasRealized(input.transactions,e.id,e.type,month.getFullYear(),month.getMonth())) continue;
      const original=e.type==="despesa"?input.expenses.find(x=>x.id===e.id):input.income.find(x=>x.id===e.id);
      const originalMonth=original && (e.type==="despesa" ? (original as Expense).due_date : (original as Income).reference_month);
      const isOriginalMonth=originalMonth ? new Date(String(originalMonth).slice(0,10)+"T12:00:00").getFullYear()===month.getFullYear() && new Date(String(originalMonth).slice(0,10)+"T12:00:00").getMonth()===month.getMonth():false;
      if(isOriginalMonth && (e.type==="despesa" ? (original as Expense).status==="pago" : (original as Income).status==="recebido")) continue;
      const amount=Math.max(0,valid(e.amount));
      if(!amount)continue;
      movements.push({id:e.id,date:dateKey(occurrence),label:e.description,amount,type:e.type,fixed:e.fixed});
    }
  }
  movements.sort((a,b)=>a.date.localeCompare(b.date)||(a.type==="despesa"?-1:1));
  const monthMovements=movements.filter(m=>m.date<=dateKey(monthEnd));
  const committed=cents(monthMovements.filter(m=>m.type==="despesa").reduce((s,m)=>s+m.amount,0));
  const pendingIncome=cents(monthMovements.filter(m=>m.type==="receita").reduce((s,m)=>s+m.amount,0));
  const spendableNow=cents(Math.max(0,currentBalance-reserved-committed-safetyMargin));
  let running=currentBalance;
  let conservative=currentBalance;
  const daily: CashDay[]=[];
  for(let d=new Date(today);d<=last;d.setDate(d.getDate()+1)){
    const key=dateKey(d);
    const events=movements.filter(m=>m.date===key);
    const incoming=events.filter(m=>m.type==="receita").reduce((s,m)=>s+m.amount,0);
    const outgoing=events.filter(m=>m.type==="despesa").reduce((s,m)=>s+m.amount,0);
    running+=incoming-outgoing;
    conservative-=outgoing; // future income is not spendable until confirmed
    daily.push({date:key,balance:cents(running),conservativeBalance:cents(conservative),incoming:cents(incoming),outgoing:cents(outgoing)});
  }
  const projectedMonthEnd=daily.find(x=>x.date===dateKey(monthEnd))?.balance??currentBalance;
  const minimumBalance=Math.min(currentBalance,...daily.map(x=>x.balance));
  const warnings:string[]=[];
  if(currentBalance<reserved+committed+safetyMargin)warnings.push("O saldo atual não cobre todas as contas previstas, reservas e margem de segurança deste mês.");
  if(daily.some(x=>x.balance<reserved+safetyMargin))warnings.push("A projeção indica dias abaixo da reserva e margem de segurança. Receitas previstas não são garantidas.");
  if(!movements.length)warnings.push("Sem lançamentos futuros cadastrados: a projeção pode estar incompleta.");
  return {currentBalance,reserved,committed,pendingIncome,spendableNow,projectedMonthEnd:cents(projectedMonthEnd),minimumBalance:cents(minimumBalance),daily,movements,warnings};
}
export type DebtAdvice={date:string|null;possible:boolean;reason:string;balanceAfter:number|null};
/** Simulate settling one existing scheduled debt once, not an extra payment on top of its due date. */
export function suggestDebtPayment(plan:CashPlan,expense:Expense,options?:{discount?:number;extraCostIfDelayed?:number;safetyMargin?:number}):DebtAdvice{
  const amount=Math.max(0,valid(expense.amount)-Math.max(0,valid(options?.discount)));
  const threshold=plan.reserved+Math.max(0,valid(options?.safetyMargin));
  const due=plan.movements.find(m=>m.id===expense.id&&m.type==="despesa");
  if(!due)return {date:null,possible:false,reason:"Essa dívida não possui uma parcela pendente identificada na projeção. Cadastre o vencimento antes de simular.",balanceAfter:null};
  const dates=plan.daily.filter(d=>d.date<=due.date);
  for(const candidate of dates){
    // Replace scheduled installment with a payment on the candidate date.
    const simulated=plan.daily.map(d=>({date:d.date,balance:d.balance+(d.date>=due.date?due.amount:0)-(d.date>=candidate.date?amount:0)}));
    const lowest=Math.min(plan.currentBalance-amount,...simulated.filter(d=>d.date>=candidate.date).map(d=>d.balance));
    if(lowest>=threshold){
      const balanceAfter=simulated.find(d=>d.date===candidate.date)?.balance??null;
      return {date:candidate.date,possible:true,balanceAfter:balanceAfter===null?null:cents(balanceAfter),reason:options?.extraCostIfDelayed ? "Data candidata com caixa suficiente; compare juros, multas e desconto antes de decidir." : "Data candidata sem romper a reserva na projeção. Juros, multas e descontos ainda precisam ser informados para indicar a opção financeiramente mais barata."};
    }
  }
  return {date:null,possible:false,balanceAfter:null,reason:"Nenhuma data até o vencimento mantém a reserva protegida na projeção. Considere negociar prazo ou parcelas; não pague antecipadamente sem revisar o caixa."};
}
