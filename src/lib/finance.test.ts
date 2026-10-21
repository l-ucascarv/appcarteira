import { describe, it, expect } from "vitest";
import { realizedBalance, futureFixedCommitment, monthIncomeExpected, type Expense, type Income } from "./finance";
const today = new Date(2026, 9, 21);
const expense = (id: string, amount: number, category: string, due_date: string, status: Expense["status"] = "pendente"): Expense => ({ id, name: id, amount, category, due_date, due_day: Number(due_date.slice(8)), status, installment_current: null, installment_total: null, note: null });
describe("saldos solicitados", () => {
  it("saldo anterior + entrada - saída, sem futuro nem reserva", () => {
    expect(realizedBalance([{ amount: 1000, kind: "receita", occurred_at: "2026-10-20T12:00:00" }, { amount: 300, kind: "receita", occurred_at: "2026-10-21T12:00:00" }, { amount: -100, kind: "despesa", occurred_at: "2026-10-21T12:00:00" }, { amount: 900, kind: "receita", occurred_at: "2026-10-22T12:00:00" }, { amount: -50, kind: "reserva", occurred_at: "2026-10-21T12:00:00" }], today)).toBe(1200);
  });
  it("comprometido soma fixos pendentes e futuros só do mês corrente", () => {
    expect(futureFixedCommitment([expense("fixa atrasada", 500, "fixa", "2026-10-05"), expense("fixa mensal", 200, "fixa", "2026-09-10", "pago"), expense("futura", 100, "variavel", "2026-10-25"), expense("paga", 50, "fixa", "2026-10-10", "pago"), expense("novembro", 900, "extra", "2026-11-02")], today)).toBe(800);
  });
  it("receitas do mês incluem comissão e todos os tipos sem recorrente futuro", () => {
    const income = ["salario", "plantao", "comissao", "extra"].map((kind) => ({ id: kind, name: kind, kind, amount: 100, reference_month: "2026-10-21", recurring: false, status: "previsto", received_at: null })) as Income[];
    income.push({ ...income[0], id: "futura", recurring: true, reference_month: "2026-11-01", amount: 1000 });
    expect(monthIncomeExpected(income, today)).toBe(400);
  });
  it("fixo pago no mês não fica comprometido novamente", () => {
    expect(futureFixedCommitment([expense("aluguel", 500, "fixa", "2026-09-10", "pago")], today, [{ amount: -500, kind: "despesa", reference_id: "aluguel", occurred_at: "2026-10-10T12:00:00" }])).toBe(0);
  });
});