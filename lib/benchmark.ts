/**
 * 对标账号 + 热点线索（整改 C · 对标追踪）。全部手动录入：编导自己看到的数据自己记，不做任何自动抓取。
 * 这里是校验和汇总（纯函数），接口和页面都用它。
 */
import { parseNumber } from './metrics-import';

export interface BenchmarkVideoRow {
  id: string;
  title: string;
  published_on: string | null;
  views: number | null;
  likes: number | null;
  completion: number | null;
}

export interface BenchmarkSummary {
  count: number;
  avgViews: number | null;
  medianCompletion: number | null;
  best: { title: string; views: number } | null;
}

const median = (xs: number[]): number | null => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round(((s[m - 1] + s[m]) / 2) * 10) / 10;
};

/** 一个对标账号的汇总：条数、平均播放、完播中位数、播放最高的一条。没录的数不算 0 */
export function summarizeBenchmark(videos: BenchmarkVideoRow[]): BenchmarkSummary {
  const views = videos.filter((v): v is BenchmarkVideoRow & { views: number } => typeof v.views === 'number');
  const completions = videos.map((v) => v.completion).filter((x): x is number => typeof x === 'number');
  const avgViews = views.length ? Math.round(views.reduce((a, v) => a + v.views, 0) / views.length) : null;
  const top = views.reduce<(BenchmarkVideoRow & { views: number }) | null>((best, v) => (!best || v.views > best.views ? v : best), null);
  return {
    count: videos.length,
    avgViews,
    medianCompletion: median(completions),
    best: top ? { title: top.title, views: top.views } : null,
  };
}

/** 页面和接口共用的输入检查：返回能存的值，或一句给编导看的错误 */
export type Checked<T> = { ok: true; value: T } | { ok: false; error: string };

export function checkAccount(input: { name?: unknown; platform?: unknown; link?: unknown; note?: unknown }): Checked<{ name: string; platform: string | null; link: string | null; note: string | null }> {
  const name = String(input.name ?? '').trim();
  if (!name) return { ok: false, error: '先填对标账号的名字' };
  if (name.length > 40) return { ok: false, error: '名字太长了，40 个字以内' };
  const link = String(input.link ?? '').trim();
  if (link && !/^https?:\/\//.test(link)) return { ok: false, error: '链接要以 http 或 https 开头，或者不填' };
  return {
    ok: true,
    value: {
      name,
      platform: String(input.platform ?? '').trim().slice(0, 20) || null,
      link: link.slice(0, 300) || null,
      note: String(input.note ?? '').trim().slice(0, 300) || null,
    },
  };
}

export function checkVideo(input: { title?: unknown; publishedOn?: unknown; views?: unknown; likes?: unknown; completion?: unknown }): Checked<{ title: string; published_on: string | null; views: number | null; likes: number | null; completion: number | null }> {
  const title = String(input.title ?? '').trim();
  if (!title) return { ok: false, error: '先填这条作品的标题' };
  const num = (raw: unknown): number | null | 'bad' => {
    if (raw == null || String(raw).trim() === '') return null;
    const n = parseNumber(String(raw).trim());
    return n == null || n < 0 ? 'bad' : n;
  };
  const views = num(input.views);
  const likes = num(input.likes);
  const completion = num(input.completion);
  if (views === 'bad' || likes === 'bad') return { ok: false, error: '播放、点赞要是数字，比如 12000 或 1.2万' };
  if (completion === 'bad' || (typeof completion === 'number' && completion > 100)) return { ok: false, error: '完播率在 0 到 100 之间' };
  const date = String(input.publishedOn ?? '').trim();
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: '发布日期按 2026-10-17 这样填，或者不填' };
  return {
    ok: true,
    value: {
      title: title.slice(0, 120),
      published_on: date || null,
      views: typeof views === 'number' ? Math.round(views) : null,
      likes: typeof likes === 'number' ? Math.round(likes) : null,
      completion: typeof completion === 'number' ? Math.round(completion * 10) / 10 : null,
    },
  };
}

export function checkHotTopic(input: { title?: unknown; sourceUrl?: unknown; seenOn?: unknown; note?: unknown }): Checked<{ title: string; source_url: string | null; seen_on: string | null; note: string | null }> {
  const title = String(input.title ?? '').trim();
  if (!title) return { ok: false, error: '先写下这个热点是什么' };
  const url = String(input.sourceUrl ?? '').trim();
  if (url && !/^https?:\/\//.test(url)) return { ok: false, error: '来源链接要以 http 或 https 开头，或者不填' };
  const seen = String(input.seenOn ?? '').trim();
  if (seen && !/^\d{4}-\d{2}-\d{2}$/.test(seen)) return { ok: false, error: '看到的日期按 2026-10-17 这样填，或者不填' };
  return {
    ok: true,
    value: {
      title: title.slice(0, 120),
      source_url: url.slice(0, 300) || null,
      seen_on: seen || null,
      note: String(input.note ?? '').trim().slice(0, 300) || null,
    },
  };
}
