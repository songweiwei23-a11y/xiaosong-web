/**
 * 地基一键生成写库（服务端）。字段和页面自己保存时一致（账号定位页、创作简报页、行业建议页），
 * 否则地基门槛和板块上下文读不到这些结果（2026-10-24：助理生成的结果只进了创作会话，没进账号定位表）。
 *
 * positioning_type 在每个分支里写明字面量：tests/positioning-type-constraint 会核对它和数据库约束是否一致。
 */
import { getServiceSupabase } from '@/lib/admin-auth';
import { profileFactsFingerprint } from '@/lib/creative-brief';
import type { FoundationKey } from '@/lib/foundation-job';

export async function saveFoundationRow(args: { userId: string; profileId: string; kind: FoundationKey; text: string }): Promise<void> {
  const db = getServiceSupabase();
  const { data: profile, error: profileError } = await db
    .from('user_profiles')
    .select('*')
    .eq('id', args.profileId)
    .eq('user_id', args.userId)
    .maybeSingle();
  if (profileError || !profile) throw new Error('档案读取失败，结果没有保存');

  // 账号定位是「当前生效」的那一份：和定位页一样，先把这个档案下其它的设为非生效
  if (args.kind === 'positioning') {
    const { error } = await db.from('account_positioning').update({ is_active: false }).eq('user_id', args.userId).eq('profile_id', args.profileId);
    if (error) throw new Error('保存失败：' + error.message);
  }

  const fingerprint = profileFactsFingerprint(profile);
  const firstLine = args.text.split('\n')[0].replace(/^#+\s*/, '').trim();
  const who = (profile as { profile_name?: string | null }).profile_name || '我的';
  const base = {
    user_id: args.userId,
    profile_id: args.profileId,
    full_content: args.text,
    profile_facts: fingerprint,
  };

  let row: Record<string, unknown>;
  if (args.kind === 'positioning') {
    row = { ...base, positioning_name: firstLine.slice(0, 50) || `${who}的账号定位`, positioning_type: '账号定位', is_active: true };
  } else if (args.kind === 'brief') {
    // 创作简报同时记下生成时的档案指纹（和简报页一致），用来判断它是不是按旧档案写的
    row = { ...base, positioning_name: firstLine.slice(0, 50) || `${who}的创作简报`, positioning_type: '创作简报', is_active: false, positioning_description: fingerprint };
  } else {
    row = { ...base, positioning_name: firstLine.slice(0, 50) || `${who}的行业建议`, positioning_type: '行业建议', is_active: false };
  }

  const { error } = await db.from('account_positioning').insert(row);
  if (error) throw new Error('保存失败：' + error.message);
}
