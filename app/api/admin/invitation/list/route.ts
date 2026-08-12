import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/admin-auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/admin/invitation/list
 * 管理员查询邀请码列表（支持分页、筛选、搜索）
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

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const status = searchParams.get('status') || ''; // active, used, expired
    const planType = searchParams.get('planType') || ''; // free, basic, pro, enterprise
    const createdBy = searchParams.get('createdBy') || ''; // admin, user
    const search = searchParams.get('search') || ''; // 按code搜索
    const isPublic = searchParams.get('isPublic') || ''; // true, false

    // 构建查询
    let query = supabase
      .from('invitation_codes')
      .select('*', { count: 'exact' });

    // 应用筛选条件
    if (status) {
      query = query.eq('status', status);
    }

    if (planType) {
      query = query.eq('plan_type', planType);
    }

    if (createdBy === 'admin') {
      query = query.eq('created_by_admin', true);
    } else if (createdBy === 'user') {
      query = query.eq('created_by_admin', false);
    }

    if (search) {
      query = query.ilike('code', `%${search}%`);
    }

    if (isPublic === 'true') {
      query = query.eq('is_public', true);
    } else if (isPublic === 'false') {
      query = query.eq('is_public', false);
    }

    // 分页和排序
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    query = query
      .order('created_at', { ascending: false })
      .range(from, to);

    const { data: codes, error, count } = await query;

    if (error) {
      console.error('查询邀请码失败:', error);
      return NextResponse.json(
        { error: '查询失败: ' + error.message },
        { status: 500 }
      );
    }

    // 获取创建者和使用者的邮箱信息
    const codesWithEmails = await Promise.all(
      (codes || []).map(async (code) => {
        let creatorEmail = '';
        let userEmail = '';

        if (code.created_by) {
          const { data: creator } = await supabase
            .from('user_profiles')
            .select('email')
            .eq('user_id', code.created_by)
            .single();
          creatorEmail = creator?.email || '';
        }

        if (code.used_by) {
          const { data: user } = await supabase
            .from('user_profiles')
            .select('email')
            .eq('user_id', code.used_by)
            .single();
          userEmail = user?.email || '';
        }

        return {
          ...code,
          creator_email: creatorEmail,
          user_email: userEmail,
        };
      })
    );

    const totalPages = Math.ceil((count || 0) / pageSize);

    return NextResponse.json({
      success: true,
      data: {
        codes: codesWithEmails,
        pagination: {
          page,
          pageSize,
          total: count || 0,
          totalPages,
        },
      },
    });
  } catch (error) {
    console.error('查询邀请码错误:', error);
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}
