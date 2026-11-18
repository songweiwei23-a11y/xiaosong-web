-- Durable generation task and immutable result-version ledger.
-- A task is tied to the existing creation request id, so client retries never run a
-- second paid generation. Versions are server-owned: drafts are recoverable but
-- excluded from long-term history until a completed version exists.
BEGIN;

CREATE TABLE IF NOT EXISTS public.generation_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id text NOT NULL,
  profile_id text,
  feature text NOT NULL,
  task_type text NOT NULL,
  input_hash text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'accepted' CHECK (status IN (
    'accepted','queued','generating','draft_saved','post_processing','completed',
    'partial_saved','recoverable_failed','permanent_failed','canceled'
  )),
  stage text NOT NULL DEFAULT 'accepted',
  error_code text,
  error_message text,
  retry_count integer NOT NULL DEFAULT 0 CHECK (retry_count >= 0 AND retry_count <= 3),
  run_token uuid,
  heartbeat_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE(user_id, request_id)
);

CREATE INDEX IF NOT EXISTS generation_tasks_user_recent_idx ON public.generation_tasks(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS generation_tasks_recovery_idx ON public.generation_tasks(status, heartbeat_at) WHERE status IN ('queued','generating','post_processing','partial_saved','recoverable_failed');

CREATE TABLE IF NOT EXISTS public.generation_result_versions (
  task_id uuid NOT NULL REFERENCES public.generation_tasks(id) ON DELETE CASCADE,
  version integer NOT NULL CHECK (version > 0),
  kind text NOT NULL CHECK (kind IN ('draft','processed','final')),
  stage text NOT NULL,
  result text NOT NULL CHECK (length(btrim(result)) > 0),
  result_sha256 text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(task_id, version)
);
CREATE INDEX IF NOT EXISTS generation_result_versions_task_recent_idx ON public.generation_result_versions(task_id, version DESC);

ALTER TABLE public.generation_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generation_result_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.generation_tasks, public.generation_result_versions FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.generation_tasks, public.generation_result_versions TO service_role;

CREATE OR REPLACE FUNCTION public.kaiwu_create_generation_task(
  p_user_id uuid, p_request_id text, p_profile_id text, p_feature text,
  p_task_type text, p_input_hash text, p_payload jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE t public.generation_tasks%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('generation:' || p_user_id::text || ':' || p_request_id, 0));
  SELECT * INTO t FROM public.generation_tasks WHERE user_id=p_user_id AND request_id=p_request_id FOR UPDATE;
  IF FOUND THEN
    IF t.feature <> p_feature OR t.task_type <> p_task_type OR t.input_hash <> p_input_hash OR t.profile_id IS DISTINCT FROM p_profile_id THEN
      RAISE EXCEPTION 'generation request conflict';
    END IF;
    RETURN jsonb_build_object('id',t.id,'existing',true,'status',t.status,'stage',t.stage);
  END IF;
  INSERT INTO public.generation_tasks(user_id,request_id,profile_id,feature,task_type,input_hash,payload,status,stage,heartbeat_at)
    VALUES(p_user_id,p_request_id,p_profile_id,p_feature,p_task_type,p_input_hash,coalesce(p_payload,'{}'::jsonb),'accepted','accepted',now())
    RETURNING * INTO t;
  RETURN jsonb_build_object('id',t.id,'existing',false,'status',t.status,'stage',t.stage);
END;
$$;

CREATE OR REPLACE FUNCTION public.kaiwu_claim_generation_task(p_task_id uuid, p_token uuid, p_stale_before timestamptz)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  UPDATE public.generation_tasks
    SET run_token=p_token, heartbeat_at=now(), updated_at=now()
    WHERE id=p_task_id
      AND status IN ('queued','generating','post_processing','partial_saved','recoverable_failed')
      AND (run_token IS NULL OR heartbeat_at IS NULL OR heartbeat_at < p_stale_before);
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.kaiwu_create_generation_task(uuid,text,text,text,text,text,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.kaiwu_claim_generation_task(uuid,uuid,timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kaiwu_create_generation_task(uuid,text,text,text,text,text,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.kaiwu_claim_generation_task(uuid,uuid,timestamptz) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
