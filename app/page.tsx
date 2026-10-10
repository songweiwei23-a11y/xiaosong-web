"use client";

import {
  useState, useEffect } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { SUBSCRIPTION_PLANS, quotaSummary, planSellingPoints } from "@/lib/config/plans";
import { SUPPORT_WECHAT } from "@/lib/config/contact";
import { SHOWCASE_TACTICS, SHOWCASE_CARDS, SHOWCASE_STRUCTURES, FACTS } from "@/lib/showcase";
import { VIRAL_ELEMENTS, SCRIPT_FAMILIES } from "@/lib/viral-elements";
import { LandingNavCTA } from "@/components/landing/LandingNavCTA";
import { TryHero } from "@/components/landing/hero/TryHero";
import { REGISTER_URL } from "@/lib/landing";
import { DEAL_REASONS } from "@/lib/deal-reasons";
import { PURPOSES } from "@/lib/direction";
import { LIBRARY_CATEGORIES } from "@/lib/library";
import { BRAND_NAME, BrandSeal, BrandWordmark } from "@/components/brand/Brand";
import { 
  Zap, CheckCircle, TrendingUp, ArrowRight, 
  FileText, Lightbulb, Film, Target, Star,
  Crown, Check, BarChart3, BookOpen,
  Layers, ChevronRight,
  MessageCircle, ChevronDown,
  Clapperboard, Shuffle, FileSearch, GraduationCap, Compass, Bookmark, ListChecks, MessagesSquare,
  Telescope, ClipboardList, PenLine, Globe, Paperclip, ShieldCheck, LineChart, Download,
  Users, Camera, UserCheck, Rocket, Fingerprint, Sparkles, SearchX, FolderOpen,
} from "lucide-react";
import { PLAN_CATEGORIES } from "@/lib/plan-builder";
import { DEPTHS } from "@/lib/research";
import { MAX_CHAT_FILES } from "@/lib/chat-attachments";
import { DEEP_RESEARCH_LIMITS } from "@/lib/config/plans";

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

  /*
   * 全部功能（2026-10-04 首页卖点整理，产品方确认，docs/首页卖点整理_草稿_20261004.md）。
   * 按「想清楚 / 找灵感 / 写出来 / 拍出来 / 管起来 / AI 助理 / 学起来」分组，每一条都是线上已经能用的。
   * 旧的教训照旧：选题不写「热点追踪」「爆款概率」（没有热点数据源）；脚本不写「多版本对比」（没做）。
   */
  const FEATURE_GROUPS = ["想清楚", "找灵感", "写出来", "拍出来", "管起来", "AI 助理", "学起来"] as const;
  const features: { group: (typeof FEATURE_GROUPS)[number]; icon: typeof Target; title: string; desc: string; benefits: string[]; color: string; isNew?: boolean }[] = [
    {
      group: "想清楚",
      icon: Compass,
      title: "创作方向",
      desc: "告诉 AI 你拍视频是为了什么，按你的账号铺开方向和思路，推荐最值得先做的一个",
      benefits: [`${PURPOSES.length} 种目的可选`, "勾选方向直接去写", "推荐先做哪个"],
      color: "orange",
    },
    {
      group: "想清楚",
      icon: Target,
      title: "账号定位",
      desc: "账号定位、商业定位、内容定位、创作简报四件套，先出核心几节让你尽快看到方向，再补完整",
      benefits: ["人设与差异化", "怎么赚钱、卖什么", "拍什么、怎么配比"],
      color: "blue",
    },
    {
      group: "想清楚",
      icon: FileSearch,
      title: "前采建档",
      desc: "贴前采记录或传 Word，AI 提取成账号档案，逐项核对后再写入",
      benefits: ["每项标原文依据", "AI 逐项核对", "补问清单"],
      color: "blue",
    },
    {
      group: "想清楚",
      icon: TrendingUp,
      // 板块本名是「成交理由」，原来这里写"成交话术"，点进去对不上
      title: "成交理由",
      desc: "找出客人凭什么选你，同步进账号档案，选题、脚本、标题都会用上",
      // 理由个数从理由表取，别手写（手写过"十五个"，实际 17 个）
      benefits: [`${DEAL_REASONS.length} 个成交理由逐个打分`, "按档案分别保存", "选题、脚本、标题和二创共用"],
      color: "red",
    },
    {
      group: "找灵感",
      icon: Clapperboard,
      title: "拆解爆款",
      desc: "传一条参考视频，结合画面与口播拆出开篇、结构和拍法",
      benefits: ["前3分钟切镜头、截图", "口播自动识别", "拆解卡片与档案历史"],
      color: "purple",
    },
    {
      group: "找灵感",
      icon: Shuffle,
      title: "跨行业二创",
      desc: "借别的行业爆款的开篇、结构、拍法，换成你自己的行业来拍",
      benefits: ["11 个层次自由选", "拆解完一键带过来", "改写自查与档案历史"],
      color: "green",
    },
    {
      group: "找灵感",
      icon: Lightbulb,
      title: "选题策划",
      /*
       * 原来写「AI实时分析热点趋势」「每日热点追踪」「爆款概率预测」。
       * 系统没有任何热点数据源，提示词里只是让模型"结合当前热点"——
       * 那是模型自己训练时的旧知识，谈不上实时；"概率预测"更是完全没有。
       */
      desc: "按八大爆款元素的句式出选题，贴着你的账号定位，出过的不重复",
      benefits: ["八大爆款元素句式", "对标账号参考", "每条附开篇钩子"],
      color: "yellow",
    },
    {
      group: "找灵感",
      icon: Rocket,
      title: "起号",
      desc: `起号 ${FACTS.tactics} 计，按你的资源条件挑出能拍的那几计，排成起号方案`,
      benefits: [`起号 ${FACTS.tactics} 计`, "每计带结构公式", "新手课毕业接 7 天起号"],
      color: "orange",
    },
    {
      group: "写出来",
      icon: Sparkles,
      title: "开篇设计",
      desc: `开篇 ${FACTS.cards} 计、分 ${FACTS.cardCategories} 大类，专攻前 3 秒留住人`,
      benefits: [`${FACTS.cards} 计开篇公式`, "按心理机制分类", "直接带去写脚本"],
      color: "pink",
    },
    {
      group: "写出来",
      icon: FileText,
      title: "脚本生成",
      // 「多版本对比」「一键多版本」没有做——只能重新生成、在历史里翻旧版
      desc: `AI 生成完整口播脚本，${FACTS.structures} 种脚本结构任选，写成你的口吻`,
      benefits: ["内置编导知识库", `${FACTS.structures}种脚本结构`, "结合账号档案与人设事实卡"],
      color: "green",
    },
    {
      group: "写出来",
      icon: CheckCircle,
      title: "审稿优化",
      desc: "诊断节奏、情绪曲线、冲突设计，直接给出改好的完整稿",
      benefits: ["完播率诊断", "情绪起伏分析", "改好的完整稿"],
      color: "pink",
    },
    {
      group: "写出来",
      icon: Zap,
      title: "标题与封面文案",
      // 生成数量可选 3/5/8/10，默认 5，所以说"最多"
      desc: "一次最多出 10 个标题+封面文案，方便 A/B 测试",
      benefits: ["标题公式库", "情绪钩子植入", "A/B测试建议"],
      color: "orange",
    },
    {
      group: "拍出来",
      icon: Film,
      title: "分镜脚本",
      desc: "镜头表与拍摄清单，景别、运镜、时长、道具一目了然",
      benefits: ["镜头语言规划", "场景道具清单", "时长节奏把控"],
      color: "purple",
    },
    {
      group: "拍出来",
      icon: Camera,
      title: "拍摄交付包",
      desc: "一键导出整套拍摄资料：口播稿、手机提词大字稿、镜头清单，拍完一个勾一个",
      benefits: ["口播 TXT 与完整交付包", "提词字号 22～48 可调", "镜头清单逐个打勾"],
      color: "indigo",
      isNew: true,
    },
    {
      group: "管起来",
      icon: Bookmark,
      title: "素材库",
      desc: "任何板块生成的好内容一键收藏，按选题、脚本、方向思路等分类，随时拿去继续创作",
      benefits: ["勾几条存几条", `${LIBRARY_CATEGORIES.length} 个分类`, "真实素材、认可的好稿分开管"],
      color: "pink",
    },
    {
      group: "管起来",
      icon: ListChecks,
      title: "创作进度",
      desc: "每条内容做到哪一步、拍没拍、发没发，一眼看清；做好没拍、拍完没发会提醒",
      benefits: ["选题到标题逐环节", "还没拍 / 已拍摄 / 已发布", "多久没动会提醒"],
      color: "indigo",
    },
    {
      group: "管起来",
      icon: LineChart,
      title: "数据复盘",
      desc: "发布后录入播放、完播、互动、涨粉、咨询、成交，选题和方向按这个号的真实数据调整",
      benefits: ["粘贴平台后台表格导入", "同目的、同平台对比", "每千播放涨粉 / 咨询 / 成交"],
      color: "green",
      isNew: true,
    },
    {
      group: "管起来",
      icon: Users,
      title: "多账号档案",
      desc: "一个账号做好几个号：每个档案的内容、记录、素材、进度完全隔离，互不串",
      benefits: ["人设事实卡固定格子", "风格预设", "切换档案即切换全部内容"],
      color: "blue",
    },
    {
      group: "管起来",
      icon: Download,
      title: "数据导出",
      desc: "你的内容是你的：档案、作品、生成记录、素材库、对话，一键导出全部",
      benefits: ["个人全部内容", "云端保存、换设备接着用", "按账号权限隔离"],
      color: "indigo",
    },
    {
      group: "AI 助理",
      icon: MessagesSquare,
      title: "高阶自由对话",
      desc: "什么都能问：按需联网查最新信息，读图片和文档表格；回答里的选题、方向、脚本能勾选带去接着做",
      benefits: ["联网结果标来源链接", `一次最多 ${MAX_CHAT_FILES} 个附件`, "回答可勾选、可收藏"],
      color: "blue",
    },
    {
      group: "AI 助理",
      icon: Telescope,
      title: "深度研究报告",
      desc: `帮你上网查一圈、读几十个网页，整理成带出处的研究报告，每句话标来源，点开就是原网页`,
      benefits: [`一次读 ${DEPTHS.quick.sources * DEPTHS.quick.questions[0]}～${DEPTHS.deep.sources * DEPTHS.deep.questions[1]} 个网页`, "先给计划、确认才查", "找不到出处的数字标【未核实】"],
      color: "purple",
      isNew: true,
    },
    {
      group: "AI 助理",
      icon: ClipboardList,
      title: "出方案",
      desc: `活动、运营、直播、招商……${PLAN_CATEGORIES.length} 类 ${PLAN_CATEGORIES.reduce((n, c) => n + c.scenarios.length, 0)} 个场景，先出大纲你确认，再写完整方案`,
      benefits: ["可基于你上传的资料", "缺的信息标【待确认】", "Word / PDF 下载"],
      color: "orange",
      isNew: true,
    },
    {
      group: "AI 助理",
      icon: PenLine,
      title: "结果画布",
      desc: "在结果上直接改，或选中一段让 AI 改；每改一次存一版，可以切换、逐行对照",
      benefits: ["选段让 AI 改", "改稿版本可切换", "不许加原文没有的细节"],
      color: "pink",
      isNew: true,
    },
    {
      group: "AI 助理",
      icon: BookOpen,
      title: "知识库查询",
      desc: `约 ${FACTS.wordsWan} 万字符编导资料，分 ${FACTS.libraries} 个专题库，问一句就能查`,
      benefits: ["五个专题分库", `起号${FACTS.tactics}计`, `开篇${FACTS.cards}计`],
      color: "indigo",
    },
    {
      group: "学起来",
      icon: GraduationCap,
      title: "新手课堂",
      desc: "6 关学会抖音怎么推荐、怎么拍、怎么发，完全不懂也能上手",
      benefits: ["刷视频式学习", "每关一道题", "毕业接 7 天起号"],
      color: "yellow",
    },
  ];

  /*
   * 开物能解决的问题（痛点 → 怎么解决 → 在哪个板块）。
   */
  const problems: { icon: typeof Target; pain: string; fix: string; where: string }[] = [
    { icon: Compass, pain: "想做短视频，但不知道拍什么", fix: `选你拍视频的目的（${PURPOSES.length} 种），按你的账号铺开方向，告诉你最该先做哪个；选题按八大爆款元素出，每条带开篇钩子`, where: "创作方向 · 选题策划" },
    { icon: Target, pain: "账号没定位，拍了没人看", fix: "账号、商业、内容定位和创作简报四件套，先出核心几节让你马上看到方向", where: "账号定位" },
    { icon: FileText, pain: "写不出脚本，写了也不像样", fix: `${FACTS.structures} 种脚本结构任选，结合你的账号档案写成你的口吻；开篇 ${FACTS.cards} 计专攻前 3 秒`, where: "脚本生成 · 开篇设计" },
    { icon: Camera, pain: "脚本写好了，不知道怎么拍", fix: "分镜出镜头表和拍摄清单；拍摄交付包一键导出口播稿、手机提词大字稿、镜头清单", where: "分镜脚本 · 拍摄交付包" },
    { icon: Clapperboard, pain: "看到别人爆了，学不会", fix: "传一条视频自动切镜头、识别口播，拆出开篇、结构、拍法；还能把别的行业的爆款换成你的行业来拍", where: "拆解爆款 · 跨行业二创" },
    { icon: SearchX, pain: "AI 写的东西假大空、乱编", fix: "账号档案 + 人设事实卡 + 禁忌清单；每次生成自动体检，找不到依据的价格、地名、荣誉会标出，尽量不替你编", where: "全部板块" },
    { icon: LineChart, pain: "拍完发完，不知道效果好不好", fix: "粘贴平台后台表格就能导入数据，播放、完播、涨粉、咨询、成交一目了然，选题按真实数据调整", where: "数据复盘" },
    { icon: FolderOpen, pain: "东西做多了乱，找不到", fix: `素材库 ${LIBRARY_CATEGORIES.length} 个分类一键收藏；创作进度记着每条做到哪一步、拍没拍、发没发`, where: "素材库 · 创作进度" },
    { icon: ClipboardList, pain: "要写方案、做调研、看资料", fix: "出方案先大纲后全文；深度研究读几十个网页出带出处的报告；文档表格直接读，Word / PDF 直接下载", where: "高阶自由对话" },
    { icon: GraduationCap, pain: "完全不懂短视频", fix: "新手课堂 6 关，刷视频一样学会抖音怎么推荐、怎么拍、怎么发，毕业接 7 天起号", where: "新手课堂" },
    { icon: Users, pain: "手上有好几个号，或者帮客户做", fix: "多个账号档案，内容、记录、素材、进度按档案完全隔离，互不串", where: "账号档案" },
  ];

  /*
   * 对比表（产品方：这是一大杀器）。三列如实写：自己写 / 请编导、通用 AI 聊天工具、开物。
   * 「请编导成本高」是泛化说法，不写具体薪资：没有出处的数字不放进对比表。
   */
  const compareRows: { item: string; old: string; ai: string; us: string }[] = [
    { item: "编导方法", old: "靠个人经验，自己收集整理", ai: "没有体系，全看提示词写得好不好", us: `${FACTS.methods} 条带公式的方法，按目的自动套用` },
    { item: "懂你的账号", old: "每次都要重新讲一遍", ai: "聊完就忘，换个对话从头说", us: "账号档案 + 人设事实卡，所有板块共用" },
    { item: "乱编风险", old: "低，但慢", ai: "没有资料时，容易写出无依据的数字和经历", us: "自动体检，找不到依据的价格、地名、荣誉会标出" },
    { item: "全流程", old: "多个工具来回倒腾", ai: "一问一答，前后不连贯", us: `${FACTS.boards} 个板块互通，结果勾选就带走` },
    { item: "拍摄落地", old: "自己整理拍摄清单", ai: "给你一段文字", us: "分镜 + 拍摄交付包 + 手机提词大字稿" },
    { item: "拆解爆款", old: "一帧帧看、手动记", ai: "大多看不了视频", us: "自动切镜头、识别口播、拆出拍法" },
    { item: "发布复盘", old: "表格自己算", ai: "没有", us: "数据导入、同类对比，按真实数据调方向" },
    { item: "研究与方案", old: "花半天查资料、写方案", ai: "能写，但常常没出处", us: "深度研究每句标出处，方案先大纲后全文" },
    { item: "费用", old: "请编导成本高、排期长", ai: "订阅费 + 自己磨提示词的时间", us: `¥${SUBSCRIPTION_PLANS.basic.price}～${SUBSCRIPTION_PLANS.enterprise.price}/月，免费可体验` },
  ];

  /*
   * 一条内容怎么做出来：主流程 FACTS.pipeline 之后接审稿、拍摄、发布复盘。
   */
  const flowSteps: { name: string; note: string }[] = [
    { name: FACTS.pipeline[0], note: "按目的找方向" },
    { name: FACTS.pipeline[1], note: "八大爆款元素出题" },
    { name: FACTS.pipeline[2], note: `${FACTS.cards} 计抓住前 3 秒` },
    { name: FACTS.pipeline[3], note: `${FACTS.structures} 种结构任选` },
    { name: "审稿优化", note: "改好的完整稿" },
    { name: FACTS.pipeline[4], note: "镜头表与清单" },
    { name: FACTS.pipeline[5], note: "一次出 3～10 个" },
    { name: "拍摄交付", note: "提词稿、镜头打勾" },
    { name: "发布复盘", note: "按真实数据调方向" },
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
      period: "一次性体验",
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
      cta: "选择高频会员"
    }
  ];

  const faqs = [
    {
      q: "完全不懂编导可以用吗？",
      a: `完全可以！${BRAND_NAME}内置 ${FACTS.docs} 篇、约 ${FACTS.wordsWan} 万字符的专业编导资料，AI会结合您的需求和账号档案生成内容。无论您是新手还是专业编导，都可以从行业样例开始，逐步写出选题、脚本与镜头方案。`
    },
    {
      q: "生成的脚本质量如何？",
      a: `我们用 AI 智能生成，结合内置的编导知识库和 ${FACTS.methods} 条公式与句式（起号 ${FACTS.tactics} 计、开篇 ${FACTS.cards} 计、脚本结构 ${FACTS.structures} 种、爆款元素 ${FACTS.elements} 类）。脚本按所选结构展开，可结合拍摄条件继续细化；分镜板块提供镜头、动作与时长方案。不满意可以重新生成，已保存的结果在云端历史中查看，拆解报告和二创方案也按档案保存。`
    },
    {
      q: "和其他AI工具有什么区别？",
      a: `核心区别在于：①约 ${FACTS.wordsWan} 万字符的专业编导资料（${FACTS.docs} 篇，${FACTS.libraries} 个专题分库）和 ${FACTS.methods} 条公式与句式——四大脚本各对一个生意目的，起号 ${FACTS.tactics} 计、开篇 ${FACTS.cards} 计、脚本结构 ${FACTS.structures} 种、爆款元素 ${FACTS.elements} 类；②记得住你的账号：账号档案、人设事实卡、成交理由、风格预设所有板块共用，不用每次重新讲；③尽量不乱编：每次生成自动体检，找不到依据的价格、地名、荣誉会标出；④${FACTS.boards} 个创作板块互通，从方向、脚本、分镜到拍摄交付包、发布后的数据复盘，一条内容一路做完；⑤高阶自由对话能出方案、做带出处的深度研究报告、读文档表格，直接下载 Word / PDF。`
    },
    {
      q: "AI 会不会乱编？",
      a: "这是我们花力气最多的地方。你的从业年限、籍贯、主卖什么写在人设事实卡里，所有板块以它为准；禁忌和不想用的信息写进档案，生成时避开。每次生成都会自动体检：有没有踩禁忌、有没有用你排除的信息、年限和事实卡对不对、有没有资料里找不到的价格、地名、荣誉。找不到依据的信息会标【待确认】，尽量不替你编；在画布里改写时，也不许加原文没有的人名、时间、数字。后台每晚还会用固定案例自动回归一遍，质量下滑能第一时间发现。"
    },
    {
      q: "深度研究报告是什么？",
      a: `在高阶自由对话里点「深度研究」，写下想研究的问题。它先给你看研究计划（拆成几个子问题和搜索词，你可以改），确认后自动上网搜索、打开网页读正文，一次读 ${DEPTHS.quick.sources * DEPTHS.quick.questions[0]}～${DEPTHS.deep.sources * DEPTHS.deep.questions[1]} 个网页，整理成带出处的报告：每句话后面标来源编号，点开就是原网页；来源里找不到的数字标【未核实】。研究在服务器上跑，关掉页面也会继续。专业会员每月 ${DEEP_RESEARCH_LIMITS.pro} 份、高频会员每月 ${DEEP_RESEARCH_LIMITS.enterprise} 份，不占对话和联网次数。`
    },
    {
      q: "能帮我写方案、看资料吗？",
      a: `能。高阶自由对话里的「出方案」覆盖 ${PLAN_CATEGORIES.length} 类 ${PLAN_CATEGORIES.reduce((n, c) => n + c.scenarios.length, 0)} 个场景（开业活动、直播、招商、私域、年会、团队管理、危机处理……），写不进去的可以自定义；先出大纲你确认、改好，再写完整方案。可以上传你的资料让它照着写，缺的信息先问你或标【待确认】。一次能带 ${MAX_CHAT_FILES} 个附件（图片、PDF、Word、Excel、PPT、CSV 等），表格里的数据也能读出来分析。所有回答都能下载成 Word 或 PDF。`
    },
    {
      q: "我有好几个号，能分开管吗？",
      a: "能。每个号建一个账号档案，切换档案后，生成记录、素材库、创作进度、对话都只显示这个号的，互不串。每个档案有自己的人设事实卡、成交理由和风格预设。"
    },
    {
      // 2026-10-02：板块互通、素材库、创作进度上线后加
      q: "生成的内容怎么接着用？",
      a: "每个板块的结果下面都有「继续创作」：结果里有好几条选题、方向或脚本时，先勾要的那几条，再点想去的板块（写脚本、拆分镜、起标题……），内容自动填好，点生成就行。好的内容点「收藏」存进素材库，按分类随时取用；每条内容做到哪一步、拍没拍、发没发，在「创作进度」里一目了然。"
    },
    {
      q: "免费版有什么限制？",
      /*
       * 这一行原来是手写的「每月 50 次（账号定位3次、选题3次、脚本20次、对话20次）」，
       * 四个数字里有三个和 lib/config/plans.ts 对不上，总数 50 也是凑的。
       * 价格页早就改成从配置现算了，只有这里还留着一份手写的。
       * 直接用 quotaSummary，配置改了这里自动跟。
       */
      a: `免费版的额度是：${quotaSummary("free").join("、")}。核心创作板块均可体验，主要区别是次数。账号定位、商业定位、内容定位与创作简报共享定位额度；脚本生成、起号方案与开篇钩子共享脚本额度。`
    },
    {
      q: "如何保证数据安全？",
      a: "数据存放在 Supabase（Postgres），按账号进行权限隔离，多个档案之间也互相隔离。已保存的历史可查看、复制和删除；在「我的账户」里可以一键导出你的全部内容（档案、作品、生成记录、素材库、对话等）。生成与视频处理会使用第三方服务，具体处理范围请查看隐私政策。"
    },
    {
      q: "可以开发票吗？",
      a: "目前还不支持开发票。有开票需求请先联系我们再决定是否购买，避免付完款才发现开不了。"
    },
    {
      q: "支持哪些支付方式？",
      a: "微信和支付宝转账，扫码付款后上传转账截图，我核对后开通。"
    },
    {
      q: "如何联系客服？",
      a: `直接加微信：${SUPPORT_WECHAT}（手机同号）。目前是我本人在对接，看到就回。`
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
          {/* 窄屏（320 宽）时顶栏放不下会把"开物""登录""免费试用"都折成两行：字不许折行，间距收紧 */}
          <Link href="/" className="flex shrink-0 items-center gap-2 whitespace-nowrap transition-opacity hover:opacity-90 sm:gap-2.5">
            <BrandSeal size={32} />
            <span className="hidden text-[21px] text-foreground min-[360px]:inline">
              <BrandWordmark />
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-5 lg:gap-8">
            <a href="#problems" className="hidden text-sm font-medium hover:text-primary transition-colors lg:inline">能解决什么</a>
            <a href="#advantages" className="text-sm font-medium hover:text-primary transition-colors">核心优势</a>
            <a href="#features" className="text-sm font-medium hover:text-primary transition-colors">全部功能</a>
            <a href="#compare" className="hidden text-sm font-medium hover:text-primary transition-colors lg:inline">对比</a>
            {/* 原来是「成功案例」指向 #cases，而页面上根本没有这个版块——点了不会有
                任何反应。而且我们手上没有可公开的真实客户案例，编一个就是另一种形式的
                假数据。换成真正能说服人、也抄不走的东西：方法本身 */}
            <a href="#method" className="text-sm font-medium hover:text-primary transition-colors">编导方法</a>
            <a href="#pricing" className="text-sm font-medium hover:text-primary transition-colors">价格方案</a>
          </nav>
          <div className="flex items-center gap-2 whitespace-nowrap sm:gap-4">
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

        {/*
          首屏「一句话开始」（产品方从三个版本里选的）：给完全不懂的小白。
          原来的首屏是"AI编导助手 · 专业编导知识库 · Claude AI 驱动"——
          说的是我们是谁，小白不知道"编导"是什么，也不在乎知识库多少字。
          现在标题讲他能得到什么，首屏第一个动作是"就在这儿试"，看完再注册。
          方法库、知识库这些给懂行的人看的，挪到下面几屏。
        */}
        <div className="container mx-auto relative z-10">
          <TryHero />
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
            sub: `四大脚本 · 八大爆款元素 · 起号 ${FACTS.tactics} 计 · 开篇 ${FACTS.cards} 计 · 脚本结构 ${FACTS.structures} 种，结构附情绪曲线与避坑说明`,
            suffix: '',
          },
          {
            /*
             * 这一格原来是「5 步全流程打通」。5 是这三个数里最小的一个，
             * 摆在中间反而把整排数据压下去了，而且"5 步"听上去像流程图，
             * 不像资产。换成知识库全文字符数，数字由 FACTS 统一维护，
             * 也是通用 AI 最给不出来的东西。
             */
            key: 'words',
            value: FACTS.wordsWan,
            label: '万字符专业编导资料',
            sub: `${FACTS.docs} 篇 · ${FACTS.libraries} 个专题分库，全文统计含标点与排版字符`,
            suffix: '',
          },
          {
            key: 'boards',
            value: FACTS.boards,
            label: '个创作板块，互通互联',
            sub: `${FACTS.pipeline.join(' → ')}，每一步结果都能带去下一步`,
            suffix: '',
          },
          {
            key: 'structures',
            value: FACTS.structures,
            label: '种脚本结构',
            sub: '每种附结构公式、情绪曲线、适用场景和避坑说明，也可以让 AI 推荐',
            suffix: '',
          },
          {
            key: 'scenarios',
            value: PLAN_CATEGORIES.reduce((n, c) => n + c.scenarios.length, 0),
            label: '个方案场景',
            sub: `${PLAN_CATEGORIES.length} 大类：营销、直播电商、门店经营、私域、招商、活动、团队管理……先出大纲再写全文`,
            suffix: '',
          },
          {
            key: 'research',
            value: DEPTHS.deep.sources * DEPTHS.deep.questions[1],
            label: '个网页，深度研究一次读完',
            sub: '深入档的读取量。整理成带出处的报告，每句标来源，找不到出处的数字标【未核实】',
            suffix: '',
          },
        ].filter((t) => typeof t.value === 'number' && t.value > 0);

        if (tiles.length === 0) return null;

        return (
          <section className="py-16 bg-white/50 dark:bg-muted/50 backdrop-blur-xl border-y border-border/40">
            <div className="container mx-auto px-4">
              <div
                className={`grid grid-cols-2 gap-x-6 gap-y-10 max-w-5xl mx-auto ${
                  tiles.length >= 3 ? 'md:grid-cols-3' : tiles.length === 2 ? 'md:grid-cols-2' : ''
                }`}
              >
                {tiles.map((t) => (
                  <div key={t.key} className="text-center group hover:scale-105 transition-transform">
                    <div className="text-4xl sm:text-5xl md:text-6xl font-extrabold brand-gradient bg-clip-text text-transparent mb-2">
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

      {/* 能解决什么问题（2026-10-04 首页卖点整理）：先让人看到「这说的就是我」 */}
      <section id="problems" className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/15 dark:bg-blue-900/30 rounded-full mb-4">
              <Fingerprint className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">你是不是也遇到过</span>
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
              <span className="brand-gradient bg-clip-text text-transparent">做短视频的难处，开物都接得住</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">从不知道拍什么，到拍完不知道效果，每一个卡住的地方都有对应的板块</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {problems.map((p) => {
              const Icon = p.icon;
              return (
                <div key={p.pain} className="glass-panel rounded-2xl border border-border p-5 transition-colors hover:border-primary/40">
                  <div className="mb-3 flex items-center gap-2.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary"><Icon className="h-[18px] w-[18px]" /></span>
                    <span className="font-bold text-foreground">{p.pain}</span>
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground">{p.fix}</p>
                  <p className="mt-3 text-xs font-medium text-primary">→ {p.where}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/*
        八大核心优势（原来是三大：知识库、AI 生成、板块协同）。
        每一条都是线上已经能用的；不用「顶级」「最强」「第一」这类词（广告法禁止的绝对化用语），用具体数字和做法说话。
      */}
      <section id="advantages" className="py-20 px-4 bg-primary/10">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-accent/15 dark:bg-purple-900/30 rounded-full mb-4">
              <Crown className="w-4 h-4 text-accent" />
              <span className="text-sm font-medium text-accent">为什么选择我们</span>
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
              <span className="brand-gradient bg-clip-text text-transparent">八大核心优势</span>
            </h2>
            <p className="text-xl text-muted-foreground dark:text-foreground max-w-3xl mx-auto">有方法、懂你的号、不乱编、能落地开拍、能看数据调方向——不只是一个会写字的 AI</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-6xl mx-auto">
            {[
              {
                icon: BookOpen, color: "text-primary bg-primary/15", no: "01", title: "有方法，不是瞎写",
                lead: <>约 <b className="text-primary">{FACTS.wordsWan} 万字符</b>、{FACTS.docs} 篇编导资料，分 {FACTS.libraries} 个专题库，提炼出 <b className="text-primary">{FACTS.methods} 条</b>带公式的方法</>,
                points: [
                  "四大脚本（教知识 / 聊观点 / 晒过程 / 讲故事）各对一个生意目的",
                  `八大爆款元素、起号 ${FACTS.tactics} 计、开篇 ${FACTS.cards} 计、脚本结构 ${FACTS.structures} 种`,
                  "每条有名字、机制、结构公式、适用范围；脚本结构附情绪曲线与避坑说明",
                  "通用 AI 问你想要什么风格，开物先问这条是要涨粉、要信任、还是要成交",
                ],
              },
              {
                icon: Layers, color: "text-accent bg-accent/15", no: "02", title: `一条龙：${FACTS.boards} 个板块全流程打通`,
                lead: <>从创作方向、账号定位到拍摄交付、<b className="text-accent">发布后的数据复盘</b>，一条内容一路做完</>,
                points: [
                  "任何板块的结果都能勾选几条，带去别的板块接着做，自动填好",
                  "好内容一键收藏进素材库，按选题、脚本、方向思路分类取用",
                  "创作进度记着每条做到哪一步、拍没拍、发没发",
                  "换页、刷新、换设备，接着上次继续，不用重来",
                ],
              },
              {
                icon: UserCheck, color: "text-emerald-500 bg-emerald-500/15", no: "03", title: "越用越懂你的账号",
                lead: <>账号档案所有板块共用，写出来就是<b className="text-emerald-500">你的口吻、你的店</b></>,
                points: [
                  "人设事实卡：出镜人、从业年限、籍贯、在本地多久、主卖什么，做成固定格子",
                  "前采建档：贴采访记录或传 Word，AI 提取成档案，每项标原文依据",
                  `成交理由：${DEAL_REASONS.length} 个理由逐个打分，找到客人凭什么选你`,
                  "风格预设：你认可的好稿和写法存下来，生成自动带上",
                ],
              },
              {
                icon: ShieldCheck, color: "text-amber-500 bg-amber-500/15", no: "04", title: "不乱编，质量有人把关",
                lead: <>每次生成<b className="text-amber-500">自动体检</b>，找不到依据的价格、地名、荣誉会标出，尽量不替你编</>,
                points: [
                  "查禁忌、查你排除的信息、查内容配比、查年限和事实卡对不对",
                  "资料里找不到的价格、地名、荣誉会被标出来",
                  "改写时不许加原文没有的人名、时间、数字",
                  "后台质检看板，每晚用固定案例自动回归",
                ],
              },
              {
                icon: MessagesSquare, color: "text-primary bg-primary/15", no: "05", title: "AI 助理：高阶自由对话",
                lead: <>能聊、能查、能读、能写方案、能做<b className="text-primary">带出处的深度研究</b></>,
                points: [
                  `联网查最新信息并附来源；一次读 ${MAX_CHAT_FILES} 个附件，表格数据也能分析`,
                  `出方案：${PLAN_CATEGORIES.length} 类 ${PLAN_CATEGORIES.reduce((n, c) => n + c.scenarios.length, 0)} 个场景，先大纲后全文，可基于你的资料写`,
                  `深度研究：一次读 ${DEPTHS.quick.sources * DEPTHS.quick.questions[0]}～${DEPTHS.deep.sources * DEPTHS.deep.questions[1]} 个网页，每句标出处`,
                  "结果画布直接改、选段让 AI 改，所有回答可下载 Word / PDF",
                ],
              },
              {
                icon: Camera, color: "text-accent bg-accent/15", no: "06", title: "写完就能拍",
                lead: <>分镜、审稿、标题之后，还有一键导出的<b className="text-accent">拍摄交付包</b></>,
                points: [
                  "分镜：景别、运镜、时长、画面、台词、道具清单",
                  "手机提词大字稿，字号 22～48 可调；镜头清单拍完一个勾一个",
                  "审稿直接给出改好的完整稿，不只是挑毛病",
                  "标题封面一次出 3～10 个，方便 A/B 测试",
                ],
              },
              {
                icon: LineChart, color: "text-emerald-500 bg-emerald-500/15", no: "07", title: "看数据调方向",
                lead: <>发布后的数据录进来，<b className="text-emerald-500">下一条按真实数据调整</b></>,
                points: [
                  "播放、完播、三秒留存、互动、涨粉、咨询、成交都能记",
                  "从平台后台复制表格直接粘贴，按标题自动对上作品",
                  "同目的、同平台对比，算出每千播放涨粉 / 咨询 / 成交",
                  "选题、方向、起号、自由对话会参考这个号的真实数据",
                ],
              },
              {
                icon: Download, color: "text-amber-500 bg-amber-500/15", no: "08", title: "内容是你的，随时带走",
                lead: <>多账号档案互相隔离，全部内容<b className="text-amber-500">一键导出</b></>,
                points: [
                  "一个账号做好几个号，档案之间内容、记录、素材、进度互不串",
                  "素材库分开管 AI 好稿、你认可的好稿、真实素材（原话照用）",
                  "历史全部云端保存，换设备接着用",
                  "档案、作品、生成记录、素材库、对话可以一键导出",
                ],
              },
            ].map((a) => {
              const Icon = a.icon;
              return (
                <div key={a.no} className="glass-panel rounded-2xl border-2 border-border p-6 transition-all hover:border-primary/40 hover:shadow-xl sm:p-7">
                  <div className="mb-4 flex items-center gap-3">
                    <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${a.color}`}><Icon className="h-6 w-6" /></span>
                    <div>
                      <div className="text-xs font-mono text-muted-foreground">{a.no}</div>
                      <h3 className="text-xl font-bold text-foreground sm:text-2xl">{a.title}</h3>
                    </div>
                  </div>
                  <p className="mb-4 text-muted-foreground dark:text-foreground">{a.lead}</p>
                  <ul className="space-y-2.5">
                    {a.points.map((pt) => (
                      <li key={pt} className="flex items-start gap-2"><Check className="mt-0.5 h-5 w-5 shrink-0 text-green-500" /><span className="text-sm">{pt}</span></li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 一条内容怎么做出来：主流程一路到拍摄、发布复盘 */}
      <section id="flow" className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
              <span className="brand-gradient bg-clip-text text-transparent">一条内容，从想法到数据</span>
            </h2>
            <p className="text-lg text-muted-foreground">每一步的结果都能带去下一步，不用来回复制粘贴</p>
          </div>
          <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-9">
            {flowSteps.map((s, i) => (
              <li key={s.name} className="relative glass-panel rounded-xl border border-border px-3 py-4 text-center">
                <div className="mx-auto mb-2 flex h-7 w-7 items-center justify-center rounded-full brand-gradient text-xs font-bold text-white">{i + 1}</div>
                <div className="text-sm font-bold text-foreground">{s.name}</div>
                <div className="mt-1 text-[11px] leading-snug text-muted-foreground">{s.note}</div>
                {i < flowSteps.length - 1 && <ChevronRight className="absolute -right-3 top-1/2 z-10 hidden h-5 w-5 -translate-y-1/2 text-primary lg:block" />}
              </li>
            ))}
          </ol>
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
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
              <span className="brand-gradient bg-clip-text text-transparent">拍法是有公式的</span>
            </h2>
            <p className="text-xl text-muted-foreground dark:text-foreground max-w-3xl mx-auto">
              结合编导方法，给你<span className="font-semibold text-primary">一套能照着拍的结构</span>。
              四大脚本、八大爆款元素、起号 {FACTS.tactics} 计、开篇 {FACTS.cards} 计、
              脚本结构 {FACTS.structures} 种，共 <span className="font-semibold text-primary">{FACTS.methods} 条</span>，
              含可套用的公式与句式，脚本结构另附情绪曲线、适用场景，以及
              <span className="font-semibold text-primary">避坑说明</span>。
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

      {/*
        高阶自由对话专区（2026-10-04）：深度研究、出方案、读文档表格、结果画布。
        说的都是线上能用的：深度研究只给专业会员、高频会员，次数从 DEEP_RESEARCH_LIMITS 取。
      */}
      <section id="assistant" className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-accent/15 dark:bg-purple-900/30 rounded-full mb-4">
              <MessagesSquare className="w-4 h-4 text-accent" />
              <span className="text-sm font-medium text-accent">高阶自由对话</span>
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
              <span className="brand-gradient bg-clip-text text-transparent">不止短视频：方案、研究、资料都能做</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">和各板块共用记忆，刚生成的内容可以直接接着聊；所有回答都能下载成 Word / PDF</p>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {[
              {
                icon: Telescope, tag: `专业会员 ${DEEP_RESEARCH_LIMITS.pro} 份/月 · 高频会员 ${DEEP_RESEARCH_LIMITS.enterprise} 份/月`, title: "深度研究报告",
                desc: "写下想研究的问题，它上网查一圈、打开网页读正文，整理成一份带出处的研究报告。",
                points: [
                  "先给你看研究计划：拆成几个子问题和搜索词，你改好了才开始查",
                  `快速、标准、深入三档，一次读 ${DEPTHS.quick.sources * DEPTHS.quick.questions[0]}～${DEPTHS.deep.sources * DEPTHS.deep.questions[1]} 个网页`,
                  "每句话标来源编号，点开就是原网页；来源里找不到的数字标【未核实】",
                  "在服务器上跑，关掉页面也会继续；没查完的部分可以补查",
                ],
              },
              {
                icon: ClipboardList, tag: `${PLAN_CATEGORIES.length} 类 ${PLAN_CATEGORIES.reduce((n, c) => n + c.scenarios.length, 0)} 个场景 + 自定义`, title: "出方案",
                desc: "开业活动、直播、招商、私域、年会、团队管理、危机处理……各行各业的方案都能出。",
                points: [
                  "先出大纲：章节和要点你可以改、删、加、调顺序，确认后再写全文",
                  "可以上传你的资料，方案里的事实以资料为准",
                  "缺的信息先问你，或在方案里标【待确认】，尽量不替你编",
                  "缺章能补写，写完直接下载 Word / PDF",
                ],
              },
              {
                icon: Paperclip, tag: `一次 ${MAX_CHAT_FILES} 个附件`, title: "读文档、表格、图片",
                desc: "把资料直接丢进来：图片、PDF、Word、Excel、PPT、CSV、TXT，问什么答什么。",
                points: [
                  "表格里的数据能读出来做分析，不只是看个大概",
                  "按需联网查最新信息，回答附来源链接",
                  "附件随对话保存在云端，换设备也能接着问",
                  "读不出来的会明说，不会拿别的内容冒充",
                ],
              },
              {
                icon: PenLine, tag: "改稿版本随时切换", title: "结果画布",
                desc: "对回答不满意，不用重新生成整篇：在画布里直接改，或选中一段让 AI 改。",
                points: [
                  "每改一次存一版，可以切换、逐行对照改了哪里",
                  "改写时不许加原文没有的人名、时间、数字",
                  "改好的内容可以收藏，或带去别的板块接着做",
                  "停止生成、重新生成、改一下再问、引用追问都有",
                ],
              },
            ].map((x) => {
              const Icon = x.icon;
              return (
                <div key={x.title} className="glass-panel rounded-2xl border-2 border-border p-6 transition-all hover:border-accent/40 hover:shadow-xl sm:p-7">
                  <div className="mb-3 flex flex-wrap items-center gap-3">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent"><Icon className="h-6 w-6" /></span>
                    <h3 className="text-2xl font-bold text-foreground">{x.title}</h3>
                    <span className="rounded-full bg-primary/12 px-2.5 py-0.5 text-[11px] font-medium text-primary">{x.tag}</span>
                  </div>
                  <p className="mb-4 text-muted-foreground dark:text-foreground">{x.desc}</p>
                  <ul className="space-y-2.5">
                    {x.points.map((pt) => (
                      <li key={pt} className="flex items-start gap-2"><Check className="mt-0.5 h-5 w-5 shrink-0 text-green-500" /><span className="text-sm">{pt}</span></li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
          <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground"><Globe className="h-3.5 w-3.5" />联网搜索各档另有独立次数；深度研究不占对话和联网次数</p>
        </div>
      </section>

      {/* 全部功能（2026-10-04 按用途分组，每一项都是线上能用的） */}
      <section id="features" className="py-20 px-4 glass-panel">
        <div className="container mx-auto">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/15 dark:bg-blue-900/30 rounded-full mb-4">
              <Star className="w-4 h-4 text-primary" />
              {/* 素材库、创作进度是整理内容的地方，不算创作板块（FACTS.boards 不数它们），所以分开说 */}
              <span className="text-sm font-medium text-primary">{FACTS.boards} 个创作板块 + 素材库、创作进度、数据复盘</span>
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
              <span className="brand-gradient bg-clip-text text-transparent">
                全部功能
              </span>
            </h2>
            <p className="text-xl text-muted-foreground">
              想清楚、找灵感、写出来、拍出来、管起来，每一步的结果都能带去下一步
            </p>
          </div>

          <div className="space-y-12">
            {FEATURE_GROUPS.map((group) => (
              <div key={group}>
                <h3 className="mb-4 flex items-center gap-3 text-sm font-semibold tracking-widest text-muted-foreground">
                  {group}<span className="h-px flex-1 bg-border" />
                </h3>
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
                  {features.filter((f) => f.group === group).map((feature) => {
                    const Icon = feature.icon;
                    return (
                      <div key={feature.title} className="group relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="relative glass-panel rounded-2xl p-6 border-2 border-border hover:border-primary/50 transition-all hover:shadow-xl h-full">
                          <div className={`w-12 h-12 ${colorClasses[feature.color]} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                            <Icon className="w-6 h-6" />
                          </div>
                          <h4 className="mb-2.5 flex items-center gap-2 text-lg font-bold text-foreground">
                            {feature.title}
                            {feature.isNew && (
                              <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] font-semibold text-rose-500">新</span>
                            )}
                          </h4>
                          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                            {feature.desc}
                          </p>
                          <ul className="space-y-2">
                            {feature.benefits.map((benefit) => (
                              <li key={benefit} className="flex items-start gap-2 text-xs text-muted-foreground">
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
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link
              href={REGISTER_URL}
              className="inline-flex items-center gap-2 px-8 py-4 brand-gradient text-white rounded-xl font-semibold hover:scale-105 transition-transform shadow-lg"
            >
              立即体验全部功能
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/*
        对比表（产品方：一大杀器）。三列如实对比：自己写 / 请编导、通用 AI 聊天工具、开物。
        手机上横向滑动看，第一列固定。
      */}
      <section id="compare" className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/15 dark:bg-blue-900/30 rounded-full mb-4">
              <BarChart3 className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">放在一起比一比</span>
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
              <span className="brand-gradient bg-clip-text text-transparent">请编导、用通用 AI，还是用开物？</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              请编导成本高、排期长，通用 AI 不懂编导、聊完就忘、还容易乱编；开物把编导方法、你的账号和整条创作流程装在一起，每月 ¥{SUBSCRIPTION_PLANS.basic.price} 起
            </p>
          </div>
          {/* 手机上：一项一张卡，开物那一格放最上面、高亮；表格横着滑会把开物那一列藏到屏幕外 */}
          <div className="space-y-3 md:hidden">
            {compareRows.map((r) => (
              <div key={r.item} className="glass-panel rounded-2xl border border-border p-4">
                <div className="mb-2 text-sm font-bold text-foreground">{r.item}</div>
                <div className="flex items-start gap-1.5 rounded-xl bg-primary/10 px-3 py-2 text-sm font-semibold text-primary">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-500" /><span><BrandWordmark />：{r.us}</span>
                </div>
                <div className="mt-2 space-y-1 px-1 text-xs text-muted-foreground">
                  <p><span className="text-foreground/70">请编导：</span>{r.old}</p>
                  <p><span className="text-foreground/70">通用 AI：</span>{r.ai}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="hidden overflow-x-auto rounded-2xl border-2 border-border shadow-xl md:block">
            <table className="w-full min-w-[40rem] border-collapse text-sm sm:text-base">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-muted p-3 text-left font-bold sm:p-4">对比项</th>
                  <th className="bg-muted p-3 text-center font-bold text-muted-foreground sm:p-4">自己写 / 请编导</th>
                  <th className="bg-muted p-3 text-center font-bold text-muted-foreground sm:p-4">通用 AI 聊天工具</th>
                  <th className="bg-primary/15 p-3 text-center text-primary sm:p-4"><BrandWordmark /></th>
                </tr>
              </thead>
              <tbody>
                {compareRows.map((r) => (
                  <tr key={r.item} className="border-t border-border">
                    <td className="sticky left-0 z-10 bg-card p-3 font-semibold text-foreground sm:p-4">{r.item}</td>
                    <td className="bg-card p-3 text-center text-muted-foreground sm:p-4">{r.old}</td>
                    <td className="bg-card p-3 text-center text-muted-foreground sm:p-4">{r.ai}</td>
                    <td className="bg-primary/[0.07] p-3 text-center font-semibold text-primary sm:p-4">
                      <span className="inline-flex items-start gap-1.5 text-left"><Check className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />{r.us}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="text-center mt-10">
            <Link href={REGISTER_URL} className="inline-flex items-center gap-2 px-8 py-4 brand-gradient text-white rounded-xl font-semibold hover:scale-105 transition-transform shadow-lg">
              免费试一试
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
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
              <span className="brand-gradient bg-clip-text text-transparent">
                选择适合您的方案
              </span>
            </h2>
            <p className="text-xl text-muted-foreground">
              从免费体验到高频创作，总有一款适合您
            </p>
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
                    推荐方案
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
            {/*
              原来是「随时取消续费 · 数据完全保密」。没有自动续费，谈不上"取消"；
              生成时输入会发给 Dify 和 Claude 处理（隐私政策里写明了），
              说"完全保密"和隐私政策自相矛盾。
            */}
            <p>虚拟商品开通后不支持无理由退款 · 不会自动扣费 · 不出售你的数据</p>
            <p className="mt-3">
              <Link href="/pricing" className="text-primary hover:underline">查看逐项功能对比 →</Link>
              <span className="mx-2">·</span>
              <Link href="/terms" className="text-primary hover:underline">服务条款</Link>
            </p>
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
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
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
            {/*
              原来是一个"联系客服咨询"按钮，链接 weixin://——桌面端点了没反应，
              手机上也只是打开微信、并不会加上客服。直接把微信号亮出来，可选中复制。
            */}
            <div className="inline-flex items-center gap-2 px-6 py-3 bg-primary/15 dark:bg-blue-900/30 text-primary rounded-lg font-medium">
              <MessageCircle className="w-5 h-5" />
              客服微信：<span className="select-all">{SUPPORT_WECHAT}</span>（手机同号）
            </div>
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
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6">
            准备好开始创作了吗？
          </h2>
          <p className="text-xl mb-8 opacity-90 max-w-2xl mx-auto">
            {/* 原来写「加入1280+创作者」，那个数字是编的 */}
            从创作方向开始，一条内容从选题、脚本、分镜一路做到拍摄交付和数据复盘
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link 
              href={REGISTER_URL} 
              className="group px-10 py-5 bg-white text-primary rounded-xl font-bold text-lg hover:scale-105 transition-transform shadow-2xl flex items-center gap-2"
            >
              领取邀请码，免费体验
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
            无需信用卡 · 凭邀请码注册 · 随时升级
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-muted text-muted-foreground py-12 px-4">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <BrandSeal size={30} />
                <span className="text-[19px] text-foreground">
                  <BrandWordmark latin />
                </span>
              </div>
              <p className="text-sm leading-relaxed">
                懂编导的 AI 短视频搭档：从想拍什么，到写好、拍好、发出去、看数据，一站搞定。
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold text-white mb-4">产品</h4>
              <ul className="space-y-0.5 text-sm">
                <li><a href="#features" className="inline-block py-1.5 hover:text-white transition-colors">核心功能</a></li>
                <li><a href="#pricing" className="inline-block py-1.5 hover:text-white transition-colors">价格方案</a></li>
                {/* /pricing 有一张逐项的功能对比表，原来全站没有任何入口能走到 */}
                <li><Link href="/pricing" className="inline-block py-1.5 hover:text-white transition-colors">完整功能对比</Link></li>
                <li><Link href={REGISTER_URL} className="inline-block py-1.5 hover:text-white transition-colors">立即使用</Link></li>
              </ul>
            </div>

            {/*
              这一栏原来有「联系客服」（weixin://，桌面端点了没反应，手机上也只是
              打开微信、并不会加上客服）和「使用文档」（href="#"，没有文档）。
              客服改成直接写出微信号，没有文档就不放链接。
            */}
            <div>
              <h4 className="font-semibold text-white mb-4">支持</h4>
              <ul className="space-y-0.5 text-sm">
                <li><a href="#faq" className="inline-block py-1.5 hover:text-white transition-colors">常见问题</a></li>
                <li>客服微信：<span className="select-all text-white">{SUPPORT_WECHAT}</span></li>
              </ul>
            </div>

            {/* 原来三个都是 href="#"。「关于我们」没有内容可放，撤掉 */}
            <div>
              <h4 className="font-semibold text-white mb-4">关于</h4>
              <ul className="space-y-0.5 text-sm">
                <li><Link href="/privacy" className="inline-block py-1.5 hover:text-white transition-colors">隐私政策</Link></li>
                <li><Link href="/terms" className="inline-block py-1.5 hover:text-white transition-colors">服务条款</Link></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-border pt-8 text-center text-sm">
            <p>&copy; {new Date().getFullYear()} {BRAND_NAME}. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
