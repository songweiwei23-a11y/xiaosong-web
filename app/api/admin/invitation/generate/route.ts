import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/admin-auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * 生成随机邀请码 (格式: XS-XXXXXX)
 */
function generateInvitationCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = 'XS-';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

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
 * POST /api/admin/invitation/generate
 * 管理员批量生成邀请码（不受会员限制）
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
    const { 
      count = 1, 
      planType = 'free', 
      expiresInDays = 30,
      notes = '',
      isPublic = false 
    } = body;

    // 验证参数
    if (count < 1 || count > 500) {
      return NextResponse.json(
        { error: '生成数量必须在1-500之间' },
        { status: 400 }
      );
    }

    if (!['free', 'basic', 'pro', 'enterprise'].includes(planType)) {
      return NextResponse.json(
        { error: '无效的会员类型' },
        { status: 400 }
      );
    }

    // 计算过期时间
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    // 生成邀请码
    const codes = [];
    const generatedCodes = [];

    for (let i = 0; i < count; i++) {
      let code = generateInvitationCode();
      
      // 确保邀请码唯一
      let exists = true;
      let attempts = 0;
      while (exists && attempts < 10) {
        const { data } = await supabase
          .from('invitation_codes')
          .select('code')
          .eq('code', code)
          .single();
        
        if (!data) {
          exists = false;
        } else {
          code = generateInvitationCode();
          attempts++;
        }
      }

      if (attempts >= 10) {
        console.error('生成唯一邀请码失败，跳过');
        continue;
      }

      codes.push({
        code,
        created_by: admin.userId,
        created_by_admin: true,
        plan_type: planType,
        expires_at: expiresAt.toISOString(),
        status: 'active',
        notes: notes || null,
        is_public: isPublic,
      });

      generatedCodes.push(code);
    }

    // 批量插入
    const { data: insertedCodes, error: insertError } = await supabase
      .from('invitation_codes')
      .insert(codes)
      .select();

    if (insertError) {
      console.error('插入邀请码失败:', insertError);
      return NextResponse.json(
        { error: '生成邀请码失败: ' + insertError.message },
        { status: 500 }
      );
    }

    // 记录操作日志
    await logAdminAction(admin.userId, 'generate', {
      count: insertedCodes?.length || 0,
      planType,
      expiresInDays,
      notes,
      isPublic,
      codes: generatedCodes,
    });

    return NextResponse.json({
      success: true,
      codes: insertedCodes,
      count: insertedCodes?.length || 0,
      message: `成功生成 ${insertedCodes?.length || 0} 个邀请码`,
    });
  } catch (error) {
    console.error('生成邀请码错误:', error);
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}
