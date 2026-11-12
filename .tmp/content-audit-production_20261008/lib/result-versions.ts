/**
 * 生成结果的画布版本（2026-10-04）：各创作板块的结果也能在画布里改、局部改写、锁定、比较版本，改好的接着创作。
 *
 * 存法：一条生成结果第一次在画布里保存版本时，新建一条「画布改稿」历史记录（同板块的 task_type，
 * input_data.canvasOf 标记，canvasVersions 存全部版本），之后每次保存都更新这一条，result 永远是最新一版。
 * 这样作品恢复（最新一版）、拍摄交付包、素材库「全部产出」不用改就拿到用户最新采用的稿子；
 * 后台的生成统计按 canvasOf 排除它——这不是一次生成。
 * 接口见 app/api/result-versions/route.ts。
 */
import type { CanvasVersion } from './canvas';
import { postSafely } from './safe-post';

/** 哪些板块的结果能在画布里改并存版本（路径段 → 历史记录的任务名）。开篇页一页两种任务，由页面自己传 */
export const CANVAS_TASK_BY_BOARD: Record<string, string> = {
  topic: '选题策划',
  script: '脚本生成',
  storyboard: '分镜脚本',
  review: '审稿优化',
  title: '标题封面',
  remix: '跨行业二创',
  breakdown: '拆解爆款',
  direction: '创作方向',
};

export const CANVAS_TASKS = new Set(Object.values(CANVAS_TASK_BY_BOARD).concat(['开篇钩子', '起号方案']));

/** 一条结果的全部版本最多多大（含历史版本）；超了明确报错，不偷偷删旧版本 */
export const MAX_VERSIONS_BYTES = 1_500_000;

export interface SaveVersionsInput {
  /** 已经存过的那条「画布改稿」记录；第一次保存不传 */
  id?: string | null;
  taskType: string;
  workId?: string | null;
  profileId?: string | null;
  versions: CanvasVersion[];
  /** 作品需求里的设置和源资料：存进记录，作品恢复时能接着用 */
  base?: { creationSettings?: unknown; originContent?: string };
}

/** 保存版本，返回记录 id；失败抛出带中文的错误（画布据此显示「云端未保存，本机草稿已保留」） */
export async function saveResultVersions(input: SaveVersionsInput): Promise<string> {
  const res = await postSafely('/api/result-versions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || typeof data.id !== 'string') throw new Error(data.error || '版本没保存上，请重试');
  return data.id;
}
