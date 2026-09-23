import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/admin-auth';
import { countAuthUsers } from '@/lib/admin-stats';
import { GROWTH_TACTICS } from '@/lib/growth-tactics';
import { OPENING_CARDS } from '@/lib/opening-cards';

export const dynamic = 'force-dynamic';

/**
 * 落地页上那三个大数字。
 *
 * 这里原来返回的是编造的数据，代码里写得很直白：
 *   const baseUsers = 1280;      // 「返回合理的假数据」
 *   const baseScripts = 15680;   // 「添加小幅随机波动，让数据看起来更真实」
 * 而落地页把它当真实经营数据展示（「加入1280+创作者」）。
 * 对一个要收费的产品来说，这是能惹上麻烦的——已改成查真实数据。
 *
 * 第三个数字原来是「满意度 98%」。系统里根本没有满意度这项数据，
 * 无从查起，所以换成一个确实为真、也确实是卖点的数字：内置的编导方法数
 * （起号 36+1 计 + 开篇 36 计），它直接从知识数据里数出来，不会写错。
 *
 * 真实数字可能很小。小到不适合拿出来展示时，返回 null，
 * 由前端决定不显示——宁可不展示，也不编一个。
 */

/** 低于这个数就不展示。个位数的「3+ 创作者」比不写还难看 */
const DISPLAY_FLOOR = 50;

const atLeastFloor = (n: number) => (n >= DISPLAY_FLOOR ? n : null);

export async function GET() {
  // 方法数是从代码里数的，任何情况下都真实可得
  const methods = GROWTH_TACTICS.length + OPENING_CARDS.length;

  try {
    const supabase = getServiceSupabase();

    const users = await countAuthUsers(supabase);

    // 生成总数：只要计数，不拉数据
    const { count: scripts } = await supabase
      .from('script_history')
      .select('id', { count: 'exact', head: true });

    return NextResponse.json({
      users: atLeastFloor(users),
      scripts: atLeastFloor(scripts ?? 0),
      methods,
    });
  } catch (error) {
    // 查不到就三项都不展示，而不是退回编造的数字
    console.error('[public/stats] 读取失败:', error);
    return NextResponse.json({ users: null, scripts: null, methods });
  }
}
