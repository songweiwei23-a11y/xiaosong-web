import { describe, expect, it } from 'vitest';
import { buildCreationHandoff, CREATION_DESTINATIONS } from '@/lib/creation-flow';
import { creationReference } from '@/lib/creation-continuation';
import { resolveCreationSettings, settingsFromText, settingsFromInput, settingsForResult, creationSettingsBlock, scriptReasonIds, topicReasonIds, type CreationSettings } from '@/lib/creation-settings';
import { buildTextBreakdownPrompt } from '@/lib/text-breakdown';
import { remixHistoryForm } from '@/lib/creative-history-form';
import { sanitizeMessages } from '@/lib/chat-message-utils';
import { extractOpening } from '@/lib/handoff';
import { workCreationHandoff } from '@/lib/creation-work-resume';
import type { CreatorContext } from '@/lib/creator-context';

const ctx: CreatorContext = { profile: { id: 'a', account_platform: ['抖音'], account_track: ['美食烹饪'], target_age: ['18-35岁'], content_tone: '亲切', video_duration: ['60秒'] }, positioning: null, dealReasons: ['质量好'] };
const chosen: CreationSettings = {
  topic: '牛肉怎么切', direction: '用真实备菜过程解释鲜切工序', audience: '关心食材的本地年轻顾客', industry: '美食烹饪',
  scriptType: 'show', structure: 'train', purpose: '变现型', platform: '视频号', duration: '37秒', style: '亲切接地气',
  openingLine: '今天这串牛肉，我切给你看。', openingCards: ['直接说具体的事'], tactic: '过程展示',
  elements: ['cost', 'contrast'], dealReasons: ['quality', 'value'], notes: '不得添加未核实的销量和具体串数',
};
const original = '今天这串牛肉，我切给你看。每天到店后先检查纹路，再顺纹路分块，切成适合穿串的大小。数量是X串，待核实。';

it('旧历史的自动时长不会覆盖优化稿的80秒，明确用户时长仍优先', () => {
  const result = '**建议时长：80秒**\n优化稿正文';
  const automatic = settingsForResult(result, [{ result, input_data: { duration: 'AI 按内容判断' } }], {});
  expect(automatic.duration).toBe('80秒');
  const explicit = settingsForResult(result, [{ result, input_data: { duration: '45秒' } }], {});
  expect(explicit.duration).toBe('45秒');
  const restored = resolveCreationSettings({ from: '审稿优化', sourceContent: result, settings: { duration: 'AI 推荐' } }, ctx);
  expect(restored.duration).toBe('80秒');
});

describe('全部内容板块一键承接设置', () => {
  it.each(['script','review','storyboard','title','growth'] as const)('作品直接打开 %s 也恢复原方向与精确时长', target => {
    const setup = workCreationHandoff({ id:'work', title:chosen.topic!, profile_id:'a', is_done:false, items:[
      {id:'script',task_type:'脚本生成',created_at:'2026-10-01T01:00:00Z',result:'# 纯文字文案\n'+original,input_data:{creationSettings:chosen,originContent:original}},
      {id:'title',task_type:'标题封面',created_at:'2026-10-01T02:00:00Z',result:'标题：这串牛肉怎么切',input_data:{creationSettings:chosen}},
    ] }, target);
    expect(resolveCreationSettings(setup,ctx)).toMatchObject({duration:'37秒',audience:chosen.audience,structure:'train',purpose:chosen.purpose,direction:chosen.direction});
    expect(creationReference(setup)).toContain(original);
    expect(setup.profileId).toBe('a');
    if (['review','storyboard'].includes(target)) expect(setup.scriptContent).toBe(original);
    if (target === 'growth') expect(setup.currentOpening).toBe(chosen.openingLine);
  });
  const routes = CREATION_DESTINATIONS.flatMap(source => CREATION_DESTINATIONS.filter(target => target.id !== source.id).map(target => [source.id, target.id] as const));
  it.each(routes)('%s → %s 不丢失方向、人群、结构、开头或时长', (source, target) => {
    const data = buildCreationHandoff(source, target, original, { settings: chosen, originContent: original });
    const settings = resolveCreationSettings(data, ctx);
    for (const key of ['topic','direction','audience','industry','scriptType','structure','purpose','platform','duration','style','openingLine','tactic','notes'] as const) expect(settings[key]).toBe(chosen[key]);
    expect(settings.openingCards).toEqual(chosen.openingCards);
    expect(settings.dealReasons).toEqual(['质量好','性价比']);
    expect(data.sourceContent).toBe(original);
    expect(settings.topic).toBeTruthy();
    if (['review','storyboard'].includes(target)) expect(data.scriptContent).toBeTruthy();
    if (target === 'script') expect(data.note).toContain('X串');
    if (target === 'remix') expect(data.remixSource?.text).toBeTruthy();
  });
  it('审稿 → 开篇 → 脚本 → 标题 → 分镜长期承接；本轮选中的开头最高优先', () => {
    const review = buildCreationHandoff('review','growth','### 优化后的完整脚本\n' + original, { originContent: original, settings: chosen });
    const inherited = resolveCreationSettings(review,ctx);
    const nextOpening = '这串牛肉怎么切，今天直接看过程。';
    const script = buildCreationHandoff('growth','script',nextOpening, { originContent: original, settings: inherited });
    script.openingLine = nextOpening;
    const scriptSettings = resolveCreationSettings(script,ctx);
    expect(scriptSettings.openingLine).toBe(nextOpening);
    expect(scriptSettings.structure).toBe('train');
    const stored = { result: '新的完整脚本', input_data: { creationSettings: scriptSettings, originContent: original } };
    const restored = settingsForResult(stored.result,[stored],{ audience: '正在编辑的别人的人群' });
    const title = buildCreationHandoff('script','title',stored.result,{settings:restored,originContent:original});
    const shots = buildCreationHandoff('title','storyboard','## 标题：切给你看',{settings:resolveCreationSettings(title,ctx),originContent:title.originContent});
    expect(resolveCreationSettings(shots,ctx)).toMatchObject({audience:chosen.audience, structure:'train', duration:'37秒', openingLine:nextOpening});
    expect(creationReference(shots)).toContain('X串');
  });
  it('粘贴的旧稿能恢复明确标注的意图，不用默认值覆盖', () => {
    const body = '【视频目的】人设型\n脚本类型：讲故事型\n脚本结构：故事型\n目标人群：年轻创业者\n创作方向：真实创业经历\n视频时长：45秒\n发布平台：小红书\n内容风格：朴实\n正文：那年第一次开店，遇到了困难。';
    const result = resolveCreationSettings({from:'审稿',sourceContent:body},ctx);
    expect(result).toMatchObject({purpose:'人设型',scriptType:'story',structure:'story',audience:'年轻创业者',direction:'真实创业经历',duration:'45秒',platform:'小红书',style:'朴实'});
    // 没写开篇卡就不替他选（2026-10-03：跳转时不猜）
    expect(result.openingCards).toEqual([]);
  });
  it('没有参数标签的文案：不按关键词猜类型、结构、育儿人群；行业人群用档案的', () => {
    const s = resolveCreationSettings({from:'审稿',sourceContent:'新手妈妈第一次带娃别着急，教你三个方法。第一步，先观察宝宝的日常作息。'},ctx);
    expect(s).toMatchObject({industry:'美食烹饪',audience:'18-35岁'});
    expect(s.scriptType).toBeUndefined();
    expect(s.structure).toBeUndefined();
    expect(s.purpose).toBeUndefined();
  });
  it('来源正文无参数标签时保留已选卡；生成文字不能覆盖用户明确选择', () => {
    const payload = buildCreationHandoff('script','review','脚本类型：讲故事型\n目标人群：通用观众',{settings:chosen});
    expect(resolveCreationSettings(payload,ctx)).toMatchObject({scriptType:'show',audience:chosen.audience,openingCards:chosen.openingCards});
    expect(settingsFromText('只有正文')).not.toHaveProperty('openingCards');
  });
  it('审好的完整正文经开篇和标题后仍可拆分镜，开头替换而不是丢掉整稿', () => {
    const review = buildCreationHandoff('review','growth','### 优化后的完整脚本\n原来的开头。每天到店后检查纹路，再切成穿串大小。',{settings:chosen,originContent:original});
    const title = buildCreationHandoff('growth','title','只有新开头',{settings:{...resolveCreationSettings(review,ctx),openingLine:'新开头，看切法。'},originContent:original});
    const shots = buildCreationHandoff('title','storyboard','### 标题\n牛肉的切法',{settings:resolveCreationSettings(title,ctx),originContent:original});
    expect(shots.scriptContent).toContain('每天到店后检查纹路');
    expect(shots.scriptContent).toMatch(/^新开头，看切法。/);
    expect(shots.scriptContent).not.toContain('原来的开头');
    expect(creationReference(shots)).toContain('本条内容当前的完整脚本');
  });
  it('审稿含元信息时开篇输入的是台词，不是主题、时长或 Markdown 星号', () => {
    const draft = '**【视频主题】** 牛肉\n**【脚本类型】** 晒过程型\n**【时长】** 37秒\n### 镜头1\n- **台词**："今天这串牛肉，我切给你看。"\n- **画面**：切肉';
    expect(extractOpening(draft)).toBe('今天这串牛肉，我切给你看。');
    const handed = buildCreationHandoff('growth','storyboard','新开头',{settings:{...chosen,openingLine:'新开头，看切法。',workingScript:draft}});
    expect(handed.scriptContent).toContain('- **台词**：“新开头，看切法。”');
    expect(handed.scriptContent).not.toContain('今天这串牛肉，我切给你看。');
  });
  it('脚本模型没有单列纯文字文案时也自动提取台词，策略卡和拍摄建议留在参考中', () => {
    const body = '# 脚本策略卡\n人设型，37秒\n### 镜头1\n- **台词**："先看牛肉纹路。"\n- **画面**：特写\n### 镜头2\n- **台词**："分块，再切成穿串大小。"\n### 结尾\n- **台词外音**："看看今天怎么备菜。"\n## 优化建议\n补拍手部画面';
    const data = buildCreationHandoff('script','storyboard',body,{settings:chosen});
    expect(data.scriptContent).toBe('先看牛肉纹路。\n分块，再切成穿串大小。\n看看今天怎么备菜。');
    expect(data.sourceContent).toContain('补拍手部画面');
  });
  it('二创方案的 AI 标签不能覆盖用户已明确选择的类型、结构和人群', () => {
    const payload = buildCreationHandoff('remix','script','### 方案2\n脚本类型：讲故事型\n脚本结构：故事型\n目标人群：新店创业者\n口播乙',{settings:chosen});
    expect(resolveCreationSettings(payload,ctx)).toMatchObject({scriptType:chosen.scriptType,structure:chosen.structure,audience:chosen.audience});
  });
  it('旧历史参数和新历史设置都能恢复，历史甲不使用正在编辑乙的设置', () => {
    expect(settingsFromInput({scriptType:'晒过程型',platform:'快手',duration:'30秒',scriptStructure:'train',scriptRole:'变现型'})).toMatchObject({scriptType:'show',structure:'train',purpose:'变现型'});
    expect(settingsForResult('甲',[{result:'甲',input_data:{creationSettings:chosen}}],{audience:'乙'}).audience).toBe(chosen.audience);
    expect(settingsForResult('无设置旧稿',[{result:'无设置旧稿'}],chosen)).toEqual({});
    expect(remixHistoryForm({duration:'37秒'}).duration).toBe('37秒');
  });
  it('缺失或非法选项不乱补，并保留精确时长范围', () => {
    const result = resolveCreationSettings({from:'旧稿',sourceContent:'备菜过程',settings:{scriptType:'不存在',structure:'auto',duration:'跟原片',openingCards:['不存在的卡']}},ctx);
    // 非法的丢掉，不再按「备菜过程」猜成晒过程 / 火车节；时长没写明就空着（=AI 推荐），不再拿档案常拍时长或 60 秒顶上（2026-10-06）
    expect(result.duration).toBeUndefined();
    expect(result.scriptType).toBeUndefined();
    expect(result.structure).toBeUndefined();
    expect(result.openingCards).toEqual([]);
    expect(resolveCreationSettings({from:'旧稿',settings:{duration:'3至5分钟'}},ctx).duration).toBe('3-5分钟');
  });
  it('成交理由跨页面 ID 可以转换；提示词实际承接而非只在页面展示', () => {
    expect(scriptReasonIds(['质量好','性价比'])).toEqual(['quality','price']);
    expect(topicReasonIds(['quality','price'])).toEqual(['quality','value']);
    const block = creationSettingsBlock(chosen);
    for (const value of [chosen.direction, chosen.audience, chosen.openingLine, chosen.notes, '火车节','37秒']) expect(block).toContain(value);
    expect(settingsFromText(block)).toMatchObject({scriptType:'show',structure:'train',audience:chosen.audience,openingLine:chosen.openingLine,openingCards:chosen.openingCards});
    const prompt = buildTextBreakdownPrompt(original,'档案背景',chosen);
    expect(prompt).toContain('纯文字，没有附带视频或音频');
    expect(prompt).toContain('不能编造镜头');
    expect(prompt).toContain(chosen.audience);
    expect(sanitizeMessages([{role:'user',content:'原稿',timestamp:1,creationSettings:chosen}])[0].creationSettings).toEqual(chosen);
  });
});
