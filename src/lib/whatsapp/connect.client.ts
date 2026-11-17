type FBResponse = { authResponse?: { code?: string } };
type Facebook = { init: (options: object) => void; login: (cb: (response: FBResponse) => void, options: object) => void };
declare global { interface Window { FB?: Facebook; fbAsyncInit?: () => void } }

export async function loadMetaSdk(appId: string) {
  if (window.FB) { window.FB.init({ appId, version: "v27.0", xfbml: false, autoLogAppEvents: false }); return; }
  await new Promise<void>((resolve, reject) => {
    window.fbAsyncInit = () => { window.FB?.init({ appId, version: "v27.0", xfbml: false, autoLogAppEvents: false }); resolve(); };
    const script = document.createElement("script");
    script.src = "https://connect.facebook.net/pt_BR/sdk.js";
    script.async = true;
    script.onerror = () => reject(new Error("Não foi possível carregar a Meta."));
    document.head.appendChild(script);
  });
}

export function connectMeta(configId: string): Promise<{ code: string; phoneNumberId: string; wabaId: string }> {
  return new Promise((resolve, reject) => {
    const fb = window.FB;
    if (!fb) { reject(new Error("A Meta ainda está carregando. Tente novamente.")); return; }
    let code = "", phoneNumberId = "", wabaId = "";
    const cleanup = () => { window.removeEventListener("message", onMessage); window.clearTimeout(timeout); };
    const done = () => { if (code && phoneNumberId && wabaId) { cleanup(); resolve({ code, phoneNumberId, wabaId }); } };
    const fail = (message: string) => { cleanup(); reject(new Error(message)); };
    const onMessage = (event: MessageEvent) => {
      if (!["https://www.facebook.com", "https://web.facebook.com"].includes(event.origin)) return;
      let payload: { type?: string; event?: string; data?: { phone_number_id?: string; waba_id?: string } };
      try { payload = typeof event.data === "string" ? JSON.parse(event.data) : event.data; } catch { return; }
      if (payload?.type !== "WA_EMBEDDED_SIGNUP") return;
      if (payload.event === "FINISH" || payload.event === "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING") {
        phoneNumberId = payload.data?.phone_number_id ?? ""; wabaId = payload.data?.waba_id ?? ""; done();
      } else if (payload.event === "CANCEL" || payload.event === "ERROR") fail("A conexão com a Meta não foi concluída.");
    };
    const timeout = window.setTimeout(() => fail("A conexão expirou. Tente novamente."), 300_000);
    window.addEventListener("message", onMessage);
    fb.login((response) => {
      code = response.authResponse?.code ?? "";
      if (!code) fail("A autorização não foi concluída."); else done();
    }, { config_id: configId, response_type: "code", override_default_response_type: true, extras: { setup: {} } });
  });
}