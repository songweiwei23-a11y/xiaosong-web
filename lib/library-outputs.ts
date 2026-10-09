/**
 * 素材库「全部产出」（2026-10-02）。
 *
 * 产品方："素材库里独立出选题库、脚本库……没收藏的也要有：历史记录里生成的结果自动归纳到这些库里，
 * 和收藏的分开。用户打开素材库什么都能看到——这是用户的核心资产。"
 *
 * 数据就是 script_history（每次生成都存了），这里只管"哪种任务归哪个库、标题怎么取"。
 * 选题一批出十几条，选题库按一条一条列（lib/topic-library 的 splitTopicSections），不按批。
 */
import type { LibraryCategory } from './library';

export interface OutputLibrary { id: LibraryCategory; label: string; taskTypes: string[]; board: string }

/** 顺序就是界面上的顺序：创作主线在前，账号运营在后 */
export const OUTPUT_LIBRARIES: OutputLibrary[] = [
  { id: 'topic', label: '选题库', taskTypes: ['选题策划'], board: 'topic' },
  { id: 'script', label: '脚本库', taskTypes: ['脚本生成'], board: 'script' },
  { id: 'storyboard', label: '分镜库', taskTypes: ['分镜脚本'], board: 'storyboard' },
  { id: 'review', label: '审稿库', taskTypes: ['审稿优化'], board: 'review' },
  { id: 'title', label: '标题库', taskTypes: ['标题封面'], board: 'title' },
  { id: 'opening', label: '开篇库', taskTypes: ['开篇钩子'], board: 'growth' },
  { id: 'direction', label: '方向库', taskTypes: ['创作方向', '内容规划'], board: 'direction' },
  { id: 'plan', label: '起号方案库', taskTypes: ['起号方案'], board: 'growth' },
  { id: 'remix', label: '二创库', taskTypes: ['跨行业二创'], board: 'remix' },
  { id: 'breakdown', label: '拆解库', taskTypes: ['拆解爆款'], board: 'breakdown' },
  { id: 'positioning', label: '定位库', taskTypes: ['账号定位', '商业定位', '内容定位', '创作简报', '行业建议'], board: 'positioning' },
  { id: 'deal', label: '成交理由库', taskTypes: ['成交理由'], board: 'deal-reason' },
  { id: 'other', label: '知识问答', taskTypes: ['知识库查询'], board: 'knowledge' },
];

/** 不进素材库的：分镜页「AI 推荐」只是回一段配置，不是给人看的内容 */
export const OUTPUT_SKIP_TASKS = new Set(['AI推荐']);

const BY_TASK = new Map(OUTPUT_LIBRARIES.flatMap((l) => l.taskTypes.map((t) => [t, l] as const)));
export const libraryOfTask = (taskType: string): OutputLibrary | undefined => BY_TASK.get(taskType);
export const outputLibrary = (id: string): OutputLibrary | undefined => OUTPUT_LIBRARIES.find((l) => l.id === id);

const plain = (s: string) => s.replace(/[#*>`|]/g, ' ').replace(/\s+/g, ' ').trim();

const str = (v: unknown) => (typeof v === 'string' && v.trim().length >= 2 ? v : '');
/** 分镜、审稿、开篇存的是带过来的原稿，开头一行就是「【视频主题】……」 */
const videoTopic = (input?: Record<string, unknown> | null) => {
  for (const k of ['originContent', 'draftContent', 'scriptContent', 'sourceReference', 'referenceContent']) {
    const m = str(input?.[k]).match(/【视频主题】\s*([^\n【]{2,60})/);
    if (m) return m[1].trim();
  }
  return '';
};
const POSITIONING_TASKS = new Set(['账号定位', '商业定位', '内容定位', '创作简报', '行业建议']);

/**
 * 一条产出的标题。按线上真实数据定的顺序（2026-10-02 实测：分镜库全是「1. 分镜表」、审稿库全是「1. 总评」、
 * 起号方案库全是「起号方案」，看标题分不出是哪一条）：
 *   1. 定位四件套：「账号定位 · 档案名」
 *   2. 当时填的主题 / 拆解的文件名 / 带过来的原稿里的【视频主题】/ 成交理由的店名
 *   3. 二创：「二创 · 原片名」
 *   4. 正文里第一个不是栏目名的标题
 *   5. 第一行
 */
export function outputTitle(result: string, input?: Record<string, unknown> | null, taskType?: string): string {
  if (taskType && POSITIONING_TASKS.has(taskType)) {
    const name = str(input?.profileName) || str(input?.profileSummary).match(/档案名称：([^\n]+)/)?.[1] || '';
    // 简报这类没存档案名的，就叫它的名字——正文开头「人设与口吻」这种更不像标题
    return (name ? `${taskType} · ${plain(name)}` : taskType).slice(0, 80);
  }
  const fromInput = str(input?.topic) || str(input?.fileName) || videoTopic(input) || str(input?.title) || str(input?.storeName);
  if (fromInput) return plain(fromInput).slice(0, 80);
  if (taskType === '跨行业二创' && str(input?.source)) return `二创 · ${plain(str(input?.source))}`.slice(0, 80);
  // 老的分镜、审稿记录没存视频主题：取当时那篇稿子的第一句，比正文里的「节奏自检」「逐维度打分」好认
  const draft = str(input?.scriptContent) || str(input?.draftContent);
  if (draft && (taskType === '分镜脚本' || taskType === '审稿优化')) {
    // 去掉「【开篇钩子·验证解密】」这类段落标记；带过来的是审稿报告时跳过「总评 · 综合得分」这类句子
    const first = plain(draft.replace(/【[^】]*】/g, ' '))
      .split(/[。！？!?\n]/)
      .map((s) => s.replace(/^[^\p{L}\p{N}]+/u, '').replace(/^\d{1,2}\s*[.、．)）]\s*/, '').trim())
      .find((s) => s.length >= 6 && !/总评|得分|评分|维度|优化后的/.test(s));
    if (first) return `${taskType === '分镜脚本' ? '分镜' : '审稿'} · ${first.slice(0, 30)}`;
  }
  const GENERIC = /^(选题方案|完整文案|脚本|分镜|分镜表|审稿|总评|节奏自检|逐维度打分|拍摄顺序建议|标题|方案|结果|输出|起号方案|先说结论|创作方向与思路|创作方向分析|短视频脚本生成|文案诊断报告|一句话定位|人设与口吻|.{0,4}定位方案|拆解报告)/;
  for (const line of String(result || '').split('\n')) {
    const h = line.match(/^\s*#{1,4}\s+(.+)$/);
    if (!h) continue;
    const t = plain(h[1]).replace(/^[^\p{L}\p{N}【《]+/u, '').replace(/^\d{1,2}\s*[.、．)）]\s*/, '');
    if (t.length >= 2 && !GENERIC.test(t)) return t.slice(0, 80);
  }
  const first = String(result || '').split('\n').map(plain).find((l) => l.length >= 2) || '未命名';
  return first.slice(0, 80);
}

/** 列表里的两行预览：去掉标题行和符号 */
export function outputPreview(body: string, max = 120): string {
  return plain(String(body || '').split('\n').filter((l) => !/^\s*#{1,4}\s/.test(l)).join(' ')).slice(0, max);
}
