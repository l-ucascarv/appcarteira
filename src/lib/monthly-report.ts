import { parseLocalDate, repeatsMonthly, installmentActive, type Income, type Expense, type Transaction } from "./finance";

export type ReportEntry = {
  id: string; type: "receita" | "despesa"; description: string; category: string;
  amount: number; day: number; owner: string; fixed: boolean;
};
const sameMonth = (date: Date, month: Date) => date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth();
const monthNumber = (date: Date) => date.getFullYear() * 12 + date.getMonth();
const occurrenceDay = (day: number, month: Date) => Math.min(Math.max(1, day), new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate());

export function monthlyEntries(income: Income[], expenses: Expense[], month: Date): ReportEntry[] {
  const result: ReportEntry[] = [];
  for (const entry of income) {
    const date = entry.reference_month ? parseLocalDate(entry.reference_month) : null;
    if (date ? (entry.recurring ? monthNumber(date) > monthNumber(month) : !sameMonth(date, month)) : !entry.recurring) continue;
    result.push({ id: entry.id, type: "receita", description: entry.name, category: entry.category_label || entry.kind,
      amount: Number(entry.amount), day: occurrenceDay(date?.getDate() ?? 5, month), owner: (entry as Income & { owner?: string }).owner ?? "ele", fixed: false });
  }
  for (const entry of expenses) {
    const date = parseLocalDate(entry.due_date);
    const recurring = repeatsMonthly(entry);
    const elapsed = monthNumber(month) - monthNumber(date);
    if (recurring ? elapsed < 0 : !sameMonth(date, month)) continue;
    if (recurring && !installmentActive(entry, elapsed)) continue;
    const parcel = Number(entry.installment_total) > 1 ? ` (${(Number(entry.installment_current) || 1) + Math.max(0, elapsed)}/${entry.installment_total})` : "";
    result.push({ id: entry.id, type: "despesa", description: entry.name + parcel, category: entry.category_label || entry.category,
      amount: Number(entry.amount), day: occurrenceDay(recurring ? entry.due_day : date.getDate(), month), owner: (entry as Expense & { owner?: string }).owner ?? "ele", fixed: entry.category === "fixa" });
  }
  return result;
}

export function fixedMonthlyExpenses(expenses: Expense[], month: Date): ReportEntry[] {
  return monthlyEntries([], expenses, month).filter((entry) => entry.fixed).sort((a, b) => a.day - b.day || a.description.localeCompare(b.description));
}

export function categoryTotals(entries: ReportEntry[], type: ReportEntry["type"]) {
  const groups = new Map<string, { category: string; amount: number; entries: ReportEntry[] }>();
  for (const entry of entries.filter((item) => item.type === type)) {
    const key = entry.category.trim().toLocaleLowerCase("pt-BR");
    const group = groups.get(key) ?? { category: entry.category, amount: 0, entries: [] };
    group.amount += entry.amount; group.entries.push(entry); groups.set(key, group);
  }
  const total = [...groups.values()].reduce((sum, group) => sum + group.amount, 0);
  return [...groups.values()].sort((a, b) => b.amount - a.amount).map((group) => ({ ...group, percent: total ? group.amount / total * 100 : 0 }));
}

/** Daily account balances use actual movements only, never planned entries or future dates. */
export function realizedOpeningBalance(transactions: Transaction[], month: Date, today = new Date()) {
  const cutoff = Math.min(new Date(month.getFullYear(), month.getMonth(), 1).getTime(),
    new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).getTime());
  return transactions.filter((item) => (item.kind === "receita" || item.kind === "despesa") && new Date(item.occurred_at).getTime() < cutoff)
    .reduce((sum, item) => sum + Number(item.amount), 0);
}

/** Scheduling owns the date; the saved timestamp preserves hour, minute and second. */
export function entryChronology(month: Date, day: number, recordedAt?: string | null) {
  const time = recordedAt ? new Date(recordedAt) : null;
  const valid = time && Number.isFinite(time.getTime()) ? time : null;
  return new Date(month.getFullYear(), month.getMonth(), day, valid?.getHours() ?? 0,
    valid?.getMinutes() ?? 0, valid?.getSeconds() ?? 0, valid?.getMilliseconds() ?? 0).getTime();
}

export function realizedDailyBalances(transactions: Transaction[], month: Date, today = new Date()) {
  const start = new Date(month.getFullYear(), month.getMonth(), 1).getTime();
  const cutoff = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).getTime();
  const movements = transactions.filter((item) =>
    (item.kind === "receita" || item.kind === "despesa") && new Date(item.occurred_at).getTime() < cutoff,
  );
  let balance = movements.filter((item) => new Date(item.occurred_at).getTime() < start)
    .reduce((sum, item) => sum + Number(item.amount), 0);
  return Array.from({ length: new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate() }, (_, index) => {
    const day = index + 1;
    const dayStart = new Date(month.getFullYear(), month.getMonth(), day).getTime();
    const dayEnd = new Date(month.getFullYear(), month.getMonth(), day + 1).getTime();
    balance += movements.filter((item) => {
      const time = new Date(item.occurred_at).getTime();
      return time >= dayStart && time < dayEnd;
    }).reduce((sum, item) => sum + Number(item.amount), 0);
    return { day, balance };
  });
}

export function horizonMonth(income: Income[], expenses: Expense[], transactions: (Transaction & { id?: string; description?: string; owner?: string })[], month: Date) {
  const start = new Date(month.getFullYear(), month.getMonth(), 1).getTime();
  const financial = transactions.filter((item) => item.kind === "receita" || item.kind === "despesa");
  const startBalance = financial.filter((item) => new Date(item.occurred_at).getTime() < start).reduce((sum, item) => sum + Number(item.amount), 0);
  const movements = financial.filter((item) => sameMonth(new Date(item.occurred_at), month));
  const entries = monthlyEntries(income, expenses, month).filter((entry) => !movements.some((item) => item.reference_id === entry.id && item.kind === entry.type));
  for (const item of movements) entries.push({ id: item.id ?? `movement-${entries.length}`, type: item.kind as "receita" | "despesa", description: item.description ?? "Movimentação", category: "Movimentação", amount: Math.abs(Number(item.amount)), day: new Date(item.occurred_at).getDate(), owner: item.owner ?? "ele", fixed: false });
  let balance = startBalance;
  let totalIn = 0; let totalOut = 0;
  const rows = Array.from({ length: new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate() }, (_, i) => {
    const day = i + 1;
    const ins = entries.filter((entry) => entry.day === day && entry.type === "receita");
    const outs = entries.filter((entry) => entry.day === day && entry.type === "despesa");
    const sumIn = ins.reduce((sum, entry) => sum + entry.amount, 0);
    const sumOut = outs.reduce((sum, entry) => sum + entry.amount, 0);
    totalIn += sumIn; totalOut += sumOut; balance += sumIn - sumOut;
    return { day, ins, outs, sumIn, sumOut, balance };
  });
  return { startBalance, totalIn, totalOut, endBalance: balance, rows };
}