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

import { PROFILE_CHOICES } from './profile-fields';
import { scrubProfile } from './interview-exclusions';
import { readTabooSettings } from './taboos';

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
  // 前采建档提取出来、档案字段装不下的：老板经历、招牌产品、真实数据、客户原话。
  // 放最后：前面的字段是"是什么"，这里是"凭什么信"的素材
  ['interview_highlights', '前采要点（客户原话和真实细节，写内容时优先用）'],
];

/**
 * 表单里有、但故意不放进摘要的字段，以及为什么。
 * 表单新加字段时，要么进上面的清单，要么进这里写明理由——测试会扫。
 */
export const PROFILE_SUMMARY_EXCLUDED: Record<string, string> = {
  profile_name: '摘要第一行单独写',
  content_restrictions: '作为硬性禁忌单独传给提示词（restrictions），不混在档案里',
};

/**
 * 放进请求体里给检索用的短字段：赛道、地域。
 *
 * 检索词原来只有任务主题词（"账号定位 IP定位 赛道选择 人群画像"），
 * 联网搜索拿它去搜，只会搜回一堆通用的"怎么做定位"文章，
 * 和这个号的赛道、所在城市毫无关系。buildSearchQuery 会自动把 60 字以内的
 * 字段拼进检索词，所以这里只要把它们放进请求体。
 */
export function profileSearchHints(profile: object | null | undefined): Record<string, string> {
  if (!profile) return {};
  const p = profile as ProfileLike;
  const clip = (v: unknown) => asText(v).slice(0, 40);
  const out: Record<string, string> = {};
  const track = clip(p.account_track);
  const region = clip(p.target_region);
  if (track) out.track = track;
  if (region) out.region = region;
  return out;
}

const listOf = (v: unknown): string[] =>
  Array.isArray(v)
    ? v.filter((x): x is string => typeof x === 'string').map((x) => x.trim()).filter(Boolean)
    : typeof v === 'string'
      ? v.split(/[、,，]/).map((x) => x.trim()).filter(Boolean)
      : [];

/**
 * 这家店具体在卖的品类：产品品类、赛道里**不是标准大类**的那些（用户自己写的）。
 *
 * 【为什么要单列】2026-09-29 线上：档案写着经营川味串串火锅、川味烧烤、川菜三类，
 * 但"川菜"只是赛道里的一个标签，产品品类只有"餐饮"，而选题方向、前采要点都在说"烧烤+串串"。
 * 账号定位的一句话就成了"川菜厨子，主打川味烧烤+一元串串火锅"——川菜被当成厨师身份，
 * 作为在卖的品类丢了。散在各栏里的品类模型抓不住，要单独一行点名。
 * 「餐饮」「美食烹饪」这种标准大类不算：它们说明不了具体卖什么。
 */
/** 摘要里这一行的开头。定位提示词靠它判断要不要加"经营品类"的硬约束 */
export const BUSINESS_LINES_LABEL = '- 经营品类（每一个都在卖，定位里都要体现）：';

export function businessLines(p: ProfileLike): string[] {
  const generic = new Set<string>([...PROFILE_CHOICES.product_category, ...PROFILE_CHOICES.account_track]);
  const all = [...listOf(p.product_category), ...listOf(p.account_track)].filter((x) => !generic.has(x));
  return Array.from(new Set(all));
}

export function buildProfileSummary(profile: ProfileLike): string {
  // 建档时编导刻意没选的（排除清单）：相关的句子先拿掉，模型看不见才谈得上"当它不存在"（见 lib/interview-exclusions）
  const p = scrubProfile(profile, readTabooSettings(profile.taboo_settings).excluded) ?? profile;
  const lines = [`- 档案名称：${asText(p.profile_name, '未命名')}`];
  const products = businessLines(p);
  if (products.length) lines.push(`${BUSINESS_LINES_LABEL}${products.join('、')}`);
  for (const [key, label] of PROFILE_SUMMARY_FIELDS) {
    const t = asText(p[key]);
    if (t) lines.push(`- ${label}：${t}`);
  }
  return lines.join('\n');
}
