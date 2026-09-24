/**
 * 把账号档案摊成提示词里那段「这个账号的情况」。账号定位、商业定位、内容定位共用这一份。
 *
 * 【为什么收成一份】原来账号定位页和两个深挖页各拼各的，账号定位那份漏了一大截：
 * 「数据最好的内容类型」「语言风格」「地域」「客人常问」「成交障碍」「后期能力」都没发。
 * 而定位提示词明确要求"主打内容类型的依据是档案里数据最好的内容类型"——
 * 模型根本没看到这一栏，只能自己猜，于是配比一次一个样。
 * 线上那份档案里这一栏填的是"讲故事、拍工作过程"，定位却给出"教知识 60%"。
 *
 * 字段按"判断时用得上的顺序"排，空的不写（写一堆"未设置"只会让模型以为这些都不重要）。
 */

type ProfileLike = Record<string, unknown> & { profile_name?: unknown };

export const asText = (v: unknown, fallback = ''): string => {
  if (v == null) return fallback;
  const s = Array.isArray(v) ? v.filter(Boolean).join('、') : String(v);
  return s.trim() || fallback;
};

/** [字段, 给模型看的名字]。名字要说清这一栏在判断里的用处 */
export const PROFILE_SUMMARY_FIELDS: [string, string][] = [
  ['account_platform', '平台'],
  ['account_track', '赛道'],
  ['account_stage', '账号阶段'],
  ['fans_level', '粉丝量级'],
  ['viral_content_pattern', '数据最好的内容类型（定主打内容的首要依据）'],
  ['target_region', '地域'],
  ['target_age', '目标年龄'],
  ['target_gender', '目标性别'],
  ['target_occupation', '目标职业'],
  ['target_interests', '目标人群的兴趣'],
  ['target_pain_points', '客人最担心'],
  ['target_needs', '他们真正想要'],
  ['fan_common_questions', '客人常问'],
  ['content_category', '内容类别'],
  ['content_themes', '已有的内容方向'],
  ['content_value', '想让观众发生的变化'],
  ['unique_selling_point', '核心卖点'],
  ['competitive_advantage', '竞争优势'],
  ['competitive_weakness', '目前的短板'],
  ['unique_resources', '手上的资源'],
  ['reference_accounts', '参考账号'],
  ['content_style', '内容风格'],
  ['content_tone', '语言风格'],
  ['content_format', '内容形式'],
  ['video_duration', '视频时长'],
  ['team_structure', '团队'],
  ['equipment', '设备'],
  ['shooting_location', '场地'],
  ['editing_capability', '后期能力'],
  ['budget_per_video', '单条预算'],
  ['monetization_model', '变现方式'],
  ['product_category', '卖的产品/服务'],
  ['price_range', '价格区间'],
  ['conversion_path', '成交路径'],
  ['conversion_hooks', '转化钩子'],
  ['conversion_barriers', '成交障碍'],
  ['avoid_content', '不想拍的内容'],
];

/**
 * 表单里有、但故意不放进摘要的字段，以及为什么。
 * 表单新加字段时，要么进上面的清单，要么进这里写明理由——测试会扫。
 */
export const PROFILE_SUMMARY_EXCLUDED: Record<string, string> = {
  profile_name: '摘要第一行单独写',
  content_restrictions: '作为硬性禁忌单独传给提示词（restrictions），不混在档案里',
};

export function buildProfileSummary(p: ProfileLike): string {
  const lines = [`- 档案名称：${asText(p.profile_name, '未命名')}`];
  for (const [key, label] of PROFILE_SUMMARY_FIELDS) {
    const t = asText(p[key]);
    if (t) lines.push(`- ${label}：${t}`);
  }
  return lines.join('\n');
}
