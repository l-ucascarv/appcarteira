export type EntryClassification = "fixa" | "variavel";

export function quickEntrySchedule(type: "entrada" | "saida", classification: EntryClassification, installments: string) {
  const total = type === "saida" && classification === "variavel" && installments ? Number(installments) : 1;
  if (!Number.isInteger(total) || total < 1) throw new Error("Informe uma quantidade inteira de parcelas, a partir de 1.");
  return {
    p_category: type === "entrada" ? "extra" : classification,
    p_recurring: classification === "fixa" || total > 1,
    p_realized: false,
    p_installment_current: total > 1 ? 1 : undefined,
    p_installment_total: total > 1 ? total : undefined,
  };
}