import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import type { Reserve } from "@/lib/finance";
import { toast } from "sonner";

export function ReserveDialog({ open, onOpenChange, reserves }: { open: boolean; onOpenChange: (v: boolean) => void; reserves: Reserve[] }) {
  const [id, setId] = useState("new");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try {
      const { data } = await supabase.auth.getUser();
      if (!data.user) throw new Error("Sem sessão");
      const value = Number(amount);
      if (!Number.isFinite(value) || value < 0) throw new Error("Valor inválido");
      const result = id === "new" ? await supabase.from("reserves").insert({ user_id: data.user.id, name: name.trim(), current_amount: value, goal_amount: value }) : await supabase.from("reserves").update({ current_amount: value }).eq("id", id);
      if (result.error) throw result.error;
      await qc.invalidateQueries(); onOpenChange(false); setName(""); setAmount(""); toast.success("Reserva salva");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Erro ao salvar"); }
    finally { setBusy(false); }
  }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>Valor reservado</DialogTitle></DialogHeader>
    <form className="space-y-4" onSubmit={save}>
      <Label>Reserva</Label><select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={id} onChange={(e) => { setId(e.target.value); setAmount(String(reserves.find((r) => r.id === e.target.value)?.current_amount ?? "")); }}><option value="new">Nova reserva</option>{reserves.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
      {id === "new" && <div><Label>Nome</Label><Input aria-label="Nome da reserva" required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} /></div>}
      <div><Label>Valor reservado total (R$)</Label><Input aria-label="Valor reservado total" required type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
      <Button className="w-full" disabled={busy} type="submit">{busy ? "Salvando…" : "Salvar reserva"}</Button>
    </form>
  </DialogContent></Dialog>;
}