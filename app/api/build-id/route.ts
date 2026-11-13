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
      timestamp: Date.now()
    });
  } catch (error) {
    // 如果读取失败，返回当前时间戳作为版本号
    return NextResponse.json({ 
      buildId: Date.now().toString(),
      timestamp: Date.now()
    });
  }
}
