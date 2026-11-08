import { describe, expect, it } from "vitest";
import { buildCashPlan, suggestDebtPayment } from "./cash-planner";
import type { Expense, Income, Transaction } from "./finance";
const today=new Date(2026,10,8);
const expense=(id:string,amount:number,date:string,category="variavel",status:Expense["status"]="pendente"):Expense=>({id,name:id,amount,due_date:date,due_day:Number(date.slice(8)),category,status,installment_current:null,installment_total:null,note:null});
const income=(id:string,amount:number,date:string):Income=>({id,name:id,amount,kind:"extra",reference_month:date,recurring:false,status:"previsto",received_at:null});
const balance:Transaction[]=[{amount:5000,kind:"receita",occurred_at:"2026-11-07T12:00:00"}];
describe("planejador financeiro",()=>{
 it("preserva saldo bancário e deduz despesas fixas e variáveis futuras",()=>{
  const plan=buildCashPlan({today,income:[income("salario",3000,"2026-11-15")],expenses:[expense("aluguel",2000,"2026-11-12","fixa"),expense("mercado",800,"2026-11-20")],transactions:balance,reserves:[],safetyMargin:500});
  expect(plan.currentBalance).toBe(5000);
  expect(plan.committed).toBe(2800);
  expect(plan.pendingIncome).toBe(3000);
  expect(plan.spendableNow).toBe(1700);
  expect(plan.projectedMonthEnd).toBe(5200);
 });
 it("não desconta novamente despesa realizada",()=>{
  const plan=buildCashPlan({today,income:[],expenses:[expense("pago",700,"2026-11-10","fixa"),expense("pendente",300,"2026-11-15")],transactions:[...balance,{amount:-700,kind:"despesa",reference_id:"pago",occurred_at:"2026-11-08T09:00:00"}],reserves:[]});
  expect(plan.currentBalance).toBe(4300);
  expect(plan.committed).toBe(300);
  expect(plan.spendableNow).toBe(4000);
 });
 it("não soma receita prevista ao dinheiro livre",()=>{
  const plan=buildCashPlan({today,income:[income("prevista",10000,"2026-11-12")],expenses:[],transactions:balance,reserves:[]});
  expect(plan.spendableNow).toBe(5000);
  expect(plan.projectedMonthEnd).toBe(15000);
 });
 it("reserva reduz disponível sem movimentar banco",()=>{
  const plan=buildCashPlan({today,income:[],expenses:[],transactions:balance,reserves:[{id:"r",name:"Emergência",goal_amount:5000,current_amount:1500,priority:1,color:null}]});
  expect(plan.currentBalance).toBe(5000);
  expect(plan.spendableNow).toBe(3500);
 });
 it("simula substituir parcela, sem descontar duas vezes",()=>{
  const debt=expense("divida",1500,"2026-11-20");
  const plan=buildCashPlan({today,income:[],expenses:[debt],transactions:balance,reserves:[]});
  const result=suggestDebtPayment(plan,debt);
  expect(result.possible).toBe(true);
  expect(result.date).toBe("2026-11-08");
  expect(result.balanceAfter).toBe(3500);
 });
 it("não recomenda pagamento se a reserva ficaria descoberta",()=>{
  const debt=expense("divida",4500,"2026-11-20");
  const plan=buildCashPlan({today,income:[],expenses:[debt],transactions:balance,reserves:[{id:"r",name:"Reserva",goal_amount:2000,current_amount:2000,priority:1,color:null}]});
  expect(suggestDebtPayment(plan,debt).possible).toBe(false);
 });
});
