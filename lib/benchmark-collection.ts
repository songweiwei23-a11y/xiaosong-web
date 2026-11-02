/**
 * 「开物 · 截屏带入」插件一键采集来的对标账号数据（2026-11-02 产品方定：可以自动化采集）。
 * 插件在编导自己打开的抖音主页上自动往下翻、读作品和点赞，再打开最火的几条读评论（browser-extension/kaiwu-capture/collector.js），
 * 交到开物对标页。这里负责：校验和限量（数据来自网页，不能直接信）、只留评论文字和点赞数（不收评论人昵称）、
 * 排成拆解能直接用的文字材料。
 */

// 2026-11-02 产品方：「信息量更多一些……重点是让用户根据对标拿到自己可以借鉴、可以学习的部分」。
// 细看的作品从最火 3 条加到 8 条：最火 5 条 + 点赞最低 2 条（爆款和扑街对照）+ 最新 1 条（看他现在往哪走）；
// 每条多读完整文案、话题、时长，评论 40 条并标出作者回过、赞过的（看他怎么维护评论区）。
export const COLLECTION_LIMITS = {
  works: 60,
  details: 8,
  comments: 40,
  descChars: 80,
  captionChars: 300,
  tags: 10,
  commentChars: 100,
  headerChars: 600,
  tabsChars: 160,
} as const;

/** 插件顺手带来的作品封面，文件名用这个开头，拆解时告诉模型哪几张是封面 */
export const COVER_PREFIX = '封面';

/** 细看的作品为什么被挑中：最火的、点赞偏低的（对照）、最新的 */
export type DetailRole = 'hot' | 'low' | 'new';
export const DETAIL_ROLE_LABEL: Record<DetailRole, string> = { hot: '热门作品', low: '点赞偏低的作品（对照）', new: '最新作品' };

export interface CollectedWork { id: string; link: string; desc: string; likes: string; pinned: boolean }
/** authorReplied / authorLiked：页面上标了「作者回复过」「作者赞过」 */
export interface CollectedComment { text: string; likes: string; authorReplied?: boolean; authorLiked?: boolean }
export interface CollectedDetail {
  id: string;
  link: string;
  role: DetailRole;
  desc: string;
  /** 作品页上的完整文案（标题 + 正文），话题单独放在 tags */
  caption: string;
  tags: string[];
  /** 视频时长（秒），图文或读不到为空 */
  duration: string;
  likes: string;
  comments: string;
  collects: string;
  shares: string;
  publishedAt: string;
  topComments: CollectedComment[];
}
export interface Collection {
  url: string;
  /** tabs：主页上作品、合集、橱窗这一排的文字（看内容怎么分栏、有没有橱窗团购） */
  profile: { name: string; header: string; follows: string; fans: string; likes: string; worksTotal: string; tabs: string };
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
        role: (x.role === 'low' || x.role === 'new' ? x.role : 'hot') as DetailRole,
        desc: str(x.desc, L.descChars),
        caption: str(x.caption, L.captionChars),
        tags: (Array.isArray(x.tags) ? x.tags : []).map((t) => str(t, 30).replace(/^#/, '')).filter(Boolean).slice(0, L.tags),
        duration: /^\d{1,5}$/.test(String(x.duration ?? '')) ? String(x.duration) : '',
        likes: str(x.likes, 12),
        comments: str(x.comments, 12),
        collects: str(x.collects, 12),
        shares: str(x.shares, 12),
        publishedAt: str(x.publishedAt, 30).replace(/^发布时间[:：]\s*/, ''),
        // 只留评论文字和点赞数：插件那边本来就不读昵称，这里再按字段白名单过一遍
        topComments: (Array.isArray(x.topComments) ? x.topComments : [])
          .map((c) => {
            const y = (c ?? {}) as Record<string, unknown>;
            return { text: str(y.text, L.commentChars), likes: str(y.likes, 12), authorReplied: y.authorReplied === true, authorLiked: y.authorLiked === true };
          })
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
      tabs: str(p.tabs, L.tabsChars),
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
  return `插件采集：作品 ${c.works.length} 条${c.details.length ? `，细看 ${c.details.length} 条（数据、文案、评论 ${comments} 条）` : ''}`;
}

const durationText = (s: string) => {
  const n = Number(s);
  return n >= 60 ? `${Math.floor(n / 60)} 分 ${n % 60} 秒` : `${n} 秒`;
};

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
    c.profile.tabs ? `主页栏目：${c.profile.tabs}` : '',
    '',
    `作品点赞概况（读到 ${c.works.length} 条，按主页从新到旧）：中位数 ${fmt(med)} 赞，最高 ${fmt(ranked[0]?.n ?? null)}，最低 ${fmt(ranked.at(-1)?.n ?? null)}。`,
    med != null ? `明显高于中位数 3 倍的有 ${likes.filter((n) => n >= med * 3).length} 条。` : '',
    '',
    '作品清单：',
    ...c.works.map((w, i) => `${i + 1}. ${line(w)}`),
  ];
  // 细看的作品按「热门 → 点赞偏低（对照）→ 最新」排，同一类编上号，报告里好引用（热门 2、对照 1、最新 1）
  const seq: Record<DetailRole, number> = { hot: 0, low: 0, new: 0 };
  const short: Record<DetailRole, string> = { hot: '热门', low: '对照', new: '最新' };
  const order: DetailRole[] = ['hot', 'low', 'new'];
  for (const d of [...c.details].sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role))) {
    seq[d.role] += 1;
    const replied = d.topComments.filter((x) => x.authorReplied).length;
    out.push('', ...[
      `【${DETAIL_ROLE_LABEL[d.role]}｜${short[d.role]} ${seq[d.role]}】${d.desc || d.id}`,
      `点赞 ${d.likes || '?'}，评论 ${d.comments || '?'}，收藏 ${d.collects || '?'}，分享 ${d.shares || '?'}${d.publishedAt ? `，发布于 ${d.publishedAt}` : ''}${d.duration ? `，时长 ${durationText(d.duration)}` : ''}`,
      d.caption ? `完整文案：${d.caption}` : '',
      d.tags.length ? `话题：${d.tags.map((t) => `#${t}`).join(' ')}` : '',
      d.topComments.length
        ? `评论区（按页面顺序，只记文字和点赞，不记评论人${replied ? `；作者回复过的 ${replied} 条已标出` : ''}）：`
        : '评论区：没读到',
      ...d.topComments.map((x) => `- ${x.text}${x.likes ? `（${x.likes} 赞）` : ''}${x.authorReplied ? '［作者回复过］' : x.authorLiked ? '［作者赞过］' : ''}`),
    ].filter(Boolean));
  }
  return out.filter((s, i, arr) => s !== '' || arr[i - 1] !== '').join('\n').trim();
}
