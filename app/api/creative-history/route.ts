import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-guard';
import { getServiceSupabase } from '@/lib/admin-auth';
import { PROFILE_UUID } from '@/lib/profile-history';
import { DURABLE_CREATIVE_TASKS, ownsCreativeProfile, persistCreativeHistory } from '@/lib/creative-history';
import { readJsonBody } from '@/lib/read-body';

export async function POST(request: Request) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response!;
  try {
    // 结果大：浏览器端可能压缩 / 分块发来（lib/safe-post）
    const body = await readJsonBody(request, guard.userId);
    if (body.ownerId && body.ownerId !== guard.userId) return NextResponse.json({ error: '账号已经切换，请回原账号保存' }, { status: 403 });
    if (!PROFILE_UUID.test(body.id || '') || !DURABLE_CREATIVE_TASKS.has(body.taskType) || typeof body.result !== 'string' || !body.result.trim() || body.result.length > 500_000 || !body.inputData || typeof body.inputData !== 'object' || Array.isArray(body.inputData)) {
      return NextResponse.json({ error: '历史记录参数不正确' }, { status: 400 });
    }
    const db = getServiceSupabase();
    const profileId = body.profileId ?? null;
    if (!await ownsCreativeProfile(db, guard.userId!, profileId)) return NextResponse.json({ error: '不能保存到其他账号的档案' }, { status: 403 });
    const saved = await persistCreativeHistory(db, guard.userId!, { id: body.id, taskType: body.taskType, profileId, inputData: body.inputData, result: body.result });
    return NextResponse.json(saved ? { saved: true } : { error: '云端暂未保存成功，请重试保存' }, { status: saved ? 200 : 503 });
  } catch {
    return NextResponse.json({ error: '云端暂未保存成功，请重试保存' }, { status: 503 });
  }
}
