/**
 * 2026-10-07 平台体检报告的整改项（docs 里 Codex 的体检），每项一个可复现的检查。
 */
import { describe, expect, it } from 'vitest';
import { unsupportedFacts } from '@/lib/quality-checks';
import { evaluateScriptQualityStrict, FORBIDDEN_PHRASES } from '@/lib/quality-checker';
import { buildReviewPrompt } from '@/lib/review-standards';
import { extractTitle, resultStats, spokenText } from '@/lib/script-result-utils';
import { readCode } from './helpers/source';

describe('A06 出处逐句看', () => {
  it('别处一个无关网址，不再让「据统计」整篇放行', () => {
    const text = '参考：https://example.com/about\n据统计，县城七成老板国庆后生意下滑。';
    expect(unsupportedFacts(text, '').some((x) => x.includes('引用了数据但没给出处'))).toBe(true);
  });
  it('这一句自己带了出处才算', () => {
    expect(unsupportedFacts('据统计，国庆出游人次增长（来源：文旅部 2026 年 10 月公告）', '').some((x) => x.includes('引用了数据'))).toBe(false);
    expect(unsupportedFacts('据统计，国庆出游人次增长[1]', '').some((x) => x.includes('引用了数据'))).toBe(false);
  });
});

describe('A04 编出来的个人经历', () => {
  const life = (text: string, known = '') => unsupportedFacts(text, known).filter((x) => x.startsWith('个人经历'));
  it('作息、家人、钱的具体事，资料里没有就提醒', () => {
    expect(life('我每天早上五点就到店，七点开始备货。')).toHaveLength(1);
    expect(life('我妈住院那年，我差点把店关了。')).toHaveLength(1);
    expect(life('那时候我欠了二十万，只能硬着头皮干。')).toHaveLength(1);
    expect(life('我女儿今年考上了县一中，我就想多挣点。')).toHaveLength(1);
    // 英文标点也算一句话的边界（不能跨句把「我妈」和后一句的「毕业」连起来）
    expect(life('辞职那天我妈哭了,她说你大学毕业好不容易')).toHaveLength(0);
  });
  it('档案或素材里有的、标了 X / 待确认 / 换成你的，都不算', () => {
    expect(life('我每天早上五点就到店', '老板每天早上五点就到店备货')).toHaveLength(0);
    expect(life('我每天早上X点就到店')).toHaveLength(0);
    expect(life('我妈【换成你的：家里人的一句话】')).toHaveLength(0);
    expect(life('【待确认】我每天早上五点到店')).toHaveLength(0);
  });
  it('普通的「我」不误报：说做法、说观点', () => {
    expect(life('我每次都先问客人预算，再带他去看。我觉得这样客人更放心。')).toHaveLength(0);
    expect(life('我们家具城的沙发都是实木的。')).toHaveLength(0);
  });
});

describe('A05 审稿不再逼着改语气', () => {
  it('「可能、我觉得、应该、大概」不算空洞、不扣分', () => {
    for (const w of ['可能', '我觉得', '应该', '大概']) expect(FORBIDDEN_PHRASES.level3).not.toContain(w);
    const a = evaluateScriptQualityStrict('【开场钩子】0-3秒：可能有效，先试一周看看');
    expect(a.suggestions.join()).not.toMatch(/空洞表达需具体化：.*可能/);
  });
  it('没有「你妈、手指头」不再记成缺失项，只给可忽略的提示', () => {
    const r = evaluateScriptQualityStrict('【开场钩子】0-3秒：我们是一家做了十年的家具品牌。');
    expect(r.issues.join()).not.toMatch(/接地气/);
    expect(r.suggestions.join()).toMatch(/品牌、采访类稿件不需要就忽略/);
  });
  it('预检不再说「机器已确认、直接采信」；表达建议标明仅供参考；谨慎说法要保留', () => {
    const p = buildReviewPrompt({ draftContent: '可能有效，先试试。', platform: '抖音', duration: '', scriptType: '', personalRequirements: '', reviewDimensions: '', optimizationGoals: '', benchmarkScript: '', compareMode: false } as never);
    expect(p).not.toMatch(/机器已确认|直接采信/);
    expect(p).toMatch(/有分寸的说法不算问题/);
    expect(p).toMatch(/没有依据的不要为了具体去编数字/);
  });
});

describe('B01 口播时长只算要念的', () => {
  const plan = `## 脚本策略卡\n- 视频目的：流量型\n- 核心痛点：老板国庆后没客人\n${'策略说明很长。'.repeat(100)}\n\n## 纯文字文案\n国庆过完了，我去街上转了一圈。\n发现老板们都在干一件事。\n\n## 正文脚本\n【镜头1】0-3秒 画面：街景`;
  it('有「纯文字文案」就只算它', () => {
    expect(spokenText(plan)).toBe('国庆过完了，我去街上转了一圈。\n发现老板们都在干一件事。');
    const s = resultStats(plan);
    expect(s.spokenChars).toBeLessThan(40);
    expect(s.totalChars).toBeGreaterThan(500);
    expect(s.seconds).toBeLessThan(10);
  });
  it('没有那一节，收「台词：」那几行；都没有就不估时长', () => {
    expect(spokenText('| 1 | 中景 |\n- 台词：这家人预算只有X万\n- 台词：无')).toBe('这家人预算只有X万');
    expect(resultStats('## 方向1：国庆后的县城\n- 核心思路：拍老板').seconds).toBe(0);
  });
  it('结果页、历史页都用它', () => {
    expect(readCode('components/workspace/ResultPanel.tsx')).toMatch(/stats: resultStats\(cleanBody\)/);
    expect(readCode('components/workspace/HistoryPanel.tsx')).toMatch(/const stats = resultStats\(body\)/);
  });
});

describe('B02 历史标题不拿通用栏目名', () => {
  it('跳过「脚本策略卡」「第1步」这类，取真正的主题', () => {
    expect(extractTitle('## 第1步：脚本策略卡\n## 📋 脚本策略卡\n# 国庆后县城老板的真实一天\n正文')).toBe('国庆后县城老板的真实一天');
  });
});

describe('B03 / C03 自动修正', () => {
  it('提示改成「按资料改写」，后半句用改完重新核对的结果', () => {
    const src = readCode('components/workspace/FactCheckNotice.tsx');
    expect(src).not.toMatch(/已自动修正 \{auto\.count\} 处/);
    expect(src).toMatch(/重新核对后还有 \{issues\.length\} 处待你确认/);
  });
  it('自动通道服务端核资格：自己查不出问题不给修；同一份稿子只自动修一次', () => {
    const route = readCode('app/api/fact-fix/route.ts');
    expect(route).toMatch(/const found = unsupportedFacts\(text, context, \{ light \}\)/);
    expect(route).toMatch(/服务端没查到需要自动修正的地方/);
    expect(route).toMatch(/autoFixed\.has\(key\)[\s\S]{0,120}status: 409/);
  });
});

describe('A07 隐私页和实际数据流一致', () => {
  const page = readCode('app/privacy/page.tsx');
  it('写明联网搜索交给阿里云、发的是什么、关掉就不发；模型经第三方接口转接', () => {
    expect(page).toMatch(/阿里云（联网搜索）/);
    expect(page).toMatch(/不发之前的对话、账号档案或上传的文件/);
    expect(page).toMatch(/经第三方接口服务商转接调用/);
    expect(page).toMatch(/硅基流动/);
  });
});
