// 审稿与标题提示词的真实产出检验（手动运行，不纳入 npm test）
//   npx vitest run tests/review-title-quality.integration.test.ts
//
// 这两个板块的提示词刚从「3 条 / 5 条通用要求」换成完整标准，
// 但提示词结构对不对，和产出好不好是两回事。这里真调一次 Dify，
// 用同一套评分器检查它到底给出了什么。
import { describe, it, expect } from 'vitest';
import { buildReviewPrompt } from '@/lib/review-standards';
import { buildTitlePrompt } from '@/lib/title-standards';
import { buildSearchQuery } from '@/lib/search-query';
import { evaluateScriptQualityStrict, formatQualityReport } from '@/lib/quality-checker';

const KEY = process.env.DIFY_API_KEY || '';

/** 一份故意写得平庸的稿子：钩子软、没秒数、没波点、带书面语和空洞词 */
const WEAK_DRAFT = `大家可以看一下，今天我想跟大家聊聊开烤肉店选址的问题。

我做餐饮很多年了，见过很多人开店失败。其实问题往往出在选址上。

首先，很多人喜欢选人流量大的地方，但是租金太高了。其次，有些人贪便宜选了偏僻的位置，结果没有客人。综上所述，选址要平衡租金和人流。

我觉得这个方法非常好，大家可以试试。希望对大家有帮助。`;

async function callDify(prompt: string, searchQuery: string) {
  const t0 = Date.now();
  const r = await fetch('https://api.dify.ai/v1/chat-messages', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      inputs: { query: prompt, search_query: searchQuery, conversation_history: '', dealReasons: '' },
      query: prompt,
      response_mode: 'blocking',
      user: 'prompt-quality-check',
    }),
  });
  const txt = await r.text();
  expect(r.ok, `HTTP ${r.status}: ${txt.slice(0, 300)}`).toBe(true);
  const data = JSON.parse(txt);
  return {
    answer: data.answer || '',
    seconds: (Date.now() - t0) / 1000,
    recalled: (data.metadata?.retriever_resources || []).length,
  };
}

describe('审稿提示词的真实产出', () => {
  it('对一份平庸稿子给出的审稿意见', async () => {
    const prompt = buildReviewPrompt({
      draftContent: WEAK_DRAFT,
      platform: '抖音',
      duration: '60秒',
      scriptType: '教知识型',
      reviewDimensions: '【开头吸引力】3秒钩子是否有力\n【文案质量】是否口语化、是否用了感受词',
      optimizationGoals: '提升开头吸引力、去除营销腔',
      benchmarkScript: '',
      compareMode: true,
      severityLabels: true,
    });

    const searchQuery = buildSearchQuery('审稿优化', { taskType: '审稿优化', platform: '抖音' }, prompt);

    console.log('\n===== 审稿提示词规模 =====');
    console.log(`提示词 ${prompt.length} 字，检索短查询「${searchQuery}」`);

    const { answer, seconds, recalled } = await callDify(prompt, searchQuery);
    console.log(`耗时 ${seconds.toFixed(1)}s  产出 ${answer.length} 字  知识库召回 ${recalled} 条`);

    console.log('\n===== 审稿意见该有的东西 =====');
    const checks: Array<[string, boolean]> = [
      ['给了综合得分', /\d(\.\d)?\s*分/.test(answer)],
      ['逐维度打分表', /\|.*维度.*\|/.test(answer) || /开场钩子.*\d+/.test(answer)],
      ['指出了废话开场', /大家可以看一下|开场|钩子/.test(answer)],
      ['点名了书面语「综上所述」', /综上所述/.test(answer)],
      ['点名了空洞词「非常好」', /非常好/.test(answer)],
      ['给了可直接用的改写句', /改成|改写/.test(answer)],
      ['有严重程度标注', /🔴|🟡|🟢|必须改/.test(answer)],
      ['有原文vs改写对照', /原文/.test(answer) && /改写/.test(answer)],
      ['给了优化后完整脚本', /优化后|完整脚本/.test(answer)],
      ['没有寒暄结尾', !/希望对你有帮助|以上就是/.test(answer)],
    ];
    for (const [name, pass] of checks) console.log(`  ${pass ? '✅' : '❌'} ${name}`);

    const passed = checks.filter(([, p]) => p).length;
    console.log(`\n通过 ${passed}/${checks.length}`);

    // 审稿给出的「优化后脚本」本身该经得起同一把尺子
    const rewritten = answer.split(/优化后|完整脚本/).slice(-1)[0] || '';
    if (rewritten.length > 200) {
      console.log('\n===== 它改出来的脚本，按同一标准打分 =====');
      console.log(formatQualityReport(evaluateScriptQualityStrict(rewritten)));
    }

    console.log('\n===== 审稿意见前 800 字 =====');
    console.log(answer.slice(0, 800));
  }, 240000);
});

describe('标题提示词的真实产出', () => {
  it('生成 5 个标题并检查是否各赌不同动机', async () => {
    const prompt = buildTitlePrompt({
      topic: '新手开烤肉店，选址最容易踩的坑',
      titleTypeLabel: '痛点式',
      titleFormulaValue: 'pain-solution',
      titleFormulaLabel: '痛点+解决方案',
      keywordStrategyLabel: '搜索词',
      keywordStrategyDesc: '高搜索量',
      platform: '抖音',
      targetAudience: '想开店的餐饮创业者',
      count: 5,
    });

    const searchQuery = buildSearchQuery('标题封面', { taskType: '标题封面', platform: '抖音' }, prompt);

    console.log('\n===== 标题提示词规模 =====');
    console.log(`提示词 ${prompt.length} 字，检索短查询「${searchQuery}」`);

    const { answer, seconds, recalled } = await callDify(prompt, searchQuery);
    console.log(`耗时 ${seconds.toFixed(1)}s  产出 ${answer.length} 字  知识库召回 ${recalled} 条`);

    console.log('\n===== 标题产出该有的东西 =====');
    const motives = ['好奇', '恐惧', '获得感', '认同', '窥私', '省钱'];
    const usedMotives = motives.filter((m) => answer.includes(m));
    const checks: Array<[string, boolean]> = [
      ['输出了 5 条', (answer.match(/###\s*\d/g) || []).length >= 5],
      ['标注了字数', /\d+\s*字/.test(answer)],
      ['标注了赌的动机', /动机/.test(answer)],
      ['动机至少 3 种不同', usedMotives.length >= 3],
      ['标注了核心卖点', /卖点/.test(answer)],
      ['给了投放建议', /首选|备选/.test(answer)],
      ['给了封面大字', /封面/.test(answer)],
      ['没有出现违规词「揭秘」', !/揭秘/.test(answer)],
      ['没有绝对化用语', !/最好的|第一名|100%/.test(answer)],
      ['没有开场白', !/以下是|为你准备/.test(answer)],
    ];
    for (const [name, pass] of checks) console.log(`  ${pass ? '✅' : '❌'} ${name}`);
    console.log(`  命中的动机种类：${usedMotives.join('、') || '（无）'}`);

    const passed = checks.filter(([, p]) => p).length;
    console.log(`\n通过 ${passed}/${checks.length}`);

    console.log('\n===== 标题产出前 900 字 =====');
    console.log(answer.slice(0, 900));
  }, 240000);
});
