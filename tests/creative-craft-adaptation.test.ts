import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import ts from 'typescript';
import { buildAdaptiveScriptPrompt, regenerationPrompt } from '@/lib/script-design';
import { buildReviewPrompt } from '@/lib/review-standards';
import { buildStoryboardPrompt, FOLLOW_SCRIPT } from '@/lib/storyboard-standards';
import { buildTitlePrompt } from '@/lib/title-standards';
import { buildDirectionPrompt } from '@/lib/direction';
import { buildOpeningPrompt } from '@/lib/growth-standards';
import { evaluateScriptQualityStrict } from '@/lib/quality-checker';
import { roleInferRule } from '@/lib/content-roles';
import { creativeCraftRules } from '@/lib/creative-craft';
import { creationSettingsBlock } from '@/lib/creation-settings';
import { resolveCreationSettings } from '@/lib/creation-settings';

const goal = '国庆前后门店生意对比，问每家老板的真实感受。不卖课、不引导私信，尚未采访，没有已知答案。';
const settings = { userIntent: goal, focusContent: goal, purpose: '流量型' as const, audience: '实体店老板', openingLine: '国庆前后，这条街上的生意到底有什么变化？' };
export function actualAutomaticScriptQuery(requirements = goal) {
  const page = fs.readFileSync('app/dashboard/script/page.tsx', 'utf8');
  const start = page.indexOf('const query = (autoScriptType || !isAd) ?');
  const end = page.indexOf('const response = await fetchGeneration', start);
  if (start < 0 || end < 0) throw new Error('Actual page prompt branch not found');
  const code = ts.transpileModule(`function build(){${page.slice(start, end)}return query;}`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  const scope = { autoScriptType: true, buildAdaptiveScriptPrompt, topic: '门店节前节后对比', platform: '抖音',
    isAiDuration: true, finalDuration: '', profileInfo: '手机单人，账号是编导；经营背景不代替本条目的', positioningInfo: '',
    originContent: goal, autoSetup: { settings }, additionalInfo: requirements, currentSettings: settings,
    scriptStructure: 'auto', openingLine: settings.openingLine, hookType: 'auto', tactic: 'AI推荐', AUTO_TACTIC: 'AI推荐',
    boomElements: [], directorThoughts: [],
  };
  return new Function(...Object.keys(scope), code + '\nreturn build();')(...Object.values(scope)) as string;
}

describe('创作模板服从原意：实际页面输入和共享生成器', () => {
  it('自动脚本实际分支不发送页面教知识/营销默认模板，保留主线与已选开头', () => {
    const q = actualAutomaticScriptQuery();
    expect(q).toContain(goal); expect(q).toContain(settings.openingLine);
    expect(q).toContain('至少两条可根据回答继续追问');
    expect(q).toContain('按现场真实回答');
    expect(q).not.toContain('这条视频的目的：变现型');
    expect(q).not.toContain('第1秒：必须');
    expect(q).not.toContain('至少标注3处情绪波点');
    expect(q).not.toContain('分段结构（严格执行）');
  });
  it('自动判断仍保留用户明确结构、拍法和本轮局部要求', () => {
    const q = buildAdaptiveScriptPrompt({ topic:'对比', platform:'抖音', duration:'60秒', context:'', source:goal,
      requirements:'只换开头，正文不改', settings:{...settings, structure:'contrast', tactic:'街头采访'},
      structureGuide:'用户手选对比结构', tacticGuide:'用户手选街头采访' });
    expect(q).toContain('用户手选对比结构'); expect(q).toContain('用户手选街头采访');
    expect(q).toContain('只换开头，正文不改');
  });
  it('审稿不再用固定格式缺项分指导改稿，保留比较口径和未知回答边界', () => {
    const q = buildReviewPrompt({ draftContent:goal, platform:'抖音', duration:'AI推荐', scriptType:'',
      reviewDimensions:'', optimizationGoals:'', benchmarkScript:'', compareMode:true, severityLabels:true });
    expect(q).toContain('事实与证据'); expect(q).toContain('比较口径一致');
    expect(q).toContain('不编受访者回答'); expect(q).toContain('未知采访答案');
    expect(q).not.toContain('达标线 3 处'); expect(q).not.toContain('全篇至少 3 处');
    expect(q).not.toContain('目标 9.0 分以上');
  });
  it('程序格式检查不会把金句、CTA、情绪符号缺失当作质量问题', () => {
    const body = '【镜头1】0-10秒\n画面：街道环境。\n台词：国庆前后，您店里的生意有什么变化？';
    const result = evaluateScriptQualityStrict(body, { adaptive:true });
    expect(result.issues).toEqual([]);
  });
  it('方向从零和已选拓展都保持目的，用户选定形式不能被擅自更换', () => {
    const base = {purposes:[], customGoal:goal, formats:['visit'], onCamera:'', capacity:'', horizon:'',
      count:3 as const, depth:'full' as const, profileSummary:'手机单人'};
    for (const expand of [undefined, {from:'自由对话',content:goal}]) {
      const q = buildDirectionPrompt({...base,expand});
      expect(q).toContain(goal); expect(q).not.toContain('目的不同、思路不同');
      expect(q).toContain('按用户选定的形式执行');
    }
  });
  it('标题自动选择不默认发送意外原因公式，手选公式仍可用', () => {
    const base = {topic:goal,titleTypeLabel:'AI推荐',titleFormulaValue:'auto',titleFormulaLabel:'AI推荐',
      keywordStrategyLabel:'AI推荐',keywordStrategyDesc:'按内容',platform:'抖音',targetAudience:'老板',count:3};
    const q = buildTitlePrompt(base);
    expect(q).toContain('不默认套为什么或意外原因'); expect(q).not.toContain('## 📐 公式拆解');
    expect(q).toContain('尚未采访或观察时');
    expect(buildTitlePrompt({...base,titleFormulaValue:'before-after',titleFormulaLabel:'前后对比'})).toContain('## 📐 公式拆解：前后对比');
  });
  it('分镜自动形式允许环境开场、完整问答和长镜头，保留原稿台词', () => {
    const q=buildStoryboardPrompt({scriptContent:goal,platform:'抖音',duration:FOLLOW_SCRIPT,
      contentType:'auto',visualStyle:'',visualStyleLabel:'按现场',additionalInfo:''});
    expect(q).toContain('可以用全景或远景'); expect(q).toContain('不设最低数量');
    expect(q).toContain('不默认套美食或口播模板'); expect(q).toContain('台词一句不删');
    expect(q).not.toContain('应 ≥ 2'); expect(q).not.toContain('每条视频至少要有一个特写');
  });
  it('开篇不为凑六种卡改变议题或编造素材', () => {
    const q=buildOpeningPrompt({topic:goal});
    expect(q).toContain('最多给 6 条'); expect(q).toContain('允许同一机制');
    expect(q).not.toContain('每条用不同的计');
  });
  it('重新生成保持同一角度，只有用户要求才改变；已接入实际页面', () => {
    expect(regenerationPrompt(goal)).toContain('不要为了和上一版不同而更换主题、角度');
    const page=fs.readFileSync('app/dashboard/free-chat/page.tsx','utf8');
    expect(page).toContain('opts.regenerate ? regenerationPrompt(asked)');
    expect(page).not.toContain('【请换个角度重新回答这个问题');
  });
  it('正文也锁定比较口径；已生成的错误草稿不能覆盖原意与未采访状态', () => {
    const context = creationSettingsBlock(settings);
    const wrongDraft = '我已经问过一圈，每家答案不一样。老板，今年和去年国庆比呢？';
    const q = creativeCraftRules({context,source:wrongDraft});
    expect(q).toContain('前后对比不能偷偷变成同比');
    expect(q).toContain('参考稿出现这些句子也必须改正');
    expect(q).toContain('至少两条条件追问');
    expect(q).toContain('纯文字文案只放已知主持人');
  });
  it('明确不要采访的演示任务不被草稿背景里的采访文字带偏', () => {
    const q = creativeCraftRules({intent:'用样柜演示开合空间，不要采访。',source:goal});
    expect(q).not.toContain('【采访落地】');
    expect(q).not.toContain('国庆前的那段时间');
  });
  it('一般前后对比不会被共享规则改成门店采访', () => {
    const q = creativeCraftRules({intent:'对比衣柜调整前后开门的空间。'});
    expect(q).toContain('【比较口径锁定】');
    expect(q).not.toContain('跟国庆前');
  });
  it('选择脚本类型不等于选择标题公式；用户明确保存的公式仍保留', () => {
    const handoff = {from:'脚本生成',sourceContent:'用样柜教学',settings:{scriptType:'teach'}};
    expect(resolveCreationSettings(handoff).titleFormula).toBeUndefined();
    expect(resolveCreationSettings({...handoff,settings:{scriptType:'teach',titleFormula:'before-after'}}).titleFormula).toBe('before-after');
  });
  it('开篇实际入口在选择适配规则前就包含连续设置', () => {
    const page = fs.readFileSync('app/dashboard/growth/page.tsx','utf8');
    expect(page.slice(page.indexOf('const genOpening ='))).toContain("contextBlock: buildContextBlock(context, 'script') + creationSettingsBlock(currentSettings)");
  });
  it.each(['hook','review','shots'] as const)('目的推断 %s 不重新覆盖已确定目的与混合目的', (focus)=>{
    expect(roleInferRule(focus)).toContain('混合目的');
    expect(roleInferRule(focus)).not.toContain('一条只担一个目的');
  });
});
