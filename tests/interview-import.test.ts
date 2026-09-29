/**
 * 前采建档：编导的前采记录 → 账号档案。
 *
 * 守的都是"不报错、只是悄悄错了"的那类：
 *   - 模型把原文里的双引号抄进 JSON，整段解析失败（线上实测发生过）
 *   - 单选题填了个选项外的值，编辑页下拉框显示成"请选择"，看着像没填
 *   - 依据是模型编的，却和真的一样显示
 *   - 手机号进了档案、又被发进每一次生成的提示词
 *   - 档案加了字段，提取没跟上，那一栏永远提取不出来
 */
import { describe, it, expect } from 'vitest';
import { deflateRawSync } from 'node:zlib';
import {
  buildExtractionPrompt,
  parseExtraction,
  extractJson,
  evidenceInSource,
  scrubSensitive,
  compareField,
  mergeValue,
  appendNotes,
  mergeHighlights,
  buildRevisionPrompt,
  parseRevision,
  sanitizeExtraction,
  buildCheckPrompt,
  applyCheck,
  MAX_STORED_NOTES,
} from '@/lib/interview-import';
import {
  applyRevision,
  buildPatch,
  currentValues,
  initialDrafts,
  isFlagged,
  unresolvedKeys,
} from '@/components/interview/ReviewPanel';
import { documentToText, decodeText, readZipEntry, wordXmlToText, UnsupportedDocument } from '@/lib/document-text';
import { EMPTY_PROFILE, PROFILE_CHOICES, PROFILE_FIELDS } from '@/lib/profile-fields';
import { COUNTED_FEATURES, SUBSCRIPTION_PLANS } from '@/lib/config/plans';
import { PROFILE_SUMMARY_FIELDS } from '@/lib/profile-summary';
import { readCode } from './helpers/source';

const SOURCE = `问：店里主打什么？
答：主打就是鲜切，每天早上六点从屠宰场拉黄牛过来，四个小时内切完卖完。人均大概120块左右。
问：之前拍过视频吗？
答：拍过，抖音号叫"阿强切牛肉"，现在八千多粉。我自己拿手机拍。
联系电话：13812345678`;

/** 照着线上实测的回复改的：代码块包着、evidence 里有没转义的双引号 */
const RAW = `\`\`\`json
{
  "profile_name": "阿强潮汕牛肉火锅",
  "fields": {
    "account_platform": {"value": ["抖音"], "evidence": "抖音号叫"阿强切牛肉"，现在八千多粉"},
    "fans_level": {"value": "0-1万粉丝", "evidence": "现在八千多粉"},
    "account_stage": {"value": "刚起号", "evidence": "拍过"},
    "content_value": {"value": "让人长见识（认知变化）、随便写的", "evidence": "拍我切牛肉的那种"},
    "target_pain_points": {"value": "怕质量有问题·怕等太久", "evidence": "你这牛肉真的是当天的吗"},
    "price_range": {"value": "50-200元", "evidence": "人均大概120块左右"},
    "equipment": "手机",
    "made_up_field": {"value": "x", "evidence": "y"},
    "unique_resources": {"value": "有稳定的货源，电话13812345678", "evidence": "老板说自己货源好"}
  },
  "highlights": ["每天早上六点现拉黄牛", "老板电话 13812345678"],
  "missing": [
    {"field": "content_tone", "question": "你想跟观众像朋友聊天，还是像师傅教学？"},
    {"field": "fans_level", "question": "已经填了的不该再问"},
    {"field": "nope", "question": "不认识的字段"},
    {"field": "budget_per_video", "question": ""}
  ]
}
\`\`\``;

describe('解析模型的回复', () => {
  const r = parseExtraction(RAW, SOURCE);
  const get = (k: string) => r.fields.find((f) => f.key === k);

  it('原文双引号抄进 JSON 也能解开（线上实测过）', () => {
    expect(() => JSON.parse(RAW.replace(/```(json)?/g, ''))).toThrow();
    expect(r.profileName).toBe('阿强潮汕牛肉火锅');
    expect(get('account_platform')?.value).toEqual(['抖音']);
  });

  it('单选题只留选项原文：写成"0-1万粉丝"对得上就收，"刚起号"对不上的丢掉', () => {
    expect(get('fans_level')?.value).toBe('0-1万');
    expect(get('account_stage')).toBeUndefined();
  });

  it('不许写其他的勾选题，选项外的内容丢掉', () => {
    expect(get('content_value')?.value).toBe('让人长见识（认知变化）');
  });

  it('多项用 · 隔开也认；直接给值（没有 value/evidence 包一层）也认', () => {
    expect(get('target_pain_points')?.value).toBe('怕质量有问题、怕等太久');
    expect(get('equipment')?.value).toEqual(['手机']);
  });

  it('不认识的字段名丢掉', () => {
    expect(r.fields.map((f) => f.key)).not.toContain('made_up_field');
    for (const f of r.fields) expect(PROFILE_FIELDS.some((s) => s.key === f.key)).toBe(true);
  });

  it('依据对得上原文才算数，对不上的标"需核对"', () => {
    expect(get('price_range')?.unverified).toBe(false);
    expect(get('fans_level')?.unverified).toBe(false);
    expect(get('unique_resources')?.unverified).toBe(true); // "老板说自己货源好" 原文里没有
    expect(get('account_platform')?.unverified).toBe(false); // 引号不影响比对
  });

  it('手机号不进档案：字段值、要点里都隐去', () => {
    const all = JSON.stringify(r);
    expect(all).not.toContain('13812345678');
    expect(all).toContain('（已隐去）');
  });

  it('补问清单：已经填了的、不认识的、没写问题的都不要', () => {
    expect(r.missing.map((m) => m.key)).toEqual(['content_tone']);
    expect(r.missing[0].label).toBe('语言风格');
  });

  it('按档案的顺序排（确认页按六步分组）', () => {
    const order = PROFILE_FIELDS.map((f) => f.key);
    const idx = r.fields.map((f) => order.indexOf(f.key));
    expect(idx).toEqual([...idx].sort((a, b) => a - b));
  });

  it('连 JSON 都没有才报错', () => {
    expect(() => parseExtraction('抱歉，我无法完成', SOURCE)).toThrow();
    expect(extractJson('好的：{"a":1} 以上')).toEqual({ a: 1 });
  });
});

describe('对话修改：编导一句话，AI 改对应的几项', () => {
  const input = {
    fields: { fans_level: '0-1万', team_structure: '2-3人小团队', equipment: ['手机'] },
    highlights: ['每天早上六点现拉黄牛'],
    profileName: '阿强潮汕牛肉火锅',
    instruction: '粉丝其实有3万了；目标人群兴趣那一项不要了',
  };
  const prompt = buildRevisionPrompt(input, SOURCE);

  it('提示词：只改说到的、编导为准、先看是不是已经符合、跑题不改；编导的话放在最后', () => {
    expect(prompt).toMatch(/只改编导说到的/);
    expect(prompt).toMatch(/以他为准/);
    expect(prompt).toMatch(/已经符合/);
    expect(prompt).toMatch(/这里只能修改档案内容/);
    expect(prompt.trimEnd().endsWith(input.instruction)).toBe(true);
    expect(prompt.indexOf(SOURCE)).toBeLessThan(prompt.indexOf('## 编导的要求'));
    // 现在的结果带上了（含手动改过的值）
    expect(prompt).toContain('"team_structure":"2-3人小团队"');
    for (const f of PROFILE_FIELDS) expect(prompt, f.key).toContain(`- ${f.key}（`);
  });

  // 照着线上实测的回复写的
  const RAW_REV = `{"reply":"改了2项","set":{"fans_level":{"value":"1-5万","evidence":""},"team_structure":{"value":"老板一个人"},"equipment":{"value":["手机","稳定器"],"evidence":"我自己拿手机拍"},"bogus":{"value":"x"}},"remove":["target_interests","fans_level","nope"]}`;
  const rev = parseRevision(RAW_REV, SOURCE);

  it('解析：单选仍只收选项原文，对不上的不改；不认识的字段丢掉', () => {
    expect(rev.set.map((f) => f.key)).toEqual(['fans_level', 'equipment']);
    expect(rev.set[0].value).toBe('1-5万');
    expect(rev.set.every((f) => f.byUser && !f.unverified)).toBe(true);
  });

  it('解析：依据对得上原文才留；同一项又改又清空，以"改"为准', () => {
    expect(rev.set.find((f) => f.key === 'equipment')?.evidence).toBe('我自己拿手机拍');
    expect(rev.remove).toEqual(['target_interests']);
  });

  it('解析：不改要点、不改名字时就是 null（不能把要点清空）', () => {
    expect(rev.highlights).toBeNull();
    expect(rev.profileName).toBeNull();
    expect(parseRevision('{"reply":"x","highlights":["新的"],"profile_name":"新名字"}', SOURCE)).toMatchObject({ highlights: ['新的'], profileName: '新名字' });
  });

  it('跑题的回复：什么都不改', () => {
    const r = parseRevision('{"reply":"这里只能修改档案内容","set":{},"remove":[]}', SOURCE);
    expect(r.set).toEqual([]);
    expect(r.remove).toEqual([]);
    expect(r.reply).toBe('这里只能修改档案内容');
  });
});

describe('逐项核对：提取完再当一遍严格的核对员', () => {
  const ex = {
    profileName: '阿强',
    fields: [
      { key: 'account_stage' as const, value: '稳定运营，需要新选题', evidence: '拍过，抖音号叫「阿强切牛肉」', unverified: false },
      { key: 'fans_level' as const, value: '0-1万', evidence: '现在八千多粉', unverified: false },
      { key: 'target_interests' as const, value: ['火锅'], evidence: '', unverified: true },
      { key: 'content_format' as const, value: ['Vlog', '教程'], evidence: '', unverified: false },
      { key: 'content_restrictions' as const, value: '不能用绝对化用语（全长沙最好吃）', evidence: '', unverified: false },
      { key: 'price_range' as const, value: ['50-200元'], evidence: '人均大概120块左右', unverified: false },
    ],
    highlights: [],
    missing: [],
  };

  it('提示词：点名"依据是真的、结论是猜的"这类；标准说法归对了不算问题；原文在最后', () => {
    const p = buildCheckPrompt(ex, SOURCE);
    expect(p).toMatch(/推测/);
    expect(p).toMatch(/打算做/);
    expect(p).toMatch(/宁可多标/);
    expect(p).toMatch(/标准说法/);
    expect(p).toMatch(/二十五到三十五岁" → 「25-30岁、31-40岁」/);
    for (const f of ex.fields) expect(p).toContain(`- ${f.key}（`);
    expect(p).toContain('0-1万 / 1-5万'); // 单选把选项带上，才判断得了档位对不对
    expect(p.trimEnd().endsWith('前采记录结束')).toBe(true);
  });

  // 照着线上实测的回复写的
  const RAW_CHECK = `{"checks":{
    "account_stage":{"ok":false,"reason":"原文只说拍过视频、八千多粉，没说定位定没定，阶段是猜的"},
    "fans_level":{"ok":true},
    "target_interests":{"ok":false,"reason":"原文没说客人的兴趣","fix":null},
    "content_format":{"ok":false,"reason":"只说拍切牛肉，没说是教程","fix":["Vlog"]},
    "content_restrictions":{"ok":false,"reason":"不能扩大范围","fix":"不能用绝对化用语(全长沙最好吃)"},
    "made_up":{"ok":false,"reason":"x"}
  }}`;
  const out = applyCheck(ex, RAW_CHECK);
  const get = (k: string) => out.fields.find((f) => f.key === k)!;

  it('挂上结论：有问题的带原因；fix 给值、给 null（建议不填）、不给，三种都认', () => {
    expect(out.checked).toBe(true);
    expect(get('fans_level').check).toEqual({ ok: true, reason: '' });
    expect(get('account_stage').check).toMatchObject({ ok: false, reason: expect.stringContaining('阶段是猜的') });
    expect(get('account_stage').check).not.toHaveProperty('fix');
    expect(get('target_interests').check?.fix).toBeNull();
    expect(get('content_format').check?.fix).toEqual(['Vlog']);
  });

  it('"建议"和现在的值只差全角半角括号：等于没问题（实测模型会这样）', () => {
    expect(get('content_restrictions').check?.ok).toBe(true);
  });

  it('没核到的项不挂结论；不认识的字段不会多出来', () => {
    expect(get('price_range').check).toBeUndefined();
    expect(out.fields).toHaveLength(ex.fields.length);
  });

  it('有疑问 = AI 标的；没核对成时退回看依据；编导自己说了改的不算', () => {
    expect(isFlagged(get('account_stage'), true)).toBe(true);
    expect(isFlagged(get('fans_level'), true)).toBe(false);
    // 依据对不上但 AI 核对说没问题：以核对为准
    expect(isFlagged({ ...get('fans_level'), unverified: true }, true)).toBe(false);
    // 核对没跑成
    expect(isFlagged(ex.fields[2], false)).toBe(true);
    expect(isFlagged(ex.fields[0], false)).toBe(false);
    expect(isFlagged({ ...get('account_stage'), byUser: true }, true)).toBe(false);
  });

  it('还要看的：有疑问、要写进去、没处理的；按建议改了、确认了、不填了都算处理过', () => {
    const drafts = initialDrafts(out, null);
    expect(unresolvedKeys(out, drafts).sort()).toEqual(['account_stage', 'content_format', 'target_interests']);
    drafts.account_stage = { ...drafts.account_stage, resolved: true };
    drafts.target_interests = { ...drafts.target_interests, include: false };
    expect(unresolvedKeys(out, drafts)).toEqual(['content_format']);
  });

  it('存历史时核对结论跟着存下来', () => {
    const back = sanitizeExtraction(JSON.parse(JSON.stringify(out)));
    expect(back.checked).toBe(true);
    expect(back.fields.find((f) => f.key === 'target_interests')?.check).toEqual({ ok: false, reason: '原文没说客人的兴趣', fix: null });
    expect(back.fields.find((f) => f.key === 'content_format')?.check?.fix).toEqual(['Vlog']);
  });

  it('接口：提取完先核对、再扣次数存历史；核对没跑成照样给结果', () => {
    const extract = readCode('app/api/interview/extract/route.ts');
    const c = extract.indexOf('buildCheckPrompt(result, source)');
    expect(c).toBeGreaterThan(extract.indexOf('parseExtraction('));
    expect(c).toBeLessThan(extract.indexOf('incrementUsageServer('));
    expect(extract).toMatch(/核对没跑成，不带核对给结果/);
  });

  it('页面：核对没完不让写入，写入按钮换成"还有 N 项没核对"，点了带去下一项；顺序是 核对 → 跟 AI 改 → 写入', () => {
    const page = readCode('app/dashboard/interview/page.tsx');
    expect(page).toMatch(/pending\.length > 0 \? \([\s\S]{0,200}onClick=\{goNextPending\}[\s\S]{0,300}还有 \{pending\.length\} 项没核对/);
    expect(page).toMatch(/onClick=\{save\}/);
    expect(page).toMatch(/逐项核对[\s\S]{0,300}跟 AI 说哪里不对[\s\S]{0,100}写入档案/);
    // 对话框在各项后面（先核对再改）
    expect(page).toMatch(/afterFields=\{\s*<ReviseChat/);
    const panel = readCode('components/interview/ReviewPanel.tsx');
    expect(panel).toMatch(/我核对过，没问题/);
    expect(panel).toMatch(/id=\{`field-\$\{field\.key\}`\}/);
  });
});

describe('原文依据比对', () => {
  it('去掉标点空白后比；掐头去尾、改一两个字的也算对得上', () => {
    expect(evidenceInSource('每天早上六点从屠宰场拉黄牛过来', SOURCE)).toBe(true);
    expect(evidenceInSource('每天早上六点，从屠宰场拉黄牛过来！', SOURCE)).toBe(true);
    expect(evidenceInSource('每天早上六点从屠宰场拉黄牛过来，全城最新鲜', SOURCE)).toBe(true);
  });
  it('编的、太短的不算', () => {
    expect(evidenceInSource('我们家是全长沙最好吃的火锅店', SOURCE)).toBe(false);
    expect(evidenceInSource('拍过', SOURCE)).toBe(false);
    expect(evidenceInSource('', SOURCE)).toBe(false);
  });
  it('隐去手机号、身份证、座机，不误伤价格和年份', () => {
    expect(scrubSensitive('电话 13812345678，身份证 110101199003071234，座机 0731-84561234')).not.toMatch(/\d{7,}/);
    expect(scrubSensitive('人均120元，2023年开业，粉丝8000')).toBe('人均120元，2023年开业，粉丝8000');
  });
});

describe('提示词', () => {
  const prompt = buildExtractionPrompt(SOURCE);

  it('档案的每个字段都在提示词里（档案加了字段，提取自动跟上）', () => {
    for (const f of PROFILE_FIELDS) expect(prompt, f.key).toContain(`- ${f.key}（`);
  });

  it('单选题把选项原样列出来', () => {
    for (const o of PROFILE_CHOICES.fans_level) expect(prompt).toContain(o);
    expect(prompt).toContain('完整团队(编导/摄影/剪辑)');
  });

  it('不猜、给依据、不写手机号、引号换成「」', () => {
    expect(prompt).toMatch(/只填原文里说到的/);
    expect(prompt).toMatch(/evidence/);
    expect(prompt).toMatch(/手机号/);
    expect(prompt).toMatch(/「」/);
  });

  it('原文放在最后、有明确的结束标记', () => {
    expect(prompt.indexOf(SOURCE)).toBeGreaterThan(prompt.indexOf('## 输出格式'));
    expect(prompt.trimEnd().endsWith('前采记录结束')).toBe(true);
  });
});

describe('档案字段只有一份定义', () => {
  it('表单的每个字段都能提取（除了档案名称，它单独给）', () => {
    const formKeys = Object.keys(EMPTY_PROFILE).filter((k) => k !== 'profile_name').sort();
    expect(PROFILE_FIELDS.map((f) => f.key).sort()).toEqual(formKeys);
  });

  it('表单的选项从 lib/profile-fields 读，不再自己写一份', () => {
    const form = readCode('components/profile/ProfileForm.tsx');
    expect(form).toMatch(/PROFILE_CHOICES as C/);
    // 随便挑几个选项原文：表单里不该再出现
    for (const lit of ["'0-1万'", "'亲切朋友式'", "'一人全包'", "'到店消费'"]) expect(form).not.toContain(lit);
    // 每一组选项表单都用上了（性别是按钮组，写法是 C.target_gender.map）
    const used = new Set([...form.matchAll(/\bC\.(\w+)/g)].map((m) => m[1]));
    expect([...used].sort()).toEqual(Object.keys(PROFILE_CHOICES).sort());
  });

  it('单选题都有选项', () => {
    for (const f of PROFILE_FIELDS.filter((x) => x.kind === 'single')) expect(f.options?.length, f.key).toBeGreaterThan(1);
  });
});

describe('和已有档案合并', () => {
  const field = (key: string, value: string | string[]) => ({ key: key as never, value, evidence: '', unverified: false });

  it('原来空着 / 一样 / 不一样', () => {
    expect(compareField(field('equipment', ['手机']), {})).toBe('new');
    expect(compareField(field('equipment', ['手机']), { equipment: [] })).toBe('new');
    expect(compareField(field('equipment', ['手机', '灯光']), { equipment: ['灯光', '手机'] })).toBe('same');
    expect(compareField(field('target_needs', '要实惠、要快'), { target_needs: '要快、要实惠' })).toBe('same');
    expect(compareField(field('fans_level', '1-5万'), { fans_level: '0-1万' })).toBe('different');
    // 多选：提到的都已经在档案里了，没有新东西 → 一致；有新的才算不一样
    expect(compareField(field('equipment', ['手机']), { equipment: ['手机', '灯光'] })).toBe('same');
    expect(compareField(field('equipment', ['手机', '稳定器']), { equipment: ['手机', '灯光'] })).toBe('different');
  });

  it('多选、勾选题合并时新旧都留；单选直接用新的', () => {
    expect(mergeValue('equipment', ['手机'], ['灯光', '手机'])).toEqual(['手机', '灯光']);
    expect(mergeValue('target_needs', '要快', '要实惠')).toBe('要快、要实惠');
    expect(mergeValue('fans_level', '0-1万', '1-5万')).toBe('1-5万');
  });

  it('前采原文追加不覆盖，按日期隔开；超长时丢最早的', () => {
    const d = new Date('2026-09-29T10:00:00Z');
    const one = appendNotes(null, '第一轮', d);
    expect(one).toContain('2026-09-29');
    const two = appendNotes(one, '第二轮', d);
    expect(two.indexOf('第一轮')).toBeLessThan(two.indexOf('第二轮'));
    const long = appendNotes('旧'.repeat(MAX_STORED_NOTES), '新的一轮', d);
    expect(long.length).toBe(MAX_STORED_NOTES);
    expect(long.endsWith('新的一轮')).toBe(true);
  });

  it('对话改完合进确认页：改的项勾上、清空的项拿掉、补上的不再补问；编导说的不一样项直接用新的', () => {
    const ex = {
      profileName: '阿强',
      fields: [
        { key: 'fans_level' as const, value: '0-1万', evidence: '', unverified: false },
        { key: 'target_interests' as const, value: ['火锅'], evidence: '', unverified: false },
      ],
      highlights: ['a'],
      missing: [
        { key: 'content_tone' as const, label: '语言风格', question: '?' },
        { key: 'budget_per_video' as const, label: '单条预算', question: '?' },
      ],
    };
    const existing = { fans_level: '5-10万', equipment: ['手机', '灯光'] };
    const drafts = initialDrafts(ex, existing);
    expect(drafts.fans_level).toMatchObject({ include: false, mode: 'keep' }); // 刚提取：不一样的先保留原来的
    const rev = {
      reply: '',
      set: [
        { key: 'fans_level' as const, value: '1-5万', evidence: '', unverified: false, byUser: true },
        { key: 'content_tone' as const, value: '亲切朋友式', evidence: '', unverified: false, byUser: true },
        { key: 'equipment' as const, value: ['手机', '稳定器'], evidence: '', unverified: false, byUser: true },
      ],
      remove: ['target_interests' as const],
      highlights: null,
      profileName: null,
    };
    const out = applyRevision(ex, drafts, rev, existing);
    expect(out.extraction.fields.map((f) => f.key)).toEqual(['fans_level', 'content_tone', 'equipment']); // 按档案顺序
    expect(out.drafts.fans_level).toMatchObject({ include: true, mode: 'new', text: '1-5万' }); // 编导说的：用新的
    expect(out.drafts.equipment).toMatchObject({ include: true, mode: 'merge' }); // 多选：合并，不把「灯光」冲掉
    expect(out.drafts.target_interests).toBeUndefined();
    expect(out.extraction.missing.map((m) => m.key)).toEqual(['budget_per_video']);
    expect(out.extraction.highlights).toEqual(['a']);
    // 合完以后写进档案的
    expect(buildPatch(out.extraction, out.drafts, existing)).toEqual({
      fans_level: '1-5万',
      content_tone: '亲切朋友式',
      equipment: ['手机', '灯光', '稳定器'],
    });
  });

  it('发给 AI 的"现在的结果"以编辑框为准（手动改过的也带上）', () => {
    const ex = { profileName: '', fields: [{ key: 'equipment' as const, value: ['手机'], evidence: '', unverified: false }], highlights: [], missing: [] };
    expect(currentValues(ex, { equipment: { include: true, mode: 'new', text: '手机、灯光' } })).toEqual({ equipment: ['手机', '灯光'] });
  });

  it('要点去重，新的在前，最多 12 条', () => {
    expect(mergeHighlights('a\nb', ['c', 'a'])).toBe('c\na\nb');
    expect(mergeHighlights(null, Array.from({ length: 20 }, (_, i) => `第${i}条`)).split('\n')).toHaveLength(12);
  });
});

/** 造一个最小的 zip：够测 .docx 读取（不压缩、deflate 两种都来一份） */
function makeZip(entries: { name: string; data: Buffer; deflate?: boolean }[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const e of entries) {
    const body = e.deflate ? deflateRawSync(e.data) : e.data;
    const name = Buffer.from(e.name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(e.deflate ? 8 : 0, 8);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(e.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(e.deflate ? 8 : 0, 10);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(e.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, name, body);
    centrals.push(central, name);
    offset += 30 + name.length + body.length;
  }
  const cd = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, eocd]);
}

const DOC_XML = `<?xml version="1.0"?><w:document><w:body>
<w:p><w:r><w:t>问：店里主打什么？</w:t></w:r></w:p>
<w:p><w:r><w:t xml:space="preserve">答：鲜切牛肉&amp;吊龙</w:t></w:r><w:r><w:tab/><w:t>人均120</w:t></w:r></w:p>
<w:p><w:r><w:delText>删掉的字</w:delText></w:r><w:r><w:instrText>HYPERLINK x</w:instrText></w:r><w:r><w:t>保留</w:t></w:r></w:p>
<w:tbl><w:tr><w:tc><w:p><w:r><w:t>粉丝</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>8000</w:t></w:r></w:p></w:tc></w:tr>
<w:tr><w:tc><w:p><w:r><w:t>人均</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>120</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
</w:body></w:document>`;

describe('读上传的文档', () => {
  for (const deflate of [false, true]) {
    it(`.docx（${deflate ? '压缩' : '不压缩'}）：段落换行、表格、实体、删掉的修订都处理对`, () => {
      const zip = makeZip([
        { name: '[Content_Types].xml', data: Buffer.from('<x/>'), deflate },
        { name: 'word/document.xml', data: Buffer.from(DOC_XML), deflate },
      ]);
      const text = documentToText('前采.DOCX', zip);
      expect(text).toContain('问：店里主打什么？\n答：鲜切牛肉&吊龙\t人均120');
      expect(text).toContain('保留');
      expect(text).not.toContain('删掉的字');
      expect(text).not.toContain('HYPERLINK');
      expect(text).toContain('粉丝 | 8000\n人均 | 120'); // 表格一行一行
      expect(text).not.toMatch(/\n\n/); // 标签之间的换行缩进不算正文
    });
  }

  it('zip 里没有正文、根本不是 zip：给一句能照着做的话', () => {
    const noDoc = makeZip([{ name: 'a.txt', data: Buffer.from('x') }]);
    expect(readZipEntry(noDoc, 'word/document.xml')).toBeNull();
    expect(() => documentToText('a.docx', noDoc)).toThrow(UnsupportedDocument);
    expect(() => documentToText('a.docx', Buffer.from('not a zip at all, just text'))).toThrow(/复制文字/);
  });

  it('记事本存的 GBK 文本也能读（不按 UTF-8 硬读成乱码）', () => {
    const gbk = Buffer.from([0xc4, 0xe3, 0xba, 0xc3]); // "你好"
    expect(decodeText(gbk)).toBe('你好');
    expect(decodeText(Buffer.from('﻿你好', 'utf8'))).toBe('你好');
    expect(documentToText('记录.txt', Buffer.from('问答', 'utf8'))).toBe('问答');
  });

  it('PDF、老版 .doc、图片：明说怎么办，不给看不懂的报错', () => {
    expect(() => documentToText('a.pdf', Buffer.alloc(10))).toThrow(/粘贴/);
    expect(() => documentToText('a.doc', Buffer.alloc(10))).toThrow(/另存为 \.docx/);
    expect(() => documentToText('a.jpg', Buffer.alloc(10))).toThrow(UnsupportedDocument);
  });

  it('Word XML 单独也能转', () => {
    expect(wordXmlToText('<w:p><w:r><w:t>a</w:t></w:r><w:r><w:br/><w:t>b</w:t></w:r></w:p>')).toBe('a\nb');
  });
});

describe('接口', () => {
  const extract = readCode('app/api/interview/extract/route.ts');
  const save = readCode('app/api/interview/save/route.ts');
  const revise = readCode('app/api/interview/revise/route.ts');

  it('提取按「前采建档」查额度，只在真提取出东西后才扣', () => {
    expect(extract).toMatch(/requireUserWithQuota\('interview'\)/);
    const inc = extract.indexOf("incrementUsageServer(userId, 'interview'");
    expect(inc).toBeGreaterThan(extract.indexOf("result.fields.length === 0"));
    expect((extract.match(/incrementUsageServer\(/g) ?? []).length).toBe(1);
  });

  it('提取、修改都不接共用会话（不带 conversation_id，也不存）', () => {
    for (const src of [extract, revise, readCode('lib/dify-task.ts')]) {
      expect(src).not.toMatch(/conversation_id/);
      expect(src).not.toMatch(/saveDifyConversationId|getDifyConversationId/);
    }
  });

  it('长任务有心跳，免得链路上哪一层把连接掐掉', () => {
    const task = readCode('lib/dify-task.ts');
    expect(task).toMatch(/setInterval\(\(\) => write\(': ping\\n\\n'\)/);
    expect(task).toMatch(/X-Accel-Buffering/);
    expect(extract).toMatch(/return sseTask\(/);
    expect(revise).toMatch(/return sseTask\(/);
  });

  it('对话修改：要登录、不扣前采次数、但每人每小时有上限，一次说的话有长度上限', () => {
    expect(revise).toMatch(/requireUser\(\)/);
    expect(revise).not.toMatch(/requireUserWithQuota|incrementUsageServer/);
    expect(revise).toMatch(/if \(limited\(userId\)\)/);
    expect(revise).toMatch(/MAX_INSTRUCTION_CHARS/);
    // 发给 AI 的"现在的结果"也只收档案字段
    expect(revise).toMatch(/FIELD_KEYS\.has\(k\)/);
  });

  it('确认页挂着对话框，改完合进确认页', () => {
    const page = readCode('app/dashboard/interview/page.tsx');
    expect(page).toMatch(/<ReviseChat[\s\S]*onApply=\{onRevised\}/);
    expect(page).toMatch(/applyRevision\(extraction, drafts, rev, existing\)/);
    expect(readCode('components/interview/ReviseChat.tsx')).toMatch(/fetch\("\/api\/interview\/revise"/);
  });

  it('写入只收白名单里的列，不把请求体整个塞进库（user_id 不能被改）', () => {
    expect(save).not.toMatch(/\.\.\.body/);
    expect(save).toMatch(/FIELD_KEYS\.has\(key\)/);
    expect(save).toMatch(/user_id: userId/);
    expect(save).toMatch(/\.eq\('user_id', userId\)/);
  });

  it('迁移没跑时，档案字段照样写进去（只是原文存不下）', () => {
    expect(save).toMatch(/\/interview_\/\.test\(error\.message/);
    expect(save).toMatch(/notesSaved = false/);
  });
});

describe('历史记录', () => {
  const history = readCode('app/api/interview/history/route.ts');
  const extract = readCode('app/api/interview/extract/route.ts');
  const save = readCode('app/api/interview/save/route.ts');

  it('建表：只对 service_role 开放（开 RLS、不建任何策略）', () => {
    const sql = readCode('supabase/migrations/20260929_interview_imports.sql');
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS interview_imports/);
    expect(sql).toMatch(/ALTER TABLE interview_imports ENABLE ROW LEVEL SECURITY/);
    expect(sql).not.toMatch(/CREATE POLICY/);
    expect(sql).toMatch(/ON DELETE CASCADE/);
  });

  it('接口里每一次读、改、删都限定在自己的记录上', () => {
    const queries = history.match(/\.from\('interview_imports'\)[\s\S]*?;/g) ?? [];
    expect(queries.length).toBe(3); // 取一条、列表、删除（改走 updateImport）
    for (const q of queries) expect(q, q.slice(0, 80)).toMatch(/\.eq\('user_id', guard\.userId!\)/);
    expect(readCode('lib/interview-history.ts')).toMatch(/\.update\(row\)\.eq\('id', id\)\.eq\('user_id', userId\)/);
  });

  it('列表不带原文（可能上万字），只给提取了几项', () => {
    const list = history.slice(history.indexOf(".select('id, profile_name"));
    expect(list.slice(0, 120)).not.toMatch(/source/);
    expect(history).toMatch(/field_count/);
  });

  it('提取成功就存历史（在扣次数之后），浏览器切走了也照样存', () => {
    expect(extract.indexOf('recordImport(')).toBeGreaterThan(extract.indexOf('incrementUsageServer('));
    expect(extract).toMatch(/return \{ event: 'result', extraction: result, source, importId \}/);
  });

  it('写入档案后标上写进了哪个档案；浏览器发回来的结果重新清洗再存', () => {
    expect(save).toMatch(/updateImport\(userId, body\.importId/);
    expect(save).toMatch(/savedProfileId: data\.id/);
    expect(save).toMatch(/sanitizeExtraction\(body\.extraction\)/);
    expect(history).toMatch(/sanitizeExtraction\(body\.extraction\)/);
  });

  it('页面：输入页下面挂历史记录；对话改完存一下；点开回到确认页', () => {
    const page = readCode('app/dashboard/interview/page.tsx');
    expect(page).toMatch(/<InterviewHistory refreshKey=\{historyKey\}/);
    expect(page).toMatch(/method: "PATCH"[\s\S]{0,120}extraction: next\.extraction/);
    expect(page).toMatch(/openReview\(row\.extraction as Extraction/);
  });

  it('清洗：不认识的字段、重复的字段丢掉，值按档案类型过一遍，手机号隐去', () => {
    const clean = sanitizeExtraction({
      profileName: '阿强 13812345678',
      fields: [
        { key: 'fans_level', value: '瞎写的', evidence: 'x' },
        { key: 'equipment', value: '手机、灯光', evidence: '', byUser: true },
        { key: 'equipment', value: ['别的'] },
        { key: 'hack', value: 'x' },
        'garbage',
      ],
      highlights: ['电话 13812345678', 42],
      missing: [{ key: 'content_tone', question: '语气？' }, { key: 'equipment', question: '已填的' }],
    });
    expect(clean.fields).toEqual([{ key: 'equipment', value: ['手机', '灯光'], evidence: '', unverified: false, byUser: true }]);
    expect(JSON.stringify(clean)).not.toContain('13812345678');
    expect(clean.missing.map((m) => m.key)).toEqual(['content_tone']);
    expect(sanitizeExtraction(null)).toEqual({ profileName: '', fields: [], highlights: [], missing: [] });
  });
});

describe('接到全站', () => {
  it('单独一项额度：免费 3 次，会员和其他创作功能一样', () => {
    const f = COUNTED_FEATURES.find((x) => x.key === 'interview');
    expect(f?.column).toBe('interview_used');
    expect(SUBSCRIPTION_PLANS.free.quotas.interview).toBe(3);
    expect(SUBSCRIPTION_PLANS.basic.quotas.interview).toBe(SUBSCRIPTION_PLANS.basic.quotas.script);
    expect(SUBSCRIPTION_PLANS.pro.quotas.interview).toBe(SUBSCRIPTION_PLANS.pro.quotas.script);
    expect(SUBSCRIPTION_PLANS.enterprise.quotas.interview).toBe(-1);
  });

  it('迁移把两张表要的列都加上了', () => {
    const sql = readCode('supabase/migrations/20260929_interview_import.sql');
    for (const col of ['interview_used', 'interview_notes', 'interview_highlights']) expect(sql).toContain(`add column if not exists ${col}`);
  });

  it('前采要点进定位的提示词', () => {
    expect(PROFILE_SUMMARY_FIELDS.map(([k]) => k)).toContain('interview_highlights');
  });

  it('新建、编辑档案页都有入口；编辑页能看到、能删前采资料', () => {
    expect(readCode('app/dashboard/profiles/new/page.tsx')).toContain('<InterviewEntry />');
    const edit = readCode('app/dashboard/profiles/[id]/edit/page.tsx');
    expect(edit).toContain('<InterviewEntry profileId={id} />');
    expect(edit).toContain('<InterviewNotesCard');
    expect(readCode('components/interview/InterviewEntry.tsx')).toMatch(/interview_notes: null, interview_highlights: null/);
  });

  it('写完直接去做定位：先切到这份档案再跳', () => {
    const page = readCode('app/dashboard/interview/page.tsx');
    expect(page).toMatch(/setActiveProfileId\(saved\.id\);\s*router\.push\("\/dashboard\/positioning"\)/);
  });
});
