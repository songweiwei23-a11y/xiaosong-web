"use client";

import {
  useState, useEffect } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { SUBSCRIPTION_PLANS, quotaSummary, planSellingPoints } from "@/lib/config/plans";
import { SHOWCASE_TACTICS, SHOWCASE_CARDS, SHOWCASE_STRUCTURES, FACTS } from "@/lib/showcase";
import { VIRAL_ELEMENTS, SCRIPT_FAMILIES } from "@/lib/viral-elements";
import { LandingNavCTA } from "@/components/landing/LandingNavCTA";
import { 
  Sparkles, Zap, CheckCircle, TrendingUp, ArrowRight, 
  FileText, Lightbulb, Film, Target, Star,
  Crown, Check, BarChart3, Award, Rocket, BookOpen,
  Brain, Layers, Clock, Shield, Quote, Play, ChevronRight,
  MessageCircle, Activity, ChevronDown, X
} from "lucide-react";

export default function HomePage() {
  /**
   * 落地页的三个大数字。
   *
   * 原来是编的（接口里写着「返回合理的假数据」，失败时前端还会退回
   * 1280/15680/98 这组写死的数），并以「创作者正在使用」的名义展示。
   * 现在只认接口给的真实数；接口给 null 就那一项不显示——
   * 宁可少一块，也不编一个。
   */
  const [stats, setStats] = useState<{
    users: number | null;
    scripts: number | null;
    methods: number | null;
  }>({ users: null, scripts: null, methods: null });
  const [mounted, setMounted] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    setMounted(true);
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const res = await fetch('/api/public/stats');
      if (!res.ok) return;
      const data = await res.json();
      animateNumbers({
        users: typeof data.users === 'number' ? data.users : null,
        scripts: typeof data.scripts === 'number' ? data.scripts : null,
        methods: typeof data.methods === 'number' ? data.methods : null,
      });
    } catch {
      // 拿不到就保持 null，那几块不显示。不再退回写死的假数
    }
  };

  const animateNumbers = (target: {
    users: number | null;
    scripts: number | null;
    methods: number | null;
  }) => {
    const steps = 60;
    const duration = 2000;
    // null 的那项全程保持 null，不参与动画，否则会从 0 跳一下再消失
    const step = (v: number | null, i: number) =>
      v === null ? null : Math.floor((v / steps) * i);

    let current = 0;
    const timer = setInterval(() => {
      current++;
      setStats({
        users: step(target.users, current),
        scripts: step(target.scripts, current),
        methods: step(target.methods, current),
      });
      if (current >= steps) {
        clearInterval(timer);
        setStats(target);
      }
    }, duration / steps);
  };

  if (!mounted) return null;

  const features = [
    {
      icon: Target,
      title: "账号定位",
      desc: "先出核心几节让你尽快看到方向，再补完整方案",
      benefits: ["避免试错成本", "精准人设定位", "商业模式规划"],
      color: "blue"
    },
    {
      icon: Lightbulb,
      title: "选题策划",
      /*
       * 原来写「AI实时分析热点趋势」「每日热点追踪」「爆款概率预测」。
       * 系统没有任何热点数据源，提示词里只是让模型"结合当前热点"——
       * 那是模型自己训练时的旧知识，谈不上实时；"概率预测"更是完全没有。
       * 改成真正在做的事：按八大爆款元素的句式出题、可填对标账号、每条带钩子。
       */
      desc: "按八大爆款元素的句式出选题，贴着你的账号定位",
      benefits: ["八大爆款元素句式", "对标账号参考", "每条附开篇钩子"],
      color: "yellow"
    },
    {
      icon: FileText,
      title: "脚本生成",
      // 「多版本对比」「一键多版本」没有做——只能重新生成、在历史里翻旧版
      desc: `一两分钟出一版完整脚本，${FACTS.structures} 种脚本结构任选`,
      benefits: ["Claude AI驱动", "内置编导知识库", `${FACTS.structures}种脚本结构`],
      color: "green"
    },
    {
      icon: Film,
      title: "分镜脚本",
      desc: "可视化分镜设计，拍摄执行一目了然",
      benefits: ["镜头语言规划", "场景道具清单", "时长节奏把控"],
      color: "purple"
    },
    {
      icon: CheckCircle,
      title: "审稿优化",
      desc: "智能优化脚本节奏、情绪曲线、冲突设计",
      benefits: ["完播率优化", "情绪起伏分析", "冲突点强化"],
      color: "pink"
    },
    {
      icon: Zap,
      title: "标题封面",
      // 生成数量可选 3/5/8/10，默认 5，所以说"最多"
      desc: "一次最多出 10 个标题+封面文案，方便 A/B 测试",
      benefits: ["标题公式库", "情绪钩子植入", "A/B测试建议"],
      color: "orange"
    },
    {
      icon: TrendingUp,
      title: "成交话术",
      desc: "针对性成交话术，提升转化率",
      benefits: ["痛点挖掘", "价值塑造", "促单话术"],
      color: "red"
    },
    {
      icon: BookOpen,
      title: "知识库查询",
      // 不写「随时查阅」——知识库现在只有企业版无限，其余档位按次计费，
      // 「随时」就成了一句兑现不了的话
      desc: `${FACTS.wordsWan} 万字编导资料，分 ${FACTS.libraries} 个专题库，问一句就能查`,
      benefits: ["五个专题分库", "起号36+1计", "开篇36计"],
      color: "indigo"
    }
  ];

  /*
   * 价格与额度全部从 lib/config/plans.ts 派生。
   *
   * 这里原本手写着一份，和代码、会员页、收款页三处都对不上：
   * 免费版写「账号定位 3次」（实际 1 次）、企业版写 199（收款页收 599）。
   * 首页是对外公示的价格，它和实际收款必须来自同一个源头。
   */
  const pricingPlans = [
    {
      name: SUBSCRIPTION_PLANS.free.name,
      price: SUBSCRIPTION_PLANS.free.price,
      period: "永久免费",
      desc: "体验核心功能",
      features: quotaSummary("free"),
      highlight: false,
      cta: "立即开始"
    },
    {
      name: SUBSCRIPTION_PLANS.basic.name,
      price: SUBSCRIPTION_PLANS.basic.price,
      period: "月",
      desc: "适合个人创作者",
      // 权益只从 planSellingPoints 取。这里原来手写着「邮件客服支持」——
      // 那个邮箱根本不存在，早先已经确认过
      features: [...quotaSummary("basic"), ...planSellingPoints("basic")],
      highlight: false,
      cta: "选择基础版"
    },
    {
      name: SUBSCRIPTION_PLANS.pro.name,
      price: SUBSCRIPTION_PLANS.pro.price,
      period: "月",
      desc: "适合专业团队",
      // 原来还写着「最高优先级」「多版本对比」「专属客服支持」，都没有做
      features: [...quotaSummary("pro"), ...planSellingPoints("pro")],
      highlight: true,
      cta: "选择专业版"
    },
    {
      name: SUBSCRIPTION_PLANS.enterprise.name,
      price: SUBSCRIPTION_PLANS.enterprise.price,
      period: "月",
      desc: "适合MCN机构",
      /*
       * 原来这里卖着「数据报表分析」「团队协作功能」「1v1专属顾问」——前两个
       * 代码里一行都没有，第三个本人确认做不到。「多账号档案切换」倒是做了，
       * 但所有档位都能用，当成企业版专属卖也是说错。
       */
      features: [...quotaSummary("enterprise"), ...planSellingPoints("enterprise")],
      highlight: false,
      cta: "联系销售"
    }
  ];

  const faqs = [
    {
      q: "完全不懂编导可以用吗？",
      a: `完全可以！小宋编导工作台内置 ${FACTS.docs} 篇、共 ${FACTS.wordsWan} 万字的专业编导资料，AI会根据您的需求自动匹配最佳方案。无论您是新手还是专业编导，都能快速上手，几分钟就能出一版专业脚本。`
    },
    {
      q: "生成的脚本质量如何？",
      a: `我们基于Anthropic Claude最新AI模型，结合内置的编导知识库和 ${FACTS.methods} 条成体系的方法（起号 ${FACTS.tactics} 计、开篇 ${FACTS.cards} 计、脚本结构 ${FACTS.structures} 种）。生成的脚本包含完整的开场、冲突、高潮、结尾结构，并会标注每一段落在第几秒、波点落在哪里，拿到就能照着拍。不满意可以重新生成，历次结果都存在云端随时翻看。`
    },
    {
      q: "和其他AI工具有什么区别？",
      a: `我们不是简单的AI对话工具。核心优势在于：①${FACTS.wordsWan} 万字的自有编导知识库（${FACTS.docs} 篇，${FACTS.libraries} 个专题分库），不是网上抓的通用内容；②${FACTS.methods} 条成体系的方法——四大脚本（教知识/聊观点/晒过程/讲故事）各对一个生意目的，八大爆款元素给个行业就能套出八个方向，起号 ${FACTS.tactics} 计、开篇 ${FACTS.cards} 计、脚本结构 ${FACTS.structures} 种每条都带公式和不能用的边界；③${FACTS.boards} 个板块打通全流程（定位→选题→开篇→脚本→分镜→标题→成交），上一步的产出直接喂给下一步；④专为中文短视频优化的提示词工程。`
    },
    {
      q: "免费版有什么限制？",
      /*
       * 这一行原来是手写的「每月 50 次（账号定位3次、选题3次、脚本20次、对话20次）」，
       * 四个数字里有三个和 lib/config/plans.ts 对不上，总数 50 也是凑的。
       * 价格页早就改成从配置现算了，只有这里还留着一份手写的。
       * 直接用 quotaSummary，配置改了这里自动跟。
       */
      a: `免费版的额度是：${quotaSummary("free").join("、")}。功能和付费版一样，只是次数有限制，足够你把一条内容从定位做到分镜走通一遍。`
    },
    {
      q: "如何保证数据安全？",
      a: "数据存放在 Supabase（Postgres），传输与静态存储均加密，并按账号做了行级隔离——不同账号之间互相读不到内容。我们承诺：①数据仅用于为您生成内容，②不会用于AI训练，③支持导出所有历史记录。"
    },
    {
      q: "可以开发票吗？",
      a: "目前还不支持开发票。有开票需求请先联系我们再决定是否购买，避免付完款才发现开不了。"
    },
    {
      q: "支持哪些支付方式？",
      a: "微信和支付宝转账，扫码付款后上传转账截图，我核对后开通。企业版对公转账请加微信 13240286600 获取账号。"
    },
    {
      q: "如何联系客服？",
      a: "直接加微信：13240286600（手机同号）。目前是我本人在对接，看到就回。"
    }
  ];

  const colorClasses: Record<string, string> = {
    blue: "bg-primary/15 dark:bg-blue-900/30 text-primary",
    yellow: "bg-amber-500/15 dark:bg-yellow-900/30 text-yellow-500",
    green: "bg-emerald-500/15 dark:bg-green-900/30 text-green-500",
    purple: "bg-accent/15 dark:bg-purple-900/30 text-accent",
    pink: "bg-accent/15 dark:bg-pink-900/30 text-accent",
    orange: "bg-amber-500/15 dark:bg-orange-900/30 text-orange-500",
    red: "bg-destructive/15 dark:bg-red-900/30 text-destructive",
    indigo: "bg-primary/15 dark:bg-indigo-900/30 text-primary"
  };


  return (
    <div className="min-h-screen flex flex-col">
      {/* Navigation */}
      <header className="fixed top-0 w-full border-b border-border bg-white/80 dark:bg-muted/80 backdrop-blur-xl z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl hover:scale-105 transition-transform">
            <Sparkles className="w-6 h-6 text-primary animate-pulse" />
            <span className="brand-gradient bg-clip-text text-transparent">
              小宋编导工作台
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium hover:text-primary transition-colors">核心功能</a>
            <a href="#advantages" className="text-sm font-medium hover:text-primary transition-colors">核心优势</a>
            {/* 原来是「成功案例」指向 #cases，而页面上根本没有这个版块——点了不会有
                任何反应。而且我们手上没有可公开的真实客户案例，编一个就是另一种形式的
                假数据。换成真正能说服人、也抄不走的东西：方法本身 */}
            <a href="#method" className="text-sm font-medium hover:text-primary transition-colors">编导方法</a>
            <a href="#pricing" className="text-sm font-medium hover:text-primary transition-colors">价格方案</a>
          </nav>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <LandingNavCTA />
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4 overflow-hidden bg-primary/10">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute top-40 right-10 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-pulse" style={{animationDelay:'1s'}} />
          <div className="absolute bottom-20 left-1/3 w-80 h-80 bg-accent/10 rounded-full blur-3xl animate-pulse" style={{animationDelay:'2s'}} />
        </div>

        <div className="container mx-auto relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/15 dark:bg-blue-900/30 rounded-full mb-6">
              <Rocket className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">Claude AI驱动 · 专业编导知识库 · 全流程打通爆款脚本</span>
            </div>

            <h1 className="text-5xl md:text-7xl font-extrabold mb-6 leading-tight">
              <span className="brand-gradient bg-clip-text text-transparent">
                AI编导助手
              </span>
              <br />
              <span className="text-foreground">让短视频创作</span>
              <br />
              <span className="relative inline-block">
                <span className="text-foreground">更专业、更高效</span>
                <svg className="absolute -bottom-2 left-0 w-full" height="12" viewBox="0 0 300 12" fill="none">
                  <path d="M2 10C50 5,100 2,150 3C200 4,250 7,298 10" stroke="url(#g)" strokeWidth="4" strokeLinecap="round"/>
                  <defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#3b82f6"/><stop offset="50%" stopColor="#a855f7"/><stop offset="100%" stopColor="#ec4899"/>
                  </linearGradient></defs>
                </svg>
              </span>
            </h1>

            <p className="text-xl md:text-2xl text-muted-foreground dark:text-foreground mb-8 max-w-3xl mx-auto">
              基于<span className="font-semibold text-primary">专业编导知识库</span>，
              结合<span className="font-semibold text-accent">Claude AI</span>大模型，
              为您提供<span className="font-semibold text-accent">智能化</span>的短视频创作解决方案
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
              <Link href="/dashboard" className="group relative px-8 py-4 brand-gradient text-white rounded-xl font-semibold text-lg shadow-2xl hover:shadow-blue-500/50 transition-all hover:scale-105">
                <span className="relative z-10 flex items-center gap-2">
                  立即免费体验 <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </span>
              </Link>
              <a href="#method" className="px-8 py-4 glass-panel text-foreground rounded-xl font-semibold text-lg border-2 border-border hover:border-primary/40 transition-all hover:scale-105 flex items-center gap-2">
                <Play className="w-5 h-5 text-primary" /> 观看演示
              </a>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-6 text-sm">
              <div className="flex items-center gap-2"><CheckCircle className="w-5 h-5 text-green-500" /><span className="text-muted-foreground dark:text-foreground">免费试用·无需信用卡</span></div>
              <div className="flex items-center gap-2"><CheckCircle className="w-5 h-5 text-green-500" /><span className="text-muted-foreground dark:text-foreground">一两分钟出一版脚本</span></div>
              {/* 原来是「98%用户好评」。系统里没有任何评价数据，这个数字是编的。
                  换成一句确实为真的：知识库和方法都是内置的，不是通用模型现编 */}
              <div className="flex items-center gap-2"><CheckCircle className="w-5 h-5 text-green-500" /><span className="text-muted-foreground dark:text-foreground">内置编导知识库</span></div>
            </div>
          </div>
        </div>
      </section>

      {/*
        Stats。
        以前这里是编的（1280 创作者 / 15680 脚本 / 98% 满意度），清掉之后换成了
        真实数字，但「累计生成内容 168」这种说法是在拿我们最弱的一面当门面——
        一个刚起步的产品，用量天然不好看，而且那根本不是我们的优势。

        改成讲**结构性的东西**：方法成体系、全流程打通、知识库是真的编导知识。
        这几条不随用量涨跌，也是通用 AI 给不了的。
        每一条都必须为真——数字统一从 lib/showcase.ts 的 FACTS 取。
      */}
      {(() => {
        const tiles = [
          {
            key: 'methods',
            value: FACTS.methods,
            label: '条带公式的方法',
            sub: `四大脚本 · 八大爆款元素 · 起号 ${FACTS.tactics} 计 · 开篇 ${FACTS.cards} 计 · 脚本结构 ${FACTS.structures} 种，每条都写明什么情况下不能用`,
            suffix: '',
          },
          {
            /*
             * 这一格原来是「5 步全流程打通」。5 是这三个数里最小的一个，
             * 摆在中间反而把整排数据压下去了，而且"5 步"听上去像流程图，
             * 不像资产。换成知识库字数——43 万字是我们手上最硬的一个数，
             * 也是通用 AI 最给不出来的东西。
             */
            key: 'words',
            value: FACTS.wordsWan,
            label: '万字自有编导知识库',
            sub: `${FACTS.docs} 篇 · ${FACTS.libraries} 个专题分库，不是网上抓的通用内容`,
            suffix: '',
          },
          {
            key: 'boards',
            value: FACTS.boards,
            label: '个创作板块打通全流程',
            sub: `${FACTS.pipeline.join(' → ')}，一路到成交理由`,
            suffix: '',
          },
        ].filter((t) => typeof t.value === 'number' && t.value > 0);

        if (tiles.length === 0) return null;

        return (
          <section className="py-16 bg-white/50 dark:bg-muted/50 backdrop-blur-xl border-y border-border/40">
            <div className="container mx-auto px-4">
              <div
                className={`grid grid-cols-1 gap-8 max-w-4xl mx-auto ${
                  tiles.length >= 3 ? 'md:grid-cols-3' : tiles.length === 2 ? 'md:grid-cols-2' : ''
                }`}
              >
                {tiles.map((t) => (
                  <div key={t.key} className="text-center group hover:scale-105 transition-transform">
                    <div className="text-5xl md:text-6xl font-extrabold brand-gradient bg-clip-text text-transparent mb-2">
                      {(t.value as number).toLocaleString()}
                      {t.suffix}
                    </div>
                    <div className="text-sm text-foreground font-medium">{t.label}</div>
                    {/* 副标题是关键：光一个数字说明不了优势，得说清这个数字意味着什么 */}
                    <div className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
                      {t.sub}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        );
      })()}

      {/* 三大核心优势 */}
      <section id="advantages" className="py-20 px-4 bg-primary/10">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-accent/15 dark:bg-purple-900/30 rounded-full mb-4">
              <Crown className="w-4 h-4 text-accent" />
              <span className="text-sm font-medium text-accent">为什么选择我们</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              <span className="brand-gradient bg-clip-text text-transparent">三大核心优势</span>
            </h2>
            <p className="text-xl text-muted-foreground dark:text-foreground max-w-2xl mx-auto">专业编导知识 + AI技术 + 持续迭代，让您的创作始终领先一步</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <div className="group relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-2xl blur-xl opacity-0 group-hover:opacity-20 transition-opacity" />
              <div className="relative glass-panel rounded-2xl p-8 border-2 border-border hover:border-primary/40 transition-all hover:shadow-2xl h-full">
                <div className="w-16 h-16 bg-primary/15 dark:bg-blue-900/30 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <BookOpen className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-2xl font-bold mb-4">43 万字自有知识库</h3>
                {/*
                  原来写「150+ 篇、73 个方法」。两个数都把自己说小了：
                  现数是 153 篇、43.2 万字，方法漏掉了 19 种脚本结构。
                  数字一律从 FACTS 取，那里每一个都有测试对着源头现数。
                */}
                <p className="text-muted-foreground dark:text-foreground mb-6">
                  <span className="font-semibold text-primary">{FACTS.wordsWan} 万字</span>、
                  <span className="font-semibold text-primary">{FACTS.docs}</span> 篇自有编导资料，
                  拆成 <span className="font-semibold text-primary">{FACTS.libraries}</span> 个专题分库，
                  提炼出 <span className="font-semibold text-primary">{FACTS.methods}</span> 条带公式的方法
                </p>
                <ul className="space-y-3">
                  <li className="flex items-start gap-2"><Check className="w-5 h-5 text-green-500 shrink-0 mt-0.5" /><span className="text-sm">四大脚本（教知识/聊观点/晒过程/讲故事）各对一个生意目的</span></li>
                  <li className="flex items-start gap-2"><Check className="w-5 h-5 text-green-500 shrink-0 mt-0.5" /><span className="text-sm">八大爆款元素、起号 {FACTS.tactics} 计、开篇 {FACTS.cards} 计、脚本结构 {FACTS.structures} 种</span></li>
                  <li className="flex items-start gap-2"><Check className="w-5 h-5 text-green-500 shrink-0 mt-0.5" /><span className="text-sm">每条都写明机制、结构公式、情绪曲线与适用边界</span></li>
                  <li className="flex items-start gap-2"><Check className="w-5 h-5 text-green-500 shrink-0 mt-0.5" /><span className="text-sm">来自成体系的编导课程，不是网上抓的碎片</span></li>
                </ul>
              </div>
            </div>

            <div className="group relative">
              <div className="absolute inset-0 brand-gradient rounded-2xl blur-xl opacity-0 group-hover:opacity-20 transition-opacity" />
              <div className="relative glass-panel rounded-2xl p-8 border-2 border-border hover:border-accent/40 transition-all hover:shadow-2xl h-full">
                <div className="w-16 h-16 bg-accent/15 dark:bg-purple-900/30 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Brain className="w-8 h-8 text-accent" />
                </div>
                <h3 className="text-2xl font-bold mb-4">Claude AI 智能引擎</h3>
                <p className="text-muted-foreground dark:text-foreground mb-6">
                  基于<span className="font-semibold text-accent">Anthropic Claude</span>最新模型，
                  结合编导知识库，智能理解您的需求，生成专业级脚本
                </p>
                <ul className="space-y-3">
                  <li className="flex items-start gap-2"><Check className="w-5 h-5 text-green-500 shrink-0 mt-0.5" /><span className="text-sm">一两分钟出一版完整脚本，比手写快得多</span></li>
                  <li className="flex items-start gap-2"><Check className="w-5 h-5 text-green-500 shrink-0 mt-0.5" /><span className="text-sm">自动匹配最佳叙事结构和节奏</span></li>
                  <li className="flex items-start gap-2"><Check className="w-5 h-5 text-green-500 shrink-0 mt-0.5" /><span className="text-sm">不满意就重新生成，历次结果都存在云端</span></li>
                </ul>
              </div>
            </div>

            <div className="group relative">
              <div className="absolute inset-0 bg-gradient-to-r from-pink-600 to-orange-600 rounded-2xl blur-xl opacity-0 group-hover:opacity-20 transition-opacity" />
              <div className="relative glass-panel rounded-2xl p-8 border-2 border-border hover:border-accent/40 transition-all hover:shadow-2xl h-full">
                <div className="w-16 h-16 bg-accent/15 dark:bg-pink-900/30 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Layers className="w-8 h-8 text-accent" />
                </div>
                <h3 className="text-2xl font-bold mb-4">{FACTS.boards} 个板块打通全流程</h3>
                <p className="text-muted-foreground dark:text-foreground mb-6">
                  从账号定位到成交转化，覆盖短视频创作的<span className="font-semibold text-accent">每一个环节</span>，
                  上一步的产出直接喂给下一步，不用来回复制粘贴
                </p>
                <ul className="space-y-3">
                  <li className="flex items-start gap-2"><Check className="w-5 h-5 text-green-500 shrink-0 mt-0.5" /><span className="text-sm">账号定位 → 选题策划 → 脚本生成</span></li>
                  <li className="flex items-start gap-2"><Check className="w-5 h-5 text-green-500 shrink-0 mt-0.5" /><span className="text-sm">分镜设计 → 标题封面 → 成交话术</span></li>
                  <li className="flex items-start gap-2"><Check className="w-5 h-5 text-green-500 shrink-0 mt-0.5" /><span className="text-sm">一站式解决，无需切换多个工具</span></li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/*
        编导方法库。
        取代原来那个指向空锚点的「成功案例」——我们没有可公开的真实客户案例，
        编一个就是另一种形式的假数据。而这一段展示的是**抄不走也编不出来**的
        东西：每一计都有名字、机制、结构公式和适用范围。
        别家能说"AI 帮你写脚本"，说不出"这是第 22 计行业避坑，
        结构是 点名坑 → 后果 → 识别信号 → 替代方案"。

        内容来自 lib/showcase.ts，那里的每一条都有测试盯着，和真实方法库逐字段比对。
      */}
      <section id="method" className="py-20 px-4 bg-muted/40 dark:bg-muted/20">
        <div className="container mx-auto">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/15 dark:bg-blue-900/30 rounded-full mb-4">
              <BookOpen className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">这是我们和通用 AI 的区别</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              <span className="brand-gradient bg-clip-text text-transparent">拍法是有公式的</span>
            </h2>
            <p className="text-xl text-muted-foreground dark:text-foreground max-w-3xl mx-auto">
              通用 AI 给你一段文字，我们给你<span className="font-semibold text-primary">一套能照着拍的结构</span>。
              四大脚本、八大爆款元素、起号 {FACTS.tactics} 计、开篇 {FACTS.cards} 计、
              脚本结构 {FACTS.structures} 种，共 <span className="font-semibold text-primary">{FACTS.methods} 条</span>，
              每一条都写明了机制、结构公式、情绪走向、适合谁拍，以及
              <span className="font-semibold text-primary">什么情况下不能用</span>。
            </p>
          </div>

          <div className="max-w-6xl mx-auto">
            {/*
              四大脚本放在最前面，因为它是这套方法的骨架。
              它真正的卖点不是"分了四类"，而是**四类各对应一个生意目的**——
              通用 AI 问你"想要什么风格"，这套东西问的是"你这条是要涨粉、
              要粉丝更铁、要促变现，还是要成交高客单"。目的定了结构才定得下来。
            */}
            <h3 className="text-sm font-semibold tracking-widest text-muted-foreground mb-4">
              四大脚本 · 各对一个生意目的
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
              {SCRIPT_FAMILIES.map((f) => (
                <div
                  key={f.name}
                  className="glass-panel rounded-2xl p-5 border-2 border-border hover:border-amber-500/40 transition-colors"
                >
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-lg font-bold">{f.name}</span>
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-500 font-medium">
                      {f.purpose}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">{f.note}</p>
                </div>
              ))}
            </div>

            <h3 className="text-sm font-semibold tracking-widest text-muted-foreground mb-4">
              起号 {FACTS.tactics} 计 · 摘三条
            </h3>
            <div className="grid md:grid-cols-3 gap-5 mb-12">
              {SHOWCASE_TACTICS.map((t) => (
                <div key={t.no} className="glass-panel rounded-2xl p-6 border-2 border-border hover:border-primary/40 transition-colors">
                  <div className="flex items-baseline gap-2 mb-3">
                    <span className="text-xs font-mono text-primary/70">第 {t.no} 计</span>
                    <span className="text-lg font-bold">{t.name}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">{t.mechanism}</p>
                  {/* 结构公式是这套东西最有说服力的部分，单独框出来 */}
                  <div className="rounded-xl bg-primary/[0.07] border border-primary/20 px-3 py-2.5 mb-3">
                    {/* 实测：/70 透明度下 10px 小字对比度只有 3.06，低于可读标准，改用实色并加大一号 */}
                    <div className="text-[11px] font-medium tracking-wider text-primary mb-1">结构公式</div>
                    <div className="text-[13px] font-medium text-foreground">{t.formula}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">适合：{t.fit}</div>
                </div>
              ))}
            </div>

            <h3 className="text-sm font-semibold tracking-widest text-muted-foreground mb-4">
              开篇 {FACTS.cards} 计 · 分 {FACTS.cardCategories} 大类 · 摘三张
            </h3>
            <div className="grid md:grid-cols-3 gap-5 mb-12">
              {SHOWCASE_CARDS.map((c) => (
                <div key={c.no} className="glass-panel rounded-2xl p-6 border-2 border-border hover:border-accent/40 transition-colors">
                  <div className="flex items-baseline gap-2 mb-3">
                    <span className="text-lg font-bold">{c.name}</span>
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-accent/15 text-accent">{c.category}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">{c.psychology}</p>
                  <div className="rounded-xl bg-accent/[0.07] border border-accent/20 px-3 py-2.5">
                    <div className="text-[11px] font-medium tracking-wider text-accent mb-1">开篇公式</div>
                    <div className="text-[13px] font-medium text-foreground">{c.formula}</div>
                  </div>
                </div>
              ))}
            </div>

            {/*
              第三行：脚本结构。这一块原来整个没展示，而它恰恰是"情绪曲线"
              这种通用 AI 根本给不出来的东西——它说的是观众从第几秒该有什么感觉。
            */}
            <h3 className="text-sm font-semibold tracking-widest text-muted-foreground mb-4">
              脚本结构 {FACTS.structures} 种 · 摘三种
            </h3>
            <div className="grid md:grid-cols-3 gap-5">
              {SHOWCASE_STRUCTURES.map((s) => (
                <div
                  key={s.id}
                  className="glass-panel rounded-2xl p-6 border-2 border-border hover:border-emerald-500/40 transition-colors"
                >
                  <div className="flex items-baseline gap-2 mb-3">
                    <span className="text-lg font-bold">{s.name}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">{s.coreLogic}</p>
                  <div className="rounded-xl bg-emerald-500/[0.07] border border-emerald-500/20 px-3 py-2.5 mb-3">
                    <div className="text-[11px] font-medium tracking-wider text-emerald-500 mb-1">结构公式</div>
                    <div className="text-[13px] font-medium text-foreground">{s.formula}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    情绪曲线：{s.emotionCurve}
                  </div>
                </div>
              ))}
            </div>

            {/*
              八大爆款元素用紧凑的两列排，不做成大卡片——
              它的说服力在于"八个方向一次看全"，摊成八张大卡反而散了。
              每条都带真实句式，因为句式才是能直接套用的东西，
              「要有冲突感」那种说法是正确的废话。
            */}
            <h3 className="text-sm font-semibold tracking-widest text-muted-foreground mt-12 mb-4">
              八大爆款元素 · 给个行业就能套出八个方向
            </h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {VIRAL_ELEMENTS.map((e) => (
                <div
                  key={e.name}
                  className="glass-panel rounded-xl px-4 py-3.5 border border-border hover:border-primary/40 transition-colors"
                >
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 mb-1.5">
                    <span className="font-bold">{e.name}</span>
                    <span className="text-xs text-muted-foreground">{e.hook}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {e.patterns.map((p) => (
                      <span
                        key={p}
                        className="text-[11px] px-2 py-1 rounded-md bg-primary/[0.08] border border-primary/20 text-foreground"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <p className="text-center text-sm text-muted-foreground mt-10">
              以上是 {FACTS.methods} 条里的 {3 + 3 + 3 + FACTS.elements} 条。
              生成时 AI 会按你的资源条件挑出能拍的那几条，并守住每一条写明的边界。
            </p>
          </div>
        </div>
      </section>

      {/* 核心功能。下面列了 8 个最常用的；全站共 15 个板块，数字统一从 FACTS 取 */}
      <section id="features" className="py-20 px-4 glass-panel">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/15 dark:bg-blue-900/30 rounded-full mb-4">
              <Star className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">{FACTS.boards} 个板块 · 这是最常用的 8 个</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              <span className="brand-gradient bg-clip-text text-transparent">
                全流程AI创作支持
              </span>
            </h2>
            <p className="text-xl text-muted-foreground">
              从定位到变现，8大功能覆盖短视频创作每一个环节
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, idx) => {
              const Icon = feature.icon;
              return (
                <div key={idx} className="group relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative glass-panel rounded-2xl p-6 border-2 border-border hover:border-primary/50 transition-all hover:shadow-xl h-full">
                    <div className={`w-14 h-14 ${colorClasses[feature.color]} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                      <Icon className="w-7 h-7" />
                    </div>
                    <h3 className="text-xl font-bold mb-3 text-foreground">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                      {feature.desc}
                    </p>
                    <ul className="space-y-2">
                      {feature.benefits.map((benefit, bidx) => (
                        <li key={bidx} className="flex items-start gap-2 text-xs text-muted-foreground">
                          <Check className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                          <span>{benefit}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="text-center mt-12">
            <Link 
              href="/dashboard" 
              className="inline-flex items-center gap-2 px-8 py-4 brand-gradient text-white rounded-xl font-semibold hover:scale-105 transition-transform shadow-lg"
            >
              立即体验全部功能
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* 价格对比 */}
      <section id="pricing" className="py-20 px-4 bg-muted dark:bg-muted">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-accent/15 dark:bg-purple-900/30 rounded-full mb-4">
              <Crown className="w-4 h-4 text-accent" />
              <span className="text-sm font-medium text-accent">价格方案</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              <span className="brand-gradient bg-clip-text text-transparent">
                选择适合您的方案
              </span>
            </h2>
            <p className="text-xl text-muted-foreground">
              从免费体验到企业定制，总有一款适合您
            </p>
          </div>

          {/* 传统方式 vs 小宋工作台对比 */}
          <div className="max-w-5xl mx-auto mb-16 overflow-x-auto">
            <div className="glass-panel rounded-2xl border-2 border-border overflow-hidden shadow-xl">
              <div className="grid grid-cols-4 gap-px bg-muted dark:bg-muted">
                <div className="bg-muted dark:bg-muted p-4 font-bold text-center">对比项</div>
                <div className="bg-muted dark:bg-muted p-4 font-bold text-center">传统方式</div>
                <div className="bg-primary/10 p-4 font-bold text-center text-primary">小宋工作台</div>
                <div className="bg-emerald-500/10 p-4 font-bold text-center text-green-500">提升幅度</div>
              </div>
              <div className="grid grid-cols-4 gap-px bg-muted dark:bg-muted">
                <div className="glass-panel p-4">脚本创作时间</div>
                <div className="glass-panel p-4 text-center text-muted-foreground">2-4小时</div>
                <div className="glass-panel p-4 text-center font-semibold text-primary">约 2 分钟</div>
                <div className="glass-panel p-4 text-center font-bold text-green-500">↑99%</div>
              </div>
              <div className="grid grid-cols-4 gap-px bg-muted dark:bg-muted">
                <div className="glass-panel p-4">学习门槛</div>
                <div className="glass-panel p-4 text-center text-muted-foreground">3-6个月</div>
                <div className="glass-panel p-4 text-center font-semibold text-primary">即用即会</div>
                <div className="glass-panel p-4 text-center font-bold text-green-500">零门槛</div>
              </div>
              <div className="grid grid-cols-4 gap-px bg-muted dark:bg-muted">
                <div className="glass-panel p-4">月度成本</div>
                <div className="glass-panel p-4 text-center text-muted-foreground">¥8000+</div>
                <div className="glass-panel p-4 text-center font-semibold text-primary">
                  ¥{SUBSCRIPTION_PLANS.basic.price}-{SUBSCRIPTION_PLANS.enterprise.price}
                </div>
                <div className="glass-panel p-4 text-center font-bold text-green-500">省95%</div>
              </div>
              <div className="grid grid-cols-4 gap-px bg-muted dark:bg-muted">
                <div className="glass-panel p-4">爆款命中率</div>
                <div className="glass-panel p-4 text-center text-muted-foreground">10-15%</div>
                <div className="glass-panel p-4 text-center font-semibold text-primary">30-40%</div>
                <div className="glass-panel p-4 text-center font-bold text-green-500">↑3倍</div>
              </div>
            </div>
          </div>

          {/* 4个定价方案 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
            {pricingPlans.map((plan, idx) => (
              <div key={idx} className={`relative ${plan.highlight ? 'md:scale-105' : ''}`}>
                {/*
                  下面那个徽章必须有 z-10。

                  徽章高 29px、只往上露出 16px（-top-4），剩下 13px 压在卡片上。
                  而卡片是 glass-panel，带 backdrop-filter——那会创建新的层叠
                  上下文，在两者 z-index 都是 auto 时，DOM 里靠后的卡片就画在
                  徽章上面，把它盖掉将近一半。
                  表现是「最受欢迎」被横着切了一刀，而不是不显示，所以很容易
                  被当成字体或行高的问题。

                  注意徽章和卡片是**兄弟**。页面上别处的徽章都是卡片的子元素，
                  子元素本来就画在父级背景之上，所以只有这一处会出事。
                */}
                {plan.highlight && (
                  <div className="absolute -top-4 left-1/2 z-10 -translate-x-1/2 px-4 py-1 brand-gradient text-white text-sm font-semibold rounded-full shadow-lg">
                    最受欢迎
                  </div>
                )}
                <div className={`glass-panel rounded-2xl p-6 border-2 ${plan.highlight ? 'border-accent/50 shadow-2xl' : 'border-border'} hover:shadow-xl transition-all h-full flex flex-col`}>
                  <div className="text-center mb-6">
                    <h3 className="text-2xl font-bold mb-2 text-foreground">{plan.name}</h3>
                    <div className="mb-2">
                      <span className="text-4xl font-extrabold text-primary">¥{plan.price}</span>
                      <span className="text-muted-foreground">/{plan.period}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{plan.desc}</p>
                  </div>
                  
                  <ul className="space-y-3 mb-6 flex-1">
                    {plan.features.map((feature, fidx) => (
                      <li key={fidx} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <Check className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Link
                    href="/dashboard"
                    className={`w-full py-3 rounded-xl font-semibold text-center transition-all ${
                      plan.highlight
                        ? 'brand-gradient text-white hover:scale-105 shadow-lg'
                        : 'bg-muted dark:bg-muted text-foreground hover:bg-muted dark:hover:bg-muted'
                    }`}
                  >
                    {plan.cta}
                  </Link>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-12 text-sm text-muted-foreground">
            <p>虚拟商品开通后不支持无理由退款 · 随时取消续费 · 数据完全保密</p>
          </div>
        </div>
      </section>

      {/* FAQ常见问题 */}
      <section id="faq" className="py-20 px-4 glass-panel">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/15 dark:bg-green-900/30 rounded-full mb-4">
              <MessageCircle className="w-4 h-4 text-green-500" />
              <span className="text-sm font-medium text-green-500">常见问题</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              <span className="bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
                您可能关心的问题
              </span>
            </h2>
            <p className="text-xl text-muted-foreground">
              解答您的疑惑，让您放心使用
            </p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, idx) => (
              <div key={idx} className="bg-muted rounded-xl border border-border overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-foreground/[0.06] dark:hover:bg-slate-750 transition-colors"
                >
                  <span className="font-semibold text-foreground pr-4">{faq.q}</span>
                  <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${openFaq === idx ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === idx && (
                  <div className="px-6 pb-4 text-muted-foreground leading-relaxed">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <p className="text-muted-foreground mb-4">
              还有其他问题？
            </p>
            <a 
              href="weixin://" 
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary/15 dark:bg-blue-900/30 text-primary rounded-lg hover:bg-primary/20 dark:hover:bg-blue-900/50 transition-colors font-medium"
            >
              <MessageCircle className="w-5 h-5" />
              联系客服咨询
            </a>
          </div>
        </div>
      </section>

      {/* 最终CTA */}
      <section className="py-20 px-4 brand-gradient text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-64 h-64 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-80 h-80 bg-white rounded-full blur-3xl" />
        </div>
        
        <div className="container mx-auto text-center relative z-10">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            准备好开始创作了吗？
          </h2>
          <p className="text-xl mb-8 opacity-90 max-w-2xl mx-auto">
            {/* 原来写「加入1280+创作者」，那个数字是编的 */}
            从账号定位开始，一条内容从选题到分镜一路做完
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link 
              href="/dashboard" 
              className="group px-10 py-5 bg-white text-primary rounded-xl font-bold text-lg hover:scale-105 transition-transform shadow-2xl flex items-center gap-2"
            >
              立即免费开始
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <a 
              href="#features" 
              className="px-10 py-5 border-2 border-white text-white rounded-xl font-bold text-lg hover:bg-white/10 transition-colors"
            >
              了解更多
            </a>
          </div>
          <p className="mt-8 text-sm opacity-75">
            无需信用卡 · 免费开始使用 · 随时升级
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-muted text-muted-foreground py-12 px-4">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-6 h-6 text-primary" />
                <span className="font-bold text-white text-lg">小宋编导工作台</span>
              </div>
              <p className="text-sm leading-relaxed">
                基于Claude AI的专业短视频创作助手，让创作更简单、更高效。
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold text-white mb-4">产品</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#features" className="hover:text-white transition-colors">核心功能</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">价格方案</a></li>
                <li><Link href="/dashboard" className="hover:text-white transition-colors">立即使用</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold text-white mb-4">支持</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#faq" className="hover:text-white transition-colors">常见问题</a></li>
                <li><a href="weixin://" className="hover:text-white transition-colors">联系客服</a></li>
                <li><a href="#" className="hover:text-white transition-colors">使用文档</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold text-white mb-4">关于</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">关于我们</a></li>
                <li><a href="#" className="hover:text-white transition-colors">隐私政策</a></li>
                <li><a href="#" className="hover:text-white transition-colors">服务条款</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-border pt-8 text-center text-sm">
            <p>&copy; 2024 小宋编导工作台. All rights reserved. Powered by Claude AI</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
