/**
 * 人设事实卡：出镜人是谁、干了几年、从哪来、在本地多久、主卖什么——全站唯一出处。
 *
 * 【为什么要有】（2026-10-03）这几天的事故根子都一样：关键事实散在一堆自由文字栏里，
 * AI 从哪栏读到就用哪栏——
 * - 前采原文写「南乐定居 18 年」，档案改成「9 年川菜厨师、来南乐半年」，全站继续写 18 年
 * - 「川菜」只是赛道里的一个标签，定位把它当成厨师身份，作为在卖的品类丢了
 * - 建档时没选的「公益」「直播」残留在别的栏里，定位照样拿来当依据
 * 所以把最要紧的几样做成固定的几格，所有板块以它为准；和档案其他栏、前采要点、旧简报冲突时按它来。
 *
 * 存在档案的 persona_facts 列（jsonb，迁移 20261003_persona_facts.sql）。
 */

export interface PersonaFacts {
  /** 出镜人是谁：称呼 + 身份（"主厨老王""老板娘小芳"） */
  host?: string;
  /** 和这家店 / 这个号的关系：老板、主厨、店员、编导本人 */
  role?: string;
  /** 从哪来：籍贯、来历（"成都"） */
  origin?: string;
  /** 干这行几年（"做川菜 9 年"） */
  yearsInTrade?: string;
  /** 在本地多久（"来南乐半年"） */
  yearsLocal?: string;
  /** 主卖什么（"川味串串火锅、川味烧烤、川菜"） */
  mainProducts?: string;
  /** 招牌 / 特色（"一元火锅"） */
  signature?: string;
  /** 一句话经历（"在成都做了 9 年川菜，今年来南乐跟朋友合伙摆地摊"） */
  story?: string;
  /** 其他硬事实，一行一条（营业时间、价格区间、店面大小……） */
  others?: string;
}

export const PERSONA_FIELDS: { key: keyof PersonaFacts; label: string; placeholder: string; multiline?: boolean }[] = [
  { key: 'host', label: '出镜人是谁', placeholder: '例如：主厨老王、老板娘小芳' },
  { key: 'role', label: '和店的关系', placeholder: '例如：老板 / 主厨 / 店员 / 编导本人' },
  { key: 'origin', label: '从哪来', placeholder: '例如：成都人' },
  { key: 'yearsInTrade', label: '干这行几年', placeholder: '例如：做川菜 9 年' },
  { key: 'yearsLocal', label: '在本地多久', placeholder: '例如：来南乐半年' },
  { key: 'mainProducts', label: '主卖什么', placeholder: '例如：川味串串火锅、川味烧烤、川菜' },
  { key: 'signature', label: '招牌 / 特色', placeholder: '例如：一元火锅' },
  { key: 'story', label: '一句话经历', placeholder: '例如：在成都做了 9 年川菜，今年来南乐跟朋友合伙摆地摊', multiline: true },
  { key: 'others', label: '其他硬事实（一行一条）', placeholder: '例如：\n每天下午 4 点出摊\n人均 30-50 元', multiline: true },
];

const KEYS = PERSONA_FIELDS.map((f) => f.key);

/** 库里读出来的值校验一遍：只留认识的格子、去空格、限长 */
export function readPersonaFacts(v: unknown): PersonaFacts {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const out: PersonaFacts = {};
  for (const k of KEYS) {
    const s = typeof o[k] === 'string' ? (o[k] as string).trim().slice(0, k === 'others' || k === 'story' ? 600 : 120) : '';
    if (s) out[k] = s;
  }
  return out;
}

/** 数据库还没升级、没存上的栏 → 给编导看的话（档案接口返回 _droppedColumns 时用）。都存上了返回空 */
export function droppedColumnsNotice(saved: unknown): string {
  const cols = (saved && typeof saved === 'object' ? (saved as { _droppedColumns?: unknown })._droppedColumns : null);
  if (!Array.isArray(cols) || cols.length === 0) return '';
  const names: Record<string, string> = { persona_facts: '人设事实卡', content_mix: '内容配比', taboo_settings: '禁忌设置' };
  const list = cols.map((c) => names[String(c)] ?? String(c)).join('、');
  return `档案其他内容已保存，但「${list}」没存上：数据库还没升级，请让管理员运行升级 SQL 后再存一次`;
}

export function hasPersonaFacts(v: unknown): boolean {
  return Object.keys(readPersonaFacts(v)).length > 0;
}

/**
 * 写进提示词。放在账号背景最前面——它是最硬的事实。
 * 没填的格子不写（写"未填"等于告诉模型可以自己编）；末尾那句是"没写的不要编"。
 */
export function personaFactsBlock(v: unknown): string {
  const f = readPersonaFacts(v);
  const rows = PERSONA_FIELDS.filter((x) => f[x.key]).map((x) => {
    const val = f[x.key]!;
    return x.key === 'others' ? `- **${x.label.replace(/（.*）/, '')}**：\n${val.split('\n').map((l) => `  - ${l.trim()}`).filter((l) => l.trim() !== '-').join('\n')}` : `- **${x.label}**：${val}`;
  });
  if (rows.length === 0) return '';
  return [
    '### 🪪 人设事实卡（最硬的事实，以它为准）',
    '',
    ...rows,
    '',
    '这是编导确认过的事实：**和档案其他栏、前采要点、已有的定位或简报对不上时，一律以这里为准**；',
    '写人设、经历、年限、籍贯、在卖什么时只用这里的说法，不改写、不夸大；这里没写的经历和数字不要自己编（用 X 或【换成你的：……】）。',
  ].join('\n');
}
