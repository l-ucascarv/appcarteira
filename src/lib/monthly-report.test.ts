import { describe, it, expect } from "vitest";
import { fixedMonthlyExpenses, horizonMonth, categoryTotals, monthlyEntries, realizedDailyBalances, realizedOpeningBalance, entryChronology, compareEntryChronology } from "./monthly-report";
import type { Expense, Income } from "./finance";
const month = new Date(2026, 9, 1);
const expense = (id: string, amount: number, category: string, due_date: string, status: Expense["status"] = "pendente"): Expense => ({ id, name: id, amount, category, due_date, due_day: Number(due_date.slice(8)), status, installment_current: null, installment_total: null, note: null });
const income: Income[] = [{ id: "salary", name: "Salário", amount: 1000, kind: "salario", category_label: "Trabalho", reference_month: "2026-10-20", recurring: false, status: "previsto", received_at: null }];
describe("painéis mensais", () => {
  it("saldo residual passa ao próximo mês sem contar movimentações do novo mês", () => {
    const movements = [
      { kind: "receita", amount: 1000, occurred_at: "2026-09-15T10:00:00" },
      { kind: "despesa", amount: -200, occurred_at: "2026-09-30T23:59:59" },
      { kind: "despesa", amount: -50, occurred_at: "2026-10-01T00:00:00" },
    ];
    expect(realizedOpeningBalance(movements, month, new Date(2026, 9, 20))).toBe(800);
    expect(realizedDailyBalances(movements, month, new Date(2026, 9, 20))[0].balance).toBe(750);
  });
  it.each(["asc", "desc"] as const)("ordena por dia, hora e segundo na direção %s, crescente por padrão", (order) => {
    const records = [
      { id: "earlier-day", day: 2, at: "2026-09-01T23:59:59" },
      { id: "earlier-hour", day: 3, at: "2026-09-01T10:00:59" },
      { id: "earlier-second", day: 3, at: "2026-09-01T11:00:01" },
      { id: "latest", day: 3, at: "2026-09-01T11:00:02" },
    ];
    const entries = records.map((r) => ({ ...r, timestamp: entryChronology(month, r.day, r.at) }));
    const ascending = ["earlier-day", "earlier-hour", "earlier-second", "latest"];
    expect([...entries].sort(compareEntryChronology).map((r) => r.id)).toEqual(ascending);
    expect(entries.sort((a, b) => compareEntryChronology(a, b, order)).map((r) => r.id))
      .toEqual(order === "asc" ? ascending : [...ascending].reverse());
  });
  it("saldo das colunas soma realizado anterior e do dia, excluindo futuros e reservas", () => {
    const result = realizedDailyBalances([
      { kind: "receita", amount: 300, occurred_at: "2026-09-30T12:00:00" },
      { kind: "receita", amount: 1000, occurred_at: "2026-10-02T12:00:00" },
      { kind: "despesa", amount: -200, occurred_at: "2026-10-03T12:00:00" },
      { kind: "reserva", amount: -50, occurred_at: "2026-10-03T12:00:00" },
      { kind: "despesa", amount: -900, occurred_at: "2026-10-25T12:00:00" },
    ], month, new Date(2026, 9, 20));
    expect(result[0].balance).toBe(300);
    expect(result[1].balance).toBe(1300);
    expect(result[2].balance).toBe(1100);
    expect(result[24].balance).toBe(1100);
  });
  it("desmarcar um pagamento remove seu impacto do saldo diário", () => {
    const paid = [{ kind: "despesa", amount: -200, occurred_at: "2026-10-03T12:00:00" }];
    expect(realizedDailyBalances(paid, month, new Date(2026, 9, 20))[2].balance).toBe(-200);
    expect(realizedDailyBalances([], month, new Date(2026, 9, 20))[2].balance).toBe(0);
  });
  it("receita fixa aparece mensalmente a partir da data inicial, mesmo pendente", () => {
    const salary = { ...income[0], recurring: true };
    expect(monthlyEntries([salary], [], new Date(2026, 8, 1))).toEqual([]);
    for (const m of [9, 10, 11, 12]) {
      expect(monthlyEntries([salary], [], new Date(2026, m, 1))).toEqual([expect.objectContaining({ id: "salary", amount: 1000, day: 20 })]);
    }
  });
  it("comprometido em Saldos acompanha inclusão, edição e exclusão de fixos", () => {
    const total = (expenses: Expense[]) => fixedMonthlyExpenses(expenses, month).reduce((sum, entry) => sum + entry.amount, 0);
    const rent = expense("aluguel", 500, "fixa", "2026-09-10", "pago");
    const internet = expense("internet", 80, "fixa", "2026-10-25");
    const variable = expense("mercado", 100, "variavel", "2026-10-25");
    expect(total([])).toBe(0);
    expect(total([rent, variable])).toBe(500);
    expect(total([rent, internet, variable])).toBe(580);
    expect(total([rent, { ...internet, amount: 120 }, variable])).toBe(620);
    expect(total([rent, { ...internet, category: "variavel" }, variable])).toBe(500);
    expect(total([internet, variable])).toBe(80);
  });
  it("comprometido é somente fixos do mês, incluindo pagos e vencimentos", () => {
    const result = fixedMonthlyExpenses([expense("aluguel", 500, "fixa", "2026-09-10", "pago"), expense("mercado", 100, "variavel", "2026-10-21"), expense("futuro", 900, "fixa", "2026-11-01"), expense("internet", 80, "fixa", "2026-10-25")], month);
    expect(result.map((entry) => [entry.id, entry.day, entry.amount])).toEqual([["aluguel", 10, 500], ["internet", 25, 80]]);
    expect(result.reduce((sum, entry) => sum + entry.amount, 0)).toBe(580);
  });
  it("saldo diário é anterior mais todas as entradas menos despesas do dia", () => {
    const report = horizonMonth(income, [expense("conta", 200, "variavel", "2026-10-20"), expense("futura", 100, "variavel", "2026-10-25")], [{ kind: "receita", amount: 300, occurred_at: "2026-09-30T12:00:00" }], month);
    expect(report.rows[18].balance).toBe(300);
    expect(report.rows[19].balance).toBe(1100);
    expect(report.rows[24].balance).toBe(1000);
    expect(report.endBalance).toBe(report.startBalance + report.totalIn - report.totalOut);
    expect(report.endBalance).toBe(1000);
  });
  it("realizado substitui previsto sem duplicar entrada nem saída", () => {
    const report = horizonMonth(income, [expense("conta", 200, "fixa", "2026-10-20")], [{ kind: "receita", amount: 1000, occurred_at: "2026-10-21T12:00:00", reference_id: "salary" }, { kind: "despesa", amount: -200, occurred_at: "2026-10-21T12:00:00", reference_id: "conta" }], month);
    expect(report.totalIn).toBe(1000); expect(report.totalOut).toBe(200); expect(report.endBalance).toBe(800); expect(report.rows[19].balance).toBe(0);
  });
  it("tags ordena gastos e fontes de receita pela maior participação", () => {
    const entries = monthlyEntries(income, [expense("mercado", 100, "variavel", "2026-10-20"), expense("aluguel", 500, "fixa", "2026-10-10")], month);
    expect(categoryTotals(entries, "despesa").map((group) => group.amount)).toEqual([500, 100]);
    expect(categoryTotals(entries, "receita")[0]).toMatchObject({ category: "Trabalho", amount: 1000, percent: 100 });
  });
});
describe("parcelas de despesa variável", () => {
  it("3 parcelas aparecem nos 3 meses seguintes e param depois", async () => {
    const { monthlyEntries } = await import("./monthly-report");
    const e = { id: "tv", name: "TV", amount: 100, category: "variavel", due_date: "2026-10-10", due_day: 10, status: "pendente", installment_current: 1, installment_total: 3, note: null } as never;
    const count = (m: number) => monthlyEntries([], [e], new Date(2026, m, 1)).length;
    expect([count(9), count(10), count(11), count(12)]).toEqual([1, 1, 1, 0]);
  });
});
