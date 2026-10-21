import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { OwnerSelect, type Owner } from "@/components/OwnerBadge";
import { EntryAiTools } from "@/components/EntryAiTools";

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
  const [categoryLabel, setCategoryLabel] = useState("");
  const [realized, setRealized] = useState(true);
  const today = new Date().toLocaleDateString("en-CA");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sem sessão");
      const { error } = await supabase.rpc("save_financial_entry", {
        p_type: "receita", p_name: name, p_amount: Number(amount), p_date: date,
        p_category: kind, p_label: categoryLabel || kind, p_owner: owner,
        p_recurring: recurring, p_realized: realized && date <= today,
      });
      if (error) throw error;
      toast.success("Receita lançada");
      qc.invalidateQueries();
      setName(""); setAmount(""); setKind("extra"); setRecurring(false); setCategoryLabel("");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao lançar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-2xl">
        <DialogHeader><DialogTitle>Nova receita</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <EntryAiTools type="receita" description={name} amount={amount} onSuggestion={(s) => {
            setName(s.description); if (s.amount !== null) setAmount(String(s.amount));
            if (s.date && /^\d{4}-\d{2}-\d{2}$/.test(s.date)) setDate(s.date);
            setKind(s.kind); setCategoryLabel(s.category);
          }} />
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
              <Input type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
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
              <Label>Data</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <label className="flex items-end gap-2 pb-2">
              <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} />
              <span className="text-sm">Recorrente</span>
            </label>
          </div>
          <Button type="submit" className="w-full rounded-xl" disabled={loading}>
            {loading ? "Salvando..." : "Lançar receita"}
          </Button>
          <div className="space-y-2"><Label>Categoria do lançamento</Label><Input aria-label="Categoria do lançamento" value={categoryLabel} maxLength={80} onChange={(e) => setCategoryLabel(e.target.value)} placeholder="Ex.: Salário, Comissão" /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={realized && date <= today} disabled={date > today} onChange={(e) => setRealized(e.target.checked)} />Receita já recebida</label>
        </form>
      </DialogContent>
    </Dialog>
  );
}
