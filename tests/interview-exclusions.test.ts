/**
 * 建档时"刻意没选"的信息不能再被引用（2026-10-02 产品方：前采录音转文字，有些信息没用，建档时没选，
 * 可账号定位、商业定位、内容定位、创作简报还是引用了，打乱方向）。
 * 用线上「万客隆家具城」那次建档的形状做样本：勾掉了公益、直播、抽奖那几条要点，可别的栏里还残留着
 */
import { describe, it, expect } from 'vitest';
import { exclusionsOf, residualMentions, dropSegment, segmentsOf, scrubProfile } from '@/lib/interview-exclusions';
import { buildProfileSummary } from '@/lib/profile-summary';
import { ISOLATED_TASKS } from '@/lib/topic-library';
import { taboosPromptBlock, readTabooSettings } from '@/lib/taboos';
import { buildContextBlock } from '@/lib/creator-context';
import { buildPositioningPrompt } from '@/lib/positioning-standards';
import type { Extraction } from '@/lib/interview-import';
import { readCode } from './helpers/source';

const ex = {
  profileName: '万客隆家具城·李国才',
  checked: true,
  missing: [],
  highlights: [
    '李国才河南师范大学毕业，郑州当教师5年后回南乐与哥哥合伙经营',
    '公益营销真实意愿强：愿意真送米面油、床给贫困户，可联系村书记对接',
    '直播规划：先把自然流做大再开播，蓝V认证后挂小房子小风车，李国才本人出镜主播',
  ],
  fields: [
    { key: 'content_themes', value: '公益好事（送温暖给老人贫困户），热点事件蹭点，产品细节展示', evidence: '', unverified: false },
    { key: 'unique_resources', value: '自有门店6000平、本地村书记人脉可对接贫困户、有合伙人和员工可配合出镜', evidence: '', unverified: false },
    { key: 'conversion_path', value: '看视频 → 私信 → 到店看货、中长期：看视频 → 进直播间 → 挂小房子小风车咨询 → 到店', evidence: '', unverified: false },
    { key: 'monetization_model', value: ['到店消费', '直播打赏', '线下服务'], evidence: '', unverified: false },
    { key: 'product_category', value: ['新中式家具', '办公家具'], evidence: '', unverified: false },
    { key: 'budget_per_video', value: '0-500元', evidence: '', unverified: false },
  ],
} as unknown as Extraction;

const show = (v: unknown) => (Array.isArray(v) ? v.join('、') : String(v));
const drafts = () => Object.fromEntries(ex.fields.map((f) => [f.key, { include: true, mode: 'new', text: show(f.value) }]));

describe('算出没选的', () => {
  it('没勾的要点、多选里删掉的项、整栏没写的都算；整个换掉的不算（那是改对了）', () => {
    const d = drafts();
    d.monetization_model.text = '到店消费、线下服务';
    d.product_category.text = '生活用品'; // 整个换掉
    d.budget_per_video.include = false;
    const out = exclusionsOf(ex, d, [true, false, false]);
    expect(out).toContain(ex.highlights[1]);
    expect(out).toContain(ex.highlights[2]);
    expect(out).not.toContain(ex.highlights[0]);
    expect(out).toContain('变现方式里的：直播打赏');
    expect(out.some((x) => x.includes('新中式家具'))).toBe(false);
    expect(out.some((x) => x.startsWith('单条预算'))).toBe(true);
  });

  it('文字栏删掉了其中一句：删掉的那句算', () => {
    const d = drafts();
    d.content_themes.text = '热点事件蹭点，产品细节展示';
    expect(exclusionsOf(ex, d, [true, true, true])).toContain('主要选题方向里的：公益好事（送温暖给老人贫困户）');
  });

  it('什么都没动：清单是空的', () => {
    expect(exclusionsOf(ex, drafts(), [true, true, true])).toEqual([]);
  });
});

describe('找出别的栏里的残留', () => {
  const excluded = [ex.highlights[1], ex.highlights[2]];

  it('勾掉了公益、直播：选题方向、独特资源、成交路径里相关的那几句都找得到', () => {
    const r = residualMentions(ex, drafts(), excluded, ex.profileName);
    const segs = r.map((x) => x.segment);
    expect(segs).toContain('公益好事（送温暖给老人贫困户）');
    expect(segs).toContain('本地村书记人脉可对接贫困户');
    expect(segs).toContain('中长期：看视频 → 进直播间 → 挂小房子小风车咨询 → 到店');
    // 没关系的句子不标
    expect(segs).not.toContain('自有门店6000平');
    expect(segs).not.toContain('看视频 → 私信 → 到店看货');
  });

  it('店名、人名这种到处都有的字不算撞上（不然每一栏都被标出来）', () => {
    const r = residualMentions(ex, drafts(), excluded, ex.profileName);
    expect(r.every((x) => !['李国才', '万客隆'].includes(x.shared))).toBe(true);
  });

  it('手动写的短词（「公益」「不提直播相关的事」）也认得出', () => {
    const r = residualMentions(ex, drafts(), ['公益', '不提直播相关的事'], ex.profileName).map((x) => x.segment);
    expect(r).toContain('公益好事（送温暖给老人贫困户）');
    expect(r).toContain('中长期：看视频 → 进直播间 → 挂小房子小风车咨询 → 到店');
  });

  it('一键去掉那一句，其余保留；括号里的顿号不切', () => {
    expect(dropSegment('自有门店6000平、本地村书记人脉可对接贫困户、有合伙人', '本地村书记人脉可对接贫困户')).toBe('自有门店6000平、有合伙人');
    expect(segmentsOf('公益类（给老人理发、送米）、热点类')).toEqual(['公益类（给老人理发、送米）', '热点类']);
  });
});

describe('交给 AI 之前就从档案里拿掉', () => {
  /*
   * 2026-10-02 实测：只在提示词里说"请忽略"，方向对了，但档案爆款基因里还写着"公益类 10-20 万、抽奖近 30 万"，
   * 账号定位照样写"之前靠公益抽奖拿过流量"。所以拼提示词之前就把相关的句子拿掉
   */
  const profile = {
    id: 'p', profile_name: '万客隆家具城·李国才', account_track: ['家居装修'],
    viral_content_pattern: '公益类（给老人理发10-20万播放）、热点蹭点类（送床被狗咬）、抽奖福利类（幸运车牌号抽奖近30万播放）',
    unique_resources: '自有门店6000平、本地村书记人脉可对接贫困户、有合伙人和员工可配合出镜',
    conversion_path: '看视频 → 私信 → 到店看货、中长期：看视频 → 进直播间 → 挂小房子小风车咨询 → 到店',
    interview_highlights: '李国才河南师范大学毕业，当教师5年\n公益营销真实意愿强：愿意给贫困户送米面油',
    taboo_settings: { excluded: [
      '爆款案例：幸运车牌号抽奖视频跑了近30万播放，给老人理发公益视频10-20万播放',
      '公益营销真实意愿强：愿意真送米面油、床给贫困户，可联系村书记对接',
      '直播规划：先把自然流做大再开播，蓝V认证后挂小房子小风车',
    ] },
  };

  it('档案摘要（定位、深挖、方向、二创、拆解都用它）：相关的句子没了，其余保留', () => {
    const s = buildProfileSummary(profile);
    for (const w of ['公益', '抽奖', '贫困户', '村书记', '直播', '小房子']) expect(s, w).not.toContain(w);
    expect(s).toContain('热点蹭点类（送床被狗咬）');
    expect(s).toContain('自有门店6000平');
    expect(s).toContain('看视频 → 私信 → 到店看货');
    expect(s).toContain('李国才河南师范大学毕业');
  });

  it('各板块的账号背景也一样（排除清单那一段本身要列出来，告诉 AI 忽略什么——只查它前面的档案部分）', () => {
    const b = buildContextBlock({ profile, positioning: null, dealReasons: [] }, 'freeChat');
    const profilePart = b.slice(0, b.indexOf('刻意去掉的信息'));
    expect(profilePart.length).toBeGreaterThan(50);
    expect(profilePart).not.toMatch(/村书记|小房子|车牌号/);
  });

  it('库里的档案不动：只改交给 AI 的那份拷贝', () => {
    const copy = scrubProfile(profile, profile.taboo_settings.excluded)!;
    expect(copy).not.toBe(profile);
    expect(profile.unique_resources).toContain('村书记');
    expect(copy.unique_resources).not.toContain('村书记');
  });

  it('没有排除清单：原样返回', () => {
    expect(scrubProfile(profile, [])).toBe(profile);
  });
});

describe('排除清单进提示词', () => {
  const profile = { id: 'p', profile_name: '万客隆', account_track: ['家居装修'], taboo_settings: { excluded: ['公益营销：愿意给贫困户送东西', '变现方式里的：直播打赏'] } };

  it('写明当它不存在，档案别的栏、已有定位里的残留也忽略', () => {
    const b = taboosPromptBlock(profile);
    expect(b).toContain('建档时编导刻意去掉的信息——当它不存在');
    expect(b).toContain('变现方式里的：直播打赏');
    expect(b).toMatch(/不引用、不当依据、不据此推断/);
    expect(b).toMatch(/已有的定位或简报里如果还残留相关说法，\*\*同样忽略\*\*/);
  });

  it('账号定位、各板块都拿得到', () => {
    expect(buildPositioningPrompt({ profileSummary: '- 档案名称：万客隆', taboos: taboosPromptBlock(profile) })).toContain('刻意去掉的信息');
    expect(buildContextBlock({ profile, positioning: null, dealReasons: [] }, 'script')).toContain('刻意去掉的信息');
  });

  it('没有排除清单就不加这一段', () => {
    expect(taboosPromptBlock({ account_track: ['家居装修'] })).not.toContain('刻意去掉');
  });

  it('库里的排除清单读得出来，乱写的丢掉', () => {
    expect(readTabooSettings({ excluded: ['a', '', 3, ' b '] }).excluded).toEqual(['a', 'b']);
  });
});

describe('定位类生成不接共用会话', () => {
  it('账号 / 商业 / 内容定位和创作简报都隔开：会话里聊过的被排除内容带不回来', () => {
    for (const t of ['账号定位', '商业定位', '内容定位', '创作简报']) expect(ISOLATED_TASKS.has(t), t).toBe(true);
  });
});

describe('页面接线', () => {
  it('确认页：列出没选的、找出残留、能一键去掉；写入时带上排除清单', () => {
    const page = readCode('app/dashboard/interview/page.tsx');
    expect(page).toMatch(/exclusionsOf\(extraction, drafts, highlightOn\)/);
    expect(page).toMatch(/residualMentions\(/);
    expect(page).toContain('去掉这句');
    expect(page).toMatch(/notes: keepNotes \? source : "",\s*excluded,/);
  });

  it('写入接口把排除清单合并进 taboo_settings，不冲掉原来的禁忌设置', () => {
    const route = readCode('app/api/interview/save/route.ts');
    expect(route).toMatch(/interview\.taboo_settings = \{ \.\.\.prev, excluded: /);
    expect(route).toMatch(/interview_\|taboo_settings/);
  });

  it('档案的禁忌区能看到、恢复、手动加排除项', () => {
    const editor = readCode('components/profile/TabooEditor.tsx');
    expect(editor).toContain('排除清单（当它不存在）');
    expect(editor).toContain('恢复');
  });
});
