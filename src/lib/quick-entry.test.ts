import { describe, expect, it } from "vitest";
import { quickEntrySchedule } from "./quick-entry";

describe("lançamento simplificado", () => {
  it("despesa variável com 3 parcelas começa em 1 de 3 e se repete", () => {
    expect(quickEntrySchedule("saida", "variavel", "3")).toEqual({ p_category: "variavel", p_recurring: true, p_realized: true, p_installment_current: 1, p_installment_total: 3 });
  });
  it("receita fixa se repete e já entra como realizada por padrão", () => {
    expect(quickEntrySchedule("entrada", "fixa", "")).toMatchObject({ p_recurring: true, p_realized: true });
  });
  it("receita variável não se repete nem herda parcelas da despesa", () => {
    expect(quickEntrySchedule("entrada", "variavel", "3")).toMatchObject({ p_recurring: false, p_installment_total: undefined });
  });
  it("respeita a marcação de pendente quando informada", () => {
    expect(quickEntrySchedule("saida", "fixa", "", false)).toMatchObject({ p_realized: false, p_recurring: true });
  });
  it("não aceita parcelas fracionadas", () => {
    expect(() => quickEntrySchedule("saida", "variavel", "2.5")).toThrow();
  });
});
