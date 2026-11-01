/**
 * 「开物 · 截屏带入」插件一键采集来的对标账号数据（2026-11-02 产品方定：可以自动化采集）。
 * 插件在编导自己打开的抖音主页上自动往下翻、读作品和点赞，再打开最火的几条读评论（browser-extension/kaiwu-capture/collector.js），
 * 交到开物对标页。这里负责：校验和限量（数据来自网页，不能直接信）、只留评论文字和点赞数（不收评论人昵称）、
 * 排成拆解能直接用的文字材料。
 */

export const COLLECTION_LIMITS = {
  works: 60,
  details: 3,
  comments: 20,
  descChars: 80,
  commentChars: 100,
  headerChars: 400,
} as const;

/** 插件顺手带来的作品封面，文件名用这个开头，拆解时告诉模型哪几张是封面 */
export const COVER_PREFIX = '封面';

export interface CollectedWork { id: string; link: string; desc: string; likes: string; pinned: boolean }
export interface CollectedComment { text: string; likes: string }
export interface CollectedDetail {
  id: string;
  link: string;
  desc: string;
  likes: string;
  comments: string;
  collects: string;
  shares: string;
  publishedAt: string;
  topComments: CollectedComment[];
}
export interface Collection {
  url: string;
  profile: { name: string; header: string; follows: string; fans: string; likes: string; worksTotal: string };
  works: CollectedWork[];
  details: CollectedDetail[];
  collectedAt: string;
  /** 采集没跑完整的原因（没登录只看得到前几十条、遇到验证停了……），给拆解时说明数据不全 */
  note: string;
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const douyinLink = (v: unknown) => {
  const s = str(v, 300);
  return /^https:\/\/www\.douyin\.com\//.test(s) ? s.split('?')[0] : '';
};

/** 抖音显示的数字（「17.4万」「1.3亿」「2296」「1,234」）→ 数值；读不出返回 null */
export function parseCount(text: string | null | undefined): number | null {
  const m = (text ?? '').replace(/,/g, '').match(/(\d+(?:\.\d+)?)\s*([万亿wW])?/);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = m[2] === '亿' ? 1e8 : m[2] ? 1e4 : 1;
  return Math.round(n * unit);
}

/** 插件交来的原始数据 → 校验过、限过量的采集结果；不像采集结果就返回 null */
export function sanitizeCollection(raw: unknown): Collection | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const url = douyinLink(r.url);
  const p = (r.profile && typeof r.profile === 'object' ? r.profile : {}) as Record<string, unknown>;
  const L = COLLECTION_LIMITS;
  const works: CollectedWork[] = (Array.isArray(r.works) ? r.works : [])
    .map((w) => {
      const x = (w ?? {}) as Record<string, unknown>;
      return { id: str(x.id, 30), link: douyinLink(x.link), desc: str(x.desc, L.descChars), likes: str(x.likes, 12), pinned: x.pinned === true };
    })
    .filter((w) => /^\d+$/.test(w.id))
    .slice(0, L.works);
  const details: CollectedDetail[] = (Array.isArray(r.details) ? r.details : [])
    .map((d) => {
      const x = (d ?? {}) as Record<string, unknown>;
      return {
        id: str(x.id, 30),
        link: douyinLink(x.link),
        desc: str(x.desc, L.descChars),
        likes: str(x.likes, 12),
        comments: str(x.comments, 12),
        collects: str(x.collects, 12),
        shares: str(x.shares, 12),
        publishedAt: str(x.publishedAt, 30).replace(/^发布时间[:：]\s*/, ''),
        // 只留评论文字和点赞数：插件那边本来就不读昵称，这里再按字段白名单过一遍
        topComments: (Array.isArray(x.topComments) ? x.topComments : [])
          .map((c) => ({ text: str((c as Record<string, unknown>)?.text, L.commentChars), likes: str((c as Record<string, unknown>)?.likes, 12) }))
          .filter((c) => c.text)
          .slice(0, L.comments),
      };
    })
    .filter((d) => /^\d+$/.test(d.id))
    .slice(0, L.details);
  if (!url && !works.length) return null;
  return {
    url,
    profile: {
      name: str(p.name, 40),
      header: str(p.header, L.headerChars),
      follows: str(p.follows, 12),
      fans: str(p.fans, 12),
      likes: str(p.likes, 12),
      worksTotal: str(p.worksTotal, 12),
    },
    works,
    details,
    collectedAt: str(r.collectedAt, 30),
    note: str(r.note, 120),
  };
}

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
};
const fmt = (n: number | null) => (n == null ? '读不出' : n >= 1e4 ? `${(n / 1e4).toFixed(n >= 1e5 ? 0 : 1)}万` : String(n));

/** 一句话说清采集到了什么，给页面和材料清单用 */
export function collectionSummary(c: Collection): string {
  const comments = c.details.reduce((n, d) => n + d.topComments.length, 0);
  return `插件采集：作品 ${c.works.length} 条${c.details.length ? `，热门 ${c.details.length} 条的评论 ${comments} 条` : ''}`;
}

/** 排成拆解用的文字材料：主页信息 → 作品点赞概况 → 作品清单 → 热门作品的数据和评论 */
export function formatCollection(c: Collection): string {
  const likes = c.works.map((w) => parseCount(w.likes)).filter((n): n is number => n != null);
  const ranked = c.works
    .map((w) => ({ w, n: parseCount(w.likes) }))
    .filter((x) => x.n != null)
    .sort((a, b) => (b.n ?? 0) - (a.n ?? 0));
  const med = median(likes);
  const line = (w: CollectedWork) => `${w.pinned ? '［置顶］' : ''}${w.likes || '?'} 赞｜${w.desc || '（无标题）'}`;

  const out = [
    `【插件自动采集的账号数据】（${c.collectedAt ? `采集于 ${c.collectedAt.slice(0, 16).replace('T', ' ')}，` : ''}来源：${c.url || '抖音主页'}）`,
    c.note ? `说明：${c.note}` : '',
    '',
    '主页信息：',
    c.profile.header || c.profile.name || '（没读到）',
    [c.profile.fans && `粉丝 ${c.profile.fans}`, c.profile.likes && `获赞 ${c.profile.likes}`, c.profile.worksTotal && `作品 ${c.profile.worksTotal}`].filter(Boolean).join('，'),
    '',
    `作品点赞概况（读到 ${c.works.length} 条，按主页从新到旧）：中位数 ${fmt(med)} 赞，最高 ${fmt(ranked[0]?.n ?? null)}，最低 ${fmt(ranked.at(-1)?.n ?? null)}。`,
    med != null ? `明显高于中位数 3 倍的有 ${likes.filter((n) => n >= med * 3).length} 条。` : '',
    '',
    '作品清单：',
    ...c.works.map((w, i) => `${i + 1}. ${line(w)}`),
  ];
  for (const d of c.details) {
    out.push(
      '',
      `【热门作品】${d.desc || d.id}`,
      `点赞 ${d.likes || '?'}，评论 ${d.comments || '?'}，收藏 ${d.collects || '?'}，分享 ${d.shares || '?'}${d.publishedAt ? `，发布于 ${d.publishedAt}` : ''}`,
      d.topComments.length ? '评论区（按页面顺序，只记文字和点赞，不记评论人）：' : '评论区：没读到',
      ...d.topComments.map((x) => `- ${x.text}${x.likes ? `（${x.likes} 赞）` : ''}`),
    );
  }
  return out.filter((s, i, arr) => s !== '' || arr[i - 1] !== '').join('\n').trim();
}
