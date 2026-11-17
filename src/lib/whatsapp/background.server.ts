import { AsyncLocalStorage } from "node:async_hooks";
export interface BackgroundContext { waitUntil: (promise: Promise<unknown>) => void }
export const backgroundContext = new AsyncLocalStorage<BackgroundContext>();
export function enqueueProcessing(work: () => Promise<unknown>) {
  const context = backgroundContext.getStore();
  if (!context) return work();
  context.waitUntil(work().catch(() => { console.error("WhatsApp: processamento pendente na caixa de entrada."); }));
  return Promise.resolve();
}