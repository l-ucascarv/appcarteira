import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { OwnerSelect, type Owner } from "@/components/OwnerBadge";

const KINDS = ["salario", "plantao", "comissao", "extra"] as const;

export function AddIncomeDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [kind, setKind] = useState<(typeof KINDS)[number]>("extra");
  const [date, setDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [recurring, setRecurring] = useState(false);
  const [owner, setOwner] = useState<Owner>("ele");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sem sessão");
      const { error } = await supabase.from("income").insert({
        user_id: u.user.id,
        owner,
        name,
        amount: Number(amount),
        kind,
        reference_month: refMonth ? `${refMonth}-01` : null,
        recurring,
        status: "previsto",
      });
      if (error) throw error;
      toast.success("Receita lançada");
      qc.invalidateQueries();
      setName(""); setAmount(""); setKind("extra"); setRecurring(false);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao lançar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl">
        <DialogHeader><DialogTitle>Nova receita</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>Quem lançou</Label>
            <OwnerSelect value={owner} onChange={setOwner} />
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as typeof kind)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Mês de referência</Label>
              <Input type="month" value={refMonth} onChange={(e) => setRefMonth(e.target.value)} />
            </div>
            <label className="flex items-end gap-2 pb-2">
              <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} />
              <span className="text-sm">Recorrente</span>
            </label>
          </div>
          <Button type="submit" className="w-full rounded-xl" disabled={loading}>
            {loading ? "Salvando..." : "Lançar receita"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
