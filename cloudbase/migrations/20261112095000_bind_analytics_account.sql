-- Bind queued events to the session owner even when accounts switch during an SDK request.
CREATE FUNCTION public.gre_usage_record_bound_v1(p_expected_uid text,p_events jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_expected_uid OR auth.role() IS DISTINCT FROM 'authenticated' THEN RAISE EXCEPTION 'Account changed' USING ERRCODE='42501';END IF;
 RETURN public.gre_usage_record_v1(p_events);
END;
$$;
REVOKE ALL ON FUNCTION public.gre_usage_record_bound_v1(text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.gre_usage_record_bound_v1(text,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.gre_usage_record_v1(jsonb) FROM authenticated;
