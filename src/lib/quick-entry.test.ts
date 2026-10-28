import { describe, expect, it } from "vitest";
import { quickEntrySchedule } from "./quick-entry";

describe("lançamento simplificado", () => {
  it("despesa variável com 3 parcelas começa em 1 de 3 e se repete", () => {
    expect(quickEntrySchedule("saida", "variavel", "3")).toEqual({ p_category: "variavel", p_recurring: true, p_realized: false, p_installment_current: 1, p_installment_total: 3 });
  });
  it("receita fixa se repete sem criar movimento realizado", () => {
    expect(quickEntrySchedule("entrada", "fixa", "")).toMatchObject({ p_recurring: true, p_realized: false });
  });
  it("receita variável não se repete nem herda parcelas da despesa", () => {
    expect(quickEntrySchedule("entrada", "variavel", "3")).toMatchObject({ p_recurring: false, p_installment_total: undefined });
  });
  it("não aceita parcelas fracionadas", () => {
    expect(() => quickEntrySchedule("saida", "variavel", "2.5")).toThrow();
  });
});