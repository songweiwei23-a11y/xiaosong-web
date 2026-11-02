/**
 * 老板现状（2026-11-02 产品方：「不仅聪明，而且会调动整个开物，多维度、站在用户角度为用户办事」）。
 *
 * 原来助理每轮对话开始时对老板的号一无所知，要老板问了才去查档案、作品、待办，
 * 所以只能「被动接单」。现在每轮开始前自动把整个开物里和这个老板有关的情况看一遍，压成一段现状，
 * 放进系统提示词：档案、地基做到哪、最近的创作、作品拍没拍发没发、对标、待办、额度，
 * 再按规则先替老板看出「卡在哪、下一步最值钱的是什么」。
 *
 * 只读，不调模型、不扣额度；每一项读不到就跳过，不影响对话。同一个老板 60 秒内复用上一次的结果。
 */
import { readInternal, type BoardContext } from '@/lib/assistant/boards';
import { listRecentResults } from '@/lib/assistant/carry';
import { setupSteps } from '@/lib/setup-progress';
import { diagnosisPromptBlock, type AccountDiagnosis } from '@/lib/account-diagnosis';

interface Work { title?: string; is_done?: boolean; shoot_status?: string; updated_at?: string }
interface Todo { content?: string; done?: boolean; due_at?: string | null }

export interface Situation {
  /** 北京时间今天，YYYY-MM-DD */
  today: string;
  profileCount: number;
  profile: { name: string; industry: string } | null;
  /** 当前档案已有的定位类成果：账号定位、商业定位、内容定位、创作简报、行业建议、起号方案…… */
  positioningTypes: string[];
  recent: { from: string; title: string; createdAt: string }[];
  works: Work[] | null;
  todos: Todo[] | null;
  benchmarks: { accounts: number; analyzed: number; latestAt: string | null } | null;
  quota: { planName: string; tightest: { featureName: string; remaining: number } | null } | null;
  /** 账号诊断（创作进度「诊断我的账号」）：有就把要点放进现状，助理协调时照它补全派活单 */
  diagnosis?: AccountDiagnosis | null;
}

const shanghaiDay = (d: Date | string) => new Date(d).toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' });
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

/**
 * 看出来的一件事：signal 写进助理的提示词（说清为什么）；label、ask、href 给工作台首页的「今天」用——
 * 点一下把 ask 交给助理去办，没开助理就打开 href 那一页
 */
export interface SituationItem {
  key: string;
  signal: string;
  label: string;
  ask: string;
  href: string;
}

/** 从现状里看出来的事，按要紧程度排：老板卡在哪、下一步最值钱的是什么。纯规则，不调模型 */
export function situationItems(s: Situation): SituationItem[] {
  const out: SituationItem[] = [];
  const steps = setupSteps({ profileCount: s.profileCount, positioningTypes: s.positioningTypes });
  const missing = steps.find((x) => !x.done);
  if (missing) {
    out.push({
      key: 'foundation',
      signal: `地基没打完：下一步是「${missing.title}」——${missing.why}。选题、脚本这些创作板块要等地基做完才派得出去`,
      label: `地基还差一步：${missing.title}`,
      ask: missing.key === 'profile' ? '我还没有账号档案，带我建一个' : `帮我把「${missing.title}」做了`,
      href: missing.href,
    });
  }

  if (s.todos) {
    const open = s.todos.filter((t) => !t.done && t.due_at);
    const overdue = open.filter((t) => shanghaiDay(t.due_at as string) < s.today).length;
    const dueToday = open.filter((t) => shanghaiDay(t.due_at as string) === s.today).length;
    if (overdue || dueToday) {
      const what = `${overdue ? `过期 ${overdue} 条` : ''}${overdue && dueToday ? '，' : ''}${dueToday ? `今天到期 ${dueToday} 条` : ''}`;
      out.push({ key: 'todos', signal: `待办：${what}`, label: `待办${what}`, ask: '我今天有什么要做的？过期的帮我看看怎么处理', href: '/dashboard' });
    }
  }

  if (s.works) {
    const unshot = s.works.filter((w) => w.is_done && (w.shoot_status ?? 'none') === 'none').length;
    const shotNotPosted = s.works.filter((w) => w.shoot_status === 'shot').length;
    const published = s.works.filter((w) => w.shoot_status === 'published').length;
    if (shotNotPosted) out.push({ key: 'post', signal: `有 ${shotNotPosted} 条拍完还没发：发了才有数据，先发`, label: `${shotNotPosted} 条拍完还没发`, ask: '有几条拍完还没发，帮我排一下这周的发布，记进待办', href: '/dashboard/works' });
    if (unshot >= 2) out.push({ key: 'shoot', signal: `有 ${unshot} 条内容做完还没拍：再出新稿之前，先把这几条拍掉`, label: `${unshot} 条写好了还没拍`, ask: '有几条内容做完还没拍，帮我排进拍摄待办', href: '/dashboard/works' });
    // 发了几条还没诊断过自己的号，或者诊断已经过了一个月：现状变了，规划还按老情况走
    const diagAge = s.diagnosis ? daysBetween(s.diagnosis.generatedAt, `${s.today}T12:00:00+08:00`) : null;
    if (published >= 3 && diagAge === null) out.push({ key: 'diagnose', signal: `已经发了 ${published} 条，还没诊断过自己的号：诊断一次，规划、选题、方向就能按实际情况调整`, label: '还没诊断过自己的号', ask: '帮我诊断一下我的账号', href: '/dashboard/works' });
    else if (diagAge !== null && diagAge >= 30) out.push({ key: 'diagnose-old', signal: `账号诊断是 ${diagAge} 天前做的，之后的作品没算进去：再诊断一次`, label: `诊断已经 ${diagAge} 天了`, ask: '帮我重新诊断一下我的账号', href: '/dashboard/works' });
    if (published >= 3 && s.benchmarks && s.benchmarks.accounts === 0) out.push({ key: 'benchmark-none', signal: `已经发了 ${published} 条，还没有对标账号：找一个同行拆一下，知道自己差在哪`, label: '还没有对标账号', ask: '我想找一个对标账号拆一下，怎么做？', href: '/dashboard/benchmark' });
  }

  const last = s.recent[0];
  if (last) {
    const idle = daysBetween(last.createdAt, `${s.today}T12:00:00+08:00`);
    if (idle >= 7) out.push({ key: 'idle', signal: `已经 ${idle} 天没有新的创作了：可以从「接着上次的方向出选题」开始，门槛最低`, label: `${idle} 天没有新内容了`, ask: '接着我上次的方向，帮我出一批选题', href: '/dashboard/topic' });
    else if (/选题/.test(last.from) && !s.recent.slice(0, 3).some((r) => /脚本/.test(r.from))) out.push({ key: 'topic-to-script', signal: `最近一次出了选题（${last.title.slice(0, 20)}），还没写成脚本：挑一条写脚本是最顺的下一步`, label: '上次的选题还没写成脚本', ask: '把最近那批选题挑最好的一条写成脚本', href: '/dashboard/script' });
  } else if (!missing) {
    out.push({ key: 'first', signal: '地基做好了，但还没有任何创作：从出第一批选题开始', label: '出第一批选题', ask: '帮我出第一批选题', href: '/dashboard/topic' });
  }

  if (s.benchmarks && s.benchmarks.accounts > s.benchmarks.analyzed) {
    const n = s.benchmarks.accounts - s.benchmarks.analyzed;
    out.push({ key: 'benchmark-todo', signal: `有 ${n} 个对标账号加了还没拆`, label: `${n} 个对标账号还没拆`, ask: '我加了对标账号还没拆，怎么一键拆解？', href: '/dashboard/benchmark' });
  }
  if (s.quota?.tightest && s.quota.tightest.remaining <= 2) {
    out.push({ key: 'quota', signal: `额度：「${s.quota.tightest.featureName}」只剩 ${s.quota.tightest.remaining} 次，派这类活前先说一声`, label: `「${s.quota.tightest.featureName}」只剩 ${s.quota.tightest.remaining} 次`, ask: '我的额度还剩多少？', href: '/dashboard/membership' });
  }
  return out;
}

export function situationSignals(s: Situation): string[] {
  return situationItems(s).map((x) => x.signal);
}

/** 放进系统提示词的那段：现状 + 看出来的事 + 怎么用 */
export function situationBlock(s: Situation): string {
  const lines: string[] = ['', '', '【老板现状（系统每轮自动整理，只读；用它判断需求、补全派活单，不用再为这些去问老板）】'];
  lines.push(s.profile ? `- 当前档案：${s.profile.name}${s.profile.industry ? `（${s.profile.industry}）` : ''}；共 ${s.profileCount} 个档案` : `- 账号档案：${s.profileCount ? `${s.profileCount} 个，当前没选中` : '还没有'}`);
  lines.push(`- 已有的定位类成果：${s.positioningTypes.length ? [...new Set(s.positioningTypes)].join('、') : '无'}`);
  if (s.recent.length) lines.push(`- 最近的创作：${s.recent.slice(0, 5).map((r) => `${r.from || '创作'}「${(r.title || '').slice(0, 18)}」(${shanghaiDay(r.createdAt).slice(5)})`).join('；')}`);
  else lines.push('- 最近的创作：没有');
  if (s.works) {
    const c = (st: string) => s.works!.filter((w) => (w.shoot_status ?? 'none') === st).length;
    lines.push(`- 作品进度（最近 ${s.works.length} 条）：没拍 ${c('none')}，拍完没发 ${c('shot')}，已发布 ${c('published')}`);
  }
  if (s.benchmarks) lines.push(`- 对标账号：${s.benchmarks.accounts} 个，拆过 ${s.benchmarks.analyzed} 个${s.benchmarks.latestAt ? `，最近一次拆解 ${s.benchmarks.latestAt}` : ''}`);
  if (s.todos) lines.push(`- 待办：未完成 ${s.todos.filter((t) => !t.done).length} 条`);
  if (s.quota) lines.push(`- 套餐：${s.quota.planName}${s.quota.tightest ? `；最紧张的「${s.quota.tightest.featureName}」剩 ${s.quota.tightest.remaining} 次` : ''}`);
  const signals = situationSignals(s);
  if (signals.length) {
    lines.push('看出来的事（按要紧程度）：');
    signals.forEach((x, i) => lines.push(`${i + 1}. ${x}`));
  }
  const diag = diagnosisPromptBlock(s.diagnosis, 'assistant');
  if (diag) lines.push('', diag);
  return lines.join('\n');
}

const cache = new Map<string, { at: number; value: Situation }>();
const TTL_MS = 60_000;

/** 每一项各读各的，读不到就是 null / 空，不拖累别的；整体最多等几秒 */
export async function loadSituation(ctx: BoardContext, profileId: string | null, now = Date.now()): Promise<Situation> {
  const key = `${ctx.userId}:${profileId ?? ''}`;
  const hit = cache.get(key);
  if (hit && now - hit.at < TTL_MS) return hit.value;

  const soft = <T>(p: Promise<T>): Promise<T | null> =>
    Promise.race([p.catch(() => null), new Promise<null>((r) => setTimeout(() => r(null), 4000))]);
  const profilesRaw = await soft(readInternal(ctx, '/api/profiles'));
  const profiles = Array.isArray(profilesRaw) ? (profilesRaw as { id: string; profile_name?: string | null; industry?: string | null }[]) : [];
  const current = profiles.find((p) => p.id === profileId) ?? profiles[0] ?? null;

  const [positions, recent, works, todos, bench, quota, insight] = await Promise.all([
    current ? soft(readInternal(ctx, `/api/positioning?profileId=${encodeURIComponent(current.id)}`)) : Promise.resolve(null),
    soft(listRecentResults(ctx, 5)),
    soft(readInternal(ctx, '/api/works?limit=20')),
    soft(readInternal(ctx, '/api/todos')),
    soft(readInternal(ctx, '/api/benchmark')),
    soft(readInternal(ctx, '/api/quota/check')),
    current ? soft(readInternal(ctx, `/api/work-insights?profileId=${encodeURIComponent(current.id)}`)) : Promise.resolve(null),
  ]);

  const accounts = (bench as { accounts?: { analyses?: { created_at?: string }[] }[] } | null)?.accounts;
  const analyzedDates = Array.isArray(accounts) ? accounts.flatMap((a) => (a.analyses ?? []).map((x) => x.created_at ?? '')).filter(Boolean).sort() : [];
  const q = quota as { planName?: string; tightest?: { featureName: string; remaining: number } | null } | null;
  const value: Situation = {
    today: shanghaiDay(new Date(now)),
    profileCount: profiles.length,
    profile: current ? { name: current.profile_name?.trim() || '未命名档案', industry: current.industry?.trim() || '' } : null,
    positioningTypes: Array.isArray(positions) ? (positions as { positioning_type?: string }[]).map((r) => r.positioning_type ?? '').filter(Boolean) : [],
    recent: Array.isArray(recent) ? recent.map((r) => ({ from: r.from, title: r.title || r.preview, createdAt: r.createdAt })) : [],
    works: Array.isArray(works) ? (works as Work[]) : null,
    todos: Array.isArray(todos) ? (todos as Todo[]) : null,
    benchmarks: Array.isArray(accounts) ? { accounts: accounts.length, analyzed: accounts.filter((a) => (a.analyses ?? []).length).length, latestAt: analyzedDates.at(-1)?.slice(0, 10) ?? null } : null,
    quota: q ? { planName: q.planName ?? '免费版', tightest: q.tightest ?? null } : null,
    diagnosis: (insight as { insight?: { diagnosis?: AccountDiagnosis | null } | null } | null)?.insight?.diagnosis ?? null,
  };
  cache.set(key, { at: now, value });
  return value;
}

/** 测试用 */
export function clearSituationCache(): void {
  cache.clear();
}
