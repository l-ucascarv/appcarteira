import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { OwnerSelect, type Owner } from "@/components/OwnerBadge";

const CATEGORIES = ["fixa", "variavel", "parcelada", "extra"] as const;

export function AddExpenseDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("fixa");
  const [instCur, setInstCur] = useState("");
  const [instTot, setInstTot] = useState("");
  const [note, setNote] = useState("");
  const [owner, setOwner] = useState<Owner>("ele");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sem sessão");
      const { error } = await supabase.from("expenses").insert({
        user_id: u.user.id,
        owner,
        name,
        amount: Number(amount),
        due_day: Number(dueDate.slice(8, 10)),
        category,
        status: "pendente",
        installment_current: instCur ? Number(instCur) : null,
        installment_total: instTot ? Number(instTot) : null,
        note: note || null,
      });
      if (error) throw error;
      toast.success("Despesa lançada");
      qc.invalidateQueries();
      setName(""); setAmount(""); setDueDate(dueDate); setCategory("fixa");
      setInstCur(""); setInstTot(""); setNote("");
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
        <DialogHeader><DialogTitle>Nova despesa</DialogTitle></DialogHeader>
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
              <Label>Data de vencimento</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Categoria</Label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as typeof category)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Parcela atual</Label>
              <Input type="number" min="1" value={instCur} onChange={(e) => setInstCur(e.target.value)} placeholder="opcional" />
            </div>
            <div className="space-y-2">
              <Label>Total de parcelas</Label>
              <Input type="number" min="1" value={instTot} onChange={(e) => setInstTot(e.target.value)} placeholder="opcional" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Observação</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="opcional" />
          </div>
          <Button type="submit" className="w-full rounded-xl" disabled={loading}>
            {loading ? "Salvando..." : "Lançar despesa"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
