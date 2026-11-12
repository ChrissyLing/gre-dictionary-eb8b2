-- Additive product analytics; no vocabulary, note, password, email or question content is recorded.
CREATE TABLE public.gre_analytics_admins_v1 (owner_id text PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.gre_analytics_config_v1 (id boolean PRIMARY KEY DEFAULT true CHECK(id), started_at timestamptz NOT NULL DEFAULT now());
INSERT INTO public.gre_analytics_config_v1(id) VALUES(true);
CREATE TABLE public.gre_usage_daily_v1 (
 day date NOT NULL, owner_id text NOT NULL,
 lookup_count bigint NOT NULL DEFAULT 0 CHECK(lookup_count>=0),
 verbal_count bigint NOT NULL DEFAULT 0 CHECK(verbal_count>=0),
 quant_count bigint NOT NULL DEFAULT 0 CHECK(quant_count>=0),
 last_seen timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(day,owner_id)
);
CREATE TABLE public.gre_usage_receipts_v1 (owner_id text NOT NULL,event_id uuid NOT NULL,received_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(owner_id,event_id));
CREATE INDEX gre_usage_receipts_received_v1 ON public.gre_usage_receipts_v1(received_at);
ALTER TABLE public.gre_analytics_admins_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gre_analytics_config_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gre_usage_daily_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gre_usage_receipts_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.gre_analytics_admins_v1,public.gre_analytics_config_v1,public.gre_usage_daily_v1,public.gre_usage_receipts_v1 FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.gre_analytics_admins_v1,public.gre_analytics_config_v1,public.gre_usage_daily_v1,public.gre_usage_receipts_v1 TO service_role;
-- No direct client table access: guarded definer functions are the only browser entry points.
CREATE FUNCTION public.gre_analytics_access_v1() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT auth.role()='authenticated' AND EXISTS(SELECT 1 FROM public.gre_analytics_admins_v1 WHERE owner_id=auth.uid());
$$;
CREATE FUNCTION public.gre_usage_record_v1(p_events jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE uid text:=auth.uid(); today date:=(now() AT TIME ZONE 'Asia/Shanghai')::date; e jsonb; eid uuid; k text; subj text;
 accepted integer:=0; lookups integer:=0; v integer:=0; q integer:=0; inserted uuid;
BEGIN
 IF uid IS NULL OR auth.role()<>'authenticated' OR coalesce(auth.jwt()->>'is_anonymous','false')='true' THEN RAISE EXCEPTION 'Login required' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(p_events)<>'array' OR jsonb_array_length(p_events)<1 OR jsonb_array_length(p_events)>50 THEN RAISE EXCEPTION 'Invalid event batch' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM public.gre_usage_daily_v1 WHERE day=today AND owner_id=uid AND lookup_count+verbal_count+quant_count>=20000) THEN RAISE EXCEPTION 'Daily event limit' USING ERRCODE='54000'; END IF;
 FOR e IN SELECT value FROM jsonb_array_elements(p_events) LOOP
  IF jsonb_typeof(e)<>'object' OR NOT(e ? 'id') OR NOT(e ? 'kind') OR (e - 'id' - 'kind' - 'subject')<>'{}'::jsonb THEN RAISE EXCEPTION 'Invalid event fields' USING ERRCODE='22023'; END IF;
  k:=e->>'kind';subj:=e->>'subject';
  IF k IS NULL OR k NOT IN ('active','lookup','question') OR (k='question' AND (subj IS NULL OR subj NOT IN ('v','q'))) OR (k<>'question' AND subj IS NOT NULL) THEN RAISE EXCEPTION 'Invalid event type' USING ERRCODE='22023'; END IF;
  BEGIN eid:=(e->>'id')::uuid; EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'Invalid event id' USING ERRCODE='22023'; END;
  IF eid IS NULL THEN RAISE EXCEPTION 'Missing event id' USING ERRCODE='22023';END IF;
  inserted:=NULL;
  INSERT INTO public.gre_usage_receipts_v1(owner_id,event_id) VALUES(uid,eid) ON CONFLICT DO NOTHING RETURNING event_id INTO inserted;
  IF inserted IS NOT NULL THEN accepted:=accepted+1;lookups:=lookups+CASE WHEN k='lookup' THEN 1 ELSE 0 END;v:=v+CASE WHEN k='question' AND subj='v' THEN 1 ELSE 0 END;q:=q+CASE WHEN k='question' AND subj='q' THEN 1 ELSE 0 END;END IF;
 END LOOP;
 IF accepted>0 THEN
  INSERT INTO public.gre_usage_daily_v1(day,owner_id,lookup_count,verbal_count,quant_count) VALUES(today,uid,lookups,v,q)
  ON CONFLICT(day,owner_id) DO UPDATE SET lookup_count=gre_usage_daily_v1.lookup_count+excluded.lookup_count,verbal_count=gre_usage_daily_v1.verbal_count+excluded.verbal_count,quant_count=gre_usage_daily_v1.quant_count+excluded.quant_count,last_seen=now();
 END IF;
 -- Only dedup receipts expire; daily aggregates remain. Client retry queues expire after 24h.
 DELETE FROM public.gre_usage_receipts_v1 WHERE received_at<now()-interval '90 days';
 RETURN jsonb_build_object('accepted',accepted,'day',today);
END;
$$;
CREATE FUNCTION public.gre_analytics_metrics_v1() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE today date:=(now() AT TIME ZONE 'Asia/Shanghai')::date; result jsonb;
BEGIN
 IF NOT coalesce(public.gre_analytics_access_v1(),false) THEN RAISE EXCEPTION 'Administrator access required' USING ERRCODE='42501';END IF;
 SELECT jsonb_build_object(
  'timezone','Asia/Shanghai','generated_at',now(),'started_at',(SELECT started_at FROM public.gre_analytics_config_v1 WHERE id),
  'registered_total',(SELECT count(*) FROM auth.users WHERE type='external' AND NOT coalesce(providers ? 'anonymous',false)),
  'new_today',(SELECT count(*) FROM auth.users WHERE type='external' AND NOT coalesce(providers ? 'anonymous',false) AND (created_at AT TIME ZONE 'Asia/Shanghai')::date=today),
  'new_7d',(SELECT count(*) FROM auth.users WHERE type='external' AND NOT coalesce(providers ? 'anonymous',false) AND (created_at AT TIME ZONE 'Asia/Shanghai')::date BETWEEN today-6 AND today),
  'active_today',(SELECT count(*) FROM public.gre_usage_daily_v1 WHERE day=today),
  'active_7d',(SELECT count(DISTINCT owner_id) FROM public.gre_usage_daily_v1 WHERE day BETWEEN today-6 AND today),
  'lookups_today',(SELECT coalesce(sum(lookup_count),0) FROM public.gre_usage_daily_v1 WHERE day=today),
  'questions_today',(SELECT coalesce(sum(verbal_count+quant_count),0) FROM public.gre_usage_daily_v1 WHERE day=today),
  'daily',(SELECT coalesce(jsonb_agg(row_to_json(t) ORDER BY t.day),'[]'::jsonb) FROM (
   SELECT d.day::date AS day,count(u.owner_id) AS active,coalesce(sum(u.lookup_count),0) AS lookups,coalesce(sum(u.verbal_count),0) AS verbal,coalesce(sum(u.quant_count),0) AS quant,
    (SELECT count(*) FROM auth.users a WHERE a.type='external' AND NOT coalesce(a.providers ? 'anonymous',false) AND (a.created_at AT TIME ZONE 'Asia/Shanghai')::date=d.day::date) AS registrations
   FROM generate_series(today-13,today,interval '1 day') d(day) LEFT JOIN public.gre_usage_daily_v1 u ON u.day=d.day::date GROUP BY d.day
  ) t)
 ) INTO result;
 RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.gre_analytics_access_v1(),public.gre_usage_record_v1(jsonb),public.gre_analytics_metrics_v1() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.gre_analytics_access_v1(),public.gre_usage_record_v1(jsonb),public.gre_analytics_metrics_v1() TO authenticated;
