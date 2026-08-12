import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/admin-auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * 记录管理员操作日志
 */
async function logAdminAction(
  adminId: string,
  actionType: string,
  details: any
) {
  try {
    await supabase.from('admin_action_logs').insert({
      admin_id: adminId,
      action_type: actionType,
      target_type: 'invitation_code',
      details: details,
    });
  } catch (error) {
    console.error('记录日志失败:', error);
  }
}

/**
 * POST /api/admin/invitation/revoke
 * 管理员作废邀请码（单个或批量）
 */
export async function POST(request: Request) {
  try {
    // 验证管理员权限
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json(
        { error: '需要管理员权限' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { codes, reason = '' } = body;

    // 验证参数
    if (!codes || !Array.isArray(codes) || codes.length === 0) {
      return NextResponse.json(
        { error: '请提供要作废的邀请码列表' },
        { status: 400 }
      );
    }

    if (codes.length > 100) {
      return NextResponse.json(
        { error: '单次最多作废100个邀请码' },
        { status: 400 }
      );
    }

    // 转换为大写
    const upperCodes = codes.map(c => c.toUpperCase());

    // 查询这些邀请码
    const { data: existingCodes, error: queryError } = await supabase
      .from('invitation_codes')
      .select('*')
      .in('code', upperCodes);

    if (queryError) {
      console.error('查询邀请码失败:', queryError);
      return NextResponse.json(
        { error: '查询失败: ' + queryError.message },
        { status: 500 }
      );
    }

    if (!existingCodes || existingCodes.length === 0) {
      return NextResponse.json(
        { error: '未找到任何邀请码' },
        { status: 404 }
      );
    }

    // 只作废状态为active的邀请码
    const activeCodes = existingCodes.filter(c => c.status === 'active');
    
    if (activeCodes.length === 0) {
      return NextResponse.json(
        { error: '没有可作废的邀请码（已使用或已过期）' },
        { status: 400 }
      );
    }

    const activeCodeValues = activeCodes.map(c => c.code);

    // 批量更新状态为expired
    const { error: updateError } = await supabase
      .from('invitation_codes')
      .update({ 
        status: 'expired',
        notes: reason ? `${reason} (管理员作废)` : '管理员作废'
      })
      .in('code', activeCodeValues);

    if (updateError) {
      console.error('作废邀请码失败:', updateError);
      return NextResponse.json(
        { error: '作废失败: ' + updateError.message },
        { status: 500 }
      );
    }

    // 记录操作日志
    await logAdminAction(admin.userId, 'revoke', {
      count: activeCodes.length,
      codes: activeCodeValues,
      reason,
    });

    return NextResponse.json({
      success: true,
      revokedCount: activeCodes.length,
      skippedCount: codes.length - activeCodes.length,
      message: `成功作废 ${activeCodes.length} 个邀请码`,
    });
  } catch (error) {
    console.error('作废邀请码错误:', error);
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}
