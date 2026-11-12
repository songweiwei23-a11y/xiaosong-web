/**
 * 前采建档：把编导的前采记录（粘贴的文字、上传的文档）提取成账号档案。
 *
 * 【为什么要有】档案里最影响定位的是那几道填空题——成交钩子、爆款基因、核心卖点、禁忌，
 * 线上填写率只有 6%～29%（见 lib/profile-options 顶部）。用户懒得填，AI 只能靠"平台+赛道"去猜。
 * 而编导都会做前采，这些信息就躺在前采记录里，只是没人搬进档案。
 *
 * 【三条硬规则，都在这个文件里兑现，不靠模型自觉】
 *   1. 不猜：原文没说的字段不填。每一项都要带原文依据，依据在原文里找不到的标"需核对"。
 *   2. 只填得进去的值：单选题只能是选项里的某一个（表单是下拉框，选项外的值显示不出来）；
 *      不认识的字段名、乱七八糟的类型一律丢掉。
 *   3. 手机号、身份证号这类不进档案。
 *
 * 模型只负责"读懂"，校验和清洗都在 parseExtraction 里做——模型偶尔会不守规矩。
 */
import { PROFILE_FIELDS, PROFILE_SECTIONS, type ProfileFieldSpec } from './profile-fields';

/** 一次最多读这么多字。再长就请用户删掉寒暄、只留问答部分 */
export const MAX_SOURCE_CHARS = 20_000;
/** 太短的不值得调一次模型，多半是贴错了 */
export const MIN_SOURCE_CHARS = 30;

export const INTERVIEW_TASK_TYPE = '前采建档';

type FieldKey = ProfileFieldSpec['key'];

export interface ExtractedField {
  key: FieldKey;
  /** 数组字段是 string[]，其余是 string */
  value: string | string[];
  /** 原文依据 */
  evidence: string;
  /** 依据在原文里找不到——多半是模型归纳或编的，页面上标"需核对" */
  unverified: boolean;
  /** 编导在确认页跟 AI 说了之后改的：以编导为准，不再标"需核对" */
  byUser?: boolean;
  /** AI 逐项核对的结论（见 buildCheckPrompt）。没有 = 这一项没核对到 */
  check?: FieldCheck;
}

export interface FieldCheck {
  ok: boolean;
  /** 有问题时：原文是怎么说的、错在哪 */
  reason: string;
  /** 建议改成什么；null = 原文根本没说，建议不填；undefined = 没给建议 */
  fix?: string | string[] | null;
}

export interface Extraction {
  /** 建议的档案名称（店名、账号名） */
  profileName: string;
  fields: ExtractedField[];
  /** 档案字段装不下、但做定位用得上的事实和客户原话 */
  highlights: string[];
  /** 前采没问到、但定位很需要的：下次回访可以这样问 */
  missing: { key: FieldKey; label: string; question: string }[];
  /** 逐项核对跑过了（没跑成时为 false，页面上照旧只看"依据对不对得上"） */
  checked?: boolean;
}

const SPEC = new Map(PROFILE_FIELDS.map((f) => [f.key, f]));
const ARRAY_KINDS = new Set(['multi']);

/** 手机号、座机、身份证、银行卡——不进档案 */
const SENSITIVE = [
  /(?<!\d)1[3-9]\d{9}(?!\d)/g,
  /(?<!\d)\d{3,4}-\d{7,8}(?!\d)/g,
  /(?<!\d)\d{17}[\dXx](?!\d)/g,
  /(?<!\d)\d{16,19}(?!\d)/g,
];
export function scrubSensitive(s: string): string {
  return SENSITIVE.reduce((t, re) => t.replace(re, '（已隐去）'), s);
}

// ---------------------------------------------------------------- 提示词

/**
 * 个别字段光看名字和选项会填偏，补一句说明。
 * 产品品类：选项都是「餐饮」「美妆护肤」这种大类，模型就只填个「餐饮」——
 * 线上实测，经营三个品类的店，档案里具体卖什么一个都没记下来，定位时川菜就被丢了。
 */
const FIELD_HINTS: Partial<Record<FieldKey, string>> = {
  product_category: '写具体卖什么，每个品类一项（比如 川味烧烤、川味串串火锅、川菜）；不要只写「餐饮」这种大类',
};

function fieldLine(f: ProfileFieldSpec): string {
  const hint = FIELD_HINTS[f.key];
  return hint ? `${fieldLineBase(f)}\n  ⚠ ${hint}` : fieldLineBase(f);
}

function fieldLineBase(f: ProfileFieldSpec): string {
  const opts = f.options?.length ? f.options.join(' / ') : '';
  switch (f.kind) {
    case 'single':
      return `- ${f.key}（${f.label}）【单选，只能原样填下面其中一个，都对不上就不填】：${opts}`;
    case 'multi':
      return opts
        ? `- ${f.key}（${f.label}）【多选，数组】优先用这些：${opts}；都对不上可以写原文里的短词`
        : `- ${f.key}（${f.label}）【多选，数组，写短词】`;
    case 'pick':
      return f.allowOther
        ? `- ${f.key}（${f.label}）【字符串，多项用顿号隔开】优先用这些说法：${opts}；原文有更具体的，写一句短话`
        : `- ${f.key}（${f.label}）【字符串，多项用顿号隔开，只能原样用这些】：${opts}`;
    default:
      return `- ${f.key}（${f.label}）【字符串，一两句话概括原文】`;
  }
}

/**
 * 发给模型的整段提示词。
 * 字段清单从 PROFILE_SECTIONS 现算——档案加字段、改选项，提示词自动跟上。
 */
export function buildExtractionPrompt(source: string): string {
  const fields = PROFILE_SECTIONS.map((s) => `【${s.title}】\n${s.fields.map(fieldLine).join('\n')}`).join('\n\n');
  return `【任务：前采建档】这一次不写文案、不做分析，只做信息提取。

下面是编导对一位客户（商家/博主）做的前采记录，可能是问答、聊天记录或录音转写，口语、错别字都可能有。
请从中提取这个客户的信息，填进账号档案。

## 规则（必须遵守）
1. **只填原文里说到的**。原文没提到的字段，直接不写，不要推测、不要按行业常识补。
2. 每个字段都给 evidence：从原文里**原样复制**的一小段话（不超过 60 字），证明这个值是从哪来的。原文里的双引号一律换成「」，不然 JSON 会坏。
3. 单选题只能原样填给定选项之一；对不上就不填，并把它放进 missing。
4. 手机号、微信号、身份证号、详细门牌地址一律不写。
5. highlights：档案字段装不下、但做账号定位用得上的信息——老板经历、店的故事、招牌产品、真实数据、客户的原话金句。每条一句话，最多 8 条。
6. missing：原文没问到、但对账号定位最重要的字段，最多 6 个，每个给一句编导下次回访可以直接问客户的大白话问题。
7. profile_name：店名或账号名；原文没有就用"行业+城市/人名"起一个，比如"老张汽修"。

## 档案字段（key 必须一字不差）
${fields}

## 输出格式
只输出一个 JSON 对象，不要任何解释、不要 Markdown 代码块：
{"profile_name":"…","fields":{"字段key":{"value":…,"evidence":"原文片段"}},"highlights":["…"],"missing":[{"field":"字段key","question":"…"}]}

## 前采记录（到"前采记录结束"为止）
${source}
前采记录结束`;
}

// ---------------------------------------------------------------- 校验

/** 从模型回复里把 JSON 抠出来：可能包着代码块、前后带了几句话 */
export function extractJson(raw: string): unknown {
  const s = raw.replace(/```(?:json)?/gi, '');
  const a = s.indexOf('{');
  const b = s.lastIndexOf('}');
  if (a < 0 || b <= a) throw new Error('回复里没有 JSON');
  const body = s.slice(a, b + 1);
  try {
    return JSON.parse(body);
  } catch {
    return JSON.parse(repairInnerQuotes(body));
  }
}

/**
 * 修字符串里没转义的双引号。
 *
 * 实测：原文写着 抖音号叫"阿强切牛肉"，模型把它原样抄进 evidence，
 * 整段 JSON 就断在那里。提示词里已经要求换成「」，这里再兜一层：
 * 在字符串里遇到 "，后面紧跟的不是 , } ] : 就当它是正文里的引号，转义掉。
 */
export function repairInnerQuotes(s: string): string {
  let out = '';
  let inStr = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr && c === '\\') {
      out += c + (s[i + 1] ?? '');
      i++;
      continue;
    }
    if (c === '"') {
      if (!inStr) {
        inStr = true;
      } else {
        let j = i + 1;
        while (j < s.length && /\s/.test(s[j])) j++;
        if (j < s.length && !',}]:'.includes(s[j])) {
          out += '\\"';
          continue;
        }
        inStr = false;
      }
    }
    out += c;
  }
  return out;
}

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n) : s);
const norm = (s: string) => s.replace(/[\s，。、！？,.!?：:；;"“”'‘’（）()【】\[\]…—-]/g, '').toLowerCase();

/** 依据是不是真在原文里：去掉标点空白后比；太短的依据（两三个字）不算数 */
export function evidenceInSource(evidence: string, source: string): boolean {
  const e = norm(evidence);
  if (e.length < 4) return false;
  const src = norm(source);
  if (src.includes(e)) return true;
  // 模型常常把长句掐头去尾或者改一两个字：取前后两半，有一半对得上就算
  const half = Math.floor(e.length / 2);
  return half >= 4 && (src.includes(e.slice(0, half)) || src.includes(e.slice(half)));
}

function toStrings(v: unknown): string[] {
  if (Array.isArray(v)) return v.flatMap(toStrings);
  // 模型有时用 · 隔开多项（实测过 "怕质量有问题·价格不透明"）。
  // 不按 / 拆：选项里就有「完整团队(编导/摄影/剪辑)」这种
  if (typeof v === 'string') return v.split(/[、,，;；·\n]/).map((x) => x.trim()).filter(Boolean);
  if (typeof v === 'number') return [String(v)];
  return [];
}

/** 按字段类型清洗一个值；清完是空的返回 null（这一项就不要了） */
function cleanValue(spec: ProfileFieldSpec, v: unknown): string | string[] | null {
  const parts = toStrings(v).map((x) => clip(scrubSensitive(x), 80));
  if (parts.length === 0) return null;
  const opts = spec.options ?? [];

  if (spec.kind === 'single') {
    // 下拉框只认选项原文。模型有时写"0-1万粉"，宽松一点对：选项被包含在它写的里面也算
    // 选项自己带逗号（「刚起号，定位未确定」），拆开就对不上了，所以先拿整句比
    const whole = typeof v === 'string' ? [v.trim(), ...parts] : parts;
    const hit = opts.find((o) => whole.some((p) => p === o)) ?? opts.find((o) => whole.some((p) => p.includes(o)));
    return hit ?? null;
  }
  if (spec.kind === 'multi') {
    return Array.from(new Set(parts.map((p) => clip(p, 20)))).slice(0, 8);
  }
  if (spec.kind === 'pick') {
    const kept = spec.allowOther ? parts : parts.filter((p) => opts.includes(p));
    const uniq = Array.from(new Set(kept)).slice(0, 8);
    return uniq.length ? uniq.join('、') : null;
  }
  return clip(scrubSensitive(toStrings(v).join('，')), 300) || null;
}

/**
 * 把模型的回复变成能直接用的提取结果。
 * 模型怎么乱写都不抛错（除了连 JSON 都没有），能用的留下，不能用的丢掉。
 */
export function parseExtraction(raw: string, source: string): Extraction {
  const data = extractJson(raw) as Record<string, unknown>;
  const rawFields = (data?.fields && typeof data.fields === 'object' ? data.fields : {}) as Record<string, unknown>;

  const fields: ExtractedField[] = [];
  for (const [key, entry] of Object.entries(rawFields)) {
    const spec = SPEC.get(key as FieldKey);
    if (!spec) continue;
    // 两种写法都认：{"value":…, "evidence":…} 或者直接给值
    const obj = entry && typeof entry === 'object' && !Array.isArray(entry) ? (entry as Record<string, unknown>) : { value: entry };
    const value = cleanValue(spec, obj.value);
    if (value == null) continue;
    const evidence = clip(scrubSensitive(typeof obj.evidence === 'string' ? obj.evidence.trim() : ''), 120);
    fields.push({ key: spec.key, value, evidence, unverified: !evidenceInSource(evidence, source) });
  }
  // 按档案的顺序排，页面上按六步分组展示
  const order = new Map(PROFILE_FIELDS.map((f, i) => [f.key, i]));
  fields.sort((a, b) => order.get(a.key)! - order.get(b.key)!);

  const highlights = toStringList(data?.highlights).map((h) => clip(scrubSensitive(h), 150)).slice(0, 8);

  const filled = new Set(fields.map((f) => f.key));
  const missing: Extraction['missing'] = [];
  for (const m of Array.isArray(data?.missing) ? data.missing : []) {
    const key = (m as Record<string, unknown>)?.field as FieldKey;
    const question = (m as Record<string, unknown>)?.question;
    const spec = SPEC.get(key);
    if (!spec || filled.has(key) || typeof question !== 'string' || !question.trim()) continue;
    if (missing.some((x) => x.key === key)) continue;
    missing.push({ key, label: spec.label, question: clip(question.trim(), 120) });
    if (missing.length >= 6) break;
  }

  const name = typeof data?.profile_name === 'string' ? clip(scrubSensitive(data.profile_name.trim()), 30) : '';
  return { profileName: name, fields, highlights, missing };
}

function toStringList(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string').map((x) => x.trim()).filter(Boolean);
  if (typeof v === 'string') return v.split('\n').map((x) => x.replace(/^[-•\d.、\s]+/, '').trim()).filter(Boolean);
  return [];
}

/**
 * 浏览器发回来的提取结果（对话改过、要存进历史的）重新清洗一遍：
 * 和模型的回复一样不可信——字段名、值的类型、长度都按档案定义过一遍。
 */
export function sanitizeExtraction(data: unknown): Extraction {
  const d = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  const fields: ExtractedField[] = [];
  const seen = new Set<string>();
  for (const f of Array.isArray(d.fields) ? d.fields : []) {
    const o = (f && typeof f === 'object' ? f : {}) as Record<string, unknown>;
    const spec = SPEC.get(o.key as FieldKey);
    if (!spec || seen.has(spec.key)) continue;
    const value = cleanValue(spec, o.value);
    if (value == null) continue;
    seen.add(spec.key);
    const c = o.check && typeof o.check === 'object' ? (o.check as Record<string, unknown>) : null;
    let check: FieldCheck | undefined;
    if (c) {
      const fix = c.fix === null ? null : c.fix !== undefined ? cleanValue(spec, c.fix) ?? undefined : undefined;
      check = {
        ok: c.ok === true,
        reason: clip(scrubSensitive(typeof c.reason === 'string' ? c.reason : ''), 150),
        ...(fix !== undefined ? { fix } : {}),
      };
    }
    fields.push({
      key: spec.key,
      value,
      evidence: clip(scrubSensitive(typeof o.evidence === 'string' ? o.evidence : ''), 120),
      unverified: o.unverified === true,
      ...(o.byUser === true ? { byUser: true } : {}),
      ...(check ? { check } : {}),
    });
  }
  const order = new Map(PROFILE_FIELDS.map((f, i) => [f.key, i]));
  fields.sort((a, b) => order.get(a.key)! - order.get(b.key)!);
  const missing: Extraction['missing'] = [];
  for (const m of Array.isArray(d.missing) ? d.missing : []) {
    const o = (m && typeof m === 'object' ? m : {}) as Record<string, unknown>;
    const spec = SPEC.get(o.key as FieldKey);
    if (!spec || seen.has(spec.key) || typeof o.question !== 'string' || missing.length >= 6) continue;
    missing.push({ key: spec.key, label: spec.label, question: clip(o.question, 120) });
  }
  return {
    profileName: typeof d.profileName === 'string' ? clip(scrubSensitive(d.profileName.trim()), 30) : '',
    fields,
    highlights: toStringList(d.highlights).map((h) => clip(scrubSensitive(h), 150)).slice(0, 12),
    missing,
    ...(d.checked === true ? { checked: true } : {}),
  };
}

// ---------------------------------------------------------------- 逐项核对

/**
 * 提取完再让模型当一遍"严格的核对员"，逐项对照原文挑错。
 *
 * 【为什么光比对依据不够】evidenceInSource 只能查"依据是不是原文里的话"，
 * 查不出"依据是真的、结论是猜的"：线上实测，原文只有「拍过，现在八千多粉」，
 * 提取出了「账号阶段：稳定运营，需要新选题」——依据确实在原文里，但这个阶段是推测的。
 * 产品方要求"核对要仔细"，这一类得靠读懂原文才挑得出来。
 *
 * 提取时模型在"尽量多填"，核对时换成"宁可多标"，两个方向互相制衡。
 */
export function buildCheckPrompt(ex: Extraction, source: string): string {
  const rows = ex.fields
    .map((f) => {
      const spec = SPEC.get(f.key)!;
      const opts = spec.options?.length
        ? `（${spec.kind === 'single' ? '单选' : '标准说法'}：${spec.options.join(' / ')}）`
        : '';
      return `- ${f.key}（${spec.label}）${opts}：${Array.isArray(f.value) ? f.value.join('、') : f.value}\n  依据：${f.evidence || '（没给）'}`;
    })
    .join('\n');
  return `【任务：前采建档·逐项核对】这一次不写文案、不做分析，只核对。

下面是从一份前采记录里提取出来的账号档案。你是一个严格的核对员：逐项对照原文，判断每一项提取得对不对。

## 核对标准
- **没问题**：原文明确说到，值和原文一致。
- 以下都算**有问题**：
  1. 原文没说，是推测、按行业常识补的（比如只说"拍过视频"，就填了账号处在什么阶段）
  2. 值和原文对不上：数字、档位、人群、价格（"八千多粉"应该是 0-1万；"人均120"应该是 50-200元）
  3. 把别人的情况（同行、客人、对标账号）当成了这个客户的
  4. 把"打算做、想做"当成了"已经在做"
  5. 说得比原文重、比原文多（原文说"有时候"，写成了"一直"）
  6. 依据和这一项没关系
  7. 和档案里别的项互相矛盾、或者比别的项少了东西（比如赛道里有三个品类，选题方向却写"以其中两个为核心"；
     产品品类只写了「餐饮」，没写具体卖什么）
- 宁可多标，不要放过。但原文确实说了的，不要为了挑错硬挑。

## 这些不算问题（只核意思对不对，不核措辞）
- 档案很多栏用的是固定的**标准说法**（每项后面括号里列着）：把原文的意思归到对应的标准说法上是对的，不算"加工"。
  比如原文"最常问牛肉是不是当天的" → 「怕质量有问题」；"二十五到三十五岁" → 「25-30岁、31-40岁」；"人均120" → 「50-200元」。
  只有归错了（意思对不上）才算问题。
- 不要因为"可以写得更具体"就标（原文说在店里切牛肉，写「店铺」就是对的）。
- fix 要用这一项的标准说法，不要改回原文的大白话。

## 有问题的怎么写
- reason：一句大白话，说原文是怎么说的、错在哪。比如"原文只说拍过视频、八千多粉，没说定位定没定，阶段是猜的"
- fix：建议改成什么（单选题只能是选项原文）；原文根本没说这件事，fix 写 null，意思是建议不填

## 提取结果
${rows}

## 输出格式
每一项都要给结论。只输出一个 JSON 对象，不要任何解释、不要 Markdown 代码块：
{"checks":{"字段key":{"ok":true},"另一个key":{"ok":false,"reason":"…","fix":…或null}}}

## 前采记录（到"前采记录结束"为止）
${source}
前采记录结束`;
}

/** 把核对结论挂到每一项上。解析不了就抛错，由调用方决定要不要不带核对照样给结果 */
export function applyCheck(ex: Extraction, raw: string): Extraction {
  const data = extractJson(raw) as Record<string, unknown>;
  const checks = (data?.checks && typeof data.checks === 'object' ? data.checks : {}) as Record<string, unknown>;
  const fields = ex.fields.map((f) => {
    const c = checks[f.key];
    if (!c || typeof c !== 'object') return f;
    const o = c as Record<string, unknown>;
    if (o.ok !== false) return { ...f, check: { ok: true, reason: '' } };
    const spec = SPEC.get(f.key)!;
    const reason = clip(scrubSensitive(typeof o.reason === 'string' ? o.reason.trim() : ''), 150) || '这一项和原文对不上，请核对';
    // fix：null 是"建议不填"；给了值的，按档案类型清洗，洗完是空的（比如单选给了个选项外的）就当没给建议
    let fix: FieldCheck['fix'];
    if (o.fix === null) fix = null;
    else if (o.fix !== undefined) fix = cleanValue(spec, o.fix) ?? undefined;
    // 建议改成的和现在一样（只差全角半角括号、标点），等于没问题——实测模型会给出这种"建议"
    const flat = (v: string | string[]) => norm(Array.isArray(v) ? v.join('、') : v);
    if (fix !== undefined && fix !== null && flat(fix) === flat(f.value)) return { ...f, check: { ok: true, reason: '' } };
    return { ...f, check: { ok: false, reason, ...(fix !== undefined ? { fix } : {}) } };
  });
  return { ...ex, fields, checked: true };
}

// ---------------------------------------------------------------- 对话修改

/** 编导一次说的话最多这么长：够说清"哪里不对"，又不至于被拿来当免费的聊天机器人 */
export const MAX_INSTRUCTION_CHARS = 300;

export interface RevisionInput {
  /** 确认页此刻的结果（含编导手动改过的） */
  fields: Partial<Record<FieldKey, string | string[]>>;
  highlights: string[];
  profileName: string;
  instruction: string;
}

export interface Revision {
  /** 给编导的一句话：改了什么 */
  reply: string;
  set: ExtractedField[];
  remove: FieldKey[];
  /** 只有要改要点时才有，是改完后的完整列表 */
  highlights: string[] | null;
  profileName: string | null;
}

/**
 * 确认页的"跟 AI 说哪里不对"：编导一句话，AI 只改他说到的几项。
 *
 * 编导比前采记录更清楚客户的情况（记录可能记漏、记错，客户后来又改口），
 * 所以他说的以他为准；他让回原文找的，才去原文里找。
 * 原文照样带上，要求放在最后——离输出最近，模型最不容易忘。
 */
export function buildRevisionPrompt(input: RevisionInput, source: string): string {
  const fields = PROFILE_SECTIONS.map((s) => `【${s.title}】\n${s.fields.map(fieldLine).join('\n')}`).join('\n\n');
  const current = JSON.stringify({ profile_name: input.profileName, fields: input.fields, highlights: input.highlights });
  return `【任务：修改前采建档的提取结果】这一次不写文案、不做分析，只按编导的要求改档案。

编导看了从前采记录里提取出的档案，指出了问题（见最后「编导的要求」）。请按要求修改。

## 规则（必须遵守）
1. **只改编导说到的**，没提到的事一律不动、不要出现在输出里。
   但编导说的一件事如果牵涉好几项，**相关的每一项都要改到**，不能只改一项、别的项还和它对不上。
   比如编导说"我们经营川味烧烤、川味串串火锅、川菜这三类"：产品品类、赛道、选题方向里凡是讲"卖什么""以什么为核心"的，都要写全这三类。
2. 编导说的就是事实，以他为准——他比前采记录更清楚客户的情况。
3. 编导让你回原文找、核对的，去下面的前采记录里找，evidence 写原文片段（双引号换成「」）；不是从原文来的，evidence 留空。
4. 先看现在的值是不是**已经符合**编导说的：符合就不改，在 reply 里说"已经是××了"。
   比如编导说"团队就两个人"，现在是「2-3人小团队」，那就不用改。
5. 单选题只能原样填给定选项之一；编导说的对不上任何选项，就按字面选最接近的那个（两个人 → 2-3人小团队，不是一人全包），并在 reply 里说明。
6. 要清空某一项，把字段 key 放进 remove。
7. 要改前采要点，就在 highlights 里给出改完后的**完整**列表；不改就不要输出 highlights。
8. 要改档案名称才输出 profile_name。
9. 编导的话如果和修改档案无关（让你写文案、聊别的），什么都不改，reply 里说明"这里只能修改档案内容"。
10. reply：一句大白话告诉编导你改了哪几项、改成了什么。

## 档案字段（key 必须一字不差）
${fields}

## 现在的提取结果
${current}

## 输出格式
只输出一个 JSON 对象，不要任何解释、不要 Markdown 代码块：
{"reply":"…","set":{"字段key":{"value":…,"evidence":"原文片段或空"}},"remove":["字段key"]}

## 前采记录（到"前采记录结束"为止）
${source}
前采记录结束

## 编导的要求
${input.instruction}`;
}

export function parseRevision(raw: string, source: string): Revision {
  const data = extractJson(raw) as Record<string, unknown>;
  const rawSet = (data?.set && typeof data.set === 'object' && !Array.isArray(data.set) ? data.set : {}) as Record<string, unknown>;

  const set: ExtractedField[] = [];
  for (const [key, entry] of Object.entries(rawSet)) {
    const spec = SPEC.get(key as FieldKey);
    if (!spec) continue;
    const obj = entry && typeof entry === 'object' && !Array.isArray(entry) ? (entry as Record<string, unknown>) : { value: entry };
    const value = cleanValue(spec, obj.value);
    if (value == null) continue;
    const ev = clip(scrubSensitive(typeof obj.evidence === 'string' ? obj.evidence.trim() : ''), 120);
    // 依据对得上原文才留；对不上就不留——这一项是按编导说的改的，不需要"原文依据"
    const evidence = ev && evidenceInSource(ev, source) ? ev : '';
    set.push({ key: spec.key, value, evidence, unverified: false, byUser: true });
  }

  const setKeys = new Set(set.map((f) => f.key));
  const remove = (Array.isArray(data?.remove) ? data.remove : [])
    .filter((k): k is FieldKey => typeof k === 'string' && SPEC.has(k as FieldKey) && !setKeys.has(k as FieldKey));

  const highlights = Array.isArray(data?.highlights)
    ? toStringList(data.highlights).map((h) => clip(scrubSensitive(h), 150)).slice(0, 8)
    : null;
  const profileName =
    typeof data?.profile_name === 'string' && data.profile_name.trim() ? clip(scrubSensitive(data.profile_name.trim()), 30) : null;
  const reply = typeof data?.reply === 'string' ? clip(scrubSensitive(data.reply.trim()), 200) : '';

  return { reply, set, remove: Array.from(new Set(remove)), highlights, profileName };
}

// ---------------------------------------------------------------- 和已有档案对比、合并

export type FieldStatus = 'new' | 'same' | 'different';

const asList = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x.trim()) : typeof v === 'string' ? v.split(/[、,，]/).map((x) => x.trim()).filter(Boolean) : [];

/** 这一项和档案里现有的比：原来空着 / 一样 / 不一样 */
export function compareField(f: ExtractedField, existing: Record<string, unknown> | null | undefined): FieldStatus {
  const cur = existing?.[f.key];
  const curList = asList(cur);
  if (curList.length === 0) return 'new';
  const next = Array.isArray(f.value) ? f.value : asList(f.value);
  const a = new Set(curList);
  // 多选、勾选题：新提取的都已经在档案里了（档案是「手机、灯光」，这次提到「手机」），没有新东西，算一致
  if (canMerge(f.key)) return next.every((x) => a.has(x)) ? 'same' : 'different';
  return next.length === a.size && next.every((x) => a.has(x)) ? 'same' : 'different';
}

/**
 * 合并：多选、勾选题把新旧并起来（前采补充的信息不该把原来的冲掉）；
 * 单选和自由填写只能二选一，由用户在确认页选。
 */
export function mergeValue(key: FieldKey, existing: unknown, incoming: string | string[]): string | string[] {
  const spec = SPEC.get(key);
  if (!spec) return incoming;
  if (spec.kind === 'multi') return Array.from(new Set([...asList(existing), ...asList(incoming)]));
  if (spec.kind === 'pick') return Array.from(new Set([...asList(existing), ...asList(incoming)])).join('、');
  return incoming;
}

export function canMerge(key: FieldKey): boolean {
  const k = SPEC.get(key)?.kind;
  return k === 'multi' || k === 'pick';
}

/** 前采原文存进档案时的上限：够定位参考，又不至于把一行撑得太大 */
export const MAX_STORED_NOTES = MAX_SOURCE_CHARS;
const MAX_HIGHLIGHTS = 12;

/** 新的一轮前采接在后面，按日期隔开；太长时丢掉最早的 */
export function appendNotes(prev: unknown, next: string, now = new Date()): string {
  const stamp = `——— 前采资料（${now.toISOString().slice(0, 10)} 导入）———`;
  const block = `${stamp}\n${next}`;
  const old = typeof prev === 'string' ? prev.trim() : '';
  const all = old ? `${old}\n\n${block}` : block;
  return all.length > MAX_STORED_NOTES ? all.slice(all.length - MAX_STORED_NOTES) : all;
}

/** 要点一行一条，去重；新的排前面，最多留 12 条 */
export function mergeHighlights(prev: unknown, next: string[]): string {
  const old = typeof prev === 'string' ? prev.split('\n').map((x) => x.trim()).filter(Boolean) : [];
  return Array.from(new Set([...next, ...old])).slice(0, MAX_HIGHLIGHTS).join('\n');
}
