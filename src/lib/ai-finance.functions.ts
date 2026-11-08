import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const suggestionInput = z.object({
  type: z.enum(["receita", "despesa"]),
  description: z.string().max(200),
  amount: z.number().nonnegative().finite(),
  image: z.string().max(8_000_000).regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/).nullable(),
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).refine((v) => v.image || (v.description.trim() && v.amount > 0), "Informe descrição e valor ou uma foto");

export const suggestEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => suggestionInput.parse(input))
  .handler(async ({ data }) => {
    const { suggest } = await import("./ai-finance.server");
    return suggest(getRequest(), data);
  });

export const analyzeSpending = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { analyze } = await import("./ai-finance.server");
    return analyze(getRequest(), context.supabase);
  });
const chatInput = z.object({ messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(4000) })).min(1).max(30), scope: z.enum(["pessoal", "familia"]).default("pessoal") });
export const chatFinance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => chatInput.parse(input))
  .handler(async ({ data, context }) => {
    const { chat } = await import("./ai-finance.server");
    return chat(getRequest(), context.supabase, data.messages, context.userId, data.scope);
  });
