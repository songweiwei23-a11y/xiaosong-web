-- Server-authenticated completion proof and evidence-only quota reconciliation.
BEGIN;
CREATE TABLE IF NOT EXISTS public.creation_completion_evidence (
  user_id uuid NOT NULL,
  request_id text NOT NULL,
  feature text NOT NULL,
  request_fingerprint text NOT NULL,
  task_type text,
  result text NOT NULL CHECK (length(btrim(result))>0),
  result_sha256 text NOT NULL,
  content_chars integer NOT NULL CHECK (content_chars>0),
  terminal text NOT NULL CHECK (terminal IN ('message_end','workflow_finished','recovered_message','structured_result')),
  dify_conversation_id text,
  dify_message_id text,
  usage_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  completed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,request_id),
  FOREIGN KEY(user_id,request_id) REFERENCES public.creation_requests(user_id,request_id) ON DELETE CASCADE
);
ALTER TABLE public.creation_completion_evidence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.creation_completion_evidence FROM anon,authenticated;
GRANT SELECT ON public.creation_completion_evidence TO service_role;

CREATE OR REPLACE FUNCTION public.kaiwu_record_creation_completion(
  p_user_id uuid,p_request_id text,p_result text,p_result_sha256 text,p_terminal text,
  p_task_type text DEFAULT NULL,p_conversation_id text DEFAULT NULL,p_message_id text DEFAULT NULL,p_usage jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r public.creation_requests%ROWTYPE; old public.creation_completion_evidence%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('creation:' || p_user_id::text,0));
  SELECT * INTO r FROM public.creation_requests WHERE user_id=p_user_id AND request_id=p_request_id FOR UPDATE;
  IF NOT FOUND OR r.status='released' THEN RAISE EXCEPTION 'invalid generation reservation'; END IF;
  IF p_result IS NULL OR length(btrim(p_result))=0 OR octet_length(p_result)>1600000 THEN RAISE EXCEPTION 'invalid completion result'; END IF;
  IF p_terminal NOT IN ('message_end','workflow_finished','recovered_message','structured_result') OR p_terminal IS NULL THEN RAISE EXCEPTION 'invalid completion terminal'; END IF;
  IF p_result_sha256 IS DISTINCT FROM encode(sha256(convert_to(p_result,'UTF8')),'hex') THEN RAISE EXCEPTION 'completion hash mismatch'; END IF;
  SELECT * INTO old FROM public.creation_completion_evidence WHERE user_id=p_user_id AND request_id=p_request_id;
  IF FOUND THEN
    IF old.result_sha256<>p_result_sha256 THEN RAISE EXCEPTION 'completion evidence conflict'; END IF;
    RETURN jsonb_build_object('recorded',true);
  END IF;
  INSERT INTO public.creation_completion_evidence(user_id,request_id,feature,request_fingerprint,task_type,result,result_sha256,content_chars,terminal,dify_conversation_id,dify_message_id,usage_metadata)
    VALUES(p_user_id,p_request_id,r.feature,r.fingerprint,p_task_type,p_result,p_result_sha256,char_length(p_result),p_terminal,p_conversation_id,p_message_id,coalesce(p_usage,'{}'::jsonb));
  RETURN jsonb_build_object('recorded',true);
END;
$$;

CREATE OR REPLACE FUNCTION public.kaiwu_reconcile_creation(p_actor uuid,p_requests jsonb DEFAULT NULL,p_dry_run boolean DEFAULT true)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE ids jsonb; item jsonb; r public.creation_requests%ROWTYPE; e public.creation_completion_evidence%ROWTYPE;
  findings jsonb := '[]'::jsonb; state text; counted integer := 0; settled jsonb;
BEGIN
  IF p_actor IS NULL THEN RAISE EXCEPTION 'admin actor required'; END IF;
  p_dry_run:=coalesce(p_dry_run,true);
  IF p_requests IS NULL THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object('userId',user_id,'requestId',request_id)),'[]'::jsonb) INTO ids
      FROM (SELECT candidate.user_id,candidate.request_id FROM public.creation_requests candidate JOIN public.creation_completion_evidence proof USING(user_id,request_id)
        WHERE candidate.status='pending' ORDER BY proof.completed_at LIMIT 50) candidates;
  ELSE
    ids:=p_requests;
  END IF;
  IF jsonb_typeof(ids) IS DISTINCT FROM 'array' OR jsonb_array_length(ids)>50 THEN RAISE EXCEPTION 'at most 50 requests'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(ids) ORDER BY value->>'userId',value->>'requestId' LOOP
    -- Same user lock serializes settlement, preventing duplicate counter/event increments.
    PERFORM pg_advisory_xact_lock(hashtextextended('creation:' || (item->>'userId'),0));
    SELECT * INTO r FROM public.creation_requests WHERE user_id=(item->>'userId')::uuid AND request_id=item->>'requestId' FOR UPDATE;
    IF NOT FOUND THEN state:='not_found';
    ELSIF r.status<>'pending' THEN state:=r.status;
    ELSE
      SELECT * INTO e FROM public.creation_completion_evidence WHERE user_id=r.user_id AND request_id=r.request_id;
      IF NOT FOUND THEN state:='unknown';
      ELSIF e.feature<>r.feature OR e.request_fingerprint<>r.fingerprint OR e.content_chars<>char_length(e.result)
        OR e.terminal NOT IN ('message_end','workflow_finished','recovered_message','structured_result')
        OR length(btrim(e.result))=0 OR e.result_sha256<>encode(sha256(convert_to(e.result,'UTF8')),'hex') THEN state:='invalid_evidence';
      ELSIF p_dry_run THEN state:='ready';
      ELSE
        settled:=public.kaiwu_settle_creation(r.user_id,r.request_id,true,e.task_type,
          jsonb_build_object('generation_request_id',r.request_id,'result_sha256',e.result_sha256,'content_chars',e.content_chars,
            'reconciled',true,'terminal',e.terminal,'usage',e.usage_metadata));
        IF coalesce((settled->>'settled')::boolean,false) THEN state:='committed';counted:=counted+1; ELSE state:='not_settled'; END IF;
      END IF;
    END IF;
    findings:=findings||jsonb_build_array(jsonb_build_object('userId',item->>'userId','requestId',item->>'requestId','state',state));
  END LOOP;
  -- Audit and quota reconciliation commit together. Log failure rolls back the operation.
  INSERT INTO public.admin_logs(admin_id,action,target_type,details)
    VALUES(p_actor,'quota_reconcile','creation_requests',jsonb_build_object('dryRun',p_dry_run,'counted',counted,'results',findings));
  RETURN jsonb_build_object('dryRun',p_dry_run,'counted',counted,'results',findings);
END;
$$;
REVOKE ALL ON FUNCTION public.kaiwu_record_creation_completion(uuid,text,text,text,text,text,text,text,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.kaiwu_reconcile_creation(uuid,jsonb,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.kaiwu_record_creation_completion(uuid,text,text,text,text,text,text,text,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.kaiwu_reconcile_creation(uuid,jsonb,boolean) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
