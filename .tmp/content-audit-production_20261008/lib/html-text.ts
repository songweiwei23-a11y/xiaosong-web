/**
 * 网页 → 正文（深度研究读网页用）。不引第三方库：线上服务器装包的线路不稳。
 *
 * 做法：按块级标签切成一段段，每段算「字数」和「链接字数」；导航、推荐列表这种几乎全是链接的段落扣分，
 * 有标点、成句的段落加分，再取得分最高的那一片连续区域（最大子段和）当正文——
 * 新闻、公众号转载页、政府公告、百科这几类页面的正文都是一大片连续的成句段落，旁边是链接列表。
 */

const ENTITIES: Record<string, string> = {
  nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’',
  mdash: '—', ndash: '–', hellip: '…', middot: '·', times: '×', divide: '÷', yen: '¥', copy: '©', reg: '®', deg: '°', ensp: ' ', emsp: ' ', thinsp: ' ',
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : '';
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

const stripTags = (s: string) => decodeEntities(s.replace(/<[^>]*>/g, ' ')).replace(/[ \t\r\f\v 　]+/g, ' ').trim();

function metaContent(html: string, names: string[]): string {
  for (const name of names) {
    const re = new RegExp(`<meta[^>]+(?:name|property|itemprop)=["']${name}["'][^>]*>`, 'i');
    const tag = html.match(re)?.[0];
    const v = tag?.match(/content=["']([^"']*)["']/i)?.[1];
    if (v && v.trim()) return decodeEntities(v.trim());
  }
  return '';
}

const BLOCK = /<\/?(?:p|div|section|article|main|li|ul|ol|h[1-6]|tr|table|tbody|thead|blockquote|pre|dd|dt|dl|figure|figcaption|br|hr)\b[^>]*>/gi;
const BOILERPLATE = /版权所有|copyright|©|icp备|公网安备|责任编辑|扫一扫|分享到|点击查看|登录|注册|免责声明|联系我们|返回顶部|上一篇|下一篇|相关阅读|相关推荐|热门推荐|广告/i;

export interface PageText {
  title: string;
  text: string;
  published: string;
}

export function extractMainText(html: string, maxChars = 15_000): PageText {
  const title = (metaContent(html, ['og:title', 'twitter:title']) || stripTags(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '')).slice(0, 200);
  const published = (metaContent(html, ['article:published_time', 'og:release_date', 'publishdate', 'pubdate', 'PubDate', 'publish_time', 'datePublished'])
    || html.match(/<time[^>]+datetime=["']([^"']+)["']/i)?.[1] || '').slice(0, 40);

  let body = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|iframe|template|head|nav|footer|header|aside|form|button|select|textarea|canvas|video|audio|object)\b[\s\S]*?(?:<\/\1\s*>|$)/gi, ' ');
  // 有 <article> 且够长就只看它（取最长的一个）
  const articles = [...body.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/gi)].map((m) => m[1]).sort((a, b) => stripTags(b).length - stripTags(a).length);
  if (articles[0] && stripTags(articles[0]).length >= 300) body = articles[0];

  const blocks = body.split(BLOCK).map((raw) => {
    const linkText = [...raw.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)].map((m) => stripTags(m[1])).join('').length;
    const text = stripTags(raw);
    return { text, linkText };
  }).filter((b) => b.text.length > 0);

  const value = (b: { text: string; linkText: number }) => {
    const len = b.text.length;
    const linky = len > 0 && b.linkText / len > 0.5;
    const sentence = /[。！？；：，,.!?;]/.test(b.text);
    if (linky) return -Math.max(10, len);
    if (len < 40 && BOILERPLATE.test(b.text)) return -20;
    if (!sentence && len < 25) return -3;
    return len;
  };
  // 最大子段和：得分最高的那一片连续区域
  let best = { sum: 0, from: 0, to: -1 };
  let cur = 0, start = 0;
  blocks.forEach((b, i) => {
    const v = value(b);
    if (cur <= 0) { cur = v; start = i; } else cur += v;
    if (cur > best.sum) best = { sum: cur, from: start, to: i };
  });
  let picked = best.to >= best.from ? blocks.slice(best.from, best.to + 1) : [];
  if (picked.map((b) => b.text).join('').length < 200) picked = blocks.filter((b) => value(b) > 0);
  const lines: string[] = [];
  for (const b of picked) {
    if (value(b) <= -10) continue;
    if (lines[lines.length - 1] === b.text) continue;
    lines.push(b.text);
  }
  let text = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  if (text.length > maxChars) text = `${text.slice(0, maxChars)}…（后文略）`;
  return { title, text, published };
}
