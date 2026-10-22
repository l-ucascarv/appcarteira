// Pure calculation helpers for the Meu Caixa financial engine.
// Every value is derived from the RLS-scoped Supabase reads on the client.

export type Income = {
  id: string;
  name: string;
  kind: "salario" | "plantao" | "comissao" | "extra";
  amount: number;
  reference_month: string | null;
  recurring: boolean;
  status: "previsto" | "recebido";
  received_at: string | null;
  category_label?: string | null;
};

export type Expense = {
  id: string;
  name: string;
  amount: number;
  due_day: number;
  due_date: string;
  category: string;
  status: "pendente" | "pago" | "atrasado";
  installment_current: number | null;
  installment_total: number | null;
  note: string | null;
  category_label?: string | null;
};

export type Reserve = {
  id: string;
  name: string;
  goal_amount: number;
  current_amount: number;
  priority: number;
  color: string | null;
};

export type Account = { id: string; name: string; balance: number };

export type Transaction = {
  amount: number;
  kind: string;
  occurred_at: string;
  reference_id?: string | null;
};

export function realizedBalance(transactions: Transaction[], date = new Date()): number {
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime();
  return transactions
    .filter((transaction) => (transaction.kind === "receita" || transaction.kind === "despesa") && new Date(transaction.occurred_at).getTime() < end)
    .reduce((total, transaction) => total + Number(transaction.amount), 0);
}

export function realizedOnDate(transactions: Transaction[], date = new Date()): number {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime();
  return transactions
    .filter((transaction) => {
      const occurredAt = new Date(transaction.occurred_at).getTime();
      return occurredAt >= start && occurredAt < end &&
        (transaction.kind === "receita" || transaction.kind === "despesa");
    })
    .reduce((total, transaction) => total + Number(transaction.amount), 0);
}

export function parseLocalDate(value: string): Date {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day);
}

export type Balances = {
  saldoConta: number;
  saldoReservado: number;
  saldoComprometido: number;
  saldoLivre: number;
};

export function computeBalances(
  accounts: Account[],
  reserves: Reserve[],
  expenses: Expense[],
): Balances {
  const saldoConta = accounts.reduce((s, a) => s + Number(a.balance), 0);
  const saldoReservado = reserves.reduce((s, r) => s + Number(r.current_amount), 0);
  const saldoComprometido = expenses
    .filter((e) => e.status !== "pago")
    .reduce((s, e) => s + Number(e.amount), 0);
  const saldoLivre = Math.max(0, saldoConta - saldoReservado - saldoComprometido);
  return { saldoConta, saldoReservado, saldoComprometido, saldoLivre };
}

/** Expense repeats monthly: fixed, "parcelada", or any expense with installments informed. */
export function repeatsMonthly(e: Pick<Expense, "category" | "installment_total">) {
  return e.category === "fixa" || e.category === "parcelada" || Number(e.installment_total) > 1;
}
/** False when an installment expense has already ended in the given month offset. */
export function installmentActive(e: Pick<Expense, "installment_total" | "installment_current">, elapsedMonths: number) {
  const total = Number(e.installment_total);
  if (!total) return true;
  return (Number(e.installment_current) || 1) + elapsedMonths <= total;
}

export function currentMonthExpenses(expenses: Expense[], date = new Date()): Expense[] {
  const selectedMonth = new Date(date.getFullYear(), date.getMonth(), 1).getTime();
  return expenses.filter((expense) => {
    const due = parseLocalDate(expense.due_date);
    const dueMonth = new Date(due.getFullYear(), due.getMonth(), 1).getTime();
    const elapsed = (date.getFullYear() - due.getFullYear()) * 12 + date.getMonth() - due.getMonth();
    return repeatsMonthly(expense) ? dueMonth <= selectedMonth && installmentActive(expense, elapsed) : dueMonth === selectedMonth;
  });
}

export function futureFixedCommitment(expenses: Expense[], date = new Date(), transactions: Transaction[] = []): number {
  const today = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  return currentMonthExpenses(expenses, date)
    .filter((expense) => {
      const origin = parseLocalDate(expense.due_date);
      const sameMonth = origin.getFullYear() === date.getFullYear() && origin.getMonth() === date.getMonth();
      const paidThisMonth = transactions.some((t) => {
        const paid = new Date(t.occurred_at);
        return t.reference_id === expense.id && t.kind === "despesa" && paid.getFullYear() === date.getFullYear() && paid.getMonth() === date.getMonth() && paid.getTime() < today + 86400000;
      });
      if (paidThisMonth) return false;
      if (expense.status === "pago" && sameMonth) return false;
      const occurrence = new Date(date.getFullYear(), date.getMonth(), expense.due_day).getTime();
      return expense.category === "fixa" || occurrence >= today;
    })
    .reduce((total, expense) => total + Number(expense.amount), 0);
}

export function monthIncomeExpected(income: Income[], date = new Date()): number {
  const y = date.getFullYear();
  const m = date.getMonth();
  return income.reduce((s, i) => {
    if (i.recurring && (!i.reference_month || parseLocalDate(i.reference_month).getTime() <= new Date(y, m + 1, 0).getTime())) return s + Number(i.amount);
    if (i.reference_month) {
      const d = parseLocalDate(i.reference_month);
      if (d.getFullYear() === y && d.getMonth() === m) return s + Number(i.amount);
    }
    return s;
  }, 0);
}

export function monthExpensesTotal(expenses: Expense[]): number {
  return expenses.reduce((s, e) => s + Number(e.amount), 0);
}

export function nextBill(expenses: Expense[], today = new Date()): Expense | null {
  if (!expenses.length) return null;
  const day = today.getDate();
  const upcoming = [...expenses]
    .filter((e) => {
      if (e.status === "pago") return false;
      const recurring = e.category === "fixa" || e.category === "parcelada";
      return recurring || parseLocalDate(e.due_date).getTime() >= new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    })
    .sort((a, b) => {
      const da = a.due_day >= day ? a.due_day - day : a.due_day + 31;
      const db = b.due_day >= day ? b.due_day - day : b.due_day + 31;
      return da - db;
    });
  return upcoming[0] ?? null;
}

export function forecast(
  balance: number,
  monthlyIncome: number,
  monthlyExpenses: number,
  days: number,
): { date: string; balance: number }[] {
  const daily = (monthlyIncome - monthlyExpenses) / 30;
  const out: { date: string; balance: number }[] = [];
  let b = balance;
  const start = new Date();
  const step = Math.max(1, Math.floor(days / 30));
  for (let i = 0; i <= days; i += step) {
    b = balance + daily * i;
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    out.push({ date: d.toISOString().slice(0, 10), balance: Math.round(b * 100) / 100 });
  }
  return out;
}

export function reserveEta(monthlySaving: number, remaining: number): number {
  if (monthlySaving <= 0) return Infinity;
  return Math.ceil(remaining / monthlySaving);
}

// Cascade distribution: contas -> carro -> emergência -> investimentos -> livre
export function distribute(
  amount: number,
  reserves: Reserve[],
  committed: number,
): { reserveId: string | "livre" | "contas"; label: string; value: number }[] {
  const out: { reserveId: string | "livre" | "contas"; label: string; value: number }[] = [];
  let remaining = amount;

  if (committed > 0 && remaining > 0) {
    const v = Math.min(committed, remaining);
    out.push({ reserveId: "contas", label: "Reservar contas do mês", value: v });
    remaining -= v;
  }

  const priorities = [...reserves].sort((a, b) => a.priority - b.priority);
  for (const r of priorities) {
    if (remaining <= 0) break;
    const need = Math.max(0, Number(r.goal_amount) - Number(r.current_amount));
    if (need <= 0) continue;
    const v = Math.min(need, remaining);
    out.push({ reserveId: r.id, label: r.name, value: v });
    remaining -= v;
  }

  if (remaining > 0) {
    out.push({ reserveId: "livre", label: "Dinheiro livre", value: remaining });
  }
  return out;
}
