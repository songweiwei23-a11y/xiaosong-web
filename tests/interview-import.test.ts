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
  MAX_STORED_NOTES,
} from '@/lib/interview-import';
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

  it('提取按「前采建档」查额度，只在真提取出东西后才扣', () => {
    expect(extract).toMatch(/requireUserWithQuota\('interview'\)/);
    const inc = extract.indexOf("incrementUsageServer(userId, 'interview'");
    expect(inc).toBeGreaterThan(extract.indexOf("result.fields.length === 0"));
    expect((extract.match(/incrementUsageServer\(/g) ?? []).length).toBe(1);
  });

  it('提取不接共用会话（不带 conversation_id，也不存）', () => {
    expect(extract).not.toMatch(/conversation_id/);
    expect(extract).not.toMatch(/saveDifyConversationId|getDifyConversationId/);
  });

  it('长任务有心跳，免得链路上哪一层把连接掐掉', () => {
    expect(extract).toMatch(/setInterval\(\(\) => write\(': ping\\n\\n'\)/);
    expect(extract).toMatch(/X-Accel-Buffering/);
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
