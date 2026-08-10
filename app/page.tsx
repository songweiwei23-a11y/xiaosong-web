"use client";

import {
  useState, useEffect } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { LandingNavCTA } from "@/components/landing/LandingNavCTA";
import { 
  Sparkles, Zap, CheckCircle, TrendingUp, ArrowRight, 
  FileText, Lightbulb, Film, Target, Star,
  Crown, Check, BarChart3, Award, Rocket, BookOpen,
  Brain, Layers, Clock, Shield, Quote, Play, ChevronRight,
  MessageCircle, Activity, ChevronDown, X
} from "lucide-react";

export default function HomePage() {
  const [stats, setStats] = useState({ users: 0, scripts: 0, satisfaction: 0 });
  const [mounted, setMounted] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    setMounted(true);
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const res = await fetch('/api/public/stats');
      const data = await res.json();
      animateNumbers(data);
    } catch {
      animateNumbers({ users: 1280, scripts: 15680, satisfaction: 98 });
    }
  };

  const animateNumbers = (target: any) => {
    const steps = 60;
    const duration = 2000;
    const inc = { users: target.users / steps, scripts: target.scripts / steps, satisfaction: target.satisfaction / steps };
    
    let current = 0;
    const timer = setInterval(() => {
      current++;
      setStats({ users: Math.floor(inc.users * current), scripts: Math.floor(inc.scripts * current), satisfaction: Math.floor(inc.satisfaction * current) });
      if (current >= steps) { clearInterval(timer); setStats(target); }
    }, duration / steps);
  };

  if (!mounted) return null;

  const features = [
    {
      icon: Target,
      title: "账号定位",
      desc: "3分钟精准定位，AI分析目标用户画像、内容方向、变现路径",
      benefits: ["避免试错成本", "精准人设定位", "商业模式规划"],
      color: "blue"
    },
    {
      icon: Lightbulb,
      title: "选题策划",
      desc: "AI实时分析热点趋势，推荐高潜力爆款选题",
      benefits: ["每日热点追踪", "竞品选题分析", "爆款概率预测"],
      color: "yellow"
    },
    {
      icon: FileText,
      title: "脚本生成",
      desc: "10秒生成完整脚本，支持多版本对比优选",
      benefits: ["Claude AI驱动", "10000+案例库", "一键多版本"],
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
      desc: "一键生成10个标题+封面文案，提升点击率",
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
      desc: "10000+编导技巧随时查阅，专业知识触手可及",
      benefits: ["12大类目覆盖", "每周更新", "实战案例库"],
      color: "indigo"
    }
  ];

  const pricingPlans = [
    {
      name: "免费版",
      price: 0,
      period: "永久免费",
      desc: "体验核心功能",
      features: [
        "知识库无限查询",
        "账号定位 3次",
        "选题策划 3次",
        "脚本生成 20次",
        "自由对话 20次/月"
      ],
      highlight: false,
      cta: "立即开始"
    },
    {
      name: "基础版",
      price: 30,
      period: "月",
      desc: "适合个人创作者",
      features: [
        "知识库无限查询",
        "所有功能 150次/月",
        "优先响应速度",
        "历史记录保存",
        "邮件客服支持"
      ],
      highlight: false,
      cta: "选择基础版"
    },
    {
      name: "专业版",
      price: 99,
      period: "月",
      desc: "适合专业团队",
      features: [
        "知识库无限查询",
        "所有功能 500次/月",
        "最高优先级",
        "多版本对比",
        "专属客服支持",
        "API接口访问"
      ],
      highlight: true,
      cta: "选择专业版"
    },
    {
      name: "企业版",
      price: 199,
      period: "月",
      desc: "适合MCN机构",
      features: [
        "所有功能无限使用",
        "知识库无限查询",
        "专属AI模型",
        "数据报表分析",
        "团队协作功能",
        "1v1专属顾问"
      ],
      highlight: false,
      cta: "联系销售"
    }
  ];

  const faqs = [
    {
      q: "完全不懂编导可以用吗？",
      a: "完全可以！小宋编导工作台内置10000+专业编导知识库，AI会根据您的需求自动匹配最佳方案。无论您是新手还是专业编导，都能快速上手，3分钟即可生成专业级脚本。"
    },
    {
      q: "生成的脚本质量如何？",
      a: "我们基于Anthropic Claude最新AI模型，结合10000+爆款案例和专业编导知识库训练。生成的脚本包含完整的开场、冲突、高潮、结尾结构，平均完播率提升30%以上。支持一键生成多个版本供您选择优化。"
    },
    {
      q: "和其他AI工具有什么区别？",
      a: "我们不是简单的AI对话工具。核心优势在于：①专业的10000+编导知识库，②针对短视频创作的全流程支持（定位→选题→脚本→分镜→转化），③每周更新的爆款案例库，④专为中文短视频优化的提示词工程。"
    },
    {
      q: "免费版有什么限制？",
      a: "免费版每月提供50次核心功能使用额度（账号定位3次、选题策划3次、脚本生成20次、对话20次），知识库查询不限次数。功能和付费版完全一样，只是使用次数有限制。足够您深度体验所有功能。"
    },
    {
      q: "如何保证数据安全？",
      a: "所有数据采用银行级加密存储，绝不泄露您的创意和脚本内容。我们承诺：①数据仅用于为您生成内容，②不会用于AI训练，③7天无理由退款保障，④支持导出所有历史记录。"
    },
    {
      q: "可以开发票吗？",
      a: "可以开具增值税电子普通发票和专用发票。购买后在个人中心-订单管理中申请开票，我们会在3个工作日内开具并发送到您的邮箱。"
    },
    {
      q: "支持哪些支付方式？",
      a: "目前支持微信支付和支付宝支付。企业版支持对公转账，联系客服获取账户信息。所有支付均通过官方渠道，安全可靠。"
    },
    {
      q: "如何联系客服？",
      a: "免费版用户可通过邮件联系客服（support@xiaosong.ai），基础版及以上用户享有优先响应权。专业版和企业版配有专属客服，响应时间<2小时。"
    }
  ];

  const colorClasses: Record<string, string> = {
    blue: "bg-blue-100 dark:bg-blue-900/30 text-blue-600",
    yellow: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600",
    green: "bg-green-100 dark:bg-green-900/30 text-green-600",
    purple: "bg-purple-100 dark:bg-purple-900/30 text-purple-600",
    pink: "bg-pink-100 dark:bg-pink-900/30 text-pink-600",
    orange: "bg-orange-100 dark:bg-orange-900/30 text-orange-600",
    red: "bg-red-100 dark:bg-red-900/30 text-red-600",
    indigo: "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600"
  };


  return (
    <div className="min-h-screen flex flex-col">
      {/* Navigation */}
      <header className="fixed top-0 w-full border-b border-border bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl hover:scale-105 transition-transform">
            <Sparkles className="w-6 h-6 text-blue-600 animate-pulse" />
            <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              小宋编导工作台
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium hover:text-blue-600 transition-colors">核心功能</a>
            <a href="#advantages" className="text-sm font-medium hover:text-blue-600 transition-colors">核心优势</a>
            <a href="#cases" className="text-sm font-medium hover:text-blue-600 transition-colors">成功案例</a>
            <a href="#pricing" className="text-sm font-medium hover:text-blue-600 transition-colors">价格方案</a>
          </nav>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <LandingNavCTA />
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4 overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute top-40 right-10 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{animationDelay:'1s'}} />
          <div className="absolute bottom-20 left-1/3 w-80 h-80 bg-pink-500/10 rounded-full blur-3xl animate-pulse" style={{animationDelay:'2s'}} />
        </div>

        <div className="container mx-auto relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 dark:bg-blue-900/30 rounded-full mb-6">
              <Rocket className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-600">Claude AI驱动 · 专业编导知识库 · 10秒生成爆款脚本</span>
            </div>

            <h1 className="text-5xl md:text-7xl font-extrabold mb-6 leading-tight">
              <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                AI编导助手
              </span>
              <br />
              <span className="text-slate-900 dark:text-white">让短视频创作</span>
              <br />
              <span className="relative inline-block">
                <span className="text-slate-900 dark:text-white">更专业、更高效</span>
                <svg className="absolute -bottom-2 left-0 w-full" height="12" viewBox="0 0 300 12" fill="none">
                  <path d="M2 10C50 5,100 2,150 3C200 4,250 7,298 10" stroke="url(#g)" strokeWidth="4" strokeLinecap="round"/>
                  <defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#3b82f6"/><stop offset="50%" stopColor="#a855f7"/><stop offset="100%" stopColor="#ec4899"/>
                  </linearGradient></defs>
                </svg>
              </span>
            </h1>

            <p className="text-xl md:text-2xl text-slate-600 dark:text-slate-300 mb-8 max-w-3xl mx-auto">
              基于<span className="font-semibold text-blue-600">专业编导知识库</span>，
              结合<span className="font-semibold text-purple-600">Claude AI</span>大模型，
              为您提供<span className="font-semibold text-pink-600">智能化</span>的短视频创作解决方案
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
              <Link href="/dashboard" className="group relative px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold text-lg shadow-2xl hover:shadow-blue-500/50 transition-all hover:scale-105">
                <span className="relative z-10 flex items-center gap-2">
                  立即免费体验 <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </span>
              </Link>
              <a href="#demo" className="px-8 py-4 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl font-semibold text-lg border-2 border-slate-200 dark:border-slate-700 hover:border-blue-600 transition-all hover:scale-105 flex items-center gap-2">
                <Play className="w-5 h-5 text-blue-600" /> 观看演示
              </a>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-6 text-sm">
              <div className="flex items-center gap-2"><CheckCircle className="w-5 h-5 text-green-500" /><span className="text-slate-600 dark:text-slate-300">免费试用·无需信用卡</span></div>
              <div className="flex items-center gap-2"><CheckCircle className="w-5 h-5 text-green-500" /><span className="text-slate-600 dark:text-slate-300">10秒生成专业脚本</span></div>
              <div className="flex items-center gap-2"><CheckCircle className="w-5 h-5 text-green-500" /><span className="text-slate-600 dark:text-slate-300">98%用户好评</span></div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl border-y border-border/40">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center group hover:scale-105 transition-transform">
              <div className="text-5xl md:text-6xl font-extrabold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">{stats.users.toLocaleString()}+</div>
              <div className="text-sm text-slate-600 dark:text-slate-400 font-medium">创作者正在使用</div>
            </div>
            <div className="text-center group hover:scale-105 transition-transform">
              <div className="text-5xl md:text-6xl font-extrabold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">{stats.scripts.toLocaleString()}+</div>
              <div className="text-sm text-slate-600 dark:text-slate-400 font-medium">脚本生成数量</div>
            </div>
            <div className="text-center group hover:scale-105 transition-transform">
              <div className="text-5xl md:text-6xl font-extrabold bg-gradient-to-r from-pink-600 to-orange-600 bg-clip-text text-transparent mb-2">{stats.satisfaction}%</div>
              <div className="text-sm text-slate-600 dark:text-slate-400 font-medium">用户满意度</div>
            </div>
          </div>
        </div>
      </section>

      {/* 三大核心优势 */}
      <section id="advantages" className="py-20 px-4 bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-100 dark:bg-purple-900/30 rounded-full mb-4">
              <Crown className="w-4 h-4 text-purple-600" />
              <span className="text-sm font-medium text-purple-600">为什么选择我们</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">三大核心优势</span>
            </h2>
            <p className="text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">专业编导知识 + AI技术 + 持续迭代，让您的创作始终领先一步</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <div className="group relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-2xl blur-xl opacity-0 group-hover:opacity-20 transition-opacity" />
              <div className="relative bg-white dark:bg-slate-800 rounded-2xl p-8 border-2 border-slate-200 dark:border-slate-700 hover:border-blue-600 transition-all hover:shadow-2xl h-full">
                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <BookOpen className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-2xl font-bold mb-4">专业编导知识库</h3>
                <p className="text-slate-600 dark:text-slate-300 mb-6">
                  整合<span className="font-semibold text-blue-600">10000+</span>专业编导技巧、
                  <span className="font-semibold text-blue-600">500+</span>爆款案例分析、
                  <span className="font-semibold text-blue-600">100+</span>行业洞察
                </p>
                <ul className="space-y-3">
                  <li className="flex items-start gap-2"><Check className="w-5 h-5 text-green-500 shrink-0 mt-0.5" /><span className="text-sm">涵盖情感、剧情、知识、搞笑等12大类目</span></li>
                  <li className="flex items-start gap-2"><Check className="w-5 h-5 text-green-500 shrink-0 mt-0.5" /><span className="text-sm">每周更新最新爆款脚本套路</span></li>
                  <li className="flex items-start gap-2"><Check className="w-5 h-5 text-green-500 shrink-0 mt-0.5" /><span className="text-sm">专业编导团队人工标注验证</span></li>
                </ul>
              </div>
            </div>

            <div className="group relative">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl blur-xl opacity-0 group-hover:opacity-20 transition-opacity" />
              <div className="relative bg-white dark:bg-slate-800 rounded-2xl p-8 border-2 border-slate-200 dark:border-slate-700 hover:border-purple-600 transition-all hover:shadow-2xl h-full">
                <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Brain className="w-8 h-8 text-purple-600" />
                </div>
                <h3 className="text-2xl font-bold mb-4">Claude AI 智能引擎</h3>
                <p className="text-slate-600 dark:text-slate-300 mb-6">
                  基于<span className="font-semibold text-purple-600">Anthropic Claude</span>最新模型，
                  结合编导知识库，智能理解您的需求，生成专业级脚本
                </p>
                <ul className="space-y-3">
                  <li className="flex items-start gap-2"><Check className="w-5 h-5 text-green-500 shrink-0 mt-0.5" /><span className="text-sm">10秒生成完整脚本，节省80%创作时间</span></li>
                  <li className="flex items-start gap-2"><Check className="w-5 h-5 text-green-500 shrink-0 mt-0.5" /><span className="text-sm">自动匹配最佳叙事结构和节奏</span></li>
                  <li className="flex items-start gap-2"><Check className="w-5 h-5 text-green-500 shrink-0 mt-0.5" /><span className="text-sm">支持一键优化和多版本生成</span></li>
                </ul>
              </div>
            </div>

            <div className="group relative">
              <div className="absolute inset-0 bg-gradient-to-r from-pink-600 to-orange-600 rounded-2xl blur-xl opacity-0 group-hover:opacity-20 transition-opacity" />
              <div className="relative bg-white dark:bg-slate-800 rounded-2xl p-8 border-2 border-slate-200 dark:border-slate-700 hover:border-pink-600 transition-all hover:shadow-2xl h-full">
                <div className="w-16 h-16 bg-pink-100 dark:bg-pink-900/30 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Layers className="w-8 h-8 text-pink-600" />
                </div>
                <h3 className="text-2xl font-bold mb-4">全流程创作支持</h3>
                <p className="text-slate-600 dark:text-slate-300 mb-6">
                  从账号定位到成交转化，覆盖短视频创作的<span className="font-semibold text-pink-600">每一个环节</span>
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


      {/* 8大核心功能 */}
      <section id="features" className="py-20 px-4 bg-white dark:bg-slate-900">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 dark:bg-blue-900/30 rounded-full mb-4">
              <Star className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-600">8大核心功能</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                全流程AI创作支持
              </span>
            </h2>
            <p className="text-xl text-slate-600 dark:text-slate-400">
              从定位到变现，8大功能覆盖短视频创作每一个环节
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, idx) => {
              const Icon = feature.icon;
              return (
                <div key={idx} className="group relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative bg-white dark:bg-slate-800 rounded-2xl p-6 border-2 border-slate-200 dark:border-slate-700 hover:border-blue-500 transition-all hover:shadow-xl h-full">
                    <div className={`w-14 h-14 ${colorClasses[feature.color]} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                      <Icon className="w-7 h-7" />
                    </div>
                    <h3 className="text-xl font-bold mb-3 text-slate-900 dark:text-white">{feature.title}</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
                      {feature.desc}
                    </p>
                    <ul className="space-y-2">
                      {feature.benefits.map((benefit, bidx) => (
                        <li key={bidx} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400">
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
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:scale-105 transition-transform shadow-lg"
            >
              立即体验全部功能
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* 价格对比 */}
      <section id="pricing" className="py-20 px-4 bg-slate-50 dark:bg-slate-950">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-100 dark:bg-purple-900/30 rounded-full mb-4">
              <Crown className="w-4 h-4 text-purple-600" />
              <span className="text-sm font-medium text-purple-600">价格方案</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                选择适合您的方案
              </span>
            </h2>
            <p className="text-xl text-slate-600 dark:text-slate-400">
              从免费体验到企业定制，总有一款适合您
            </p>
          </div>

          {/* 传统方式 vs 小宋工作台对比 */}
          <div className="max-w-5xl mx-auto mb-16 overflow-x-auto">
            <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-200 dark:border-slate-700 overflow-hidden shadow-xl">
              <div className="grid grid-cols-4 gap-px bg-slate-200 dark:bg-slate-700">
                <div className="bg-slate-100 dark:bg-slate-900 p-4 font-bold text-center">对比项</div>
                <div className="bg-slate-100 dark:bg-slate-900 p-4 font-bold text-center">传统方式</div>
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 font-bold text-center text-blue-600">小宋工作台</div>
                <div className="bg-green-50 dark:bg-green-900/20 p-4 font-bold text-center text-green-600">提升幅度</div>
              </div>
              <div className="grid grid-cols-4 gap-px bg-slate-200 dark:bg-slate-700">
                <div className="bg-white dark:bg-slate-800 p-4">脚本创作时间</div>
                <div className="bg-white dark:bg-slate-800 p-4 text-center text-slate-600 dark:text-slate-400">2-4小时</div>
                <div className="bg-white dark:bg-slate-800 p-4 text-center font-semibold text-blue-600">10秒</div>
                <div className="bg-white dark:bg-slate-800 p-4 text-center font-bold text-green-600">↑99%</div>
              </div>
              <div className="grid grid-cols-4 gap-px bg-slate-200 dark:bg-slate-700">
                <div className="bg-white dark:bg-slate-800 p-4">学习门槛</div>
                <div className="bg-white dark:bg-slate-800 p-4 text-center text-slate-600 dark:text-slate-400">3-6个月</div>
                <div className="bg-white dark:bg-slate-800 p-4 text-center font-semibold text-blue-600">即用即会</div>
                <div className="bg-white dark:bg-slate-800 p-4 text-center font-bold text-green-600">零门槛</div>
              </div>
              <div className="grid grid-cols-4 gap-px bg-slate-200 dark:bg-slate-700">
                <div className="bg-white dark:bg-slate-800 p-4">月度成本</div>
                <div className="bg-white dark:bg-slate-800 p-4 text-center text-slate-600 dark:text-slate-400">¥8000+</div>
                <div className="bg-white dark:bg-slate-800 p-4 text-center font-semibold text-blue-600">¥30-199</div>
                <div className="bg-white dark:bg-slate-800 p-4 text-center font-bold text-green-600">省95%</div>
              </div>
              <div className="grid grid-cols-4 gap-px bg-slate-200 dark:bg-slate-700">
                <div className="bg-white dark:bg-slate-800 p-4">爆款命中率</div>
                <div className="bg-white dark:bg-slate-800 p-4 text-center text-slate-600 dark:text-slate-400">10-15%</div>
                <div className="bg-white dark:bg-slate-800 p-4 text-center font-semibold text-blue-600">30-40%</div>
                <div className="bg-white dark:bg-slate-800 p-4 text-center font-bold text-green-600">↑3倍</div>
              </div>
            </div>
          </div>

          {/* 4个定价方案 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
            {pricingPlans.map((plan, idx) => (
              <div key={idx} className={`relative ${plan.highlight ? 'md:scale-105' : ''}`}>
                {plan.highlight && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm font-semibold rounded-full shadow-lg">
                    最受欢迎
                  </div>
                )}
                <div className={`bg-white dark:bg-slate-800 rounded-2xl p-6 border-2 ${plan.highlight ? 'border-purple-500 shadow-2xl' : 'border-slate-200 dark:border-slate-700'} hover:shadow-xl transition-all h-full flex flex-col`}>
                  <div className="text-center mb-6">
                    <h3 className="text-2xl font-bold mb-2 text-slate-900 dark:text-white">{plan.name}</h3>
                    <div className="mb-2">
                      <span className="text-4xl font-extrabold text-blue-600">¥{plan.price}</span>
                      <span className="text-slate-600 dark:text-slate-400">/{plan.period}</span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{plan.desc}</p>
                  </div>
                  
                  <ul className="space-y-3 mb-6 flex-1">
                    {plan.features.map((feature, fidx) => (
                      <li key={fidx} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                        <Check className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Link
                    href="/dashboard"
                    className={`w-full py-3 rounded-xl font-semibold text-center transition-all ${
                      plan.highlight
                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:scale-105 shadow-lg'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-600'
                    }`}
                  >
                    {plan.cta}
                  </Link>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-12 text-sm text-slate-600 dark:text-slate-400">
            <p>所有方案均支持7天无理由退款 · 随时取消订阅 · 数据完全保密</p>
          </div>
        </div>
      </section>

      {/* FAQ常见问题 */}
      <section id="faq" className="py-20 px-4 bg-white dark:bg-slate-900">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 dark:bg-green-900/30 rounded-full mb-4">
              <MessageCircle className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-green-600">常见问题</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              <span className="bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
                您可能关心的问题
              </span>
            </h2>
            <p className="text-xl text-slate-600 dark:text-slate-400">
              解答您的疑惑，让您放心使用
            </p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, idx) => (
              <div key={idx} className="bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-100 dark:hover:bg-slate-750 transition-colors"
                >
                  <span className="font-semibold text-slate-900 dark:text-white pr-4">{faq.q}</span>
                  <ChevronDown className={`w-5 h-5 text-slate-600 dark:text-slate-400 transition-transform ${openFaq === idx ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === idx && (
                  <div className="px-6 pb-4 text-slate-600 dark:text-slate-400 leading-relaxed">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              还有其他问题？
            </p>
            <a 
              href="mailto:support@xiaosong.ai" 
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors font-medium"
            >
              <MessageCircle className="w-5 h-5" />
              联系客服咨询
            </a>
          </div>
        </div>
      </section>

      {/* 最终CTA */}
      <section className="py-20 px-4 bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-64 h-64 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-80 h-80 bg-white rounded-full blur-3xl" />
        </div>
        
        <div className="container mx-auto text-center relative z-10">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            准备好开始创作了吗？
          </h2>
          <p className="text-xl mb-8 opacity-90 max-w-2xl mx-auto">
            加入1280+创作者，让AI帮您创作出更专业、更高效的短视频内容
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link 
              href="/dashboard" 
              className="group px-10 py-5 bg-white text-blue-600 rounded-xl font-bold text-lg hover:scale-105 transition-transform shadow-2xl flex items-center gap-2"
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
      <footer className="bg-slate-900 text-slate-400 py-12 px-4">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-6 h-6 text-blue-500" />
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
                <li><a href="mailto:support@xiaosong.ai" className="hover:text-white transition-colors">联系客服</a></li>
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
          
          <div className="border-t border-slate-800 pt-8 text-center text-sm">
            <p>&copy; 2024 小宋编导工作台. All rights reserved. Powered by Claude AI</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
