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
        p_type: "despesa", p_name: name, p_amount: Number(amount), p_date: dueDate,
        p_category: category, p_label: categoryLabel || category, p_owner: owner,
        p_recurring: category === "fixa" || category === "parcelada", p_realized: realized && dueDate <= today,
        p_installment_current: instCur ? Number(instCur) : undefined,
        p_installment_total: instTot ? Number(instTot) : undefined, p_note: note || undefined,
      });
      if (error) throw error;
      toast.success("Despesa lançada");
      qc.invalidateQueries();
      setName(""); setAmount(""); setDueDate(dueDate); setCategory("fixa");
      setInstCur(""); setInstTot(""); setNote(""); setCategoryLabel("");
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
        <DialogHeader><DialogTitle>Nova despesa</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <EntryAiTools type="despesa" description={name} amount={amount} onSuggestion={(s, fromPhoto) => {
            setName(s.description); setAmount(s.amount !== null ? String(s.amount) : "");
            if (s.date && /^\d{4}-\d{2}-\d{2}$/.test(s.date)) setDueDate(s.date);
            else if (fromPhoto) setDueDate("");
            setCategory(s.expenseType); setCategoryLabel(s.category);
          }} />
          <div className="space-y-2">
            <Label>Quem lançou</Label>
            <OwnerSelect value={owner} onChange={setOwner} />
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Input aria-label="Descrição" maxLength={200} value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Data do lançamento</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Tipo de despesa</Label>
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
          <div className="space-y-2"><Label>Categoria do lançamento</Label><Input aria-label="Categoria do lançamento" value={categoryLabel} maxLength={80} onChange={(e) => setCategoryLabel(e.target.value)} placeholder="Ex.: Alimentação, Transporte" /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={realized && dueDate <= today} disabled={dueDate > today} onChange={(e) => setRealized(e.target.checked)} />Despesa já paga</label>
          <Button type="submit" className="w-full rounded-xl" disabled={loading}>
            {loading ? "Salvando..." : "Lançar despesa"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
