import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

export const dynamic = 'force-dynamic';

/**
 * 返回当前构建版本ID
 * 前端用来检测是否有新版本部署
 */
export async function GET() {
  try {
    // Next.js 在构建时会生成 .next/BUILD_ID
    const buildIdPath = join(process.cwd(), '.next', 'BUILD_ID');
    const buildId = readFileSync(buildIdPath, 'utf-8').trim();
    
    return NextResponse.json({
      buildId,
      // Next 在构建时内联公开变量，实际执行的 bundle 必须带着本次发布标记。
      release: process.env.NEXT_PUBLIC_APP_BUILD || null,
      timestamp: Date.now(),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: '当前构建编号不可用' }, { status: 503 });
  }
}
