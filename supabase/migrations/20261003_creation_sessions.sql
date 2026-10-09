-- Durable per-work intent and immutable handoff versions. No existing history is removed.
BEGIN;
ALTER TABLE public.works ADD COLUMN IF NOT EXISTS creation_brief jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE TABLE IF NOT EXISTS public.creation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id uuid,
  work_id uuid REFERENCES public.works(id) ON DELETE SET NULL,
  payload jsonb NOT NULL,
  request_input jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.creation_sessions ADD COLUMN IF NOT EXISTS request_input jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS creation_sessions_owner ON public.creation_sessions(user_id, created_at DESC);
ALTER TABLE public.creation_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS own_creation_sessions ON public.creation_sessions;
DROP POLICY IF EXISTS insert_own_creation_sessions ON public.creation_sessions;
CREATE POLICY own_creation_sessions ON public.creation_sessions FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY insert_own_creation_sessions ON public.creation_sessions FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (profile_id IS NULL OR EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id=profile_id AND p.user_id=auth.uid()))
    AND (work_id IS NULL OR EXISTS (SELECT 1 FROM public.works w WHERE w.id=work_id AND w.user_id=auth.uid() AND w.profile_id IS NOT DISTINCT FROM creation_sessions.profile_id))
  );
REVOKE ALL ON public.creation_sessions FROM authenticated;
GRANT SELECT, INSERT ON public.creation_sessions TO authenticated;
REVOKE ALL ON public.creation_sessions FROM anon;

CREATE OR REPLACE FUNCTION public.save_creation_session(p_id uuid, p_payload jsonb, p_branch boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE
  owner uuid := auth.uid(); profile uuid := NULLIF(p_payload->>'profileId', '')::uuid;
  work uuid := NULLIF(p_payload->>'workId', '')::uuid;
  brief jsonb; saved jsonb; title text; prior public.creation_sessions%ROWTYPE;
  request_input jsonb := jsonb_build_object('payload',p_payload,'branch',coalesce(p_branch,false));
BEGIN
  IF owner IS NULL THEN RAISE EXCEPTION 'permission denied'; END IF;
  IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'invalid payload'; END IF;
  -- Serialize retries of one ID before creating a branch/work. A lost response is safe to retry.
  PERFORM pg_advisory_xact_lock(hashtextextended('creation-session:' || p_id::text,0));
  SELECT * INTO prior FROM public.creation_sessions WHERE id=p_id;
  IF FOUND THEN
    IF prior.user_id<>owner OR prior.request_input<>request_input THEN RAISE EXCEPTION 'creation request id conflict'; END IF;
    RETURN jsonb_build_object('id',p_id,'payload',prior.payload);
  END IF;
  IF profile IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = profile AND user_id = owner) THEN
    RAISE EXCEPTION 'profile ownership mismatch';
  END IF;
  IF octet_length(p_payload::text) > 1600000 THEN RAISE EXCEPTION 'payload too large'; END IF;
  -- Validate even when branching: a forged parent ID must never be silently ignored.
  IF work IS NOT NULL THEN
    SELECT creation_brief INTO brief FROM public.works WHERE id = work AND user_id = owner AND profile_id IS NOT DISTINCT FROM profile FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'work profile ownership mismatch'; END IF;
  END IF;
  IF p_branch OR p_payload->>'target'='/dashboard/topic' THEN work := NULL; END IF;
  IF work IS NULL AND p_payload->>'target'<>'/dashboard/topic' AND coalesce(jsonb_array_length(p_payload->'topicOptions'), 0) <= 1 THEN
    title := left(coalesce(nullif(p_payload->>'topic',''), nullif(p_payload->>'sourceTitle',''), '创作作品'), 60);
    INSERT INTO public.works(user_id, profile_id, title) VALUES(owner, profile, title) RETURNING id INTO work;
  END IF;
  -- Merge nested settings before overwriting the previous object; each hop inherits omitted fields.
  saved := coalesce(brief, '{}'::jsonb) || p_payload;
  saved := jsonb_set(saved, '{settings}', coalesce(brief->'settings','{}'::jsonb) || coalesce(p_payload->'settings','{}'::jsonb));
  saved := jsonb_set(saved, '{originContent}', to_jsonb(coalesce(nullif(brief->>'originContent',''), nullif(p_payload->>'originContent',''), p_payload->>'sourceContent', '')));
  saved := saved - 'workId';
  IF work IS NOT NULL THEN
    saved := saved || jsonb_build_object('workId', work);
    UPDATE public.works SET creation_brief = saved, updated_at = now() WHERE id = work AND user_id = owner;
  END IF;
  INSERT INTO public.creation_sessions(id, user_id, profile_id, work_id, payload, request_input) VALUES(p_id, owner, profile, work, saved, request_input);
  RETURN jsonb_build_object('id', p_id, 'payload', saved);
END;
$$;
REVOKE ALL ON FUNCTION public.save_creation_session(uuid,jsonb,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_creation_session(uuid,jsonb,boolean) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
