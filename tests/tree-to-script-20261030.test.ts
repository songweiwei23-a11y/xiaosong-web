/**
 * 选题 → 脚本 这一跳的契约（2026-10-30）：大类、具体结构、目的写进脚本提示词，
 * 跳转时视频目的从选题带过去。守的是：提示词里写明的结构不靠模型自选，且两个大类分开。
 */
import { describe, expect, it } from 'vitest';
import { GROWTH_TACTICS } from '@/lib/growth-tactics';
import { buildScriptBoardQuery } from '@/lib/boards/script-query';
import { scriptFormOfTopic } from '@/lib/creation-settings';
import { treeNodeOfScriptInputs } from '@/lib/creation-tree';

const base = {
  topic: '川菜最不能省的是炒前准备', platform: '抖音', scriptType: 'discuss', autoScriptType: false,
  effectiveRole: '人设型', isAd: false, industry: '川味餐饮', customIndustry: '', targetGroup: '', customTargetGroup: '',
  style: '专业', customStyle: '', durationMode: 'preset', duration: '60秒', customDuration: '', profile: null,
  scriptStructure: 'argue', hookType: 'auto', boomElements: [], directorThoughts: [], tactic: '', openingLine: '', openingCard: '',
  productInfo: '', priceInfo: '', scene: '室内', device: '手机', budget: '低成本(0-500)', personnel: '一人',
  accountPositioning: '', additionalInfo: '', dealReasons: [], originContent: '', focusContent: '', currentSettings: {},
};

describe('契约节点：从脚本输入推出来', () => {
  it('四大脚本的结构 id：大类四大脚本，类型聊观点，结构全名', () => {
    expect(treeNodeOfScriptInputs({ scriptStructure: 'argue', purpose: '人设型' })).toMatchObject({
      bigType: '四大脚本', kind: '聊观点', structure: '聊观点·论证型', purpose: '人设型',
    });
  });

  it('36 计的计名：大类 36 计，没有类型，结构是第 N 计全名', () => {
    const t = GROWTH_TACTICS[0];
    expect(treeNodeOfScriptInputs({ tactic: t.name, scriptStructure: 'auto' })).toMatchObject({
      bigType: '36计', kind: '', structure: `36计·第${t.no}计 ${t.name}`,
    });
  });

  it('两个都没有（AI 自选）：返回 null', () => {
    expect(treeNodeOfScriptInputs({ tactic: 'auto', scriptStructure: 'auto' })).toBeNull();
  });
});

describe('脚本提示词里写明大类、结构、目的', () => {
  it('四大脚本的结构进了提示词，大类写「四大脚本」', () => {
    const q = String(buildScriptBoardQuery(base as never));
    expect(q).toContain('【内容树】');
    expect(q).toContain('- 大类：四大脚本');
    expect(q).toContain('- 类型：聊观点');
    expect(q).toContain('- 具体结构：聊观点·论证型');
    expect(q).toContain('- 目的：人设型');
  });

  it('36 计的计进了提示词，大类写「36计」，不带四大脚本的类型', () => {
    const t = GROWTH_TACTICS[0];
    const q = String(buildScriptBoardQuery({ ...base, tactic: t.name, scriptStructure: 'auto' } as never));
    expect(q).toContain('- 大类：36计');
    expect(q).toContain(`- 具体结构：36计·第${t.no}计 ${t.name}`);
    expect(q).not.toMatch(/- 类型：聊观点|- 类型：晒过程/);
  });
});

describe('选题跳转时视频目的一起带过去', () => {
  it('选题里写了「视频目的：人设型」，解析出来', () => {
    const body = '### 选题1\n- 视频目的：人设型\n**🅰 打法**\n- 四大脚本·聊观点·论证型：先讲判断';
    expect(scriptFormOfTopic(body)).toEqual({ scriptType: 'discuss', structure: 'argue', purpose: '人设型' });
  });

  it('只有目的、没有打法：只带目的，不猜结构', () => {
    expect(scriptFormOfTopic('- 视频目的：流量型')).toEqual({ purpose: '流量型' });
  });
});
