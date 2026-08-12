import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/admin-auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/admin/invitation/stats
 * 管理员查看邀请码统计数据
 */
export async function GET(request: Request) {
  try {
    // 验证管理员权限
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json(
        { error: '需要管理员权限' },
        { status: 403 }
      );
    }

    // 1. 总体统计
    const { data: allCodes, error: allError } = await supabase
      .from('invitation_codes')
      .select('status, plan_type, created_at, used_at');

    if (allError) {
      console.error('查询统计失败:', allError);
      return NextResponse.json(
        { error: '查询失败: ' + allError.message },
        { status: 500 }
      );
    }

    const total = allCodes?.length || 0;
    const active = allCodes?.filter(c => c.status === 'active').length || 0;
    const used = allCodes?.filter(c => c.status === 'used').length || 0;
    const expired = allCodes?.filter(c => c.status === 'expired').length || 0;
    const usageRate = total > 0 ? Math.round((used / total) * 100) : 0;

    // 2. 按会员类型统计
    const byPlanType: Record<string, number> = {
      free: 0,
      basic: 0,
      pro: 0,
      enterprise: 0,
    };

    allCodes?.forEach(code => {
      const planType = code.plan_type || 'free';
      if (byPlanType[planType] !== undefined) {
        byPlanType[planType]++;
      }
    });

    // 3. 按状态和会员类型交叉统计
    const byStatusAndPlan: Record<string, Record<string, number>> = {
      active: { free: 0, basic: 0, pro: 0, enterprise: 0 },
      used: { free: 0, basic: 0, pro: 0, enterprise: 0 },
      expired: { free: 0, basic: 0, pro: 0, enterprise: 0 },
    };

    allCodes?.forEach(code => {
      const status = code.status || 'active';
      const planType = code.plan_type || 'free';
      if (byStatusAndPlan[status] && byStatusAndPlan[status][planType] !== undefined) {
        byStatusAndPlan[status][planType]++;
      }
    });

    // 4. 最近7天使用趋势
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentUsage: Array<{ date: string; count: number }> = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const count = allCodes?.filter(code => {
        if (!code.used_at) return false;
        const usedDate = new Date(code.used_at).toISOString().split('T')[0];
        return usedDate === dateStr;
      }).length || 0;

      recentUsage.push({ date: dateStr, count });
    }

    // 5. 最近7天生成趋势
    const recentGeneration: Array<{ date: string; count: number }> = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const count = allCodes?.filter(code => {
        if (!code.created_at) return false;
        const createdDate = new Date(code.created_at).toISOString().split('T')[0];
        return createdDate === dateStr;
      }).length || 0;

      recentGeneration.push({ date: dateStr, count });
    }

    // 6. 管理员生成 vs 用户生成
    const { data: adminGenerated } = await supabase
      .from('invitation_codes')
      .select('id')
      .eq('created_by_admin', true);

    const adminCount = adminGenerated?.length || 0;
    const userCount = total - adminCount;

    // 7. 公开邀请码统计
    const { data: publicCodes } = await supabase
      .from('invitation_codes')
      .select('id')
      .eq('is_public', true);

    const publicCount = publicCodes?.length || 0;
    const privateCount = total - publicCount;

    return NextResponse.json({
      success: true,
      stats: {
        overview: {
          total,
          active,
          used,
          expired,
          usageRate,
        },
        byPlanType,
        byStatusAndPlan,
        byCreator: {
          admin: adminCount,
          user: userCount,
        },
        byVisibility: {
          public: publicCount,
          private: privateCount,
        },
        trends: {
          recentUsage,
          recentGeneration,
        },
      },
    });
  } catch (error) {
    console.error('查询统计错误:', error);
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}
