CREATE TABLE public.push_subscriptions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
 endpoint text NOT NULL, p256dh text NOT NULL, auth text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id,endpoint)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_select ON public.push_subscriptions FOR SELECT TO authenticated USING ((select auth.uid())=user_id);
CREATE POLICY owner_insert ON public.push_subscriptions FOR INSERT TO authenticated WITH CHECK ((select auth.uid())=user_id);
CREATE POLICY owner_update ON public.push_subscriptions FOR UPDATE TO authenticated USING ((select auth.uid())=user_id) WITH CHECK ((select auth.uid())=user_id);
CREATE POLICY owner_delete ON public.push_subscriptions FOR DELETE TO authenticated USING ((select auth.uid())=user_id);
CREATE INDEX push_subscriptions_owner ON public.push_subscriptions(user_id,created_at DESC);
CREATE TABLE public.habit_push_deliveries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), subscription_id uuid NOT NULL REFERENCES public.push_subscriptions(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE, routine_id text NOT NULL,
 scheduled_date date NOT NULL, scheduled_time text NOT NULL, status text NOT NULL DEFAULT 'claimed' CHECK(status IN ('claimed','sent','failed','unknown')),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(subscription_id,routine_id,scheduled_date,scheduled_time)
);
GRANT ALL ON public.habit_push_deliveries TO service_role;
ALTER TABLE public.habit_push_deliveries ENABLE ROW LEVEL SECURITY;
CREATE INDEX habit_push_deliveries_owner ON public.habit_push_deliveries(user_id,created_at DESC);
CREATE INDEX habit_push_deliveries_subscription ON public.habit_push_deliveries(subscription_id);
CREATE OR REPLACE FUNCTION public.claim_habit_push_notifications(at_time timestamptz DEFAULT now())
RETURNS TABLE(delivery_id uuid, subscription_id uuid, endpoint text, p256dh text, auth text, title text, scheduled_time text, notice_key text)
LANGUAGE sql SET search_path=public AS $$
 WITH eligible AS (
  SELECT s.id subscription_id, r.user_id, r.id routine_id, r.name title, r.time,
   (at_time AT TIME ZONE p.timezone)::date scheduled_date
  FROM public.habit_routines r JOIN public.profiles p ON p.user_id=r.user_id
  JOIN public.preferences prefs ON prefs.user_id=r.user_id AND prefs.notifications=true
  JOIN public.push_subscriptions s ON s.user_id=r.user_id
  WHERE r.active=true AND r.notify=true AND r.time IS NOT NULL
   AND extract(dow FROM at_time AT TIME ZONE p.timezone)::int=ANY(r.days)
   AND (at_time AT TIME ZONE p.timezone)>=((at_time AT TIME ZONE p.timezone)::date + r.time::time)
   AND (at_time AT TIME ZONE p.timezone)<((at_time AT TIME ZONE p.timezone)::date + r.time::time + interval '10 minutes')
   AND NOT EXISTS(SELECT 1 FROM public.habits h WHERE h.user_id=r.user_id AND h.routine_id=r.id AND h.date=(at_time AT TIME ZONE p.timezone)::date::text)
   AND NOT EXISTS(SELECT 1 FROM public.habit_push_deliveries d WHERE d.subscription_id=s.id AND d.routine_id=r.id AND d.scheduled_date=(at_time AT TIME ZONE p.timezone)::date AND d.scheduled_time=r.time)
  ORDER BY r.user_id,r.id,s.id LIMIT 100
 ), claimed AS (
  INSERT INTO public.habit_push_deliveries(subscription_id,user_id,routine_id,scheduled_date,scheduled_time)
  SELECT e.subscription_id,e.user_id,e.routine_id,e.scheduled_date,e.time FROM eligible e
  ON CONFLICT(subscription_id,routine_id,scheduled_date,scheduled_time) DO NOTHING RETURNING *
 ) SELECT c.id,s.id,s.endpoint,s.p256dh,s.auth,e.title,c.scheduled_time,
   'routine-'||c.routine_id||'-'||c.scheduled_date::text||'-'||c.scheduled_time
 FROM claimed c JOIN public.push_subscriptions s ON s.id=c.subscription_id JOIN eligible e ON e.subscription_id=c.subscription_id AND e.routine_id=c.routine_id;
$$;
REVOKE ALL ON FUNCTION public.claim_habit_push_notifications(timestamptz) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_habit_push_notifications(timestamptz) TO service_role;