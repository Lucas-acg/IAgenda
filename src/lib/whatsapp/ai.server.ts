import { createOpenAI } from "@ai-sdk/openai";
import { Output, streamText } from "ai";
import { z } from "zod";
import { CATEGORIES, localNow, type Extraction } from "./extract";

const MODEL = "openai/gpt-6-astra";
const GATEWAY = "https://ai.gateway.lovable.dev/v1";

export class AiGatewayError extends Error {
  constructor(message: string, readonly status: number | undefined, readonly retryable: boolean) { super(message); }
}

const schema = z.object({
  is_appointment: z.boolean(),
  title: z.string().nullable(),
  date: z.string().nullable().describe("YYYY-MM-DD"),
  time: z.string().nullable().describe("HH:MM, 24h"),
  category: z.enum(CATEGORIES).nullable(),
  description: z.string().nullable(),
});

/** Uses Lovable AI to decide whether a WhatsApp message describes an appointment with a set time. */
export async function extractAppointment(text: string, timezone: string, sentAt: Date): Promise<Extraction> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new AiGatewayError("LOVABLE_API_KEY não configurada", 401, false);
  const now = localNow(timezone, sentAt);
  const provider = createOpenAI({
    baseURL: GATEWAY,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
  });
  let failure: unknown;
  const result = streamText({
    model: provider.responses(MODEL),
    instructions:
      "Você analisa mensagens de WhatsApp em português e identifica compromissos com hora marcada. " +
      "Considere compromisso apenas quando houver um evento futuro com data (explícita ou relativa, como 'amanhã' ou 'sexta') E um horário específico. " +
      "Sem horário específico, ou se for só conversa, pergunta vaga ou algo no passado, responda is_appointment=false e os demais campos null. " +
      `A mensagem foi enviada em ${now.weekday}, ${now.date} às ${now.time} (fuso ${timezone}). Resolva datas relativas a partir disso. ` +
      "title: curto e claro (ex.: 'Dentista', 'Reunião com Ana'). description: detalhes úteis como local ou pessoa, ou null.",
    messages: [{ role: "user", content: text.slice(0, 4000) }],
    output: Output.object({ schema }),
    onError: ({ error }) => { failure = error; },
    providerOptions: {
      openai: { forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto", store: false, include: ["reasoning.encrypted_content"] },
    },
  });
  try {
    return (await result.output) as Extraction;
  } catch (e) {
    const err = (failure ?? e) as { statusCode?: number; message?: string };
    const status = err.statusCode;
    throw new AiGatewayError(err.message ?? "Falha na IA", status, status === 429 || (status !== undefined && status >= 500));
  }
}
