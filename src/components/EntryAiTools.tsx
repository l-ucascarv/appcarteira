import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { suggestEntry } from "@/lib/ai-finance.functions";
import { Button } from "@/components/ui/button";
import { Camera, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

export type EntrySuggestion = NonNullable<Awaited<ReturnType<typeof suggestEntry>>["data"]>;
export function EntryAiTools({ type, description, amount, onSuggestion }: { type: "receita" | "despesa"; description: string; amount: string; onSuggestion: (value: EntrySuggestion, fromPhoto: boolean) => void }) {
  const suggest = useServerFn(suggestEntry);
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  async function run(image: string | null) {
    setBusy(true); setMessage("");
    try {
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const result = await suggest({ data: { type, description, amount: Number(amount) || 0, image, today } });
      if (result.error || !result.data) throw new Error(result.error ?? "Sem sugestão");
      onSuggestion(result.data, Boolean(image)); setMessage(result.data.explanation);
      if (image && !result.data.date) toast.warning("Data não identificada. Confira a data antes de salvar.");
    } catch (error) { const text = error instanceof Error ? error.message : "Erro na análise"; setMessage(text); toast.error(text); }
    finally { setBusy(false); }
  }
  async function upload(file?: File) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) { toast.error("Envie JPG, PNG ou WebP de até 5 MB."); return; }
    const reader = new FileReader();
    reader.onload = () => { if (typeof reader.result === "string") { setPreview(reader.result); void run(reader.result); } };
    reader.readAsDataURL(file);
  }
  return <div className="space-y-2">
    <div className="flex flex-wrap gap-2">
      <Button type="button" size="sm" variant="outline" disabled={busy || !description.trim() || Number(amount) <= 0} onClick={() => run(null)}><Sparkles className="mr-2 h-4 w-4" />Sugerir categoria</Button>
      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => fileInput.current?.click()}><Camera className="mr-2 h-4 w-4" />Foto do comprovante</Button>
      <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ""; }} />
    </div>
    {preview && <img src={preview} alt="Comprovante selecionado" className="h-24 max-w-full rounded-md object-contain" />}
    {busy && <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />Analisando…</p>}
    {message && <p role="status" className="text-xs text-muted-foreground">{message}</p>}
  </div>;
}