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

  /*
   * 呈现形式四表、风格六触点、内容系列这三块，实测后已从账号定位里移走：
   * 变现 2542 + 呈现 2072 + 风格 1930 字，比「人设/用户/内容」
   * 这三个用户点名的重点还多，而变现和内容**各自已有独立板块**。
   * 常量保留，深挖板块照常用——下面「移走的内容去了该去的地方」那组卡这个。
   */
  it('风格调性只保留最有用的那条：会说和不会说的话', () => {
    expect(p).toContain('正向匹配还是有意反差');
    expect(p).toContain('这比形容词有用');
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

  it('变现先分清在玩哪种经济', () => {
    expect(p).toContain('流量经济');
    expect(p).toContain('粉丝经济');
    expect(p).toContain('产品是为了满足需求，人物是为了制造偏好');
  });

  /*
   * 30 天实验和数据诊断树原来也在这份提示词里，现已移出——
   * 产出被撑到 27000 字、单次跑 10 分钟，而这两块本来就是**起号阶段**的活，
   * 起号会单独成板块（起号36计 + 开篇36计），留在定位里是重复。
   * 常量保留并导出，起号板块直接拿去用。下面「该砍的确实砍掉了」那组就是卡这个的。
   */

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

  it('输出里「先说这一行」排在一句话定位那一节之前', () => {
    // 顺序反了，模型会先进入"介绍账号"的腔调，行业洞察就变成补充说明了。
    // 注意要比小节标题，不能比「一句话定位」这个词——
    // 开头的核心结论摘要里也会提到它，比词会比到摘要上去
    expect(p.indexOf('## 🔍 先说这一行')).toBeLessThan(p.indexOf('## 一句话定位'));
  });

  it('50/20/30 是起号后的实体店/服务商配比，不是起号期的', () => {
    expect(p).toMatch(/\*\*起号后到成熟前\*\*[^\n]*\*\*变现50% \/ 人设20% \/ 流量30%\*\*/);
  });

  it('给出能直接抄走的账号五件套', () => {
    expect(p).toContain('账号五件套');
    expect(p).toContain('不要写"建议优化头像"这种废话');
  });
});

/**
 * 第三轮反馈，两条硬伤：
 *
 * 1. 「你的行业那段我都没看懂，我的定位是代运营，你给我我这个行业的才对」
 *    ——我把「实体店 12 大类型」硬套在一个代运营账号上，讲餐饮毛利、
 *    服装淡旺季。那是他客户的行业，不是他的。
 *    根因是提示词默认所有账号都是实体店。
 *
 * 2. 「人设、用户、内容三维写得太简单，完全是从档案照搬」
 *    ——提示词只写了"输出什么"，没写"怎么分析出来"，
 *    模型就把档案字段翻译一遍交差。
 */
describe('先认主体类型，不默认是实体店', () => {
  const p = buildPositioningPrompt(base);

  it('给出四类主体，代运营单独成一类', () => {
    expect(p).toContain('本地实体店');
    expect(p).toContain('服务商 / 代运营');
    expect(p).toContain('个人 IP / 知识博主');
    expect(p).toContain('电商 / 带货');
  });

  it('明确不能按他服务的客户行业去归类', () => {
    // 给火锅店做代运营的账号，主体是 B 不是 A——他自己不卖火锅
    expect(p).toContain('他自己不卖火锅');
  });

  it('代运营这一行有自己的行业认知，不是讲客户的毛利', () => {
    expect(p).toContain('绝对不要去讲他客户那一行的毛利');
    expect(p).toContain('是不是又一个来割韭菜的');
    expect(p).toContain('客户为什么流失');
    // 县域市场和一二线不是一回事
    expect(p).toContain('熟人社会');
  });

  it('to B 账号不套八大人群词根', () => {
    expect(p).toContain('上面那八类**不适用**');
    expect(p).toContain('他会先潜水观察你很久');
  });

  it('只接本地客户的号，才提醒别把观众当泛粉', () => {
    expect(p).toContain('**如果这个号唯一的变现就是接本地客户**');
    expect(p).toContain('比 10 万播放全是同行围观强');
  });

  /*
   * 第四轮反馈：「用编导的眼睛记录世界，做有影响力的 IP，既有大流量又能变现」，
   * 结果被判成纯 to B 服务号，配比教知识 60%。
   * 档案里变现方式是"广告变现、带货佣金、卖 AI 工具、代运营"——前三样都靠大流量。
   */
  it('允许混合型：按每种变现方式靠什么来判，而不是硬塞一类', () => {
    expect(p).toContain('**可以是混合型，不要硬塞进一类。**');
    expect(p).toMatch(/广告变现、带货佣金、卖课 \/ 卖工具 → 靠\*\*大流量\*\*/);
    expect(p).toContain('不能把他判成纯 to B 服务号');
  });

  it('"别当泛粉"那条只管服务线，不压流量线', () => {
    expect(p).toContain('**但这条只管服务线。**');
  });
});

/**
 * 第四轮反馈：同一份档案、同一句"既有大流量又能变现"，一天之内给出
 * 教知识60% / 知识45% / 晒过程40% / 过程60% 四种主打。
 * 查下来是提示词的问题：知识库里知识40% 是**成熟账号**的配比，提示词把这四个字丢了；
 * "变现50%"又紧跟着"走教知识"；作用和形式两层混在一起；也没有规则把"要大流量"和配比挂钩。
 */
describe('内容配比按知识库的顺序推', () => {
  const p = buildPositioningPrompt(base);

  it('知识40% 明确标成成熟账号的，并警告新号别套', () => {
    expect(p).toMatch(/\*\*成熟账号\*\*：形式上可参考 \*\*知识40% \/ 故事20% \/ 过程20% \/ 观点20%\*\*/);
    expect(p).toContain('**这是成熟账号的基准，不是新号的**');
    // 旧写法：个人 IP 直接用知识40%，不分阶段
    expect(p).not.toContain('纯个人 IP / 知识博主**（靠内容本身变现）用 知识40%');
  });

  it('新号流量型必须是最大的一块', () => {
    expect(p).toMatch(/\*\*新号 \/ 刚起号\*\*[\s\S]{0,200}\*\*流量型必须是最大的一块\*\*/);
  });

  it('作用、形式、题材三层都给', () => {
    expect(p).toContain('配比必须**三层都给**');
    expect(p).toMatch(/作用配比：流量型 \/ 人设型 \/ 变现型 各占多少/);
  });

  it('用户要大流量时，行业干货不当主力（知识库：选题决定流量上限）', () => {
    expect(p).toContain('**想要大流量，就不能让行业干货当主力。**');
    expect(p).toMatch(/要\*\*大流量、有影响力、涨粉、做博主\*\* → 流量型往上加/);
  });

  it('主力形式就是档案里数据最好的类型', () => {
    expect(p).toContain('**它就是主力形式**');
  });

  it('"变现"不再直接等于"教知识"', () => {
    expect(p).not.toContain('变现型走教知识和晒过程');
    expect(p).toContain('不是把知识型抬成主力');
  });

  it('输出里要逐条写出配比核验', () => {
    expect(p).toContain('**配比核验**');
    expect(p).toContain('3. 用户要大流量的话，行业干货是不是没当主力？');
    expect(p).toContain('4. 题材有没有给目标人群的兴趣留出 30-40%？');
  });

  it('题材按人群垂直配（薛老师：主赛道 60-70% + 人群兴趣 30-40%）', () => {
    expect(p).toContain('垂直是**人群垂直，不是赛道垂直**');
    expect(p).toContain('**主赛道 60-70% + 目标人群的兴趣 30-40%**');
  });

  it('变现型的形式按成交理由选（薛老师）', () => {
    expect(p).toContain('靠手艺、靠服务过程 → 晒过程；靠专业判断 → 教知识；靠人品、靠关系 → 讲故事');
  });

  it('账号定位也先判断内容方向', () => {
    expect(p).toContain('### 先定内容方向：多元四类，还是单一主题');
    expect(p).toMatch(/- \*\*内容方向\*\*：多元四类还是单一主题/);
  });

  it('变现方式排先后：普通人先引流卖货，广告不当起号期主要收入（薛老师）', () => {
    expect(p).toContain('### 变现方式怎么排（薛老师）');
    expect(p).toContain('当远期彩蛋，不能当起号期的主要收入');
  });

  it('没有知识库里不存在的"新号 60/30/10"', () => {
    // 那组数字是旧代码里写的，知识库里找不到，不能冒充知识库的结论
    expect(p).not.toMatch(/流量型\s*60%/);
  });
});

describe('人设/用户/内容三维要真分析，不是照搬档案', () => {
  const p = buildPositioningPrompt(base);

  it('人设：要求先指出原料，并把形容词翻译成具体行为', () => {
    expect(p).toContain('档案里那些形容词是**原料**');
    expect(p).toContain('把形容词翻译成具体行为');
    // 给了正反例，"专业、靠谱、有温度"这种谁都能用的词要挡住
    expect(p).toContain('不收预付款、先干出效果再谈钱的县城编导');
    expect(p).toContain('在同类账号里的位置');
  });

  it('用户：要写成一个具体的人，并且要敢排除人群', () => {
    expect(p).toContain('不要把档案里的痛点清单抄一遍');
    expect(p).toContain('不敢排除人群 = 定位没做完');
    // 嘴上不会说的那句话，才是真实心理
    expect(p).toContain('他嘴上不会说的那句话');
  });

  it('内容：要说明每类内容管用户旅程的哪一段', () => {
    expect(p).toContain('每类内容管哪一段路');
    expect(p).toContain('只堆配比不说明这个，等于没规划');
    expect(p).toContain('第一条该发什么');
  });
});

describe('开头摘要和前18条选题', () => {
  const p = buildPositioningPrompt(base);

  it('第一屏是核心结论 8 条', () => {
    expect(p).toContain('核心结论（先看这 8 条）');
    // 摘要必须排在展开论证之前，否则等于没摘要
    expect(p.indexOf('核心结论')).toBeLessThan(p.indexOf('先说这一行'));
  });

});

/**
 * 用户看完实测产出后的决定：砍内容。
 * 30天实验、数据诊断树、前18条选题整体移交给未来的「起号」板块
 * （它有自己的方法论：起号36计 + 开篇36计）。
 * 定位这份只回答"这个号是什么、给谁、凭什么"，写到风险就收尾。
 */
describe('该砍的确实砍掉了', () => {
  const p = buildPositioningPrompt(base);

  it('不再要求输出 30 天计划和数据诊断', () => {
    expect(p).not.toContain('## 🚦 30 天起号实验');
    expect(p).not.toContain('## 📊 跑不通怎么诊断');
    // 参考资料里那两张表也不再塞进去，白占篇幅还拖慢生成
    expect(p).not.toContain('第26-30天');
    expect(p).not.toContain('有曝光但前段流失');
  });

  it('不再要求输出前 18 条选题', () => {
    expect(p).not.toContain('前 18 条怎么拍');
  });

  it('明确告诉模型写到风险就收尾，别越界写到起号去', () => {
    expect(p).toContain('到这里为止');
    expect(p).toContain('属于「起号」板块');
  });

  it('两个常量仍然导出，起号板块要用', async () => {
    const m = await import('@/lib/positioning-standards');
    expect(m.THIRTY_DAY_PLAN).toContain('第1-3天');
    expect(m.DIAGNOSIS_TREE).toContain('咨询多成交少');
  });

  it('已有独立板块的三维只给结论，不在这儿展开', () => {
    // 变现定位 2542 字曾是全篇最长的一节，而商业定位已是独立板块
    expect(p).toContain('这个号的变现有独立的「商业定位」板块专门深挖');
    expect(p).toContain('不要展开写内容系列和排期');
    expect(p).toContain('只给结论，≤200字');
  });

  it('移走的内容去了该去的地方：深挖板块照常能用', () => {
    // 从账号定位摘掉不等于删掉——商业定位仍要内容配比，内容定位仍要系列设计
    const biz = buildPositioningPrompt({ ...base, focus: 'business' });
    const con = buildPositioningPrompt({ ...base, focus: 'content' });
    expect(con).toContain('先过"能不能立项"，再定"怎么一集集出"'); // 系列化
    expect(con).toContain('高质量口播远胜粗糙剧情'); // 呈现形式四表
    expect(biz).toContain('知识型');          // 内容五类型
  });

  it('给出整体篇幅上限，并点名哪三维要写透', () => {
    expect(p).toContain('人设、用户、内容这三维要写透');
    expect(p).toContain('8000 字以内');
  });

  it('该留的一个没少', () => {
    for (const k of ['核心结论', '先说这一行', '六维地基', '记忆点', '差异化', '账号五件套', '最大的风险']) {
      expect(p, `不该砍掉 ${k}`).toContain(k);
    }
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
  it('full：六维全套，收尾在风险', () => {
    const p = buildPositioningPrompt({ ...base, focus: 'full' });
    expect(p).toContain('# 🎯 账号定位方案');
    expect(p).toContain('六维地基');
    // 30天实验已移交给起号板块，见「该砍的确实砍掉了」那组
    expect(p).toContain('最大的风险');
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
    expect(p).toMatch(/## 🎯 用户自己定的方向（硬约束）\n\n这次只想做同城/);
    expect(p).toContain('优先于上面的档案，也优先于下面方法论里的默认值');
  });

  it('点名它管定位和配比，且不许自作主张改方向', () => {
    const p = buildPositioningPrompt({ ...base, additionalNotes: '做有影响力的IP，既有大流量又能变现' });
    expect(p).toContain('**主体判断、一句话定位、人设**要落在这个方向上');
    expect(p).toContain('**内容配比**要服务这个目标');
    expect(p).toContain('不要自作主张改方向');
  });

  it('他写的核心定位原样保留在一句话定位里', () => {
    const p = buildPositioningPrompt(base);
    expect(p).toContain('他原话里的核心短语要**原样出现**在这句话里');
  });

  it('禁忌也管例子；不许替用户编经历和数字', () => {
    const p = buildPositioningPrompt(base);
    expect(p).toContain('**以上禁忌同样管你举的例子、示范标题和脚本**');
    expect(p).toContain('例子里的老板、客户、同行也不能被写成反面角色');
    expect(p).toContain('档案里没有的人数、金额、年限、播放量一律写成 X');
    expect(p).toContain('（示例，换成你自己的真实经历）');
  });

  it('没写补充说明时不留空段落', () => {
    const p = buildPositioningPrompt({ profileSummary: base.profileSummary });
    expect(p).not.toContain('用户自己定的方向');
  });
});

/**
 * 第五轮反馈：内容定位的"内容系列"没按小黄来，配比也不对。
 * 查下来：提示词直接让模型"给 3-4 个系列"，跳过了小黄内容定位的第一个决定
 * （多元四类还是单一主题）；系列只要名字和结构，不检验能不能撑 30 集；
 * 薛老师的"定量+变量""人群垂直"一样没用上。
 */
describe('内容定位：小黄的方向和主题型 + 薛老师的定量变量', () => {
  const con = buildPositioningPrompt({ ...base, focus: 'content' });

  it('先定内容方向：多元四类还是单一主题，并说为什么不选另一条', () => {
    expect(con).toContain('### 先定内容方向：多元四类，还是单一主题');
    expect(con).toContain('## 内容方向：多元四类还是单一主题');
    expect(con).toContain('**为什么不选另一条**');
  });

  it('系列 = 定量 + 变量，且要过小黄的立项检验', () => {
    expect(con).toContain('**① 结构：定量 + 变量**（薛老师）');
    expect(con).toContain('**撑得住 30 集**：先列出前 10 集的具体标题');
    expect(con).toMatch(/\*\*定量 \/ 变量\*\*：每集不变的是什么、每集换的是什么/);
    expect(con).toContain('**前 10 集标题**：列满 10 个');
    expect(con).toContain('列不满 10 集、或者立项检验没过的系列，不要写进来');
  });

  it('编数字、揭秘这两条放在用到的地方，交稿前再自查一遍', () => {
    // 实测放在末尾禁忌区压不住：十集标题里照样出现"坑了8000块""50岁""破了2万播放"
    expect(con).toMatch(/\*\*前 10 集标题\*\*[^\n]*\n\s*⚠️ \*\*标题里档案没写过的数字一律写 X\*\*/);
    expect(con).toContain('**交稿前自查**');
    expect(con).toContain('全文没有出现"揭秘"两个字');
  });

  it('配比三层都要给，含题材', () => {
    expect(con).toContain('### 题材配比');
    expect(con).toContain('**人群兴趣具体是哪几类**');
  });

  it('选题来源按小黄第19节四大方向 + 九宫格', () => {
    expect(con).toContain('### 选题从哪来（小黄第19节）');
    expect(con).toContain('最后给一个九宫格示例');
  });

  it('行业视角只给一次（原来深挖板块重复推了两遍）', () => {
    const n = (s: string) => s.split('### 第一步：先认准这是什么主体的账号').length - 1;
    expect(n(con)).toBe(1);
    expect(n(buildPositioningPrompt({ ...base, focus: 'business' }))).toBe(1);
  });

  it('内容定位不再带起号的诊断树', () => {
    expect(con).not.toContain('### 数据诊断树');
  });
});
