CREATE TABLE public.habit_routines (
 id text NOT NULL, user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
 name text NOT NULL CHECK (length(trim(name)) > 0),
 days smallint[] NOT NULL DEFAULT ARRAY[0,1,2,3,4,5,6]::smallint[] CHECK (cardinality(days) BETWEEN 1 AND 7 AND days <@ ARRAY[0,1,2,3,4,5,6]::smallint[] AND array_position(days,NULL) IS NULL),
 active boolean NOT NULL DEFAULT true, PRIMARY KEY(user_id,id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.habit_routines TO authenticated;
GRANT ALL ON public.habit_routines TO service_role;
ALTER TABLE public.habit_routines ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_select ON public.habit_routines FOR SELECT TO authenticated USING(auth.uid()=user_id);
CREATE POLICY owner_insert ON public.habit_routines FOR INSERT TO authenticated WITH CHECK(auth.uid()=user_id);
CREATE POLICY owner_update ON public.habit_routines FOR UPDATE TO authenticated USING(auth.uid()=user_id) WITH CHECK(auth.uid()=user_id);
CREATE POLICY owner_delete ON public.habit_routines FOR DELETE TO authenticated USING(auth.uid()=user_id);
CREATE UNIQUE INDEX habit_routines_name ON public.habit_routines(user_id,lower(trim(name)));
ALTER TABLE public.habits ADD COLUMN routine_id text;
INSERT INTO public.habit_routines(id,user_id,name)
 SELECT 'routine-'||md5(user_id::text||lower(trim(name))),user_id,min(trim(name)) FROM public.habits WHERE kind='recorrente' GROUP BY user_id,lower(trim(name));
UPDATE public.habits h SET routine_id=r.id FROM public.habit_routines r WHERE h.user_id=r.user_id AND lower(trim(h.name))=lower(trim(r.name)) AND h.kind='recorrente';
ALTER TABLE public.habits ADD CONSTRAINT habits_routine_owner_fkey FOREIGN KEY(user_id,routine_id) REFERENCES public.habit_routines(user_id,id) DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX habits_routine_date ON public.habits(user_id,routine_id,date);
ALTER TABLE public.profiles ADD COLUMN "avatarPath" text NOT NULL DEFAULT '';
CREATE POLICY profile_photos_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='profile-photos' AND (storage.foldername(name))[1]=auth.uid()::text);
CREATE POLICY profile_photos_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='profile-photos' AND (storage.foldername(name))[1]=auth.uid()::text);
CREATE POLICY profile_photos_delete ON storage.objects FOR DELETE TO authenticated USING(bucket_id='profile-photos' AND (storage.foldername(name))[1]=auth.uid()::text);
COMMENT ON TABLE public.wa_accounts IS 'DEPRECATED: unused legacy WhatsApp Business integration';
COMMENT ON TABLE public.wa_contacts IS 'DEPRECATED: unused legacy WhatsApp contact monitoring';
COMMENT ON TABLE public.wa_messages IS 'DEPRECATED: unused legacy WhatsApp messages';
COMMENT ON TABLE public.wa_oauth_states IS 'DEPRECATED: unused legacy Meta OAuth';
CREATE OR REPLACE FUNCTION public.save_iagenda_data(payload jsonb) RETURNS void LANGUAGE plpgsql SET search_path=public AS $$ DECLARE owner uuid:=auth.uid(); t text; key text; p jsonb:=payload->'prefs'; BEGIN IF owner IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
IF jsonb_typeof(payload)<>'object' OR jsonb_typeof(payload->'profile')<>'object' OR jsonb_typeof(p)<>'object' THEN RAISE EXCEPTION 'Invalid data'; END IF;
UPDATE public.profiles SET name=payload->'profile'->>'name',timezone=COALESCE(payload->'profile'->>'timezone','America/Sao_Paulo'),height=payload->'profile'->>'height',weight=payload->'profile'->>'weight',wake=payload->'profile'->>'wake',sleep=payload->'profile'->>'sleep',"waterGoal"=(payload->'profile'->>'waterGoal')::numeric,"sleepGoal"=(payload->'profile'->>'sleepGoal')::numeric,"avatarPath"=COALESCE(payload->'profile'->>'avatarPath',"avatarPath") WHERE user_id=owner;
INSERT INTO public.preferences (user_id,notifications,"weekStartsMonday",compact,"accentColor",theme,"largeText",animations,"showSummary","calendarView") VALUES (owner,(p->>'notifications')::boolean,(p->>'weekStartsMonday')::boolean,COALESCE((p->>'compact')::boolean,false),COALESCE(p->>'accentColor',CASE p->>'palette' WHEN 'rosa' THEN '#b64466' WHEN 'azul' THEN '#1f6cb0' ELSE '#007d6b' END),COALESCE(p->>'theme','claro'),COALESCE((p->>'largeText')::boolean,false),COALESCE((p->>'animations')::boolean,true),COALESCE((p->>'showSummary')::boolean,true),COALESCE(p->>'calendarView','mes')) ON CONFLICT(user_id) DO UPDATE SET notifications=excluded.notifications,"weekStartsMonday"=excluded."weekStartsMonday",compact=excluded.compact,"accentColor"=excluded."accentColor",theme=excluded.theme,"largeText"=excluded."largeText",animations=excluded.animations,"showSummary"=excluded."showSummary","calendarView"=excluded."calendarView";
IF jsonb_typeof(payload->'appointments')<>'array' THEN RAISE EXCEPTION 'Invalid appointments'; END IF;
DELETE FROM public.appointments WHERE user_id=owner AND id IN (SELECT jsonb_array_elements_text(COALESCE(payload->'knownAppointmentIds','[]'::jsonb))) AND id NOT IN (SELECT e->>'id' FROM jsonb_array_elements(payload->'appointments') e);
INSERT INTO public.appointments SELECT r.* FROM jsonb_populate_recordset(NULL::public.appointments,(SELECT COALESCE(jsonb_agg(e||jsonb_build_object('user_id',owner)),'[]'::jsonb) FROM jsonb_array_elements(payload->'appointments') e)) r ON CONFLICT(user_id,id) DO UPDATE SET title=excluded.title,date=excluded.date,time=excluded.time,description=excluded.description,category=excluded.category,reminder=excluded.reminder,done=excluded.done;
FOREACH t IN ARRAY ARRAY['entries','habits','reminders','important_days'] LOOP key:=CASE WHEN t='important_days' THEN 'importantDays' ELSE t END; IF jsonb_typeof(payload->key)<>'array' THEN RAISE EXCEPTION 'Invalid records'; END IF; EXECUTE format('DELETE FROM public.%I WHERE user_id=$1',t) USING owner; EXECUTE format('INSERT INTO public.%I SELECT r.* FROM jsonb_populate_recordset(NULL::public.%I,$1) r',t,t) USING (SELECT COALESCE(jsonb_agg(e||jsonb_build_object('user_id',owner)),'[]'::jsonb) FROM jsonb_array_elements(payload->key) e); END LOOP;
IF payload ? 'habitRoutines' THEN
  IF jsonb_typeof(payload->'habitRoutines') <> 'array' THEN RAISE EXCEPTION 'Invalid routines'; END IF;
  DELETE FROM public.habit_routines WHERE user_id=owner;
  INSERT INTO public.habit_routines SELECT r.* FROM jsonb_populate_recordset(NULL::public.habit_routines,(SELECT COALESCE(jsonb_agg(e||jsonb_build_object('user_id',owner)),'[]'::jsonb) FROM jsonb_array_elements(payload->'habitRoutines') e)) r;
END IF;
END $$;