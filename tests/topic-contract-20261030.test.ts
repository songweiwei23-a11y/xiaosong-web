/**
 * 选题正文的完整契约（2026-10-30，lib/creation-tree 的 treeNodeOfTopicBody）：
 * 结构（以选题写的为准）、视频目的、视频任务、爆款元素，一起带到脚本。
 */
import { describe, expect, it } from 'vitest';
import { treeNodeOfTopicBody } from '@/lib/creation-tree';
import { buildScriptBoardQuery } from '@/lib/boards/script-query';

const ONE_TOPIC = [
  '## 选题1：川菜最不能省的是炒前准备',
  '**0️⃣ 视频目的**',
  '人设型，让人信你这个人',
  '',
  '**🅰 打法**',
  '- 四大脚本·聊观点·论证型：先讲一个判断，再用经历说明依据',
  '',
  '**视频任务**',
  '让观众看完觉得这个人懂火候之外的准备，愿意关注',
  '',
  '**1️⃣ 爆款元素**',
  '反差：火大不等于炒得好',
  '',
  '**2️⃣ 开篇钩子**',
  '我做川菜9年，最不认同的一句话……',
].join('\n');

const TWO_TOPICS = [
  '## 选题1：凌晨的菜市场',
  '**0️⃣ 视频目的**',
  '流量型',
  '**🅰 打法**',
  '- 36计·第32计 换个视角：从摊主的角度看进货',
  '**视频任务**',
  '让陌生人停下来看完',
  '',
  '## 选题2：川菜最不能省的是炒前准备',
  '**0️⃣ 视频目的**',
  '人设型',
  '**🅰 打法**',
  '- 四大脚本·聊观点·论证型：先讲判断',
  '**视频任务**',
  '让观众信你这个人',
].join('\n');

describe('从选题正文读出契约', () => {
  it('四大脚本的结构、人设型目的、视频任务、爆款元素都读出来', () => {
    const n = treeNodeOfTopicBody(ONE_TOPIC, '川菜最不能省的是炒前准备');
    expect(n).toMatchObject({
      bigType: '四大脚本', kind: '聊观点', structure: '聊观点·论证型', purpose: '人设型',
      task: '让观众看完觉得这个人懂火候之外的准备，愿意关注', elements: ['反差'],
    });
  });

  it('36 计的结构：大类 36 计，结构是第 N 计全名，目的和任务也读出来', () => {
    const n = treeNodeOfTopicBody(TWO_TOPICS, '凌晨的菜市场');
    expect(n).toMatchObject({ bigType: '36计', structure: '36计·第32计 换个视角', purpose: '流量型', task: '让陌生人停下来看完' });
  });

  it('一批选题里只认标题对得上的那一条，不把别的选题的结构当成这一条的', () => {
    expect(treeNodeOfTopicBody(TWO_TOPICS, '川菜最不能省的是炒前准备')?.structure).toBe('聊观点·论证型');
    expect(treeNodeOfTopicBody(TWO_TOPICS, '凌晨的菜市场')?.structure).toBe('36计·第32计 换个视角');
  });

  it('标题对不上、又有好几条：返回 null，不猜', () => {
    expect(treeNodeOfTopicBody(TWO_TOPICS, '一条不存在的选题')).toBeNull();
  });

  it('正文里没有打法：返回 null', () => {
    expect(treeNodeOfTopicBody('## 选题1：只有标题\n**0️⃣ 视频目的**\n流量型', '只有标题')).toBeNull();
  });
});

describe('脚本以选题写的结构为准', () => {
  const base = {
    topic: '川菜最不能省的是炒前准备', platform: '抖音', scriptType: 'teach', autoScriptType: false,
    effectiveRole: '变现型', isAd: false, industry: '川味餐饮', customIndustry: '', targetGroup: '', customTargetGroup: '',
    style: '专业', customStyle: '', durationMode: 'preset', duration: '60秒', customDuration: '', profile: null,
    scriptStructure: 'problem', hookType: 'auto', boomElements: [], directorThoughts: [], tactic: '', openingLine: '', openingCard: '',
    productInfo: '', priceInfo: '', scene: '室内', device: '手机', budget: '低成本(0-500)', personnel: '一人',
    accountPositioning: '', additionalInfo: '', dealReasons: [], focusContent: '', currentSettings: {},
  };

  it('页面传的是「解题型」，选题写的是「聊观点·论证型」：脚本按选题写的', () => {
    const q = String(buildScriptBoardQuery({ ...base, originContent: ONE_TOPIC } as never));
    expect(q).toContain('- 大类：四大脚本');
    expect(q).toContain('- 具体结构：聊观点·论证型');
    expect(q).toContain('- 目的：人设型');
    expect(q).toContain('- 任务：让观众看完觉得这个人懂火候之外的准备，愿意关注');
    expect(q).toContain('- 爆款元素：反差');
    expect(q).not.toContain('- 具体结构：教知识·解题型');
  });

  it('选题正文里没有契约：沿用页面传的结构，不硬改', () => {
    const q = String(buildScriptBoardQuery({ ...base, originContent: '一段没有打法的正文' } as never));
    expect(q).toContain('- 具体结构：教知识·解题型');
  });
});
