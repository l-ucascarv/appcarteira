import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { brl } from "@/lib/format";
import { useAccounts, usePayExpense } from "@/lib/queries";
import { toast } from "sonner";
import { CircleDollarSign } from "lucide-react";

export function PayExpenseDialog({
  open,
  onOpenChange,
  expenseId,
  amount,
  description,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  expenseId: string;
  amount: number;
  description: string;
}) {
  const { data: accounts = [] } = useAccounts();
  const mutation = usePayExpense();
  const account = accounts[0];
  const newBalance = account ? Number(account.balance) - amount : 0;

  const apply = async () => {
    if (!account) {
      toast.error("Nenhuma conta cadastrada");
      return;
    }
    try {
      await mutation.mutateAsync({
        expenseId,
        amount,
        description,
        accountId: account.id,
        accountBalance: Number(account.balance),
      });
      toast.success("Despesa paga");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao pagar");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CircleDollarSign className="h-5 w-5" /> Pagar despesa
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <div className="text-sm text-muted-foreground">{description}</div>
            <div className="text-3xl font-semibold tracking-tight">{brl(amount)}</div>
          </div>
          <div className="rounded-xl border p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Saldo atual</span>
              <span className="tabular-nums">{brl(Number(account?.balance ?? 0))}</span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-muted-foreground">Saldo após pagamento</span>
              <span className={`tabular-nums font-medium ${newBalance < 0 ? "text-rose-600" : ""}`}>
                {brl(newBalance)}
              </span>
            </div>
          </div>
          <Button className="w-full rounded-xl" onClick={apply} disabled={mutation.isPending}>
            {mutation.isPending ? "Pagando..." : "Confirmar pagamento"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
