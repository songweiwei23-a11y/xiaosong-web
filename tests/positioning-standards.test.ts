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

/**
 * 用户反馈第一版「不够细节、太片面、不够全」。原因是我只用了知识库的
 * 第一篇（战略与IP定位），后面几篇里跟定位直接相关的内容全没进来。
 * 下面这组卡住的就是补进去的那几块——少任何一块，方案就会回到"骨架"状态。
 */
describe('缺的那几块都补上了', () => {
  const p = buildPositioningPrompt(base);

  it('呈现形式有四种对比，不再是一句「口播/Vlog等」', () => {
    expect(p).toContain('情景剧');
    expect(p).toContain('资源不足时，高质量口播远胜粗糙剧情');
    // 情境真实是可信度的执行底线
    expect(p).toContain('宝宝一定要收藏');
  });

  it('风格调性给了六个触点，不是三个关键词了事', () => {
    for (const t of ['主页', '单条封面', '人物', '场景', '语言', '音乐剪辑']) {
      expect(p, `触点缺 ${t}`).toContain(t);
    }
    expect(p).toContain('有意反差');
  });

  it('记忆点这一整块补上了', () => {
    expect(p).toContain('让用户能复述你');
    for (const k of ['语言', '动作', '道具', '服装', '场景']) expect(p).toContain(k);
    // 记忆点最终留哪个要看评论区，不能写成必须照做
    expect(p).toContain('自然形成的标签');
  });

  it('差异化给的是 24 元素微创新方法，不是「别人vs你」', () => {
    expect(p).toContain('身份互换');
    expect(p).toContain('情境还原');
    expect(p).toContain('借物喻人');
    expect(p).toContain('A + 变量B');
    expect(p).toContain('不要急着否定整个赛道');
  });

  it('有系列化设计，能撑 30 集才立项', () => {
    expect(p).toContain('连续追更');
    expect(p).toContain('至少 30 集');
    expect(p).toContain('假装随机却被识破');
  });

  it('变现先分清在玩哪种经济', () => {
    expect(p).toContain('流量经济');
    expect(p).toContain('粉丝经济');
    expect(p).toContain('产品是为了满足需求，人物是为了制造偏好');
  });

  it('30 天实验排到了周期和交付物', () => {
    expect(p).toContain('第1-3天');
    expect(p).toContain('第26-30天');
    expect(p).toContain('一次只改一个变量');
  });

  it('自带「跑不通怎么办」的诊断树', () => {
    expect(p).toContain('数据诊断树');
    expect(p).toContain('有曝光但前段流失');
    expect(p).toContain('咨询多成交少');
  });

  it('三大原则筛掉自嗨方向', () => {
    expect(p).toContain('有用处');
    expect(p).toContain('有共鸣');
    expect(p).toContain('只想着展示自己的产品');
  });

  it('要求输出结论而不是抄参考表', () => {
    expect(p).toContain('不要原样抄进方案里');
    expect(p).toContain('不要越写越简略');
  });

  it('要求指出风险，不许只讲好听的', () => {
    expect(p).toContain('这个号最大的风险');
    expect(p).toContain('不要粉饰');
  });
});

/**
 * 用户第二轮反馈：方案读起来像把档案字段翻译了一遍，
 * 没有「你真的懂我这行」的感觉。要的是代运营的视角——
 * 档案只是粗描，真正让人信服的是那些**用户没写、但一看就会点头**的东西。
 *
 * 内容取自我们自己的《代运营从0到1创作SOP》和《实体店通用选题创作SOP手册》。
 */
describe('代运营的立场，不是顾问写报告', () => {
  const p = buildPositioningPrompt(base);

  it('身份是"下周就要接手这个号"，不是交报告', () => {
    expect(p).toContain('要接手这个号');
    expect(p).toContain('不要为了方案好看开空头支票');
  });

  it('带上前采问题清单，并要求先给推测', () => {
    expect(p).toContain('我会先问老板的几个问题');
    expect(p).toContain('待确认');
  });

  it('抓住最关键那条：顾客感受到的差异化，不是老板以为的', () => {
    // 这是代运营 SOP 里原话，也是"懂行"与否的分水岭
    expect(p).toContain('顾客感受到的，不是老板以为的');
  });

  it('明确要求扩散而不是复述档案', () => {
    expect(p).toContain('要扩散，不要复述');
    expect(p).toContain('全篇复述档案');
    // 宁可说错被纠正，也不能什么都不敢说
    expect(p).toContain('不敢说才是真没用');
  });
});

describe('行业视角', () => {
  const p = buildPositioningPrompt(base);

  it('给了实体店 12 大类型，先认准行业', () => {
    expect(p).toContain('餐饮食品');
    expect(p).toContain('汽车服务');
    expect(p).toContain('母婴亲子');
  });

  it('要求说出档案里没有的行业常识', () => {
    for (const k of ['毛利', '决策链路', '淡旺季', '普遍会犯的错', '同行']) {
      expect(p, `缺少行业认知要求：${k}`).toContain(k);
    }
  });

  it('人群落到八大词根，不许写年龄段', () => {
    for (const g of ['小镇青年', '精致妈妈', '资深中产', 'Z世代', '新锐白领', '都市蓝领', '银发族', '小镇中老年']) {
      expect(p, `缺少人群词根：${g}`).toContain(g);
    }
    expect(p).toContain('比写"25-35岁女性"有用一百倍');
  });

  it('输出里「先说这一行」排在账号定位之前', () => {
    // 顺序反了，模型会先进入"介绍账号"的腔调，行业洞察就变成补充说明了
    expect(p.indexOf('先说这一行')).toBeLessThan(p.indexOf('一句话定位'));
  });

  it('实体店用 50/20/30 配比，个人 IP 用另一套', () => {
    expect(p).toContain('变现50% / 人设20% / 流量30%');
    expect(p).toContain('门店等的是客人，不是粉丝');
  });

  it('给出能直接抄走的账号五件套', () => {
    expect(p).toContain('账号五件套');
    expect(p).toContain('不要写"建议优化头像"这种废话');
  });
});

describe('深挖板块同样要带行业视角', () => {
  it('商业定位先讲这门生意的逻辑', () => {
    const p = buildPositioningPrompt({ ...base, focus: 'business' });
    expect(p).toContain('先说这一行的生意逻辑');
    expect(p).toContain('餐饮食品'); // 12 类表也要带上
  });

  it('内容定位也带行业锚点，不退回泛泛而谈', () => {
    const p = buildPositioningPrompt({ ...base, focus: 'content' });
    expect(p).toContain('小镇青年');
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
  it('full：六维全套 + 30天实验', () => {
    const p = buildPositioningPrompt({ ...base, focus: 'full' });
    expect(p).toContain('# 🎯 账号定位方案');
    expect(p).toContain('30 天起号实验');
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
