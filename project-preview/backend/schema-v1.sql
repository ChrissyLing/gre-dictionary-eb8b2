-- CloudBase PostgreSQL mode. Additive v1 contract; never drop/rename columns used by a published release.
BEGIN;
CREATE TABLE IF NOT EXISTS public.gre_favorites_v1 (
 owner_id varchar(128) NOT NULL DEFAULT (current_setting('request.jwt.claims',true)::json->>'sub'),
 word varchar(100) NOT NULL,
 payload jsonb NOT NULL CHECK (jsonb_typeof(payload)='object' AND payload ? 'schema' AND payload->>'schema'='1'),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(owner_id,word)
);
CREATE TABLE IF NOT EXISTS public.gre_profiles_v1 (
 owner_id varchar(128) PRIMARY KEY DEFAULT (current_setting('request.jwt.claims',true)::json->>'sub'),
 preferred_release varchar(40),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.gre_favorites_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gre_profiles_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.gre_favorites_v1,public.gre_profiles_v1 FROM anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.gre_favorites_v1,public.gre_profiles_v1 TO authenticated;
GRANT ALL ON public.gre_favorites_v1,public.gre_profiles_v1 TO service_role;
DROP POLICY IF EXISTS gre_favorites_owner_v1 ON public.gre_favorites_v1;
CREATE POLICY gre_favorites_owner_v1 ON public.gre_favorites_v1 FOR ALL TO authenticated
 USING (owner_id=(current_setting('request.jwt.claims',true)::json->>'sub'))
 WITH CHECK (owner_id=(current_setting('request.jwt.claims',true)::json->>'sub'));
DROP POLICY IF EXISTS gre_profiles_owner_v1 ON public.gre_profiles_v1;
CREATE POLICY gre_profiles_owner_v1 ON public.gre_profiles_v1 FOR ALL TO authenticated
 USING (owner_id=(current_setting('request.jwt.claims',true)::json->>'sub'))
 WITH CHECK (owner_id=(current_setting('request.jwt.claims',true)::json->>'sub'));
CREATE OR REPLACE FUNCTION public.gre_touch_updated_at_v1() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
 BEGIN NEW.updated_at=now(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS gre_favorites_touch ON public.gre_favorites_v1;
CREATE TRIGGER gre_favorites_touch BEFORE UPDATE ON public.gre_favorites_v1 FOR EACH ROW EXECUTE FUNCTION public.gre_touch_updated_at_v1();
DROP TRIGGER IF EXISTS gre_profiles_touch ON public.gre_profiles_v1;
CREATE TRIGGER gre_profiles_touch BEFORE UPDATE ON public.gre_profiles_v1 FOR EACH ROW EXECUTE FUNCTION public.gre_touch_updated_at_v1();
COMMIT;
