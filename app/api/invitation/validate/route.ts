import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/invitation/validate
 * 验证邀请码是否有效
 */
export async function POST(request: Request) {
  try {
    const { code } = await request.json();

    if (!code) {
      return NextResponse.json(
        { valid: false, error: '邀请码不能为空' },
        { status: 400 }
      );
    }

    // 查询邀请码
    const { data: invitation, error } = await supabase
      .from('invitation_codes')
      .select('*')
      .eq('code', code.toUpperCase())
      .single();

    if (error || !invitation) {
      return NextResponse.json({
        valid: false,
        error: '邀请码不存在',
      });
    }

    // 检查状态
    if (invitation.status === 'used') {
      return NextResponse.json({
        valid: false,
        error: '邀请码已被使用',
      });
    }

    if (invitation.status === 'expired') {
      return NextResponse.json({
        valid: false,
        error: '邀请码已过期',
      });
    }

    // 检查过期时间
    if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
      // 更新状态为过期
      await supabase
        .from('invitation_codes')
        .update({ status: 'expired' })
        .eq('code', code.toUpperCase());

      return NextResponse.json({
        valid: false,
        error: '邀请码已过期',
      });
    }

    // 邀请码有效
    return NextResponse.json({
      valid: true,
      planType: invitation.plan_type || 'free',
      expiresAt: invitation.expires_at,
    });
  } catch (error) {
    console.error('验证邀请码错误:', error);
    return NextResponse.json(
      { valid: false, error: '服务器错误' },
      { status: 500 }
    );
  }
}
