import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { topicReference } from '@/lib/creation-continuation';
import { BIG_OPENING_RULE, TITLE_CRAFT } from '@/lib/sharp-rules';

const DIR = [
  '### 方向1：同一件外套，换搭配看差别',
  '- **核心目的**：涨粉曝光',
  '- **内容方向**：赛道是大码女装，目标人群是通勤和带娃的女性，大众切口是买错衣服的后悔',
  '- **切入角度**：',
  '  - 对比切入 ｜ 同一件外套换搭配 ｜ 对比 ｜ 看搭配维度',
  '- **思路提示**：买衣服最怕买回家不敢穿，可以从这件事往下想',
  '- **节奏**：第1周',
].join('\n');

describe('交接：用户最初的想法必须接上（修复：之前只剩种子，原意丢了）', () => {
  it('方向种子 + 用户自己写的最初想法同时带过去', () => {
    const ref = topicReference({ sourceContent: DIR, originContent: '我想拍大家都能看懂、愿意点开的内容。别只讲衣服细节', settings: {} });
    expect(ref).toContain('【方向种子');
    expect(ref).toContain('【最初的想法');
    expect(ref).toContain('别只讲衣服细节');
  });
  it('origin 是方向原文本身时不重复带，只带种子', () => {
    const ref = topicReference({ sourceContent: DIR, originContent: DIR, settings: {} });
    expect(ref).toContain('【方向种子');
    expect(ref).not.toContain('【最初的想法');
  });
});

describe('大开口不离开定位：赛道、目标人群、大众大事三处同时落下', () => {
  it('大开口规则写明三处锚点，并且不离开定位', () => {
    expect(BIG_OPENING_RULE).toContain('开口要大，但不离开定位');
    expect(BIG_OPENING_RULE).toContain('赛道');
    expect(BIG_OPENING_RULE).toContain('标题里也要有一个赛道词');
    expect(BIG_OPENING_RULE).toContain('目标人群');
    expect(BIG_OPENING_RULE).toContain('大众大事');
    expect(BIG_OPENING_RULE).toContain('爆款元素是标题和第一秒的看点');
    expect(BIG_OPENING_RULE).toContain('光看就认得出分给它的那个元素');
  });
  it('标题规则仍然要求具体的东西，但不限于商品细节', () => {
    expect(TITLE_CRAFT).toContain('不一定是商品细节');
  });
  it.skip('选题提示词接上大开口规则，流量选题的人群来自档案（不再用通用大众人群）', () => {
    const src = fs.readFileSync('lib/boards/topic-query.ts', 'utf8');
    expect(src).toContain('${BIG_OPENING_RULE}');
    expect(src).not.toContain('BROAD_AUDIENCES');
    expect(src).toContain('audiences: audiencePool(selectedProfile as never)');
  });
  it.skip('题眼不再出现在方向种子和提示词里（题眼会误导模型）', () => {
    const dsrc = fs.readFileSync('lib/direction-seed.ts', 'utf8');
    expect(dsrc).not.toContain("listUnder(text, '题眼池')");
    const dir = fs.readFileSync('lib/direction.ts', 'utf8');
    expect(dir).not.toContain('**题眼池**');
    expect(dir).toContain('**思路提示**');
  });
});
