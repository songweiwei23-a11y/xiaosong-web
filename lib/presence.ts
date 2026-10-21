/**
 * 在线心跳（2026-10-21）：工作台开着、页面在前台时，每 30 秒告诉服务器「这个人还在用」。
 *
 * 为什么不看登录和生成记录：登录态能保持好几周，只是浏览、看内容的人既不登录也不生成，
 * 监控上完全看不见。在线必须是「这一刻真的在用」，所以用心跳。
 *
 * 为什么存在进程内存里、不写数据库：心跳每人每 30 秒一次，写库会让数据版本一直在变，
 * 大屏就会一直重算。这里只有一个服务进程（pm2 fork 模式），内存就够用；
 * 进程重启后，心跳 30 秒内会重新攒起来。以后要多进程部署，这里要换成共享存储。
 */

/** 前端多久发一次心跳 */
export const PRESENCE_HEARTBEAT_MS = 30_000;
/** 超过这么久没有心跳，就算离线（比心跳间隔多留两次，偶尔丢一次不会闪烁） */
export const PRESENCE_ONLINE_MS = 90_000;
/** 最近 24 小时内有过心跳的人才保留 */
const KEEP_MS = 24 * 60 * 60 * 1000;

/**
 * 这次构建的版本号（构建时由部署脚本注入，见 同步到服务器.ps1）。
 * 页面和服务器用的是同一个值：页面带的版本号和服务器不一样，说明页面还是部署前打开的旧代码。
 */
export const APP_BUILD: string = sanitizeBuild(process.env.NEXT_PUBLIC_APP_BUILD) || 'dev';

export interface PresenceEntry {
  /** 最后一次看到这个人的时间（心跳或接口请求，毫秒） */
  at: number;
  /** 最后停留的页面路径（不含查询参数）；只有心跳会带，接口请求不改它 */
  path: string;
  /** 页面用的版本号（心跳带上来的）；接口请求不改它 */
  build: string;
}

/** 版本号只允许字母、数字、下划线、连字符，长度有限，防止乱填 */
export function sanitizeBuild(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const s = raw.trim();
  return /^[A-Za-z0-9_-]{1,64}$/.test(s) ? s : '';
}

interface PresenceStore {
  entries: Map<string, PresenceEntry>;
  /** 每当有人从离线变成在线就加一：大屏靠它立刻知道要刷新 */
  revision: number;
}

function store(): PresenceStore {
  const g = globalThis as unknown as { kaiwuPresence?: PresenceStore };
  return (g.kaiwuPresence ??= { entries: new Map(), revision: 0 });
}

/** 只留站内路径：以 / 开头、去掉查询参数和锚点、限制长度。其余一律记成空 */
export function cleanPath(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const p = raw.split(/[?#]/)[0].trim();
  return p.startsWith('/') && p.length <= 200 ? p : '';
}

function prune(s: PresenceStore, now: number) {
  for (const [uid, e] of s.entries) if (now - e.at > KEEP_MS) s.entries.delete(uid);
}

/** 记一次心跳（工作台页面发来的，带页面路径和版本号）。之前不在线（或从没来过）的，版本号加一 */
export function touchPresence(userId: string, rawPath: unknown, now = Date.now(), rawBuild: unknown = ''): void {
  if (!userId) return;
  const s = store();
  const prev = s.entries.get(userId);
  if (!prev || now - prev.at > PRESENCE_ONLINE_MS) s.revision++;
  s.entries.set(userId, { at: now, path: cleanPath(rawPath), build: sanitizeBuild(rawBuild) });
  prune(s, now);
}

/**
 * 登录用户发出的任何接口请求（查额度、读档案、保存、生成……）都算「在用」。
 * 只更新最后出现的时间，不改页面路径和版本号（那两样只有心跳才知道）。
 * 这样即使页面是旧代码、不发心跳，只要它在用，大屏也能看见。
 */
export function markActive(userId: string, now = Date.now()): void {
  if (!userId) return;
  const s = store();
  const prev = s.entries.get(userId);
  if (!prev || now - prev.at > PRESENCE_ONLINE_MS) s.revision++;
  s.entries.set(userId, { at: now, path: prev?.path ?? '', build: prev?.build ?? '' });
  prune(s, now);
}

/** 心跳版本号：只在有人新上线时变化 */
export function presenceRevision(): number {
  return store().revision;
}

/** 24 小时内有过心跳的人（副本，调用方随便改不影响这里） */
export function presenceSnapshot(now = Date.now()): Map<string, PresenceEntry> {
  const s = store();
  prune(s, now);
  return new Map(s.entries);
}

/** 这一刻在线的人数（最近 PRESENCE_ONLINE_MS 内有心跳） */
export function onlinePresenceCount(now = Date.now()): number {
  let n = 0;
  for (const e of store().entries.values()) if (now - e.at <= PRESENCE_ONLINE_MS) n++;
  return n;
}

/** 页面路径翻成看得懂的名字：取最长的前缀匹配，认不出来就写「工作台」 */
const PAGE_LABELS: [string, string][] = [
  ['/dashboard/script', '脚本生成'],
  ['/dashboard/topic', '选题策划'],
  ['/dashboard/review', '审稿优化'],
  ['/dashboard/storyboard', '分镜脚本'],
  ['/dashboard/positioning', '账号定位'],
  ['/dashboard/creative-brief', '创作简报'],
  ['/dashboard/industry-advice', '行业建议'],
  ['/dashboard/works', '创作进度'],
  ['/dashboard/profiles', '账号档案'],
  ['/dashboard/knowledge', '知识库'],
  ['/dashboard/membership', '会员中心'],
  ['/admin/monitor', '后台实时监控'],
  ['/admin', '后台管理'],
].sort((a, b) => b[0].length - a[0].length) as [string, string][];

export function presenceLabel(path: string): string {
  if (path === '/dashboard') return '工作台首页';
  if (!path) return '工作台';
  const hit = PAGE_LABELS.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`));
  return hit ? hit[1] : '工作台';
}

/** 测试用：清空心跳 */
export function resetPresence() {
  const s = store();
  s.entries.clear();
  s.revision = 0;
}
