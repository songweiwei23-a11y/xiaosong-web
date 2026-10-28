/**
 * 主角是卖的东西（2026-10-29 产品方定）+ 选题标题「不用改的就不改」。
 * - 内容规划、创作方向：对比要变的是在卖的东西（同一个人换两套衣服），不是同一件东西换穿法。
 * - 两个板块每个方向都要写「主角」；创作方向不再挡着货（原来写着「范围不写具体的商品场景」）。
 * - 标题后处理只修真错了的（占位符、年龄段），不再让模型挑「读不顺」重写，也不因为超字数、分号重写。
 */
import fs from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { PRODUCT_HERO_RULE } from '@/lib/sharp-rules';
import { buildContentPlanPrompt } from '@/lib/content-plan';
import { buildDirectionPrompt } from '@/lib/direction';
import { resolveMix } from '@/lib/content-mix';
import { polishSmooth, MUST_FIX_FLAWS } from '@/lib/title-polish';

const plan = buildContentPlanPrompt({ lastMonth: '', recordedLastMonth: null, count: 12, focus: [], events: '', notes: '', resolved: resolveMix(null), industry: '大码女装' });
const direction = buildDirectionPrompt({ purposes: ['fans'], formats: ['any'], count: 12, depth: 'quick', industry: '大码女装' });

describe('主角是卖的东西', () => {
  it('规则写明：变的必须是在卖的东西；同一件换穿法不行；卖手艺的手艺就是货', () => {
    expect(PRODUCT_HERO_RULE).toContain('同一个人先后穿两套衣服');
    expect(PRODUCT_HERO_RULE).toContain('不做「同一件东西换个穿法、搭法、摆法、用法、吃法」的对比');
    expect(PRODUCT_HERO_RULE).toContain('手艺本身就是货');
  });

  it('内容规划和创作方向都带上这条规则，每个方向都有「主角」一栏', () => {
    for (const p of [plan, direction]) {
      expect(p).toContain(PRODUCT_HERO_RULE);
      expect(p).toContain('- **主角**：');
    }
  });

  it('创作方向不再写「范围不写具体的商品场景」（这句把货挡在了方向外面）', () => {
    expect(direction).not.toContain('范围不写具体的商品场景');
  });

  it('现实规则的注释不再说「真实能变的只有做法、搭配」', () => {
    expect(fs.readFileSync('lib/sharp-rules.ts', 'utf8')).not.toContain('真实能变的只有它的做法、搭配');
  });
});

describe('选题标题：不用改的就不改', () => {
  const TEXT = '## 选题1：当年最火的大码外套，今天还能穿吗\n正文\n## 选题2：带娃出门的妈妈们，换季这件外套到底该怎么选才不后悔\n正文\n## 选题3：X元的裤子，穿出门有面子吗\n正文';

  it('只把占位符、年龄段算成必须改的毛病', () => {
    expect(MUST_FIX_FLAWS).toEqual(['占位符', '年龄段']);
  });

  it('judge=false：不问模型「哪条读不顺」，超字数的标题不动，只改带占位符的那条', async () => {
    const ask = vi.fn(async (_prompt: string) => 'X元的裤子，穿出门有面子吗 => 39元的裤子，穿出门有面子吗');
    const r = await polishSmooth(TEXT, ask, '', { judge: false });
    expect(ask).toHaveBeenCalledTimes(1);
    expect(ask.mock.calls[0][0]).not.toContain('读不顺」的标题');
    expect(r.text).toContain('带娃出门的妈妈们，换季这件外套到底该怎么选才不后悔');
    expect(r.text).toContain('当年最火的大码外套，今天还能穿吗');
    expect(r.text).toContain('39元的裤子，穿出门有面子吗');
  });

  it('judge=false 且没有真错的标题：一次模型都不调，原文一字不动', async () => {
    const clean = '## 选题1：当年最火的大码外套，今天还能穿吗\n正文';
    const ask = vi.fn(async () => '1');
    const r = await polishSmooth(clean, ask, '', { judge: false });
    expect(ask).not.toHaveBeenCalled();
    expect(r.text).toBe(clean);
  });

  it('选题页和创作方向页共用的后处理接口用 judge=false', () => {
    expect(fs.readFileSync('app/api/polish-titles/route.ts', 'utf8')).toContain('polishSmooth(templated.text, ask, context, { judge: false })');
  });
});
