import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

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
 * POST /api/invitation/generate
 * 生成邀请码（需要付费用户权限）
 */
export async function POST(request: Request) {
  try {
    const { userId, planType = 'free', count = 1 } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: '用户ID必填' },
        { status: 400 }
      );
    }

    // 查询用户的会员等级
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('subscription_plan')
      .eq('user_id', userId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: '用户不存在' },
        { status: 404 }
      );
    }

    const userPlan = profile.subscription_plan as string;

    // 根据会员等级限制生成数量
    const maxCodesMap: Record<string, number> = {
      free: 0,
      basic: 3,
      pro: 10,
      enterprise: 50,
    };
    const maxCodes = maxCodesMap[userPlan] || 0;

    if (maxCodes === 0) {
      return NextResponse.json(
        { error: '免费用户无法生成邀请码' },
        { status: 403 }
      );
    }

    if (count > maxCodes) {
      return NextResponse.json(
        { error: `您的会员等级最多可生成 ${maxCodes} 个邀请码` },
        { status: 400 }
      );
    }

    // 检查用户已生成的邀请码数量（本月）
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data: existingCodes, error: countError } = await supabase
      .from('invitation_codes')
      .select('id')
      .eq('created_by', userId)
      .gte('created_at', startOfMonth.toISOString());

    if (countError) {
      console.error('查询已有邀请码失败:', countError);
      return NextResponse.json(
        { error: '查询失败' },
        { status: 500 }
      );
    }

    const existingCount = existingCodes?.length || 0;
    if (existingCount + count > maxCodes) {
      return NextResponse.json(
        { 
          error: `本月已生成 ${existingCount} 个邀请码，最多还可生成 ${maxCodes - existingCount} 个` 
        },
        { status: 400 }
      );
    }

    // 生成邀请码
    const codes = [];
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1); // 1个月后过期

    for (let i = 0; i < count; i++) {
      let code = generateInvitationCode();
      
      // 确保邀请码唯一
      let exists = true;
      while (exists) {
        const { data } = await supabase
          .from('invitation_codes')
          .select('code')
          .eq('code', code)
          .single();
        
        if (!data) {
          exists = false;
        } else {
          code = generateInvitationCode();
        }
      }

      codes.push({
        code,
        created_by: userId,
        plan_type: planType,
        expires_at: expiresAt.toISOString(),
        status: 'active',
      });
    }

    // 批量插入
    const { data: insertedCodes, error: insertError } = await supabase
      .from('invitation_codes')
      .insert(codes)
      .select();

    if (insertError) {
      console.error('插入邀请码失败:', insertError);
      return NextResponse.json(
        { error: '生成邀请码失败' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      codes: insertedCodes,
      message: `成功生成 ${count} 个邀请码`,
    });
  } catch (error) {
    console.error('生成邀请码错误:', error);
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/invitation/generate
 * 查询用户的邀请码列表
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: '用户ID必填' },
        { status: 400 }
      );
    }

    // 查询用户创建的所有邀请码
    const { data: codes, error } = await supabase
      .from('invitation_codes')
      .select('*')
      .eq('created_by', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('查询邀请码失败:', error);
      return NextResponse.json(
        { error: '查询失败' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      codes: codes || [],
    });
  } catch (error) {
    console.error('查询邀请码错误:', error);
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}

