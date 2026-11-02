/**
 * 助理读对标账号（2026-11-02 体检补的）：对标 & 热点页存下的对标账号、录的作品数据、拆解报告和热点线索，
 * 压成一段给助理看的摘要。老板说「参考我拆过的那个号出选题」时，助理先读这个，再把对方的打法要点写进派活单。
 * 纯函数，数据由调用方从 /api/benchmark 读来。
 */

interface Summary { count?: number; avgViews?: number | null; best?: { title?: string; views?: number } | null }
interface Analysis { report?: string | null; created_at?: string | null }
interface Account { id?: string; name?: string; platform?: string | null; link?: string | null; note?: string | null; summary?: Summary; analyses?: Analysis[] }
interface Hot { title?: string; source_url?: string | null; seen_on?: string | null; note?: string | null }

const MAX_ACCOUNTS = 5;
const REPORT_CHARS = 1800;

/**
 * 从拆解报告里取最有用的几段：
 * - 带「我们学什么」的新框架（11-02 晚）：一句话定位 + 可借鉴打法的每招标题 + 能直接做的选题标题——
 *   老板说「照我拆的那个号出选题」，派活单里要写的就是借哪一招、做哪个选题；
 * - 11-02 的框架：「核心结论」和「一句话定位」；
 * - 更早的旧框架：「账号定位拆解」和「内容拆解」。都找不到就取开头一段。
 */
export function reportGist(report: string): string {
  const sections = report.split(/\n(?=###\s)/);
  const pick = (re: RegExp) => sections.find((s) => re.test(s.split('\n')[0]))?.trim() ?? '';
  const moves = pick(/可借鉴的打法/);
  if (moves) {
    const titles = [...moves.matchAll(/^####\s*(第\s*\S+?\s*招.*)$/gm)].map((m) => `- ${m[1].trim()}`);
    const topics = [...pick(/可以直接做的/).matchAll(/^\d+\.\s*\*\*(.+?)\*\*/gm)].map((m) => `- ${m[1].trim()}`);
    const gist = [
      pick(/一句话定位/),
      titles.length ? `可借鉴的打法（报告第十二节，每招都写了「我们怎么改了用」）：\n${titles.join('\n')}` : '',
      topics.length ? `能直接做的选题（报告第十三节）：\n${topics.join('\n')}` : '',
    ].filter(Boolean).join('\n\n');
    return gist.length > REPORT_CHARS ? `${gist.slice(0, REPORT_CHARS)}…（只摘了一部分，全文在对标 & 热点页）` : gist;
  }
  const parts = [pick(/核心结论/), pick(/一句话定位/)].filter(Boolean);
  const old = parts.length ? [] : [pick(/账号定位拆解/), pick(/内容拆解/)].filter(Boolean);
  const gist = (parts.length ? parts : old).join('\n\n') || report.trim();
  return gist.length > REPORT_CHARS ? `${gist.slice(0, REPORT_CHARS)}…（只摘了开头，全文在对标 & 热点页）` : gist;
}

export function benchmarkDigest(data: { accounts?: Account[]; hotTopics?: Hot[] } | null | undefined): string {
  const accounts = Array.isArray(data?.accounts) ? data.accounts : [];
  const hot = Array.isArray(data?.hotTopics) ? data.hotTopics : [];
  if (!accounts.length && !hot.length) {
    return '老板还没有加过对标账号，也没有记热点线索。要拆对标账号，可以打开「对标 & 热点」页，粘贴对方抖音主页链接，点「一键采集并拆解」（要先装开物插件）。';
  }
  const lines: string[] = [`对标账号 ${accounts.length} 个${accounts.length > MAX_ACCOUNTS ? `（只列最近的 ${MAX_ACCOUNTS} 个）` : ''}：`];
  for (const a of accounts.slice(-MAX_ACCOUNTS).reverse()) {
    const s = a.summary ?? {};
    const stats = [
      s.count ? `录了 ${s.count} 条作品` : '',
      s.avgViews != null ? `平均播放 ${s.avgViews}` : '',
      s.best?.title ? `播放最高「${s.best.title}」` : '',
    ].filter(Boolean).join('，');
    lines.push('', `■ ${a.name || '未命名'}${a.platform ? `（${a.platform}）` : ''}${a.link ? ` ${a.link}` : ''}`);
    if (a.note) lines.push(`备注：${a.note}`);
    if (stats) lines.push(stats);
    const latest = (a.analyses ?? []).find((x) => typeof x.report === 'string' && x.report.trim());
    lines.push(latest ? `最近一次拆解（${(latest.created_at ?? '').slice(0, 10) || '日期未知'}）的要点：\n${reportGist(latest.report as string)}` : '还没有拆解报告。');
  }
  if (hot.length) {
    lines.push('', `热点线索（最近 ${Math.min(hot.length, 8)} 条）：`);
    for (const h of hot.slice(0, 8)) lines.push(`- ${h.title || '未命名'}${h.seen_on ? `（${h.seen_on}）` : ''}${h.note ? `：${h.note}` : ''}`);
  }
  return lines.join('\n');
}
