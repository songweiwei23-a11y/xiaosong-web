/**
 * 前采里混进的策划稿要剔掉（lib/interview-strategy，2026-10-29）。
 *
 * 守的是"不报错、只是悄悄把策划稿当成客户说过的话"这一类：
 *   - 客户原话里的「规划」「分析」这类字，不能把客户原话误剔
 *   - 策划稿的章节标题认得出，但正文里出现的同样的词不能算章节
 *   - 剔完以后，客户原话一句不能少
 */
import { describe, it, expect } from 'vitest';
import { splitStrategyBlock } from '@/lib/interview-strategy';

const CUSTOMER_PART = [
  '一、客户基本档案',
  '店名：李大厨膳食热菜，流动摊位，中午和晚上出摊。',
  '',
  '二、经营现状深度梳理',
  '客户原话：「下班打包的人很多，装盒的时候最费时间。」',
  '规划好的菜品不一定全卖得动，卖不动的我就撤。',
].join('\n');

const STRATEGY_PART = [
  '四、IP定位与账号规划',
  '建议人设：严谨的专业厨师。',
  '',
  '七、内容大纲（首期20条选题规划）',
  '1. 红烧肉的做法拆解',
  '',
  '八、拍摄执行方案',
  '每天早上跟拍采购。',
  '',
  '十、下一步行动计划',
  '1. 本周拍 3 条。',
].join('\n');

describe('splitStrategyBlock：剔掉策划稿章节', () => {
  it('客户原话和基本信息全部留下，策划稿章节全部剔掉', () => {
    const { kept, removed } = splitStrategyBlock([CUSTOMER_PART, '', STRATEGY_PART].join('\n'));
    expect(kept).toContain('一、客户基本档案');
    expect(kept).toContain('店名：李大厨膳食热菜');
    expect(kept).toContain('客户原话：「下班打包的人很多，装盒的时候最费时间。」');
    expect(kept).not.toContain('IP定位');
    expect(kept).not.toContain('红烧肉的做法拆解');
    expect(kept).not.toContain('每天早上跟拍采购');
    expect(kept).not.toContain('下一步行动计划');
    expect(removed).toEqual([
      '四、IP定位与账号规划',
      '七、内容大纲（首期20条选题规划）',
      '八、拍摄执行方案',
      '十、下一步行动计划',
    ]);
  });

  it('客户原话里的「规划」「分析」不误剔：只看章节标题，不看正文', () => {
    const text = ['一、客户基本档案', '客户说：我对菜品规划没什么经验，成本分析也没做过。', '', '二、经营现状'].join('\n');
    const { kept, removed } = splitStrategyBlock(text);
    expect(kept).toContain('我对菜品规划没什么经验');
    expect(kept).toContain('成本分析也没做过');
    expect(removed).toEqual([]);
  });

  it('没有章节的纯原话，原样留下（去掉多余空行）', () => {
    const raw = '第一段原话。\n\n\n\n第二段原话。';
    const { kept, removed } = splitStrategyBlock(raw);
    expect(kept).toBe('第一段原话。\n\n第二段原话。');
    expect(removed).toEqual([]);
  });

  it('markdown 标题也认：## 选题策略 剔掉，## 客户访谈 留下', () => {
    const text = ['## 客户访谈', '老板说卖的是现做热菜。', '', '## 选题策略', '每周 3 条流量型。'].join('\n');
    const { kept, removed } = splitStrategyBlock(text);
    expect(kept).toContain('老板说卖的是现做热菜');
    expect(kept).not.toContain('每周 3 条流量型');
    expect(removed).toEqual(['## 选题策略']);
  });

  it('剔掉的章节遇到下一个客户章节就恢复留下', () => {
    const text = ['三、客户诉求', '想拍出食材的质感。', '', '四、拍摄执行方案', '每天拍。', '', '五、客户禁忌', '不拍正脸。'].join('\n');
    const { kept, removed } = splitStrategyBlock(text);
    expect(kept).toContain('想拍出食材的质感');
    expect(kept).not.toContain('每天拍');
    expect(kept).toContain('不拍正脸');
    expect(removed).toEqual(['四、拍摄执行方案']);
  });

  it('空文本不报错', () => {
    expect(splitStrategyBlock('')).toEqual({ kept: '', removed: [] });
  });
});
