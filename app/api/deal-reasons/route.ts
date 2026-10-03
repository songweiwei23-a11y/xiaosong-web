import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-guard';
import { getServiceSupabase } from '@/lib/admin-auth';
import { mergeSellingPoints, reasonsToSellingPoints, toReasonLabels } from '@/lib/deal-reasons';
import { readJsonBody } from '@/lib/read-body';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** profile_id 这一列要跑 20260930_deal_reasons_profile.sql 才有；没跑时报的错里带着列名 */
const missingProfileColumn = (msg?: string) => /profile_id/.test(msg ?? '');

/**
 * 成交理由：**按账号档案分别存**（2026-09-30 起）。
 *
 * 原来按用户存、取最新一条——一个人有两个号（烧烤店 + 另一家），两个号共用一份成交理由，
 * 切到另一个档案看到的还是上一家店的。产品方要求"成交理由的信息要与档案同步"。
 *
 * 选题、脚本、标题、二创等板块通过创作上下文（hooks/useCreatorContext）带上当前档案的这一份。
 *
 * 【读和写都走服务端 + service_role，并显式按 user_id 过滤】
 * 这张表的行级权限开没开没人知道（迁移里连建表语句都没有），不能交给浏览器直读。
 *
 * 老数据（没有 profile_id 的那一条）：这个档案还没存过时先拿它顶上（legacy: true），
 * 这个档案一保存，就认领成这个档案的。
 */
export async function GET(request: Request) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response!;
  const profileId = new URL(request.url).searchParams.get('profileId');
  const db = getServiceSupabase();

  const latest = (q: ReturnType<typeof db.from>) =>
    q.select('*').eq('user_id', guard.userId!).order('updated_at', { ascending: false, nullsFirst: false }).limit(1);

  let row: Record<string, any> | undefined;
  let legacy = false;
  if (profileId && UUID_RE.test(profileId)) {
    const own = await latest(db.from('deal_reasons')).eq('profile_id', profileId);
    if (own.error && !missingProfileColumn(own.error.message)) {
      console.warn('[deal-reasons] 读取失败:', own.error.message);
      return NextResponse.json({ reasons: [] });
    }
    row = own.data?.[0];
    if (!row) {
      // 这个档案还没存过：拿老的那条（没挂档案的）顶上；列还没加时就是用户最新一条
      const old = own.error ? await latest(db.from('deal_reasons')) : await latest(db.from('deal_reasons')).is('profile_id', null);
      row = old.data?.[0];
      legacy = !!row;
    }
  } else {
    const any = await latest(db.from('deal_reasons'));
    row = any.data?.[0];
  }

  if (!row) return NextResponse.json({ reasons: [] });

  /*
   * 统一成中文名。老代码存的是英文代号（looks、honest），原样交出去的话，
   * 各板块提示词里拿到的就是"成交理由：looks、effect、choice"。
   */
  const reasons = toReasonLabels(row.selected_reasons).slice(0, 8);

  return NextResponse.json({
    reasons,
    updatedAt: row.updated_at ?? row.created_at ?? null,
    legacy,
    // 成交理由页自己回填表单用；创作上下文只读 reasons
    storeName: row.store_name ?? '',
    storeType: row.store_type ?? '',
    storeFeatures: row.store_features ?? '',
    targetCustomer: row.target_customer ?? '',
    analysisResult: row.analysis_result ?? '',
  });
}

/**
 * 保存到当前档案，并把勾选的理由并进档案的「凭什么让人选你」。
 *
 * 【为什么不用 upsert】upsert 要求唯一约束，线上这张表没有（实测 42P10）。先查后写。
 */
export async function POST(request: Request) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response!;

  let body: any;
  try {
    body = await readJsonBody(request);
  } catch {
    return NextResponse.json({ error: '请求格式不正确' }, { status: 400 });
  }

  const storeName = String(body.storeName ?? '').trim();
  if (!storeName) return NextResponse.json({ error: '请填写店铺名称' }, { status: 400 });

  const reasons = toReasonLabels(body.selectedReasons);
  if (reasons.length === 0) {
    return NextResponse.json({ error: '至少选一个成交理由' }, { status: 400 });
  }
  const profileId = typeof body.profileId === 'string' && UUID_RE.test(body.profileId) ? body.profileId : null;

  const row: Record<string, unknown> = {
    user_id: guard.userId!,
    store_name: storeName.slice(0, 60),
    store_type: String(body.storeType ?? '其他').slice(0, 20),
    store_features: String(body.storeFeatures ?? '').slice(0, 2000),
    target_customer: String(body.targetCustomer ?? '').slice(0, 200),
    analysis_result: String(body.analysisResult ?? ''),
    // 存中文名，不存代号
    selected_reasons: reasons,
    updated_at: new Date().toISOString(),
    ...(profileId ? { profile_id: profileId } : {}),
  };

  const db = getServiceSupabase();
  // 找这一份写到哪：这个档案自己的 → 没挂档案的老数据（认领）→ 新建
  let targetId: string | undefined;
  let columnMissing = false;
  if (profileId) {
    const own = await db.from('deal_reasons').select('id').eq('user_id', guard.userId!).eq('profile_id', profileId).limit(1);
    if (own.error) columnMissing = missingProfileColumn(own.error.message);
    targetId = own.data?.[0]?.id;
    if (!targetId && !columnMissing) {
      const old = await db.from('deal_reasons').select('id').eq('user_id', guard.userId!).is('profile_id', null).order('updated_at', { ascending: false, nullsFirst: false }).limit(1);
      targetId = old.data?.[0]?.id;
    }
  }
  if (!profileId || columnMissing) {
    // 没有档案、或者列还没加：退回原来的"每人一条"
    delete row.profile_id;
    const any = await db.from('deal_reasons').select('id').eq('user_id', guard.userId!).order('updated_at', { ascending: false, nullsFirst: false }).limit(1);
    if (any.error) {
      console.error('[deal-reasons] 保存前读取失败:', any.error.message);
      return NextResponse.json({ error: '保存失败，请稍后重试' }, { status: 500 });
    }
    targetId = any.data?.[0]?.id;
  }

  const { error } = targetId
    ? await db.from('deal_reasons').update(row).eq('id', targetId).eq('user_id', guard.userId!)
    : await db.from('deal_reasons').insert(row);
  if (error) {
    console.error('[deal-reasons] 保存失败:', error.message);
    return NextResponse.json({ error: '保存失败：' + error.message }, { status: 500 });
  }

  // 同步进档案：勾选的理由并进「凭什么让人选你」（原来的保留、去重）。失败不影响保存成功
  let profileSynced = false;
  if (profileId) {
    const { data: prof } = await db.from('user_profiles').select('unique_selling_point').eq('id', profileId).eq('user_id', guard.userId!).maybeSingle();
    if (prof) {
      const merged = mergeSellingPoints(prof.unique_selling_point, reasonsToSellingPoints(reasons));
      // 没有新卖点就不写：写一次档案更新时间就变，别处会以为档案改过了（2026-10-02 简报误报"过时"）
      if (merged === prof.unique_selling_point) {
        profileSynced = true;
      } else {
        const { error: syncError } = await db.from('user_profiles').update({ unique_selling_point: merged }).eq('id', profileId).eq('user_id', guard.userId!);
        if (syncError) console.error('[deal-reasons] 同步进档案失败:', syncError.message);
        profileSynced = !syncError;
      }
    }
  }

  return NextResponse.json({ success: true, reasons, profileSynced, perProfile: !!profileId && !columnMissing });
}
