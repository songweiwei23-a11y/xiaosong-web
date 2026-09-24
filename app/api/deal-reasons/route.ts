import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-guard';
import { getServiceSupabase } from '@/lib/admin-auth';
import { toReasonLabels } from '@/lib/deal-reasons';

export const dynamic = 'force-dynamic';

/**
 * 当前用户已确定的成交理由。
 *
 * 成交理由页会把分析结果存进 deal_reasons 表，选题、脚本、标题三个板块
 * 通过创作上下文（hooks/useCreatorContext）自动带上。
 *
 * 表是按用户存的（不是按档案），取最新一条。
 *
 * 【读和写都走服务端 + service_role，并显式按 user_id 过滤】
 * 原来读用的是受行级权限约束的客户端、查询里却没带 user_id——一旦这张表
 * 的行级权限没开（它在迁移文件里连建表语句都没有，开没开没人知道），
 * 任何人都会拿到"全站最新一条"，也就是别人的成交理由。
 */
export async function GET() {
  const guard = await requireUser();
  if (!guard.ok) return guard.response!;

  const { data, error } = await getServiceSupabase()
    .from('deal_reasons')
    .select('*')
    .eq('user_id', guard.userId!)
    .order('updated_at', { ascending: false, nullsFirst: false })
    .limit(1);

  if (error) {
    // 读不到按「没有成交理由」处理。这只是上下文的一部分，不该让整块上下文加载失败
    console.warn('[deal-reasons] 读取失败:', error.message);
    return NextResponse.json({ reasons: [] });
  }

  const row = data?.[0];
  if (!row) return NextResponse.json({ reasons: [] });

  /*
   * 统一成中文名。老代码存的是英文代号（looks、honest），原样交出去的话，
   * 各板块提示词里拿到的就是"成交理由：looks、effect、choice"。
   */
  const reasons = toReasonLabels(row.selected_reasons).slice(0, 8);

  return NextResponse.json({
    reasons,
    updatedAt: row.updated_at ?? row.created_at ?? null,
    // 成交理由页自己回填表单用；创作上下文只读 reasons
    storeName: row.store_name ?? '',
    storeType: row.store_type ?? '',
    storeFeatures: row.store_features ?? '',
    targetCustomer: row.target_customer ?? '',
    analysisResult: row.analysis_result ?? '',
  });
}

/**
 * 保存。
 *
 * 【为什么不用 upsert】原来是 upsert(onConflict: 'user_id')。这要求 user_id 上
 * 有唯一约束，而线上这张表没有——实测返回 42P10。也就是说
 * 「保存到云端」这个按钮**从上线起就没成功过一次**，线上一条记录都没有。
 *
 * 改成先查后写：有就更新，没有就插入。不依赖约束，今天就能用。
 */
export async function POST(request: Request) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response!;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '请求格式不正确' }, { status: 400 });
  }

  const storeName = String(body.storeName ?? '').trim();
  if (!storeName) return NextResponse.json({ error: '请填写店铺名称' }, { status: 400 });

  const reasons = toReasonLabels(body.selectedReasons);
  if (reasons.length === 0) {
    return NextResponse.json({ error: '至少选一个成交理由' }, { status: 400 });
  }

  const row = {
    user_id: guard.userId!,
    store_name: storeName.slice(0, 60),
    store_type: String(body.storeType ?? '其他').slice(0, 20),
    store_features: String(body.storeFeatures ?? '').slice(0, 2000),
    target_customer: String(body.targetCustomer ?? '').slice(0, 200),
    analysis_result: String(body.analysisResult ?? ''),
    // 存中文名，不存代号
    selected_reasons: reasons,
    updated_at: new Date().toISOString(),
  };

  const db = getServiceSupabase();
  const { data: existing, error: readError } = await db
    .from('deal_reasons')
    .select('id')
    .eq('user_id', guard.userId!)
    .order('updated_at', { ascending: false, nullsFirst: false })
    .limit(1);
  if (readError) {
    console.error('[deal-reasons] 保存前读取失败:', readError.message);
    return NextResponse.json({ error: '保存失败，请稍后重试' }, { status: 500 });
  }

  const { error } = existing?.[0]
    ? await db.from('deal_reasons').update(row).eq('id', existing[0].id).eq('user_id', guard.userId!)
    : await db.from('deal_reasons').insert(row);

  if (error) {
    console.error('[deal-reasons] 保存失败:', error.message);
    return NextResponse.json({ error: '保存失败：' + error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, reasons });
}
