-- OBSOLETO: integração anterior de monitoramento abandonada.
-- NÃO APLICAR: o assistente compartilhado já possui tabelas nas migrations gerenciadas.

-- Caixa de entrada durável dos webhooks (somente o servidor acessa).
CREATE TABLE public.whatsapp_webhook_events (
  id bigserial PRIMARY KEY,
  delivery_id text NOT NULL UNIQUE,
  event text NOT NULL,
  payload jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  processing_error text,
  attempts integer NOT NULL DEFAULT 0
);
GRANT ALL ON public.whatsapp_webhook_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.whatsapp_webhook_events_id_seq TO service_role;
ALTER TABLE public.whatsapp_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX whatsapp_events_pending ON public.whatsapp_webhook_events(attempts, received_at) WHERE processed_at IS NULL;

-- Dono da integração (o número WhatsApp Business conectado pertence a uma conta do IAgenda).
CREATE TABLE public.whatsapp_owner (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.whatsapp_owner TO authenticated;
GRANT ALL ON public.whatsapp_owner TO service_role;
ALTER TABLE public.whatsapp_owner ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_select ON public.whatsapp_owner FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE FUNCTION public.claim_whatsapp_owner() RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); cur uuid;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  INSERT INTO public.whatsapp_owner(id, user_id) VALUES (1, me) ON CONFLICT (id) DO NOTHING;
  SELECT user_id INTO cur FROM public.whatsapp_owner WHERE id = 1;
  RETURN cur = me;
END $$;
REVOKE ALL ON FUNCTION public.claim_whatsapp_owner() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_whatsapp_owner() TO authenticated;

-- Conversas do número conectado e escolha de quais a IA verifica.
CREATE TABLE public.whatsapp_conversations (
  wa_id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  contact_name text NOT NULL DEFAULT '',
  last_preview text NOT NULL DEFAULT '',
  last_message_at timestamptz NOT NULL DEFAULT now(),
  watched boolean NOT NULL DEFAULT false
);
GRANT SELECT, UPDATE ON public.whatsapp_conversations TO authenticated;
GRANT ALL ON public.whatsapp_conversations TO service_role;
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_select ON public.whatsapp_conversations FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY owner_update ON public.whatsapp_conversations FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Mensagens recebidas/enviadas e o resultado da análise da IA.
CREATE TABLE public.whatsapp_messages (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  wa_id text NOT NULL REFERENCES public.whatsapp_conversations(wa_id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('in','out')),
  body text NOT NULL DEFAULT '',
  sent_at timestamptz NOT NULL,
  ai_status text NOT NULL DEFAULT 'pending' CHECK (ai_status IN ('pending','ignored','created','not_appointment','error')),
  ai_error text,
  appointment_id text,
  appointment_title text,
  appointment_date text,
  appointment_time text
);
GRANT SELECT ON public.whatsapp_messages TO authenticated;
GRANT ALL ON public.whatsapp_messages TO service_role;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_select ON public.whatsapp_messages FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX whatsapp_messages_conv ON public.whatsapp_messages(user_id, wa_id, sent_at DESC);
