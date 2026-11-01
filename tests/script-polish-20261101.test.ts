// 脚本打磨（2026-11-01 产品方，lib/script-polish）：体检 → 只改被点名的句子 → 复检，最多两轮，只升不降。
// 这里用假的模型回答测流程：取上下文、确定性体检、替换（口播和分镜一起换）、采用规则（变好才换、编了新细节不换）。
import { describe, expect, it } from 'vitest';
import {
  polishContextFromPrompt, localScriptIssues, parseReviewIssues, parseReplacements, applyReplacements, polishScript,
} from '@/lib/script-polish';

const PROMPT = `【任务：脚本生成】你是短视频编导。
## 当前任务
- 主题：拿着图来剪？先等等

## 本条的内容树（结构已定，不另选）
【内容树】
- 具体结构：36计·第1计 反向操作（必须按这个结构写，不另选）
- 目的：流量型

## 用户本轮要求
【来自选题策划的参考内容】
【当前版本】
## 选题1：拿着图来剪？先等等
**🅰 打法**
常规：顾客拿图就照剪 → 阿杰先不动剪刀问三个问题 → 顾客的真实反应

【本条创作的连续设置】
- 主题：拿着图来剪？

## 账号背景与可用资源
### 🪪 人设事实卡（最硬的事实，以它为准）
- **出镜人是谁**：店主阿杰
- **干这行几年**：剪发11年
这是编导确认过的事实。
- 前采要点（客户原话和真实细节，写内容时优先用）：店主剪发11年，坚持剪前先聊脸型
## 🎬 本条用的拍法：反向操作
- **结构公式**：常规A → 反向B → 真实反应/结果
## 内容质量要求
- 先落实用户想拍的那条内容`;

const SCRIPT = `## 第1步：脚本策略卡
核心问题：拿图照剪适不适合

## 第2步：纯文字文案
今天又有人拿图来，我还是那句话：先别急着剪。
图里的发型再好看，不适合你也白搭。
评论区说说，你拿图剪发时，理发师会先问你这些吗？

## 第3步：完整分镜脚本
**【镜头1】0-8秒**
**台词**：今天又有人拿图来，我还是那句话：先别急着剪。
**【镜头2】8-20秒**
**台词**：图里的发型再好看,不适合你也白搭。
**【镜头3】20-30秒**
**台词**：评论区说说，你拿图剪发时，理发师会先问你这些吗？

## 第4步：执行与优化建议
- 征得顾客同意`;

describe('从脚本提示词里取打磨要用的几块', () => {
  it('选题卡、结构公式、目的、档案事实、本人的话', () => {
    const ctx = polishContextFromPrompt(PROMPT);
    expect(ctx.topicCard).toContain('阿杰先不动剪刀问三个问题');
    expect(ctx.topicCard).not.toContain('本条创作的连续设置');
    expect(ctx.structure).toContain('常规A → 反向B → 真实反应/结果');
    expect(ctx.purpose).toBe('流量型');
    expect(ctx.facts).toContain('剪发11年');
    expect(ctx.voice).toContain('坚持剪前先聊脸型');
  });
});

describe('不调模型的体检', () => {
  it('新编的具体细节、结尾动作对不上目的，都点出来', () => {
    const ctx = polishContextFromPrompt(PROMPT);
    const bad = SCRIPT.replace('图里的发型再好看，不适合你也白搭。', '上周三来了个客人，花了300元。').replace('评论区说说，你拿图剪发时，理发师会先问你这些吗？', '想剪就私信我。');
    const r = localScriptIssues(bad, ctx, PROMPT);
    expect(r.novel.size).toBeGreaterThan(0);
    expect(r.issues.some((i) => i.rule === '结尾动作')).toBe(true);
  });

  it('正常的稿子没有新细节、结尾对得上', () => {
    const r = localScriptIssues(SCRIPT, polishContextFromPrompt(PROMPT), PROMPT);
    expect(r.novel.size).toBe(0);
    expect(r.issues.some((i) => i.rule === '结尾动作')).toBe(false);
  });
});

describe('解析模型的回答', () => {
  it('体检 JSON：代码块里、外面多了话都认得出', () => {
    const issues = parseReviewIssues('好的\n```json\n{"issues":[{"rule":"D","level":"必须改","quote":"图里的发型再好看，不适合你也白搭。","problem":"像总结道理","fix":"说眼前这位顾客"}]}\n```');
    expect(issues?.[0].rule).toBe('D');
    expect(parseReviewIssues('{"issues": []}')).toEqual([]);
    expect(parseReviewIssues('没有 JSON')).toBeNull();
  });

  it('原句里带了没转义的英文双引号：修补后照样解析（线上实测踩过）', () => {
    const raw = '```json\n{"issues": [{"rule": "A", "level": "必须改", "quote": "阿杰：比如"你早上只有五分钟"或"你脸型偏圆"", "problem": "缺真实反应", "fix": "补"}]}\n```';
    const issues = parseReviewIssues(raw);
    expect(issues?.length).toBe(1);
    expect(issues?.[0].quote).toContain('你早上只有五分钟');
  });

  it('新句里冒出编的经历和顾客规律（原句没有）：这一处替换不用', () => {
    const pairs = parseReplacements('[{"from":"临时买和提前准备不一样。","to":"我这4年看下来，秋天来补货的妈妈和夏天不一样。"},{"from":"这个要先看。","to":"你看这个，先看这儿。"}]');
    expect(pairs).toEqual([{ from: '这个要先看。', to: '你看这个，先看这儿。' }]);
  });

  it('体检要求口吻那一条单独点名 2–3 句', async () => {
    const { buildScriptReviewPrompt } = await import('@/lib/script-polish');
    expect(buildScriptReviewPrompt(SCRIPT, polishContextFromPrompt(PROMPT), [])).toContain('挑出最不像本人当面说话的 2–3 句');
  });

  it('替换对', () => {
    expect(parseReplacements('```json\n[{"from":"甲句","to":"乙句"},{"from":"","to":"x"}]\n```')).toEqual([{ from: '甲句', to: '乙句' }]);
  });
});

describe('替换：口播和分镜里的同一句一起换，标点不一样也认', () => {
  it('第 2 步和第 3 步都换掉', () => {
    const { text, applied } = applyReplacements(SCRIPT, [{ from: '图里的发型再好看，不适合你也白搭。', to: '你这张图上的人头发是往后吹的，你早上有这个时间吗？' }]);
    expect(applied).toBe(1);
    expect(text).not.toContain('不适合你也白搭');
    expect(text.split('你早上有这个时间吗').length - 1).toBe(2);
  });

  it('新句是在原句后面接着补的：只补一次，不重复', () => {
    const from = '图里的发型再好看，不适合你也白搭。';
    const { text } = applyReplacements(SCRIPT, [{ from, to: `${from}你早上有这个时间吗？` }]);
    expect(text.split('你早上有这个时间吗').length - 1).toBe(2);
    expect(text).not.toContain('你早上有这个时间吗？你早上有这个时间吗');
  });

  it('句末标点连带换掉，不出现「？？」「。。」，也不把下一行并上来', () => {
    const { text } = applyReplacements(SCRIPT, [{ from: '今天又有人拿图来，我还是那句话：先别急着剪', to: '又有人拿着图进门了，先别急。' }]);
    expect(text).not.toMatch(/。。|？？/);
    expect(text).toContain('又有人拿着图进门了，先别急。\n图里的发型再好看');
  });

  it('润色提示词不许替顾客编反应，体检不许给示范句', async () => {
    const { buildScriptPolishPrompt, buildScriptReviewPrompt } = await import('@/lib/script-polish');
    const ctx = polishContextFromPrompt(PROMPT);
    expect(buildScriptPolishPrompt(SCRIPT, ctx, [])).toContain('不替顾客、受访者、路人写他们的反应');
    expect(buildScriptReviewPrompt(SCRIPT, ctx, [])).toContain('fix 只写往哪个方向改，不写示范句');
  });

  it('原句找不到就不换', () => {
    expect(applyReplacements(SCRIPT, [{ from: '原稿里没有的一句话', to: 'x' }]).applied).toBe(0);
  });
});

describe('打磨流程：只升不降，最多两轮', () => {
  const issueJson = (n: number) => `{"issues":[${Array.from({ length: n }, () => '{"rule":"D","level":"必须改","quote":"图里的发型再好看，不适合你也白搭。","problem":"像总结道理","fix":"说眼前这位顾客"}').join(',')}]}`;

  it('体检没问题：一次调用，原稿交付', async () => {
    const r = await polishScript({ draft: SCRIPT, query: PROMPT, known: PROMPT, ask: async () => '{"issues": []}' });
    expect(r.changed).toBe(false);
    expect(r.calls).toBe(1);
  });

  const OK = '{"unresolved": [], "added": []}';

  it('改完复检：点名的都改好、没引入新问题，采用新版', async () => {
    const answers = [issueJson(1), '[{"from":"图里的发型再好看，不适合你也白搭。","to":"你这张图上的人头发是往后吹的，你早上有这个时间吗？"}]', OK];
    const status: string[] = [];
    const r = await polishScript({ draft: SCRIPT, query: PROMPT, known: PROMPT, ask: async () => answers.shift() ?? null, onStatus: (s) => status.push(s) });
    expect(r.changed).toBe(true);
    expect(r.text).toContain('你早上有这个时间吗');
    expect(r.rounds[0].accepted).toBe(true);
    expect(status[0]).toContain('体检');
  });

  it('复检说点名的没改好：保留原稿', async () => {
    const answers = [issueJson(1), '[{"from":"图里的发型再好看，不适合你也白搭。","to":"其实发型这件事因人而异。"}]', '{"unresolved": [1], "added": []}'];
    const r = await polishScript({ draft: SCRIPT, query: PROMPT, known: PROMPT, ask: async () => answers.shift() ?? null });
    expect(r.changed).toBe(false);
    expect(r.rounds[0].reason).toContain('只改好了 0 处');
  });

  it('一轮里有一句改坏了：只退回那一句，改好的留下', async () => {
    const answers = [
      issueJson(2),
      '[{"from":"图里的发型再好看，不适合你也白搭。","to":"你这张图上的人头发是往后吹的。"},{"from":"今天又有人拿图来，我还是那句话：先别急着剪。","to":"顾客听完点了点头。"}]',
      '{"unresolved": [], "added": [{"rule":"G","level":"必须改","quote":"顾客听完点了点头。","problem":"编了顾客的反应","fix":"按现场真实反应"}]}',
    ];
    const r = await polishScript({ draft: SCRIPT, query: PROMPT, known: PROMPT, maxRounds: 1, ask: async () => answers.shift() ?? null });
    expect(r.changed).toBe(true);
    expect(r.text).toContain('你这张图上的人头发是往后吹的');
    expect(r.text).not.toContain('点了点头');
    expect(r.text).toContain('先别急着剪');
    expect(r.rounds[0].reason).toContain('退回原句');
  });

  it('复检说改的时候引入了「必须改」的新问题：保留原稿', async () => {
    const answers = [issueJson(1), '[{"from":"图里的发型再好看，不适合你也白搭。","to":"顾客听完点了点头。"}]', '{"unresolved": [], "added": [{"rule":"G","level":"必须改","quote":"顾客听完点了点头。","problem":"编了顾客的反应","fix":"按现场真实反应"}]}'];
    const r = await polishScript({ draft: SCRIPT, query: PROMPT, known: PROMPT, ask: async () => answers.shift() ?? null });
    expect(r.changed).toBe(false);
    expect(r.rounds[0].reason).toContain('引入了新问题');
  });

  it('不再拿「重新体检挑出几条」判好坏：复检只核点名的几处', async () => {
    const { buildScriptVerifyPrompt } = await import('@/lib/script-polish');
    const p = buildScriptVerifyPrompt(SCRIPT, polishContextFromPrompt(PROMPT), [], [{ from: '甲', to: '乙' }]);
    expect(p).toContain('不重新体检全文');
    expect(p).toContain('原句「甲」→ 新句「乙」');
  });

  it('润色第一次没回替换：重试一次', async () => {
    const answers = [issueJson(1), '不是 JSON', '[{"from":"图里的发型再好看，不适合你也白搭。","to":"你这张图上的人头发是往后吹的。"}]', OK];
    const r = await polishScript({ draft: SCRIPT, query: PROMPT, known: PROMPT, ask: async () => answers.shift() ?? null });
    expect(r.changed).toBe(true);
    expect(r.calls).toBe(4);
  });

  it('润色借机编了新的具体细节：不采用，也不再复检', async () => {
    const answers = [issueJson(1), '[{"from":"图里的发型再好看，不适合你也白搭。","to":"上周三有个客人花了300元剪这个发型。"}]', OK];
    const r = await polishScript({ draft: SCRIPT, query: PROMPT, known: PROMPT, ask: async () => answers.shift() ?? null });
    expect(r.changed).toBe(false);
    expect(r.calls).toBe(2);
    expect(r.rounds[0].reason).toContain('新冒出了具体细节');
  });

  it('模型调用失败：体检重试一次，还不行就原稿交付，不打断', async () => {
    const r = await polishScript({ draft: SCRIPT, query: PROMPT, known: PROMPT, ask: async () => null });
    expect(r.text).toBe(SCRIPT);
    expect(r.reviewFailed).toBe(true);
    expect(r.calls).toBe(2);
  });

  it('两轮：第一轮没改完的、新引入的「建议改」带到第二轮，两轮都采用，正常 5 次调用', async () => {
    const answers = [
      issueJson(2),
      '[{"from":"图里的发型再好看，不适合你也白搭。","to":"你这张图上的人头发是往后吹的。"}]',
      '{"unresolved": [], "added": [{"rule":"D","level":"建议改","quote":"你这张图上的人头发是往后吹的。","problem":"还可以接一句问眼前这个人","fix":"问他早上的时间"}]}',
      '[{"from":"你这张图上的人头发是往后吹的。","to":"你这张图上的人头发是往后吹的，你早上有这个时间吗？"}]',
      OK,
    ];
    const r = await polishScript({ draft: SCRIPT, query: PROMPT, known: PROMPT, ask: async () => answers.shift() ?? null });
    expect(r.rounds.filter((x) => x.accepted).length).toBe(2);
    expect(r.calls).toBe(5);
    expect(r.text).toContain('你早上有这个时间吗');
  });
});
