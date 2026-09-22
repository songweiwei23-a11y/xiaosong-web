import { describe, it, expect } from 'vitest';
import {
  BRIEF_FIELDS,
  buildBriefPrompt,
  parseBrief,
  serializeBrief,
  briefBlockFor,
  briefCompleteness,
} from '@/lib/creative-brief';

/**
 * 创作简报要解决的问题，是量出来的：
 * 账号定位 12466 字，各板块注入时按 2000 字截断，只有前 16% 进得去。
 * 进去的是核心结论、行业分析（其他板块用不上）和半截前采问题（更用不上）；
 * 被截掉的是一句话定位、六维地基全部、记忆点、差异化——
 * **人设标签、用户画像、语气、禁忌一个都没到达**，还断在句子中间。
 *
 * 简报不是摘要是转译：把"分析结论"翻译成"创作指令"，
 * 并按消费方切片，各板块只取自己那几段。
 */

const SAMPLE = `### 1. 一句话定位

接单先看人、不合适的钱不赚的南乐本土编导

### 2. 人设与口吻

- **我是谁**：南乐本地、做了六年的实体店编导
- **说话什么调**：唠嗑的口气，爱用"你说是不是这个理儿"
- **会说的一句话**：这单我没接，他那店的问题不在抖音上
- **不会说的一句话**：三个月保证你粉丝破万

### 3. 说给谁听

- **画像**：开了六七年、客流在掉、被上一个代运营坑过的南乐餐馆老板
- **他最怕什么**：又交学费、老板自己不会拍、投了钱看不到人来
- **他最想要什么**：来客人、能长期有人管、别忽悠
- **他会搜什么词**：南乐 抖音代运营、饭店怎么做抖音

### 4. 内容方向

- **主打类型与配比**：晒过程50% + 讲故事30% + 教知识20%
- **能长期挖的选题来源**：老客户的真实店况、接单时拒绝过的案例
- **明确不做的方向**：不揭行业黑幕、不拍同行对比、不做纯数据分析

### 5. 凭什么信你

- **核心卖点**：本地、跑不了；先干出效果再谈钱
- **可以拍成画面的证据**：老客户出镜说、店里客流实拍、聊天记录

### 6. 怎么拍

- **呈现形式**：口播 + 在客户店里的 Vlog
- **真实条件**：一个人、手机+灯、多在家或车里、一周两次
- **视觉调性**：不追求精致，手持轻微晃动反而可信

### 7. 记忆点

- **语言**："这单我没接" —— 每次讲拒单故事时都说（待验证）
- **道具**：手机当道具，拍的时候拿在手里

### 8. 绝对不能说

- 绝对化用语（最好/第一/全网最便宜）
- 不诋毁同行、不爆行业黑料
- 不承诺具体涨粉数字`;

describe('字段定义', () => {
  it('每个字段都有标题、消费方和产出要求', () => {
    for (const f of BRIEF_FIELDS) {
      expect(f.label, `${f.key} 缺标题`).toBeTruthy();
      expect(f.spec, `${f.key} 缺产出要求`).toBeTruthy();
      expect(f.hint, `${f.key} 缺界面提示`).toBeTruthy();
      expect(f.modules.length, `${f.key} 没有任何板块会读它`).toBeGreaterThan(0);
    }
  });

  it('key 和 label 都不重复', () => {
    const keys = BRIEF_FIELDS.map((f) => f.key);
    const labels = BRIEF_FIELDS.map((f) => f.label);
    expect(new Set(keys).size).toBe(keys.length);
    // label 是解析的锚点，重了会串段
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('五个板块都至少能读到一段', () => {
    for (const m of ['topic', 'script', 'storyboard', 'review', 'title'] as const) {
      const n = BRIEF_FIELDS.filter((f) => f.modules.includes(m)).length;
      expect(n, `${m} 一段都读不到`).toBeGreaterThan(0);
    }
  });

  it('一句话定位和禁忌是所有板块都要的', () => {
    for (const key of ['oneline', 'forbidden']) {
      const f = BRIEF_FIELDS.find((x) => x.key === key)!;
      for (const m of ['topic', 'script', 'storyboard', 'review', 'title'] as const) {
        expect(f.modules, `${key} 漏了 ${m}`).toContain(m);
      }
    }
  });
});

describe('生成提示词', () => {
  const p = buildBriefPrompt({ positioningFull: '（这里是一份完整的账号定位方案）' });

  it('讲清楚这是转译不是摘要，并给了正反例', () => {
    expect(p).toContain('这不是摘要，是转译');
    expect(p).toContain('前者在分析，后者能照着写');
  });

  it('把定位原文带进去', () => {
    expect(p).toContain('（这里是一份完整的账号定位方案）');
  });

  it('要求标题一个字都不能改——各板块靠它切片', () => {
    expect(p).toContain('标题一个字都不要改');
    for (const f of BRIEF_FIELDS) expect(p).toContain(f.label);
  });

  it('限制篇幅，这是每次生成都要带的', () => {
    expect(p).toContain('1500 字以内');
  });

  it('额外要求和档案是可选的，不传就不留空段', () => {
    const bare = buildBriefPrompt({ positioningFull: 'x' });
    expect(bare).not.toContain('这次的额外要求');
    expect(bare).not.toContain('账号档案（补充参照）');
    const withNotes = buildBriefPrompt({ positioningFull: 'x', notes: '这次只想做同城' });
    expect(withNotes).toContain('这次只想做同城');
  });
});

describe('解析：标题对不上就等于整份作废', () => {
  it('八个字段全解析出来', () => {
    const v = parseBrief(SAMPLE);
    expect(Object.keys(v).sort()).toEqual(BRIEF_FIELDS.map((f) => f.key).sort());
  });

  it('内容完整，没被上下段串走', () => {
    const v = parseBrief(SAMPLE);
    expect(v.oneline).toBe('接单先看人、不合适的钱不赚的南乐本土编导');
    expect(v.persona).toContain('唠嗑的口气');
    expect(v.persona).not.toContain('画像'); // 下一段的内容不能漏进来
    expect(v.forbidden).toContain('不爆行业黑料');
  });

  it('模型少写序号、用 ## 而不是 ### 也能解析', () => {
    const v = parseBrief('## 一句话定位\n\n测试内容\n\n## 人设与口吻\n\n口吻内容');
    expect(v.oneline).toBe('测试内容');
    expect(v.persona).toBe('口吻内容');
  });

  it('标题里多了字（比如「1. 说给谁听（重要）」）也能认出来', () => {
    const v = parseBrief('### 3. 说给谁听（重要）\n\n画像内容');
    expect(v.audience).toBe('画像内容');
  });

  it('空值不炸', () => {
    for (const x of [null, undefined, '', '   ']) {
      expect(parseBrief(x)).toEqual({});
    }
  });

  it('认不出的标题不会顶掉前一段', () => {
    const v = parseBrief('### 1. 一句话定位\n\n正文\n\n### 无关小节\n\n噪音');
    // 无关小节的内容会并入上一段，但不会丢掉正文
    expect(v.oneline).toContain('正文');
  });
});

describe('编辑后存回去，内容不变形', () => {
  it('解析再拼回，字段内容一致', () => {
    const v = parseBrief(SAMPLE);
    const back = parseBrief(serializeBrief(v));
    for (const f of BRIEF_FIELDS) {
      expect(back[f.key], `${f.label} 走一圈变了`).toBe(v[f.key]);
    }
  });

  it('改过的字段能存下来', () => {
    const v = parseBrief(SAMPLE);
    v.oneline = '改成新的一句话定位';
    expect(parseBrief(serializeBrief(v)).oneline).toBe('改成新的一句话定位');
  });

  it('清空某个字段就不输出那一节，不留空标题', () => {
    const v = parseBrief(SAMPLE);
    v.memory = '';
    const out = serializeBrief(v);
    expect(out).not.toContain('记忆点');
    expect(parseBrief(out).memory).toBeUndefined();
  });

  it('自由补充的内容原样保留', () => {
    const v = parseBrief(SAMPLE);
    v.direction += '\n- **补充**：最近想试试本地商家访谈';
    expect(parseBrief(serializeBrief(v)).direction).toContain('本地商家访谈');
  });
});

describe('按板块切片——这是简报存在的全部意义', () => {
  it('分镜只拿到「怎么拍」「记忆点」和通用两段', () => {
    const b = briefBlockFor(SAMPLE, 'storyboard');
    expect(b).toContain('怎么拍');
    expect(b).toContain('记忆点');
    expect(b).toContain('一句话定位');
    expect(b).toContain('绝对不能说');
    // 分镜不需要知道选题来源和卖点
    expect(b).not.toContain('能长期挖的选题来源');
    expect(b).not.toContain('凭什么信你');
  });

  it('选题拿到方向和人群，拿不到拍摄条件', () => {
    const b = briefBlockFor(SAMPLE, 'topic');
    expect(b).toContain('内容方向');
    expect(b).toContain('说给谁听');
    expect(b).not.toContain('怎么拍');
  });

  it('审稿拿到口吻和人群，作为判据', () => {
    const b = briefBlockFor(SAMPLE, 'review');
    expect(b).toContain('人设与口吻');
    expect(b).toContain('说给谁听');
  });

  it('切出来的比原来截断 2000 字更短', () => {
    for (const m of ['topic', 'script', 'storyboard', 'review', 'title'] as const) {
      const size = briefBlockFor(SAMPLE, m).length;
      expect(size, `${m} 切出来 ${size} 字，太长了`).toBeLessThan(1200);
      expect(size, `${m} 切出来是空的`).toBeGreaterThan(80);
    }
  });

  it('带上「必须与它一致」的约束', () => {
    expect(briefBlockFor(SAMPLE, 'script')).toContain('不要另起炉灶');
  });

  it('没有简报时返回空串，调用方照常工作', () => {
    expect(briefBlockFor(null, 'script')).toBe('');
    expect(briefBlockFor('一段没有任何小节标题的文字', 'script')).toBe('');
  });
});

/**
 * 简报做出来了，还得真的顶掉旧的截断逻辑，否则等于白做——
 * 这正是上几轮反复踩的坑：结构接上了但没生效。
 */
describe('接进 buildContextBlock：有简报就不再截断定位', () => {
  it('有简报时用简报，定位原文不再出现', async () => {
    const { buildContextBlock } = await import('@/lib/creator-context');
    const longPositioning = '账号定位正文'.repeat(2000); // 12000 字，远超 2000 截断线
    const block = buildContextBlock(
      {
        profile: { id: 'p1', profile_name: '测试号' },
        positioning: { name: '定位', summary: longPositioning, full: longPositioning },
        dealReasons: [],
        brief: SAMPLE,
      },
      'storyboard'
    );
    expect(block).toContain('创作简报');
    expect(block).toContain('不追求精致'); // 简报「怎么拍」里的内容
    expect(block).not.toContain('账号定位正文'); // 截断的定位原文不该再进来
  });

  it('没有简报时退回截断定位，并提示可以生成简报', async () => {
    const { buildContextBlock } = await import('@/lib/creator-context');
    const block = buildContextBlock(
      {
        profile: { id: 'p1', profile_name: '测试号' },
        positioning: { name: '定位', summary: '定位摘要内容', full: '定位完整内容' },
        dealReasons: [],
      },
      'script'
    );
    expect(block).toContain('已确定的账号定位');
    expect(block).toContain('生成一份「创作简报」');
  });

  it('有简报之后，注入体积明显小于截断 2000 字', async () => {
    const { buildContextBlock } = await import('@/lib/creator-context');
    const longPositioning = '定'.repeat(12000);
    const base = { profile: { id: 'p1', profile_name: '测试号' }, dealReasons: [] };
    const withBrief = buildContextBlock(
      { ...base, positioning: { name: 'n', summary: longPositioning, full: longPositioning }, brief: SAMPLE },
      'storyboard'
    );
    const withoutBrief = buildContextBlock(
      { ...base, positioning: { name: 'n', summary: longPositioning, full: longPositioning } },
      'storyboard'
    );
    expect(withBrief.length).toBeLessThan(withoutBrief.length);
  });
});

describe('完整度', () => {
  it('全填是 100', () => {
    expect(briefCompleteness(SAMPLE)).toBe(100);
  });

  it('空的是 0', () => {
    expect(briefCompleteness('')).toBe(0);
  });

  it('填一半大约是一半', () => {
    const v = parseBrief(SAMPLE);
    for (const k of ['memory', 'shooting', 'trust', 'trustX']) delete v[k];
    expect(briefCompleteness(serializeBrief(v))).toBeLessThan(70);
  });
});
