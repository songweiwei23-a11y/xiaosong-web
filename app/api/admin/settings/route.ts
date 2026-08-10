import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/admin-auth';
import { logAdminAction, AdminActions } from '@/lib/admin-logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = 'force-dynamic';

// GET - 获取系统配置
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');
    const category = searchParams.get('category');

    let query = supabase.from('system_settings').select('*');

    if (key) {
      query = query.eq('key', key);
      const { data, error } = await query.single();
      if (error) throw error;
      return NextResponse.json(data);
    }

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query.order('key');
    if (error) throw error;

    // 转换为易用的格式
    const settings: Record<string, any> = {};
    (data || []).forEach((item: any) => {
      settings[item.key] = item.value;
    });

    return NextResponse.json({
      settings,
      raw: data,
    });
  } catch (error: any) {
    console.error('获取配置失败:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST/PUT - 更新系统配置
export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
    }

    const { key, value, description, category } = await request.json();

    if (!key || value === undefined) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    // 使用 upsert 更新或插入
    const { data, error } = await supabase
      .from('system_settings')
      .upsert({
        key,
        value,
        description,
        category,
        updated_by: admin.userId,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    // 记录日志
    await logAdminAction({
      admin_id: admin.userId,
      action: AdminActions.UPDATE_SETTINGS,
      target_type: 'system_settings',
      target_id: key,
      details: { key, category },
    });

    return NextResponse.json({
      success: true,
      message: '配置已更新',
      data,
    });
  } catch (error: any) {
    console.error('更新配置失败:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH - 批量更新配置
export async function PATCH(request: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
    }

    const { settings } = await request.json();

    if (!settings || typeof settings !== 'object') {
      return NextResponse.json({ error: '参数格式错误' }, { status: 400 });
    }

    // 批量更新
    const updates = Object.entries(settings).map(([key, value]) => ({
      key,
      value,
      updated_by: admin.userId,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from('system_settings')
      .upsert(updates);

    if (error) throw error;

    // 记录日志
    await logAdminAction({
      admin_id: admin.userId,
      action: AdminActions.UPDATE_SETTINGS,
      target_type: 'system_settings',
      target_id: 'batch',
      details: { count: updates.length, keys: Object.keys(settings) },
    });

    return NextResponse.json({
      success: true,
      message: `已更新 ${updates.length} 项配置`,
    });
  } catch (error: any) {
    console.error('批量更新配置失败:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - 删除配置
export async function DELETE(request: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');

    if (!key) {
      return NextResponse.json({ error: '缺少配置键' }, { status: 400 });
    }

    const { error } = await supabase
      .from('system_settings')
      .delete()
      .eq('key', key);

    if (error) throw error;

    await logAdminAction({
      admin_id: admin.userId,
      action: AdminActions.DELETE_SETTING,
      target_type: 'system_settings',
      target_id: key,
      details: {},
    });

    return NextResponse.json({
      success: true,
      message: '配置已删除',
    });
  } catch (error: any) {
    console.error('删除配置失败:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}