import { describe, it, expect } from 'vitest';
import { topicDesignStandards, topicRoutePrompt, topicSourceRules, topicDesignFinalCheck, topicPreferredTactic } from '@/lib/topic-design';
import { routeAssignment } from '@/lib/creative-routes';
import { buildNoRepeatBlock } from '@/lib/topic-library';
import { buildCreationHandoff } from '@/lib/creation-flow';
import fs from 'node:fs';

describe('选题从方向落地：保留核心行动而不是强求猎奇', () => {
  it('采访对比包含真实提问、不同回答、共同口径及素材边界', () => {
    const prompt = topicDesignStandards({ source: '国庆前后门店生意对比，去问每家店老板的真实感受' });
    expect(prompt).toContain('真实采访型选题');
    expect(prompt).toContain('主问题和2～3个追问');
    expect(prompt).toContain('共同口径');
    expect(prompt).toContain('变好、变差或没变化');
    expect(prompt).toContain('不替受访者预写答案');
  });
  it('普通选题不强加街采，保留原编导方法', () => {
    const prompt = topicDesignStandards({ source: '展示衣柜门与抽屉的开合空间，给装修家庭测量清单' });
    expect(prompt).not.toContain('真实采访型选题');
    expect(prompt).toContain('八大爆款元素、四大脚本与36计');
  });
  it('继续街访时只提供对应拍法，明确改拍法或非采访内容不受限', () => {
    const p = { source: '国庆前后去问每家店老板的真实感受', explicit: false };
    expect(topicPreferredTactic(p)).toBe('街头采访');
    expect(topicPreferredTactic({ ...p, direction: '国庆后的县城消费观察' })).toBe('街头采访');
    expect(topicPreferredTactic({ ...p, explicit: true })).toBeUndefined();
    expect(topicPreferredTactic({ ...p, direction: '不要采访，用店内样柜演示' })).toBeUndefined();
    expect(topicPreferredTactic({ source: '店内衣柜开合空间测量演示', explicit: false })).toBeUndefined();
  });
  it('采访开头不能提前报告未获得的发现，最后仍核对核心问题', () => {
    const standards = topicDesignStandards({ source: '国庆前后问老板真实感受' });
    expect(standards).toContain('不填采访家数、答复比例');
    expect(standards).toContain('前后生意对比');
    expect(standards).toContain('每条主问题直接比较用户指定的前后变化');
    expect(standards).toContain('保留现场原话');
    expect(standards).toContain('先问同一店指定前后时段生意的变化');
    expect(standards).toContain('今天去问问这条街的老板');
    expect(standards).toContain('首条优先把用户明确要拍的那一期做扎实');
    expect(topicDesignFinalCheck()).toContain('没有用户提供的采访实录');
    expect(topicDesignFinalCheck()).toContain('不要另写「自检通过」');
  });
  it('方向里的示例允许落实，但必须补充内容设计，不能冒充已拍摄', () => {
    expect(topicSourceRules(false)).toContain('不是已经拍完');
    expect(topicSourceRules(false)).toContain('增加具体提问、内容推进和取材方法');
    expect(topicSourceRules(true)).toContain('当前稿件');
    expect(topicSourceRules(true)).not.toContain('只有用户明确要求另出全新选题');
  });
  it('继续创作的默认混合拍法不硬凑数量，用户显式选择仍严格执行', () => {
    const params = { route: '两种都出' as const, count: 5, sourced: true, explicit: false };
    expect(topicRoutePrompt(params)).not.toBe(routeAssignment(params.route, params.count));
    expect(topicRoutePrompt(params)).toContain('同一最佳拍法');
    expect(topicRoutePrompt({ ...params, explicit: true })).toBe(routeAssignment(params.route, params.count));
    expect(topicRoutePrompt({ ...params, sourced: false })).toBe(routeAssignment(params.route, params.count));
  });
  it('防重复保留采访和对比，不将历史草稿当成发布事实', () => {
    const prompt = buildNoRepeatBlock(['国庆前后老板的真实感受']);
    expect(prompt).toContain('不禁止继续同一种采访、同一种对比');
    expect(prompt).toContain('不代表已经拍摄或发布');
    expect(prompt).toContain('不许原样重复');
    expect(prompt).not.toContain('宁可角度冷门');
  });
  it('落实已选方向时旧标题不再作为禁拍清单，新题模式仍列历史防照抄', () => {
    const previous = ['国庆前后门店客流对比'];
    const develop = buildNoRepeatBlock(previous, { developSelected: true });
    expect(develop).toContain('首条直接回答用户的核心问题');
    expect(develop).not.toContain('1. 国庆前后');
    expect(buildNoRepeatBlock(previous)).toContain('1. 国庆前后');
    const api = fs.readFileSync('app/api/dify/stream/route.ts', 'utf8');
    expect(api).toContain("typeof source === 'string' && !!source.trim()");
    expect(api).toContain('!wantsNewTopics');
    expect(api).toContain('buildNoRepeatBlock(prior, { developSelected })');
  });
  it('选题里的主问题、追问和采访边界带入后续脚本', () => {
    const root = '国庆前后门店生意对比，问每家店老板的真实感受，不写假采访';
    const body = '## 选题1：客人少了，还是只是不再扎堆？\n视频目的：流量型\n取材与内容推进：主问题：节后平时这两个时段客人怎么变了？追问：用最近一件具体的事说明；相同口径对照。\n事实边界：尚未采访，保留变好、变差或没变化，不替老板写答案。';
    const handoff = buildCreationHandoff('topic', 'script', body, { originContent: root, settings: { userIntent: root, purpose: '流量型', audience: '实体店老板' } });
    expect(handoff.sourceContent).toContain('主问题');
    expect(handoff.sourceContent).toContain('事实边界');
    expect(handoff.settings?.userIntent).toContain('不写假采访');
    expect(handoff.settings?.purpose).toBe('流量型');
  });
  it('页面接入新质量要求，去掉骨架十字与强制三秒三句，手动选择被记录', () => {
    const page = fs.readFileSync('app/dashboard/topic/page.tsx', 'utf8');
    expect(page).toContain('topicDesignStandards({ source: sourceReference');
    expect(page).toContain('setRouteExplicit(true)');
    expect(page).toContain('取材与内容推进');
    expect(page).toContain('不写示范答案');
    expect(page).not.toContain('每段最多10字');
    expect(page).not.toContain('每项最多10字');
    expect(page).not.toContain('第1秒：[开场文案');
    expect(page).not.toContain('要出示例之外的新的一期');
  });
});

