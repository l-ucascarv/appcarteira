import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { brl } from "@/lib/format";
import { distribute } from "@/lib/finance";
import { useAccounts, useReserves, useExpenses, useReceiveIncome } from "@/lib/queries";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

export function ReceiveIncomeDialog({
  open,
  onOpenChange,
  incomeId,
  amount,
  description,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  incomeId: string;
  amount: number;
  description: string;
}) {
  const { data: accounts = [] } = useAccounts();
  const { data: reserves = [] } = useReserves();
  const { data: expenses = [] } = useExpenses();
  const mutation = useReceiveIncome();
  const [applied, setApplied] = useState(false);

  const account = accounts[0];
  const committed = expenses.filter((e) => e.status !== "pago").reduce((s, e) => s + Number(e.amount), 0);
  const plan = distribute(amount, reserves, committed);

  const apply = async () => {
    if (!account) {
      toast.error("Nenhuma conta cadastrada");
      return;
    }
    try {
      await mutation.mutateAsync({
        incomeId,
        amount,
        description,
        accountId: account.id,
        accountBalance: Number(account.balance),
        distribution: plan.map((p) => ({ reserveId: p.reserveId as string, value: p.value })),
      });
      setApplied(true);
      toast.success("Receita distribuída automaticamente");
      setTimeout(() => {
        onOpenChange(false);
        setApplied(false);
      }, 900);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao distribuir");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" /> Receita recebida
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <div className="text-sm text-muted-foreground">{description}</div>
            <div className="text-3xl font-semibold tracking-tight">{brl(amount)}</div>
          </div>

          <div className="rounded-xl border p-4">
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Distribuição automática sugerida
            </div>
            <ul className="space-y-2">
              {plan.map((p, i) => (
                <li key={i} className="flex items-center justify-between text-sm">
                  <span>
                    <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px]">
                      {i + 1}
                    </span>
                    {p.label}
                  </span>
                  <span className="font-medium tabular-nums">{brl(p.value)}</span>
                </li>
              ))}
            </ul>
          </div>

          <Button className="w-full rounded-xl" onClick={apply} disabled={mutation.isPending || applied}>
            {applied ? "Aplicado ✓" : mutation.isPending ? "Aplicando..." : "Distribuir automaticamente"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
