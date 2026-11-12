"use client";
import { useEffect, useRef, useState } from 'react';
import type { CreatorContext } from '@/lib/creator-context';
import type { HandoffPayload } from '@/lib/handoff';
import { resolveCreationSettings, type CreationSettings } from '@/lib/creation-settings';

/** 等档案就绪再一次性填表，之后用户的修改不被异步背景覆盖。 */
export function useAutoCreationSetup(incoming: HandoffPayload | null, context: CreatorContext, loading: boolean, apply: (settings: CreationSettings) => void) {
  const applyRef = useRef(apply); applyRef.current = apply;
  const applied = useRef<HandoffPayload | null>(null);
  const [settings, setSettings] = useState<CreationSettings>({});
  const scope = context.profile?.id || null;
  const sameProfile = !incoming || !('profileId' in incoming) || incoming.profileId === scope;
  useEffect(() => {
    if (!incoming || loading || !sameProfile || applied.current === incoming) return;
    applied.current = incoming;
    const resolved = resolveCreationSettings(incoming, context);
    setSettings(resolved);
    applyRef.current(resolved);
  }, [incoming, loading, sameProfile, context]);
  return { settings: incoming && sameProfile ? settings : {}, preparing: Boolean(incoming && sameProfile && (loading || applied.current !== incoming)) };
}
