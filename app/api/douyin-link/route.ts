import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-guard';
import { readJsonBody } from '@/lib/read-body';
import { createRateLimiter } from '@/lib/rate-limit';
import { classifyDouyinUrl, isDouyinHost } from '@/lib/douyin-link';

export const dynamic = 'force-dynamic';

/**
 * 解析抖音链接（2026-11-10：点「一键采集」没反应）。
 * 抖音 App 分享出来的是短链接（v.douyin.com/xxx），复制不全或过期会跳到抖音首页；插件打开首页发现不是主页就停了，
 * 提示只在抖音那个标签页里，开物页面上看起来「没反应」。
 * 现在点按钮时先在这里跟一遍跳转（只跟抖音自己的域名，最多 5 跳，不读正文），告诉页面最后落在哪：
 *   profile 账号主页 → 把真实地址交给插件；work 作品 → 照样交给插件（插件会跳到作者主页）；other → 当场提示重新分享
 */
const limit = createRateLimiter(60_000, 20);
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

export async function POST(request: Request) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response!;
  if (limit(guard.userId!)) return NextResponse.json({ error: '太频繁了，过一会儿再试' }, { status: 429 });
  let body: { url?: unknown };
  try { body = await readJsonBody(request, guard.userId!); } catch { return NextResponse.json({ error: '请求格式不正确' }, { status: 400 }); }
  let url = typeof body.url === 'string' ? body.url.trim() : '';
  try { if (!isDouyinHost(new URL(url).hostname)) throw new Error(); } catch { return NextResponse.json({ error: '不是抖音的链接' }, { status: 400 }); }
  for (let i = 0; i < 5; i++) {
    const kind = classifyDouyinUrl(url);
    if (kind !== 'short') return NextResponse.json({ url, kind });
    let res: Response;
    try {
      res = await fetch(url, { redirect: 'manual', headers: { 'user-agent': UA }, signal: AbortSignal.timeout(8000) });
    } catch {
      // 解析不了（网络问题）：不挡，原样交给插件
      return NextResponse.json({ url, kind: 'unknown' });
    }
    const loc = res.headers.get('location');
    if (!loc) return NextResponse.json({ url, kind: 'other' });
    const next = new URL(loc, url);
    if (!isDouyinHost(next.hostname)) return NextResponse.json({ url, kind: 'other' });
    url = next.href;
  }
  return NextResponse.json({ url, kind: classifyDouyinUrl(url) === 'short' ? 'other' : classifyDouyinUrl(url) });
}
