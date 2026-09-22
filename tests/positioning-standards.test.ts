import { describe, it, expect } from 'vitest';
import { buildPositioningPrompt } from '@/lib/positioning-standards';

/**
 * 账号定位改造前：提示词写在 API 路由里四百多行 parts.push，
 * 规定的全是「输出哪些小节」，没有一条判断依据。模型于是把小节填满，
 * 但说不出为什么是这个人设、为什么这个配比、凭什么这条路能变现。
 *
 * 另外还有三个具体毛病，下面分别有用例卡住：
 *   · 和知识库的六维定位体系脱节（六维在 Dify 里能检索到，提示词没要过）
 *   · 多处写死「抖音」，而档案支持快手/小红书/视频号/B站
 *   · 限制 1000 字且明确要求「不要输出变现路径」——把最要紧的一维挖掉了
 */

const base = {
  profileSummary: `- 档案名称：言山廷潮汕牛肉自助
- 平台：抖音
- 赛道：美食烹饪
- 设备：专业摄像机、灯光、稳定器
- 团队：2-3人小团队`,
  additionalNotes: '希望多来本地客人',
};

describe('给的是判断依据，不只是小节清单', () => {
  const p = buildPositioningPrompt(base);

  it('带上「让观众发生变化」这把标尺', () => {
    expect(p).toContain('认知变化');
    expect(p).toContain('信任变化');
    // 只有信任变化直接通向成交，这是整套判断的关键
    expect(p).toContain('只有"信任变化"直接通向成交');
  });

  it('六维地基一维不少', () => {
    for (const d of ['人设定位', '用户定位', '内容定位', '呈现定位', '风格调性', '变现定位']) {
      expect(p, `缺少${d}`).toContain(d);
    }
  });

  it('人设的七个入口各自配了验证问题', () => {
    expect(p).toContain('是否是高频真痛点');
    expect(p).toContain('能否持续讲细节');
    expect(p).toContain('对方是否同意长期出镜');
    // 人设最容易写成漂亮空话，所以必须当场回答验证问题
    expect(p).toContain('必须当场回答它对应的验证问题');
  });

  it('内容五类型讲清了各自要证明什么、会栽在哪', () => {
    expect(p).toContain('晒过程型');
    expect(p).toContain('我正在做、能做成');
    expect(p).toContain('前5秒无期待、流水账');
    expect(p).toContain('知识40%');
  });

  it('要求自洽检验，而不是看写得漂不漂亮', () => {
    expect(p).toContain('遮住字幕');
    expect(p).toContain('只听声音');
  });

  it('明确要求说出理由，禁止正确的废话', () => {
    expect(p).toContain('说不出理由的结论直接删掉');
    expect(p).toContain('不是在填表');
  });
});

describe('不再写死抖音', () => {
  it('按档案里的平台给对应特性', () => {
    const xhs = buildPositioningPrompt({ ...base, platform: '小红书' });
    expect(xhs).toContain('搜索属性强');
    expect(xhs).not.toContain('老铁关系');
  });

  it('每个支持的平台都有自己的说明', () => {
    for (const [plat, kw] of [
      ['抖音', '前3秒'],
      ['快手', '老铁关系'],
      ['小红书', '搜索属性强'],
      ['视频号', '社交关系链'],
      ['B站', '干货密度'],
    ] as const) {
      expect(buildPositioningPrompt({ ...base, platform: plat }), `${plat} 没有专属说明`).toContain(kw);
    }
  });

  it('不知道平台时明确叫模型别假设成抖音', () => {
    const p = buildPositioningPrompt(base);
    expect(p).toContain('不要假设是抖音');
  });
});

describe('禁忌是硬约束', () => {
  it('档案里的禁忌原样带上', () => {
    const p = buildPositioningPrompt({ ...base, restrictions: '不能说全网最便宜' });
    expect(p).toContain('全网最便宜');
    expect(p).toContain('违反即不可用');
  });

  it('没填禁忌也保留通用底线', () => {
    const p = buildPositioningPrompt(base);
    expect(p).toContain('揭秘');  // 容易招同行举报，要求换说法
    expect(p).toContain('教你看懂');
  });
});

describe('一个函数三种用法', () => {
  it('full：六维全套 + 起步30条', () => {
    const p = buildPositioningPrompt({ ...base, focus: 'full' });
    expect(p).toContain('# 🎯 账号定位方案');
    expect(p).toContain('起步 30 条怎么排');
  });

  it('business：变现深挖，要成交路径和信任证据', () => {
    const p = buildPositioningPrompt({ ...base, focus: 'business' });
    expect(p).toContain('# 💰 商业定位方案');
    expect(p).toContain('成交路径');
    expect(p).toContain('信任证据清单');
    // 高客单靠证据不靠形容词
    expect(p).toContain('可以拍成画面');
  });

  it('content：内容深挖，要系列和前30条规划', () => {
    const p = buildPositioningPrompt({ ...base, focus: 'content' });
    expect(p).toContain('# 💎 内容定位方案');
    expect(p).toContain('内容系列');
    expect(p).toContain('不要做什么');
  });

  it('深挖模式不重复输出六维地基那一整套', () => {
    const biz = buildPositioningPrompt({ ...base, focus: 'business' });
    expect(biz).not.toContain('七个入口');
  });

  it('深挖时继承已有地基，并要求保持一致', () => {
    const p = buildPositioningPrompt({
      ...base,
      focus: 'business',
      baseline: '一句话定位：只做原切鲜切的潮汕牛肉自助',
    });
    expect(p).toContain('已确定的定位地基');
    expect(p).toContain('原切鲜切');
    expect(p).toContain('不要另起炉灶');
  });

  it('没有地基时不输出空的地基标题', () => {
    expect(buildPositioningPrompt(base)).not.toContain('已确定的定位地基');
  });
});

describe('变现这一维不能再被砍掉', () => {
  it('六维输出里明确要成交路径和客单价', () => {
    const p = buildPositioningPrompt(base);
    expect(p).toContain('客单价区间');
    expect(p).toContain('成交路径');
    // 旧提示词写着「不要输出：…变现路径」，正是用户想要商业定位的那一块
    expect(p).not.toContain('不要输出：视觉呈现');
  });
});

describe('补充说明优先于档案', () => {
  it('用户临时写的要求要压过档案里的默认值', () => {
    const p = buildPositioningPrompt({ ...base, additionalNotes: '这次只想做同城' });
    expect(p).toContain('这次只想做同城');
    expect(p).toContain('优先级高于上面的档案');
  });

  it('没写补充说明时不留空段落', () => {
    const p = buildPositioningPrompt({ profileSummary: base.profileSummary });
    expect(p).not.toContain('用户补充说明');
  });
});
