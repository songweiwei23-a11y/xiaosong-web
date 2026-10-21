import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-guard';
import { getServiceSupabase } from '@/lib/admin-auth';
import { readFormBody } from '@/lib/read-body';
import { extractMaterial, MATERIAL_TEXT_LIMIT, type ExtractedMaterial } from '@/lib/work-materials/extract';
import { describeImageMaterial, imageMediaType, VISION_MAX_BYTES } from '@/lib/work-materials/vision';
import { readAssistantConfig } from '@/lib/assistant/config';

/** 图片交给模型读；读不了的说明原因，文件照样保存 */
async function readImage(name: string, bytes: Uint8Array): Promise<ExtractedMaterial> {
  const fallback = '图片里的文字暂时读不出来，已保存；要用其中的数据，请把文字或表格导入';
  const cfg = readAssistantConfig();
  const mediaType = imageMediaType(name);
  if (!cfg || !mediaType) return { kind: 'image', status: 'unsupported', text: '', note: fallback };
  if (bytes.length > VISION_MAX_BYTES) {
    return { kind: 'image', status: 'unsupported', text: '', note: '图片超过 4MB，没有识别；请压缩后再导入' };
  }
  try {
    const text = await describeImageMaterial(cfg, bytes, mediaType);
    if (!text) return { kind: 'image', status: 'empty', text: '', note: '图片里没有读出文字' };
    return {
      kind: 'image',
      status: 'ok',
      text: text.slice(0, MATERIAL_TEXT_LIMIT),
      note: '已识别图片内容（由模型读取，可能有误差，请核对）',
    };
  } catch {
    return { kind: 'image', status: 'unsupported', text: '', note: `图片识别暂时没有完成，已保存；${fallback}` };
  }
}

export const dynamic = 'force-dynamic';

/** 单个文件的上限，和聊天附件一致 */
const MATERIAL_MAX_BYTES = 10 * 1024 * 1024;
/** 每个档案最多保留的文件数 */
const MAX_MATERIALS_PER_PROFILE = 60;

/**
 * 创作进度里导入的文件（任意格式）。读出来的文字只给分析用，不会原样显示在别处。
 *   GET    ?profileId=        列出（不含文字内容）
 *   POST   multipart: file + profileId   上传并读取文字
 *   DELETE ?id=&profileId=    删除一条
 * 所有读写都先确认档案属于当前登录用户。
 */

async function ownedProfile(userId: string, profileId: string): Promise<boolean> {
  const { data } = await getServiceSupabase()
    .from('user_profiles')
    .select('id')
    .eq('id', profileId)
    .eq('user_id', userId)
    .maybeSingle();
  return !!data;
}

const LIST_COLUMNS = 'id, filename, kind, status, note, byte_size, created_at';

export async function GET(request: Request) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response!;
  const profileId = new URL(request.url).searchParams.get('profileId') ?? '';
  if (!profileId || !(await ownedProfile(guard.userId!, profileId))) {
    return NextResponse.json({ error: '找不到这个档案' }, { status: 404 });
  }
  const { data, error } = await getServiceSupabase()
    .from('account_materials')
    .select(LIST_COLUMNS)
    .eq('user_id', guard.userId!)
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ materials: [], unavailable: true });
  return NextResponse.json({ materials: data ?? [] });
}

export async function POST(request: Request) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response!;
  const userId = guard.userId!;
  const form = await readFormBody(request, userId);
  const file = form.get('file');
  const profileId = String(form.get('profileId') ?? '');
  if (!(file instanceof File)) return NextResponse.json({ error: '请选择要导入的文件' }, { status: 400 });
  if (!profileId || !(await ownedProfile(userId, profileId))) {
    return NextResponse.json({ error: '找不到这个档案' }, { status: 404 });
  }
  if (file.size > MATERIAL_MAX_BYTES) {
    return NextResponse.json({ error: '单个文件不能超过 10MB，可以拆成几个文件再导入' }, { status: 413 });
  }
  const db = getServiceSupabase();
  const { count } = await db
    .from('account_materials')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('profile_id', profileId);
  if ((count ?? 0) >= MAX_MATERIALS_PER_PROFILE) {
    return NextResponse.json({ error: `每个档案最多保留 ${MAX_MATERIALS_PER_PROFILE} 个文件，先删掉一些再导入` }, { status: 409 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  let read = extractMaterial(file.name, bytes);
  // 图片：交给模型读出里面的文字和数据（截图、脚本页面都行）
  if (read.kind === 'image') read = await readImage(file.name, bytes);
  const { data, error } = await db
    .from('account_materials')
    .insert({
      user_id: userId,
      profile_id: profileId,
      filename: file.name.slice(0, 200),
      kind: read.kind,
      status: read.status,
      note: read.note,
      byte_size: file.size,
      content: read.text,
    })
    .select(LIST_COLUMNS)
    .single();
  if (error || !data) {
    return NextResponse.json({ error: '文件暂时没有保存下来，请稍后再试' }, { status: 503 });
  }
  return NextResponse.json({ material: data });
}

export async function DELETE(request: Request) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response!;
  const url = new URL(request.url);
  const id = url.searchParams.get('id') ?? '';
  const profileId = url.searchParams.get('profileId') ?? '';
  if (!id || !profileId || !(await ownedProfile(guard.userId!, profileId))) {
    return NextResponse.json({ error: '找不到这个文件' }, { status: 404 });
  }
  const { error } = await getServiceSupabase()
    .from('account_materials')
    .delete()
    .eq('id', id)
    .eq('user_id', guard.userId!)
    .eq('profile_id', profileId);
  if (error) return NextResponse.json({ error: '删除没有成功' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
