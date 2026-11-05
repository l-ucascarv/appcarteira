import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Account, Expense, Income, Reserve } from "./finance";
import { filterByScope, useViewScope } from "./view-scope";

function useUid() {
  return useQuery({ queryKey: ["uid"], staleTime: Infinity, queryFn: currentUserId }).data;
}

function useScopedFilter() {
  const scope = useViewScope();
  const uid = useUid();
  return <T extends { user_id?: string | null }>(rows: T[]) => filterByScope(rows, scope, uid);
}

async function currentUserId() {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const uid = await currentUserId();
      if (!uid) return null;
      const { data } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
      return data;
    },
  });
}

export function useAccounts() {
  return useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("accounts").select("*").order("created_at");
      if (error) throw error;
      return (data ?? []) as Account[];
    },
  });
}

export function useIncome() {
  return useQuery({
    queryKey: ["income"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("income")
        .select("*")
        .order("reference_month", { ascending: true, nullsFirst: true });
      if (error) throw error;
      return (data ?? []) as Income[];
    },
  });
}

export function useExpenses() {
  return useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("expenses").select("*").order("due_day");
      if (error) throw error;
      return (data ?? []) as Expense[];
    },
  });
}

export function useReserves() {
  return useQuery({
    queryKey: ["reserves"],
    queryFn: async () => {
      const { data, error } = await supabase.from("reserves").select("*").order("priority");
      if (error) throw error;
      return (data ?? []) as Reserve[];
    },
  });
}

export function useGoals() {
  return useQuery({
    queryKey: ["goals"],
    queryFn: async () => {
      const { data, error } = await supabase.from("goals").select("*").order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useTransactions() {
  return useQuery({
    queryKey: ["transactions"],
    queryFn: async () => {
      const rows = [];
      for (let start = 0; ; start += 1000) {
        const { data, error } = await supabase.from("transactions").select("*")
          .order("occurred_at", { ascending: false }).order("id").range(start, start + 999);
        if (error) throw error;
        rows.push(...(data ?? []));
        if (!data || data.length < 1000) break;
      }
      return rows;
    },
  });
}

export function useInsights() {
  return useQuery({
    queryKey: ["insights"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("insights")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useReceiveIncome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      incomeId: string;
      amount: number;
      description: string;
      distribution: { reserveId: string; value: number }[];
      accountId: string;
      accountBalance: number;
    }) => {
      const uid = await currentUserId();
      if (!uid) throw new Error("Sem sessão");

      let running = Number(input.accountBalance) + Number(input.amount);

      await supabase.from("income").update({
        status: "recebido",
        received_at: new Date().toISOString(),
      }).eq("id", input.incomeId);

      await supabase.from("transactions").insert({
        user_id: uid,
        kind: "receita",
        description: input.description,
        amount: input.amount,
        balance_after: running,
        reference_id: input.incomeId,
      });

      for (const d of input.distribution) {
        if (d.reserveId === "livre" || d.reserveId === "contas") {
          await supabase.from("transactions").insert({
            user_id: uid,
            kind: "reserva",
            description: d.reserveId === "livre" ? "Reservado como livre" : "Reservado para contas do mês",
            amount: -d.value,
            balance_after: running,
          });
          continue;
        }
        const { data: reserve } = await supabase
          .from("reserves").select("current_amount").eq("id", d.reserveId).maybeSingle();
        const newAmount = Number(reserve?.current_amount ?? 0) + d.value;
        await supabase.from("reserves").update({ current_amount: newAmount }).eq("id", d.reserveId);
        await supabase.from("transactions").insert({
          user_id: uid,
          kind: "reserva",
          description: `Alocado em reserva`,
          amount: -d.value,
          balance_after: running,
          reference_id: d.reserveId,
        });
      }

      await supabase.from("accounts").update({ balance: running }).eq("id", input.accountId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["income"] });
      qc.invalidateQueries({ queryKey: ["reserves"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}

export function usePayExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { expenseId: string; amount: number; description: string; accountId: string; accountBalance: number }) => {
      const uid = await currentUserId();
      if (!uid) throw new Error("Sem sessão");
      const newBalance = Number(input.accountBalance) - Number(input.amount);
      await supabase.from("expenses").update({ status: "pago" }).eq("id", input.expenseId);
      await supabase.from("accounts").update({ balance: newBalance }).eq("id", input.accountId);
      await supabase.from("transactions").insert({
        user_id: uid,
        kind: "despesa",
        description: input.description,
        amount: -input.amount,
        balance_after: newBalance,
        reference_id: input.expenseId,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries();
    },
  });
}

type EntryTable = "income" | "expenses" | "transactions";

export function useDeleteEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { table: EntryTable; id: string }) => {
      const { error } = await supabase.from(input.table).delete().eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useDeleteAllEntries() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const uid = await currentUserId();
      if (!uid) throw new Error("Sem sessão");
      for (const t of ["transactions", "income", "expenses"] as EntryTable[]) {
        const { error } = await supabase.from(t).delete().eq("user_id", uid);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries(),
  });
}
