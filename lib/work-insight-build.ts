import { resolveMix } from '@/lib/content-mix';
import { readMetrics, metricsLine, summarizePerformance } from '@/lib/performance';
import { buildProfileSummary } from '@/lib/profile-summary';
import {
  insightPrompt,
  materialMixOf,
  mixReport,
  performanceRowsOf,
  roleFeedback,
  roleOfPurpose,
  type ParsedInsight,
  type WorkInsight,
} from '@/lib/work-insight';

/**
 * 把作品记录、创作设置、录入的数据、导入的文件和模型的分析，组装成「账号作品概况」。
 * 纯函数，不碰数据库和网络：路由负责读数据、调模型、存结果。
 */

export interface InsightWork {
  id: string;
  title: string;
  is_done?: boolean | null;
  shoot_status?: string | null;
  published_at?: string | null;
  metrics?: unknown;
}

export interface InsightMaterial {
  filename: string;
  status: string;
  content: string;
}

export type SettingsOf = Map<string, Record<string, unknown>>;

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** 作品的目的 / 拍法：来自它当时的脚本或选题设置 */
export function purposeOfWork(settingsOf: SettingsOf, workId: string): string | null {
  return str(settingsOf.get(workId)?.purpose);
}

/** 作品进度（和作品卡片、工具里的说法一致） */
export function workStatusLabel(w: InsightWork): string {
  if (w.shoot_status === 'published' || w.published_at) return '已发布';
  if (w.shoot_status === 'shot') return '已拍摄';
  return w.is_done ? '内容做完、未拍' : '进行中';
}

export interface BuildInput {
  profile: Record<string, unknown>;
  works: InsightWork[];
  settingsOf: SettingsOf;
  materials: InsightMaterial[];
  model: { used: boolean; parsed: ParsedInsight | null; notes: string[] };
  now?: Date;
}

export function buildWorkInsight(input: BuildInput): WorkInsight {
  const { profile, works, settingsOf, materials, model } = input;
  const planned = resolveMix(profile, null, '').mix;
  const mix = mixReport(works.map((w) => ({ purpose: purposeOfWork(settingsOf, w.id) })), planned);
  const rows = performanceRowsOf(
    works.map((w) => ({ id: w.id, title: w.title, metrics: w.metrics, published_at: w.published_at ?? null })),
    settingsOf,
  );
  const summary = summarizePerformance(rows);
  const readable = materials.filter((m) => m.status === 'ok');
  const caveats: string[] = ['录入的数据是手动观察值，只描述过去的情况，不证明某种拍法一定更有效'];
  if (!works.length) caveats.push('还没有作品记录，配比和数据反馈都是空的');
  if (!readable.length) caveats.push('还没有能读出文字的导入文件，识别配比只看作品记录');
  caveats.push(...model.notes);
  return {
    generatedAt: (input.now ?? new Date()).toISOString(),
    overview: {
      works: works.length,
      shot: works.filter((w) => w.shoot_status === 'shot' || w.shoot_status === 'published').length,
      published: works.filter((w) => w.shoot_status === 'published' || !!w.published_at).length,
      withData: rows.length,
      materials: readable.length,
    },
    mix,
    feedback: roleFeedback(summary),
    dataNotes: summary.insights,
    materialMix: model.parsed ? materialMixOf(model.parsed.items) : null,
    items: model.parsed?.items ?? [],
    planning: model.parsed?.planning ?? [],
    reviewNotes: model.parsed?.reviewNotes ?? [],
    materialNotes: model.parsed?.materialNotes ?? [],
    modelUsed: model.used && !!model.parsed,
    caveats,
  };
}

/** 交给模型的提示词（和 buildWorkInsight 用的是同一批数据） */
export function insightPromptFor(input: Omit<BuildInput, 'model' | 'now'>) {
  const { profile, works, settingsOf, materials } = input;
  const planned = resolveMix(profile, null, '').mix;
  const mix = mixReport(works.map((w) => ({ purpose: purposeOfWork(settingsOf, w.id) })), planned);
  const rows = performanceRowsOf(
    works.map((w) => ({ id: w.id, title: w.title, metrics: w.metrics, published_at: w.published_at ?? null })),
    settingsOf,
  );
  const summary = summarizePerformance(rows);
  return insightPrompt({
    profileSummary: buildProfileSummary(profile as Record<string, unknown> & { profile_name?: unknown }),
    works: works.map((w) => {
      const metrics = readMetrics(w.metrics);
      return {
        title: w.title,
        role: roleOfPurpose(purposeOfWork(settingsOf, w.id)),
        tactic: str(settingsOf.get(w.id)?.tactic),
        status: workStatusLabel(w),
        metrics: metrics ? metricsLine(metrics) : null,
      };
    }),
    mix,
    feedback: roleFeedback(summary),
    dataNotes: summary.insights,
    materialTexts: materials.filter((m) => m.status === 'ok').map((m) => ({ name: m.filename, text: m.content })),
  });
}
