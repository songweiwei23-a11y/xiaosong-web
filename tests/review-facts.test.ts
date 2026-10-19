/**
 * 审稿的事实依据（2026-10-19）：原稿里写的时间、金额、年限，要在档案和材料里找依据；原稿本身不是依据。
 * 线上实测：原稿「老王每天早上六点去批发市场拿货」「人均两三块」，审稿把它们当成「值得保留」，还保留进了改写稿。
 */
import { describe, it, expect } from 'vitest';
import { draftFactClaims, unsupportedDraftFacts, factEvidenceBlock } from '@/lib/review-facts';
import { reviewVerificationPrompt } from '@/lib/review-verification';
import { buildReviewPrompt } from '@/lib/review-standards';
import { ALWAYS_PROTECTED } from '@/lib/review-scope';

const DRAFT = '南乐最好吃的一元串串，老王每天早上六点去批发市场拿货。\n我们是公益店，每周给环卫工人送一顿饭，人均两三块。\n在成都做了9年川菜。\n关注我，直播间见。';
const MATERIAL = '## 账号档案\n- 人设：主厨老王，成都人，做川菜 9 年，来南乐半年\n- 主卖：川味串串火锅、川味烧烤';

describe('原稿里的具体说法', () => {
  it('抽出时间、金额、年限', () => {
    const claims = draftFactClaims(DRAFT);
    expect(claims).toContain('早上六点');
    expect(claims).toContain('人均两三块');
    expect(claims).toContain('9年');
    expect(claims).toContain('一元');
  });

  it('同一个说法出现多次只记一次', () => {
    expect(draftFactClaims('早上六点来，早上六点走').filter((c) => c === '早上六点')).toHaveLength(1);
  });
});

describe('字面比对：材料里找不到依据的', () => {
  it('早上六点、人均两三块 没有依据；9年 在材料里有（空格不影响）', () => {
    const missing = unsupportedDraftFacts(DRAFT, MATERIAL);
    expect(missing).toContain('早上六点');
    expect(missing).toContain('人均两三块');
    expect(missing).not.toContain('9年');
  });

  it('材料为空时，原稿里的具体说法全部算无依据', () => {
    expect(unsupportedDraftFacts(DRAFT, '')).toEqual(expect.arrayContaining(['早上六点', '9年']));
  });
});

describe('预检块：写给模型的规则', () => {
  it('列出无依据的说法，并规定：不进值得保留、问题清单标无依据、改成【待确认】', () => {
    const block = factEvidenceBlock(DRAFT, MATERIAL);
    expect(block).toContain('找不到字面依据');
    expect(block).toContain('「早上六点」');
    expect(block).toContain('不列进「值得保留」');
    expect(block).toContain('【无依据】');
    expect(block).toContain('【待确认：…】');
    expect(block).toContain('不受「本轮改动范围」限制');
  });

  it('原稿没有具体说法时直接说明，不硬加规则', () => {
    expect(factEvidenceBlock('这是一段没有数字的话。', MATERIAL)).toContain('没有需要比对');
  });
});

describe('审稿提示词接入预检', () => {
  it('档案里有的依据不被标为无依据；档案里没有的被列出', () => {
    const p = buildReviewPrompt({
      draftContent: DRAFT, platform: '抖音', duration: 'AI推荐', scriptType: '', reviewDimensions: '', optimizationGoals: '',
      benchmarkScript: '', compareMode: false, severityLabels: true, contextBlock: MATERIAL, personalRequirements: '',
    } as never);
    expect(p).toContain('## 🔎 事实依据预检');
    expect(p).toContain('「早上六点」');
    expect(p).toContain('「人均两三块」');
    expect(p).toMatch(/值得保留\*\*：[^\n]*不许列在这里/);
  });

  it('相关方案参考也算依据（产品方决定：内容本来都是生成的，不偏离真实、按档案来就可以）', () => {
    const p = buildReviewPrompt({
      draftContent: DRAFT, platform: '抖音', duration: 'AI推荐', scriptType: '', reviewDimensions: '', optimizationGoals: '',
      benchmarkScript: '', compareMode: false, severityLabels: true,
      // 参考里写了「早上六点」，所以它有字面依据，不算无依据
      contextBlock: `${MATERIAL}\n【相关方案参考】老王每天早上六点去批发市场拿货`,
      personalRequirements: '',
    } as never);
    expect(p).not.toMatch(/找不到字面依据[^\n]*「早上六点」/);
  });

  it('个人要求算依据：编导在要求里写明的时间，预检不再标无依据', () => {
    const p = buildReviewPrompt({
      draftContent: DRAFT, platform: '抖音', duration: 'AI推荐', scriptType: '', reviewDimensions: '', optimizationGoals: '',
      benchmarkScript: '', compareMode: false, severityLabels: true,
      contextBlock: MATERIAL, personalRequirements: '老王每天早上六点去批发市场拿货是真的',
    } as never);
    expect(p).not.toMatch(/找不到字面依据[^\n]*「早上六点」/);
  });

  it('保护清单不再把"原稿已有的数字和事实"整体保护起来', () => {
    expect(ALWAYS_PROTECTED.join('|')).not.toContain('原稿已有的数字和事实');
    expect(ALWAYS_PROTECTED.join('|')).toContain('有依据的数字和事实');
  });
});

describe('校对步骤：材料是依据，原稿不是', () => {
  it('把本轮材料交给校对，并写明原稿本身不是事实依据', () => {
    const p = reviewVerificationPrompt('原稿', '', '审稿结果', MATERIAL);
    expect(p).toContain('本轮材料');
    expect(p).toContain('主厨老王，成都人');
    expect(p).toContain('原稿本身不是事实依据');
    expect(p).toContain('不能放进「值得保留」');
  });

  it('不传材料时仍能工作（旧调用方不受影响）', () => {
    expect(reviewVerificationPrompt('原稿', '', '审稿结果')).toContain('原稿本身不是事实依据');
  });
});
