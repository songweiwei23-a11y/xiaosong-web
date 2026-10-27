/**
 * 标题二次润色（2026-10-27）：模板标题修过以后，先由模型判断哪几条读不顺（默认不改），
 * 再把要改的那几条（读不顺的，加上规则认出的机械毛病）交给模型改顺，只改有毛病的那一小段。
 * 全部用假的 ask，不调真实模型。
 */
import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import {
  titleFlaws,
  judgeTitlesPrompt,
  parseJudgeAnswer,
  rewriteTitlesPrompt,
  parseSmoothAnswer,
  acceptSmooth,
  charSimilarity,
  replaceTitleLine,
  polishSmooth,
  hasAnyTitle,
  allTitles,
  closestFlagged,
  titleElementsOf,
} from '@/lib/title-polish';

const TEXT = [
  '## 选题1：压箱底的裤子，像怕被评价的人',
  '**0️⃣ 视频目的**',
  '流量型。正文里提到 显瘦 这种词不要改。',
  '',
  '## 选题2：25—30岁宝妈换季外套，舒服和不显眼难两全？',
  '正文二',
  '',
  '## 选题3：带娃出门前，大码外套要不要穿得显眼',
  '正文三',
].join('\n');

/** 按提示词分派的假模型：判断那一步回「judge」，改写那一步回「rewrite」 */
const byStep = (judge: string, rewrite: string) => async (prompt: string) => (prompt.includes('只找出「读不顺」') ? judge : rewrite);

describe('机械毛病：占位符、年龄段标签、超字数、分号连句', () => {
  it('每一种都认得出来', () => {
    expect(titleFlaws('31岁还在上学，X元怎么穿去上课')).toContain('占位符');
    expect(titleFlaws('25—30岁宝妈换季外套怎么选')).toContain('年龄段');
    expect(titleFlaws('18-24岁学生的外套')).toContain('年龄段');
    expect(titleFlaws('这是一个非常非常长的标题而且还要说很多很多很多话才行')).toContain('超字数');
    expect(titleFlaws('外套好看；裤子好穿')).toContain('分号连句');
  });
  it('正常的标题、单个年龄（这个人的事实）不报', () => {
    expect(titleFlaws('31岁还在上学，上课穿什么')).toEqual([]);
    expect(titleFlaws('带娃出门前，大码外套要不要穿得显眼')).toEqual([]);
    expect(titleFlaws('XL 码的裤子能穿吗')).toEqual([]);
  });
});

describe('判断那一步：只问读不顺的，默认「无」', () => {
  it('提示词列全部标题，标准严，允许「无」', () => {
    const p = judgeTitlesPrompt(['压箱底的裤子，像怕被评价的人', '换外套怎么选']);
    expect(p).toContain('1. 压箱底的裤子，像怕被评价的人');
    expect(p).toContain('2. 换外套怎么选');
    expect(p).toContain('只找出「读不顺」');
    expect(p).toContain('哪怕你觉得还能写得更好，都不算读不顺。');
    expect(p).toContain('一条都没有就只输出：无');
  });
  it('解析编号：「2,5」「无」「数字超出范围」', () => {
    expect(parseJudgeAnswer('2,5', 6)).toEqual([2, 5]);
    expect(parseJudgeAnswer('无', 6)).toEqual([]);
    expect(parseJudgeAnswer(null, 6)).toEqual([]);
    expect(parseJudgeAnswer('9,1', 6)).toEqual([1]);
  });
});

describe('改写那一步：只给要改的，每条只改有毛病的那一小段', () => {
  it('提示词里有毛病的标题要标出来，并要求保留身份词、改动越小越好', () => {
    const p = rewriteTitlesPrompt(['18—24岁宝妈的旧外套，出门前先不穿', '压箱底的裤子，还敢穿吗']);
    expect(p).toContain('1. 18—24岁宝妈的旧外套，出门前先不穿  [有毛病：年龄段]');
    expect(p).toContain('2. 压箱底的裤子，还敢穿吗');
    expect(p).not.toContain('2. 压箱底的裤子，还敢穿吗  [有毛病');
    expect(p).toContain('身份词不能删');
    expect(p).toContain('改动越小越好');
    expect(p).toContain('原标题 => 新标题');
  });
  it('背景只用来保持方向，没有就不写这一段', () => {
    expect(rewriteTitlesPrompt(['甲'], '')).not.toContain('这批内容的背景');
    expect(rewriteTitlesPrompt(['甲'], '换季').replace(/\n/g, '')).toContain('这批内容的背景（只用来保持方向一致）：换季');
  });
});

describe('解析回答：一行一条，认不出的忽略', () => {
  it('能解析编号、短横线、★ 和引号', () => {
    expect(parseSmoothAnswer('1. 甲标题 => 甲新\n- 乙标题 => 乙新\n★「丙标题」=>「丙新」')).toEqual([
      { from: '甲标题', to: '甲新' },
      { from: '乙标题', to: '乙新' },
      { from: '丙标题', to: '丙新' },
    ]);
  });
  it('空回答和没有箭头的解释都是没有改动', () => {
    expect(parseSmoothAnswer(null)).toEqual([]);
    expect(parseSmoothAnswer('这是一段解释，没有箭头')).toEqual([]);
  });
});

describe('新标题的采用规则：不合格就保留原标题', () => {
  const others = ['别的标题'];
  const ORIG = '压箱底的裤子，像怕被评价的人';
  it('合格的采用，并去掉多余的引号和星号', () => {
    expect(acceptSmooth(ORIG, '「压箱底的裤子，还敢穿出门吗」', others)).toBe('压箱底的裤子，还敢穿出门吗');
    expect(acceptSmooth(ORIG, '**压箱底的裤子，一直没敢再穿**', others)).toBe('压箱底的裤子，一直没敢再穿');
  });
  it('模板、年龄段、超字数、占位符、身材词、和别的标题重复、和原来一样，都不采用', () => {
    expect(acceptSmooth(ORIG, '别只穿裤子', others)).toBeNull();
    expect(acceptSmooth(ORIG, '25—30岁宝妈换外套', others)).toBeNull();
    expect(acceptSmooth(ORIG, '这个标题实在是太长了一点点连句号都没有地方放啊啊啊啊', others)).toBeNull();
    expect(acceptSmooth(ORIG, '压箱底的裤子，X元怎么穿', others)).toBeNull();
    expect(acceptSmooth(ORIG, '压箱底的裤子，显瘦又好看', others)).toBeNull();
    expect(acceptSmooth(ORIG, '别的标题', others)).toBeNull();
    expect(acceptSmooth(ORIG, ORIG, others)).toBeNull();
    expect(acceptSmooth(ORIG, '', others)).toBeNull();
  });
  it('整个换掉的不算润色：相似度低于一半就不采用', () => {
    expect(acceptSmooth(ORIG, '夏天的运动鞋怎么选才舒服', others)).toBeNull();
    expect(charSimilarity('压箱底的裤子，像怕被评价的人', '压箱底的裤子，一直没敢再穿')).toBeGreaterThanOrEqual(0.5);
    expect(charSimilarity('abc', 'xyz')).toBe(0);
    expect(charSimilarity('', '甲')).toBe(0);
  });
});

describe('替换只动标题行，正文里同样的字不误伤', () => {
  it('正文里的「显瘦」保留，只改标题那一行', () => {
    const out = replaceTitleLine(TEXT, '压箱底的裤子，像怕被评价的人', '压箱底的裤子，还敢穿出门吗');
    expect(out).toContain('## 选题1：压箱底的裤子，还敢穿出门吗');
    expect(out).toContain('流量型。正文里提到 显瘦 这种词不要改。');
    expect(out.split('\n')).toHaveLength(TEXT.split('\n').length);
  });
});

describe('二次润色：先判断，再只改要改的那几条', () => {
  it('标题列表和 hasAnyTitle', () => {
    expect(allTitles(TEXT)).toEqual([
      '压箱底的裤子，像怕被评价的人',
      '25—30岁宝妈换季外套，舒服和不显眼难两全？',
      '带娃出门前，大码外套要不要穿得显眼',
    ]);
    expect(hasAnyTitle(TEXT)).toBe(true);
    expect(hasAnyTitle('没有标题的正文')).toBe(false);
  });

  it('判断说「无」而且没有机械毛病：只调用一次模型，原样返回', async () => {
    const ask = vi.fn(byStep('无', 'x'));
    const clean = '## 选题1：带娃出门前，大码外套要不要穿得显眼\n正文';
    const r = await polishSmooth(clean, ask);
    expect(ask).toHaveBeenCalledTimes(1);
    expect(r).toEqual({ text: clean, tried: 0, accepted: 0 });
  });

  it('判断点出 1 条读不顺的，加上规则认出的年龄段标签，两条一起交给改写；未点出的不动', async () => {
    const ask = vi.fn(byStep('1', '压箱底的裤子，像怕被评价的人 => 压箱底的裤子，还敢穿出门吗\n25—30岁宝妈换季外套，舒服和不显眼难两全？ => 宝妈换季外套，舒服和不显眼难两全？'));
    const r = await polishSmooth(TEXT, ask);
    expect(ask).toHaveBeenCalledTimes(2);
    expect(r.accepted).toBe(2);
    expect(r.text).toContain('## 选题1：压箱底的裤子，还敢穿出门吗');
    expect(r.text).toContain('## 选题2：宝妈换季外套，舒服和不显眼难两全？');
    expect(r.text).toContain('## 选题3：带娃出门前，大码外套要不要穿得显眼');
    expect(r.text).toContain('流量型。正文里提到 显瘦 这种词不要改。');
  });

  it('改写那一步顺手改了没有被点出来的标题，不认', async () => {
    // 判断只点出 1 条；改写却把第 3 条也改了：第 3 条不动
    const r = await polishSmooth(TEXT, byStep('1', '压箱底的裤子，像怕被评价的人 => 压箱底的裤子，还敢穿出门吗\n带娃出门前，大码外套要不要穿得显眼 => 带娃出门，大码外套穿得显眼吗'));
    expect(r.text).toContain('## 选题1：压箱底的裤子，还敢穿出门吗');
    expect(r.text).toContain('## 选题3：带娃出门前，大码外套要不要穿得显眼');
    expect(r.text).not.toContain('带娃出门，大码外套穿得显眼吗');
  });

  it('改写点出的不在列表里的标题不认', async () => {
    const r = await polishSmooth(TEXT, byStep('1', '不存在的标题 => 随便改的\n压箱底的裤子，像怕被评价的人 => 压箱底的裤子，还敢穿出门吗'));
    expect(r.tried).toBe(1);
    expect(r.accepted).toBe(1);
    expect(r.text).not.toContain('随便改的');
  });

  it('没有标题时不调用模型', async () => {
    const ask = vi.fn(async () => 'x');
    const r = await polishSmooth('只有正文', ask);
    expect(ask).not.toHaveBeenCalled();
    expect(r).toEqual({ text: '只有正文', tried: 0, accepted: 0 });
  });
});

describe('模型吐出的思考过程和写法偏差', () => {
  it('思考段（闭合或没闭合）都不当答案', () => {
    expect(parseJudgeAnswer('<think>我觉得第 1 条和第 3 条不顺</think>2', 3)).toEqual([2]);
    expect(parseJudgeAnswer('<think>还在想 1 和 2', 3)).toEqual([]);
    expect(parseSmoothAnswer('<think>a => b</think>甲标题 => 甲新')).toEqual([{ from: '甲标题', to: '甲新' }]);
  });
  it('原标题写法有偏差（少个标点）也能对上要改的那一条', async () => {
    const r = await polishSmooth(TEXT, byStep('1', '压箱底的裤子像怕被评价的人 => 压箱底的裤子，还敢穿出门吗'));
    expect(r.accepted).toBe(1);
    expect(r.text).toContain('## 选题1：压箱底的裤子，还敢穿出门吗');
  });
  it('模型只给新标题、没写箭头：条数一样就按顺序对上', async () => {
    // 要改的有两条：读不顺的（选题1）和规则认出年龄段的（选题2），两行新标题按这个顺序对上
    const r = await polishSmooth(TEXT, byStep('1', '压箱底的裤子，这次敢穿出门吗\n宝妈换季外套，舒服和不显眼难两全？'));
    expect(r.accepted).toBe(2);
    expect(r.text).toContain('## 选题1：压箱底的裤子，这次敢穿出门吗');
    expect(r.text).toContain('## 选题2：宝妈换季外套，舒服和不显眼难两全？');
  });
  it('比喻整个去掉、改成具体的事和冲突，能通过', () => {
    expect(acceptSmooth('压箱底的裤子，像怕被评价的人', '压箱底的裤子，这次敢穿出门吗', [])).toBe('压箱底的裤子，这次敢穿出门吗');
  });
  it('差得太远的原标题不认', () => {
    expect(closestFlagged('完全不相干的一句话', ['压箱底的裤子，像怕被评价的人'])).toBeNull();
    expect(closestFlagged('压箱底的裤子，像怕被评价的人', ['压箱底的裤子，像怕被评价的人'])).toBe('压箱底的裤子，像怕被评价的人');
  });
});

describe('标题要看得出爆款元素：元素从正文取，判断和改写都带上', () => {
  const WITH_EL = [
    '## 选题1：秋天出门换了几身，还是不敢穿？',
    '**0️⃣ 视频目的**',
    '流量型。',
    '',
    '**1️⃣ 爆款元素**',
    '- **怀旧**：套「当年最火的X」',
    '- **荷尔蒙**：套「异性会多看你两眼的X」',
    '',
    '**2️⃣ 开篇钩子**',
    '不生成。',
    '',
    '## 选题2：大码外套的衣架，不该替人决定尺码',
    '**1️⃣ 爆款元素**',
    '- **成本**：套「花小钱办大事」',
    '',
    '**2️⃣ 开篇钩子**',
  ].join('\n');

  it('按标题取出每条的元素（流量条有，没写元素的不记）', () => {
    expect(titleElementsOf(WITH_EL)).toEqual({
      '秋天出门换了几身，还是不敢穿？': ['怀旧', '荷尔蒙'],
      '大码外套的衣架，不该替人决定尺码': ['成本'],
    });
    expect(titleElementsOf(TEXT)).toEqual({});
    // 元素行不带粗体（模型常见写法）也要认得出
    expect(titleElementsOf(WITH_EL.replace(/\*\*(头牌|怀旧|荷尔蒙|成本)\*\*/g, '$1'))).toEqual(titleElementsOf(WITH_EL));
  });

  it('判断提示词只看读不顺，不判元素（元素在生成时保证，判断会误伤通顺的标题）', () => {
    const p = judgeTitlesPrompt(['秋天出门换了几身，还是不敢穿？', '甲标题']);
    expect(p).toContain('1. 秋天出门换了几身，还是不敢穿？');
    expect(p).not.toContain('[元素');
    expect(p).not.toContain('认不出这个元素');
    expect(p).toContain('只看下面三种');
  });

  it('改写提示词：标了元素的要求改后光看标题就认得出，别的标题不加标记', () => {
    const p = rewriteTitlesPrompt(['秋天出门换了几身，还是不敢穿？'], '', { '秋天出门换了几身，还是不敢穿？': ['怀旧'] });
    expect(p).toContain('[元素：怀旧，标题里要光看就认得出]');
    expect(p).toContain('标了［元素：…］的，改后光看标题就要认得出这个元素');
    expect(rewriteTitlesPrompt(['甲标题'], '', {})).not.toContain('[元素：');
  });

  it('判断说无需改时，标了元素的标题也不动（不因为元素被改坏）', async () => {
    const ask = vi.fn(async () => '无');
    const r = await polishSmooth(WITH_EL, ask);
    expect(ask).toHaveBeenCalledTimes(1);
    expect(r.text).toBe(WITH_EL);
  });

  it('要改的标题，改写时仍然带着元素要求', async () => {
    const ask = vi.fn(async (p: string) => (p.includes('只看下面三种') ? '1' : '秋天出门换了几身，还是不敢穿？ => 秋天换了几身，还是不敢穿当年那件？'));
    await polishSmooth(WITH_EL, ask);
    const rewritePrompt = ask.mock.calls[1][0];
    expect(rewritePrompt).toContain('[元素：怀旧、荷尔蒙，标题里要光看就认得出]');
  });
});

describe('接线：路由先模板、再二次润色、再现实、最后去重；页面有标题就调用', () => {
  it('路由的顺序', () => {
    const src = fs.readFileSync('app/api/polish-titles/route.ts', 'utf8');
    const iTemplate = src.indexOf('polishTitles(text');
    const iSmooth = src.indexOf('polishSmooth(templated.text');
    const iReality = src.indexOf('polishReality(smooth.text');
    const iDedupe = src.indexOf('dedupeTitles(reality.text');
    expect(iTemplate).toBeGreaterThan(0);
    expect(iSmooth).toBeGreaterThan(iTemplate);
    expect(iReality).toBeGreaterThan(iSmooth);
    expect(iDedupe).toBeGreaterThan(iReality);
  });
  it('polishTitlesRemote 只要有标题就交给服务端', () => {
    const src = fs.readFileSync('lib/title-polish.ts', 'utf8');
    expect(src).toMatch(/!hasAnyTitle\(text\) && !findTemplateTitles\(text\)/);
  });
});
