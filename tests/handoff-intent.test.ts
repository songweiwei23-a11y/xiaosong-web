import { describe, it, expect } from 'vitest';
import { buildOpeningPrompt } from '@/lib/growth-standards';
import { creationSettingsBlock } from '@/lib/creation-settings';
import { buildCreationHandoff } from '@/lib/creation-flow';
import { pickBatchItem } from '@/lib/creation-selection';

/** 两条选题的一批：第 1 条是流量型、第 2 条是变现型，内容方向各不相同 */
const BATCH = [
  '## 选题1：南乐降温了，这家地摊老板干了两件事',
  '**视频目的**：流量型',
  '**内容方向**：讲A：秋天吃露天的理由',
  '**拍摄角度**：拍棚子',
  '',
  '## 选题2：一元火锅第一次来怎么点',
  '**视频目的**：变现型',
  '**内容方向**：讲B：新客怎么点不踩坑',
  '**拍摄角度**：拍点单',
].join('\n');

describe('开篇钩子：照选题的目的、方向和人称写', () => {
  it('传了意图：目的（含完整说法）、内容方向、用户想法都点名', () => {
    const prompt = buildOpeningPrompt({
      topic: '一元火锅第一次来怎么点',
      intent: { purpose: '变现型', purposeText: '引流到店、推新品、口碑', direction: '讲B：新客怎么点不踩坑', userIntent: '想把新品拍成视频' },
    });
    expect(prompt).toContain('本条必须守住的意图');
    expect(prompt).toContain('变现型（完整：引流到店、推新品、口碑）');
    expect(prompt).toContain('讲B：新客怎么点不踩坑');
    expect(prompt).toContain('想把新品拍成视频');
  });

  it('没传意图：不输出意图块，但说话人规则一直在', () => {
    const prompt = buildOpeningPrompt({ topic: '一元火锅第一次来怎么点' });
    expect(prompt).not.toContain('本条必须守住的意图');
    expect(prompt).toContain('说话人（人称）');
    expect(prompt).toContain('出镜人自己对着镜头说的');
    expect(prompt).toContain('不写「这家老板」');
  });
});

describe('设置块：完整目的不因为有了类别就丢掉', () => {
  it('有视频目的类别，也要带上完整目的', () => {
    const block = creationSettingsBlock({ purpose: '变现型', purposeText: '引流到店、推新品' });
    expect(block).toContain('视频目的：变现型');
    expect(block).toContain('完整目的：引流到店、推新品');
  });
});

describe('交接：整批和拆解报告里的标签不算用户的设置', () => {
  it('整批选题交接给开篇：不读第 1 条的目的和方向', () => {
    const data = buildCreationHandoff('topic', 'growth', BATCH, {});
    expect(data.settings?.purpose).toBeUndefined();
    expect(data.settings?.direction).toBeUndefined();
  });

  it('拆解报告交接给二创：报告里的视频目的（原片的）不带过去', () => {
    const report = '## 拆解报告\n视频目的：人设型\n内容方向：别人的原片讲的事\n脚本类型：教知识';
    const data = buildCreationHandoff('breakdown', 'remix', report, {});
    expect(data.settings?.purpose).toBeUndefined();
    expect(data.settings?.direction).toBeUndefined();
    expect(data.settings?.scriptType).toBeUndefined();
  });

  it('用户自己给的设置照常带过去', () => {
    const data = buildCreationHandoff('topic', 'growth', BATCH, { settings: { purpose: '变现型' } });
    expect(data.settings?.purpose).toBe('变现型');
  });
});

describe('开篇页挑一条：主线、方向、目的整体换成这一条的', () => {
  it('挑第 2 条：焦点和方向是 B 的，不是 A 的', () => {
    const picked = pickBatchItem(BATCH, '一元火锅第一次来怎么点', { originContent: BATCH, settings: {} });
    expect(picked).not.toBeNull();
    expect(picked!.settings?.direction).toBe('讲B：新客怎么点不踩坑');
    expect(picked!.settings?.focusContent).toContain('讲B');
    expect(picked!.settings?.focusContent).not.toContain('讲A');
    expect(picked!.body).toContain('讲B');
    expect(picked!.body).not.toContain('讲A');
  });

  it('找不到这一条时返回 null，不换设置', () => {
    expect(pickBatchItem(BATCH, '不存在的标题', { originContent: BATCH, settings: {} })).toBeNull();
  });
});
