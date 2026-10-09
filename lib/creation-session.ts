import { putHandoff, type HandoffPayload } from './handoff';
import { postSafely } from './safe-post';
import { creationSnapshotUrl, readCreationSnapshot } from './creation-snapshot';
import { getActiveProfileId } from './active-profile';
import { createHistoryId } from './history-id';

const pendingIds = new Map<string, string>();

/**
 * 保存完整创作需求后再打开目标页（2026-10-04：所有板块的「带去下一步」按钮统一走这里，不再只存在本标签页里）。
 * - 同一份内容保存失败后重试，沿用同一个请求编号：服务端按编号幂等，不会多建作品；保存成功后下一次才换新编号。
 * - 只有正文在别的字段里的（脚本正文、拆解报告、要换的开头），补成 sourceContent——服务端要求有可继续的内容。
 * - 失败时抛出带中文的错误，调用方提示；当前页面内容不动、不跳转。
 */
export async function openCreation(payload: HandoffPayload, push: (url: string) => void, branch = false): Promise<void> {
  if (!payload.target) throw new Error('没有指定要去的板块');
  const full: HandoffPayload = {
    ...payload,
    sourceContent: payload.sourceContent?.trim() ? payload.sourceContent : payload.scriptContent || payload.remixSource?.text || payload.currentOpening || payload.topic || '',
  };
  const signature = JSON.stringify({ full, branch });
  let id = pendingIds.get(signature);
  if (!id) { id = createHistoryId(); pendingIds.set(signature, id); }
  let saved: Awaited<ReturnType<typeof saveCreationSession>>;
  try { saved = await saveCreationSession(full, branch, id); }
  catch (e) {
    // 网络没发出去：给一句人话（编号留着，再点一次沿用它，服务端不会重复建）
    if (e instanceof TypeError && /fetch|network|load failed/i.test(e.message)) throw new Error('网络断了一下，创作需求没保存上，再点一次就好（当前内容都还在）');
    throw e;
  }
  pendingIds.delete(signature);
  if (!putHandoff(saved.payload)) throw new Error('浏览器暂时无法带入内容，请先复制正文后再继续');
  push(saved.url);
}

/** 同上，失败交给 onError 提示（页面里的按钮用），返回是否已经跳转 */
export function openCreationSafely(payload: HandoffPayload, push: (url: string) => void, onError: (message: string) => void, branch = false): Promise<boolean> {
  return openCreation(payload, push, branch).then(() => true, (e) => {
    onError((e as Error)?.message || '创作需求未保存，请重试；当前内容仍在原页面');
    return false;
  });
}

/** A destination is opened only after the complete creative snapshot is durable. */
export async function saveCreationSession(payload: HandoffPayload, branch = false, requestId = createHistoryId()): Promise<{ payload: HandoffPayload; url: string }> {
  const response = await postSafely('/api/creation-sessions', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestId, payload: { ...payload, profileId: getActiveProfileId() }, branch }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || '创作需求未保存，请重试；当前内容仍在原页面');
  const saved = readCreationSnapshot(data.payload);
  if (!saved) throw new Error('创作需求返回不完整，请重试');
  return { payload: saved, url: creationSnapshotUrl(saved, data.id) };
}
