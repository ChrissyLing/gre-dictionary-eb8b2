CREATE OR REPLACE FUNCTION public.gre_analytics_metrics_v1() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE today date:=(now() AT TIME ZONE 'Asia/Shanghai')::date; result jsonb;
BEGIN
 IF NOT coalesce(public.gre_analytics_access_v1(),false) THEN RAISE EXCEPTION 'Administrator access required' USING ERRCODE='42501';END IF;
 SELECT jsonb_build_object(
  'timezone','Asia/Shanghai','generated_at',now(),'started_at',(SELECT started_at FROM public.gre_analytics_config_v1 WHERE id),
  'registered_total',(SELECT count(*) FROM auth.users WHERE coalesce(internal_user_type,'generalUser')='generalUser' AND NOT coalesce(providers ? 'anonymous',false)),
  'new_today',(SELECT count(*) FROM auth.users WHERE coalesce(internal_user_type,'generalUser')='generalUser' AND NOT coalesce(providers ? 'anonymous',false) AND (created_at AT TIME ZONE 'Asia/Shanghai')::date=today),
  'new_7d',(SELECT count(*) FROM auth.users WHERE coalesce(internal_user_type,'generalUser')='generalUser' AND NOT coalesce(providers ? 'anonymous',false) AND (created_at AT TIME ZONE 'Asia/Shanghai')::date BETWEEN today-6 AND today),
  'active_today',(SELECT count(*) FROM public.gre_usage_daily_v1 WHERE day=today),
  'active_7d',(SELECT count(DISTINCT owner_id) FROM public.gre_usage_daily_v1 WHERE day BETWEEN today-6 AND today),
  'lookups_today',(SELECT coalesce(sum(lookup_count),0) FROM public.gre_usage_daily_v1 WHERE day=today),
  'questions_today',(SELECT coalesce(sum(verbal_count+quant_count),0) FROM public.gre_usage_daily_v1 WHERE day=today),
  'daily',(SELECT coalesce(jsonb_agg(row_to_json(t) ORDER BY t.day),'[]'::jsonb) FROM (
   SELECT d.day::date AS day,count(u.owner_id) AS active,coalesce(sum(u.lookup_count),0) AS lookups,coalesce(sum(u.verbal_count),0) AS verbal,coalesce(sum(u.quant_count),0) AS quant,
    (SELECT count(*) FROM auth.users a WHERE coalesce(a.internal_user_type,'generalUser')='generalUser' AND NOT coalesce(a.providers ? 'anonymous',false) AND (a.created_at AT TIME ZONE 'Asia/Shanghai')::date=d.day::date) AS registrations
   FROM generate_series(today-13,today,interval '1 day') d(day) LEFT JOIN public.gre_usage_daily_v1 u ON u.day=d.day::date GROUP BY d.day
  ) t)
 ) INTO result;
 RETURN result;
END;
$$;
