import { z } from "zod";

const updateSchema = z.object({
  update_id: z.number().int().nonnegative().safe(),
  message: z.object({
    message_id: z.number().int().positive().safe(),
    date: z.number().int().nonnegative().max(253402300799),
    chat: z.object({ id: z.number().int().positive().safe(), type: z.literal("private") }),
    from: z.object({ id: z.number().int().positive().safe(), is_bot: z.literal(false) }),
    text: z.string().min(1).max(4096),
  }),
});

export function telegramMessage(payload: unknown) {
  const parsed = updateSchema.safeParse(payload);
  if (!parsed.success || parsed.data.message.from.id !== parsed.data.message.chat.id) return null;
  const { update_id, message } = parsed.data;
  return { updateId: update_id, id: `tg-${message.chat.id}-${message.message_id}`, phone: String(message.chat.id), body: message.text, sentAt: new Date(message.date * 1000).toISOString() };
}

export function telegramLinkCode(text: string) {
  return /^(?:VINCULAR|\/start(?:@IAgenda2_bot)?)\s+([A-F0-9]{16})$/i.exec(text.trim())?.[1]?.toUpperCase() ?? null;
}
