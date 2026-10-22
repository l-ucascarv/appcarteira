import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { chatFinance } from "@/lib/ai-finance.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string };
const SUGGESTIONS = ["Quanto posso gastar no próximo mês?", "Como ficam minhas parcelas nos próximos meses?", "Onde estou gastando mais?"];

export function FinanceChat() {
  const send = useServerFn(chatFinance);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    const next = [...messages, { role: "user" as const, content: q }];
    setMessages(next); setText(""); setBusy(true); setError("");
    try {
      const r = await send({ data: { messages: next } });
      if (r.error || !r.data) setError(r.error ?? "Sem resposta");
      else setMessages([...next, { role: "assistant", content: r.data }]);
    } catch (e) { setError(e instanceof Error ? e.message : "Erro na conversa"); }
    finally { setBusy(false); }
  }
  return <div className="space-y-3 pt-2">
    <h3 className="text-sm font-semibold">Converse sobre suas projeções</h3>
    <div className="max-h-96 space-y-2 overflow-y-auto">
      {messages.map((m, i) => <div key={i} className={`whitespace-pre-wrap rounded-xl px-3 py-2 text-sm ${m.role === "user" ? "ml-8 bg-primary text-primary-foreground" : "mr-8 bg-muted"}`}>{m.content}</div>)}
      {busy && <p className="text-sm text-muted-foreground">Analisando seus lançamentos…</p>}
    </div>
    {!messages.length && <div className="flex flex-wrap gap-2">{SUGGESTIONS.map((s) => <Button key={s} variant="outline" size="sm" onClick={() => ask(s)}>{s}</Button>)}</div>}
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); ask(text); }}>
      <Input aria-label="Pergunta" maxLength={4000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ex.: quanto posso gastar em dezembro?" />
      <Button type="submit" size="icon" disabled={busy || !text.trim()} aria-label="Enviar"><Send className="h-4 w-4" /></Button>
    </form>
  </div>;
}
