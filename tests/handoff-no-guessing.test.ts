/**
 * 跳转时自动填写：只填原内容写明的和档案里有的，不猜、不塞占位话（2026-10-03 产品方体检：
 * "各个板块的生成结果跳转到其他板块时，系统自动接管填写的信息必须准确，不能乱填，必须按照原来的内容填写"）。
 * 每条用例都来自线上真实记录
 */
import { describe, it, expect } from 'vitest';
import { buildCreationHandoff } from '@/lib/creation-flow';
import { resolveCreationSettings, mergeCreationSettings, purposeOf, cleanTitle, creationSettingsBlock } from '@/lib/creation-settings';
import type { CreatorContext } from '@/lib/creator-context';
import { readCode } from './helpers/source';

const ctx: CreatorContext = {
  profile: { id: 'p', account_platform: ['抖音'], account_track: ['美食烹饪', '本地服务'], target_age: ['18-24岁', '25-30岁'], content_tone: '亲切朋友式', video_duration: ['30-60秒'] },
  positioning: null,
  dealReasons: [],
};

describe('从创作方向勾一条去选题（线上：主题带着「方向1：」，内容方向和主题一模一样，目的四次填出三种）', () => {
  const item = `### 方向1：师傅看不见的坚持（把"顾客第一"拍成凌晨的动作）
- **对应目的**：立人设、让人有情绪、建立信任
- **核心思路**：拍师傅收摊后一个人做的那些客人看不见的事
- **拍什么**：凌晨备料、熬锅底
- **为什么能达到目的**：细节比口号更让人信`;

  it('主题去掉编号；内容方向用「核心思路」；目的按「对应目的」那一行判成人设型', () => {
    const s = resolveCreationSettings(buildCreationHandoff('direction', 'topic', item, { title: '方向1：师傅看不见的坚持（把"顾客第一"拍成凌晨的动作）' }), ctx);
    expect(s.topic).toBe('师傅看不见的坚持（把"顾客第一"拍成凌晨的动作）');
    expect(s.direction).toBe('拍师傅收摊后一个人做的那些客人看不见的事');
    expect(s.purpose).toBe('人设型');
  });

  it('同一条跳多少次都一样', () => {
    const runs = Array.from({ length: 4 }, () => resolveCreationSettings(buildCreationHandoff('direction', 'topic', item, { title: '方向1：师傅看不见的坚持' }), ctx).purpose);
    expect(new Set(runs).size).toBe(1);
  });
});

describe('从一批选题里挑一条：不能拿到第 1 条的设置（串条）', () => {
  const batch = `# 5条爆款选题
## 选题1：南方人和北方人买家具的区别
**0️⃣ 视频目的**
流量型 — 地域话题
## 选题2：当了5年老师转行卖家具
**0️⃣ 视频目的**
人设型 — 讲经历
## 选题3：3万块能配齐全屋家具吗`;

  it('挑的这条没写目的：留空，不读整批里第 1 条的「流量型」', () => {
    const data = { from: '选题策划', sourceContent: '## 选题3：3万块能配齐全屋家具吗\n今天实拍给你们看', originContent: batch, sourceTitle: '选题3：3万块能配齐全屋家具吗' };
    const s = resolveCreationSettings(data, ctx);
    expect(s.purpose).toBeUndefined();
    expect(s.topic).toBe('3万块能配齐全屋家具吗');
  });

  it('挑的这条写了目的：用它自己的', () => {
    const data = { from: '选题策划', sourceContent: '## 选题2：当了5年老师转行卖家具\n**0️⃣ 视频目的**\n人设型 — 讲经历', originContent: batch };
    expect(resolveCreationSettings(data, ctx).purpose).toBe('人设型');
  });
});

describe('从自由对话跳过来（线上：主题被填成编导的提问）', () => {
  it('问句、整批的总标题不当主题', () => {
    const s = resolveCreationSettings({ from: '高阶自由对话', sourceContent: '# 根据南乐县本地热点创作的5个选题\n……', sourceTitle: '根据南乐县本地最近一周的热点新闻 结合我的信息 帮我创作5个我能用的爆款选题' }, ctx);
    expect(s.topic).toBeUndefined();
  });
});

describe('不按关键词猜', () => {
  it('正文里有"私信""团购"、没写目的：目的留空（原来判成变现型）', () => {
    expect(resolveCreationSettings({ from: 'x', sourceContent: '想吃的私信我，团购链接在左下角' }, ctx).purpose).toBeUndefined();
  });

  it('"宝宝们"这种称呼不把人群改成育儿父母、行业改成育儿教育；人群行业用档案的', () => {
    const s = resolveCreationSettings({ from: 'x', sourceContent: '宝宝们，今天这锅底我熬了六个小时' }, ctx);
    expect(s.audience).toBe('18-24岁、25-30岁');
    expect(s.industry).toBe('美食烹饪、本地服务');
  });

  it('不替他选脚本类型、结构、钩子、爆款元素、开篇卡', () => {
    const s = resolveCreationSettings({ from: 'x', sourceContent: '第一步先切肉，第二步穿串，教你三个技巧' }, ctx);
    for (const k of ['scriptType', 'structure', 'hookType', 'elements', 'contentType', 'titleType'] as const) expect(s[k], k).toBeUndefined();
    expect(s.openingCards).toEqual([]);
  });

  it('连续设置里不出现猜出来的东西（原来会写成"不得擅自更换"）', () => {
    const block = creationSettingsBlock(resolveCreationSettings({ from: 'x', sourceContent: '想吃的私信我' }, ctx));
    expect(block).not.toMatch(/视频目的|脚本类型|脚本结构/);
  });
});

describe('占位话不再生成，历史里存着的也丢掉', () => {
  it('旧历史带着占位话跳过来：不当成内容方向、主题、人群', () => {
    const s = mergeCreationSettings({ topic: '基于已有内容继续创作', direction: '保留原稿核心观点与创意，完成下一环节', audience: '对这条内容主题有实际需求的人群', scene: '实际经营或工作场景' });
    expect(s).toEqual({});
  });

  it('resolve 自己也不再产出占位话', () => {
    const s = resolveCreationSettings({ from: 'x', sourceContent: '' }, { profile: null, positioning: null, dealReasons: [] });
    expect(JSON.stringify(s)).not.toMatch(/保留原稿|基于已有内容|有实际需求的人群|实际经营或工作场景|知识分享/);
  });
});

describe('目的那一行怎么认', () => {
  it.each([
    ['流量型 — 地域话题', '流量型'],
    ['立人设、让人有情绪、建立信任', '人设型'],
    ['引流到店、卖团购', '变现型'],
    ['涨粉曝光', '流量型'],
    // 写了好几种就不替他挑（线上创作方向常见：一条方向列四五个目的）
    ['先涨粉，再引流到店', undefined],
    ['口碑、建立信任、涨粉曝光', undefined],
    ['让人有情绪', undefined],
  ])('%s → %s', (line, want) => expect(purposeOf(line)).toBe(want));

  it('问句标题照样是主题（"……你们发现了吗?"）；"帮我……"这种提问不是', () => {
    const s = resolveCreationSettings({ from: '选题策划', sourceContent: '## 选题1：南方人买家具和北方人买家具的区别，你们发现了吗?\n正文', sourceTitle: '南方人买家具和北方人买家具的区别，你们发现了吗?' }, ctx);
    expect(s.topic).toBe('南方人买家具和北方人买家具的区别，你们发现了吗?');
  });

  it('编号清理', () => {
    expect(cleanTitle('方向1：师傅的坚持')).toBe('师傅的坚持');
    expect(cleanTitle('## 选题3：3万块')).toBe('3万块');
    expect(cleanTitle('第1条:成都串串火锅 — Vlog配音版')).toBe('成都串串火锅 — Vlog配音版');
    expect(cleanTitle('一元火锅怎么吃')).toBe('一元火锅怎么吃');
  });
});

describe('页面：没写的保持默认，不填占位话', () => {
  it('选题页：目的默认按配比，个人要求只填写明的方向', () => {
    const src = readCode('app/dashboard/topic/page.tsx');
    expect(src).toMatch(/setTopicRole\(s\.purpose \?\? '按配比'\)/);
    expect(src).toMatch(/setPersonalRequirement\(s\.direction \?\? ''\)/);
    expect(src).not.toMatch(/\|\| '聊观点型'\]\)/);
  });

  it('脚本页：目的「自动」、结构和钩子「auto」', () => {
    const src = readCode('app/dashboard/script/page.tsx');
    expect(src).toMatch(/setScriptRole\(s\.purpose \?\? '自动'\)/);
    expect(src).toMatch(/setScriptStructure\(s\.structure \?\? 'auto'\)/);
    expect(src).toMatch(/setHookType\(s\.hookType \?\? 'auto'\)/);
  });

  it('审稿页不替编导勾优化目标；二创页补充说明不塞占位话', () => {
    expect(readCode('app/dashboard/review/page.tsx')).not.toMatch(/setOptimizationGoals\(\['提升开头吸引力', '优化口播节奏'\]\)/);
    expect(readCode('app/dashboard/remix/page.tsx')).toMatch(/setNotes\(s\.notes \|\| ''\)/);
    expect(readCode('lib/creation-settings.ts')).not.toMatch(/inferType\(/);
  });
});
