/**
 * 内容规划、创作方向的自动返工（2026-10-29 产品方同意）：
 * 体检（lib/direction-shape-check）标出问题时，让模型按问题只改出问题的那几个方向，改一次。
 *
 * 为什么要有：规则收成「好方向标准」后，大问题都没了，剩下「差一个」的小问题——十三轮真实核验里大码号
 * 「换季」3 个（规定最多 2 个）、带人群身份 3/7（要求一半）。这类问题再加提示词收益很小，模型每次随机差一项；
 * 体检能认出来，就按体检的话改一次，比让编导自己发现更省事。
 *
 * 只在体检真有问题时才多调一次；改完必须问题变少、方向数不变、规划的各目的条数不变，才采用，否则保留原稿。
 * 每人每天最多 20 次，和别的修复分开计。
 */
import { createRateLimiter } from './rate-limit';
import { directionShapeIssues, identityTermsOf } from './direction-shape-check';
import { parsePlanDirections } from './content-plan';
import { CONTENT_ROLE_LIST } from './content-roles';

export const DIRECTION_REWORK_TASKS = new Set(['内容规划', '创作方向']);

/** 每人每天最多返工 20 次 */
export const directionReworkLimited = createRateLimiter(24 * 3600_000, 20);

const listOf = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : typeof v === 'string' ? v.split(/[、，,；;]/) : []).map((s) => s.trim()).filter(Boolean);

/** 这份结果在体检里的问题（核心卖点、人群身份词都从档案取；没有档案也能查大部分） */
export function reworkIssues(text: string, profile: Record<string, unknown> | null | undefined): string[] {
  return directionShapeIssues(text, listOf(profile?.unique_selling_point), identityTermsOf(profile));
}

/**
 * context 是原来那份任务的提示词（档案、定位、好方向标准都在里面）。
 * 返工核验（10-29）：只给结果不给背景，模型只能改名字躲开体检（「旧衣柜换季整理」→「旧衣柜留存理由」），拍的东西没变
 */
export function buildDirectionReworkPrompt(p: { task: string; text: string; issues: string[]; context?: string }): string {
  return `【返工：${p.task}】${p.context?.trim() ? `\n## 原来的任务（账号情况、定位和标准都照它）\n${p.context.trim()}\n\n## 返工要求\n` : ''}下面这份${p.task}，交稿前体检发现这些问题：
${p.issues.map((x, i) => `${i + 1}. ${x}`).join('\n')}

请只改出问题的那几个方向，改的是拍的东西：换一个这群人感兴趣的话题、换一个元素，或者换一样货、换一个场，把方向名、出发点和内容方向一起重写。只改方向名里的词、拍的还是同一件事，不算改。改法要守住这几条：
- 反差的两边必须是两样货、两类人或两个时代；写不出就换别的元素
- 同一个话题（系列的大主题也算）在流量方向里最多 2 个；至少一半流量方向带这群人的身份；流量方向里人、货、场都有
- 流量型不推卖点、不证明成交理由；不编人、事、数字
- 没出问题的方向一字不动；方向的数量、编号、视频目的、本月条数、节奏都不变；格式和字段名原样保留

直接输出改好后的完整一份，不写「已修改」之类的说明。

## 要返工的这份${p.task}
${p.text}`;
}

/** 规划：每种目的的条数合计（返工不能改动配比） */
function roleCounts(text: string): string {
  const got = Object.fromEntries(CONTENT_ROLE_LIST.map((r) => [r, 0])) as Record<string, number>;
  for (const d of parsePlanDirections(text)) if (d.role) got[d.role] += d.count;
  return CONTENT_ROLE_LIST.map((r) => got[r]).join('/');
}

const blockCount = (text: string) => (text.match(/\n#{2,4}\s*方向\s*\d+/g) ?? []).length + (/^#{2,4}\s*方向\s*\d+/.test(text) ? 1 : 0);

/** 采用条件：问题变少；方向数不变；规划的各目的条数不变 */
export function acceptRework(before: string, after: string, task: string, profile: Record<string, unknown> | null | undefined): boolean {
  if (!after.trim()) return false;
  if (blockCount(after) !== blockCount(before)) return false;
  if (task === '内容规划' && roleCounts(after) !== roleCounts(before)) return false;
  return reworkIssues(after, profile).length < reworkIssues(before, profile).length;
}
