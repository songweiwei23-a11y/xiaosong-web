import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-guard';
import { getServerSupabase } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

/**
 * 当前用户已确定的成交理由。
 *
 * 成交理由页会把分析结果存进 deal_reasons 表，但此前没有任何地方读它——
 * 用户在那一页辛苦选出来的「专业强、实在不坑、质量好」，到了选题页
 * 还得再选一遍，到了脚本页又得再选一遍。这个接口让创作上下文能取到它，
 * 选题、脚本、标题三个板块自动带上。
 *
 * 表是按用户存的（不是按档案），取最新一条。
 */
export async function GET() {
  const guard = await requireUser();
  if (!guard.ok) return guard.response!;

  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from('deal_reasons')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    // 表不存在或读不到时按「没有成交理由」处理。
    // 这只是上下文的一部分，不该让整块上下文加载失败
    console.warn('[deal-reasons] 读取失败:', error.message);
    return NextResponse.json({ reasons: [] });
  }

  const row = data?.[0];
  if (!row) return NextResponse.json({ reasons: [] });

  /*
   * 历史数据的形状不统一：有的存成字符串数组，有的是逗号/顿号分隔的长句，
   * 也可能存在 selected_reasons / reasons / content 几个字段里的任意一个。
   * 这里一律归一成字符串数组，调用方不用关心。
   */
  const raw = row.selected_reasons ?? row.reasons ?? row.content ?? null;
  let reasons: string[] = [];

  if (Array.isArray(raw)) {
    reasons = raw.map((x) => String(x).trim()).filter(Boolean);
  } else if (typeof raw === 'string') {
    reasons = raw
      .split(/[,，、\n]/)
      .map((x) => x.trim())
      .filter(Boolean);
  }

  // 太长的不是「理由」而是整段分析，放进提示词只会稀释指令
  reasons = reasons.filter((r) => r.length <= 40).slice(0, 8);

  return NextResponse.json({ reasons, updatedAt: row.updated_at ?? row.created_at ?? null });
}
