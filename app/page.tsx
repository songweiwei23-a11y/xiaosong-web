import Link from "next/link";
import { 
  Sparkles, Zap, CheckCircle, TrendingUp, ArrowRight, 
  FileText, Lightbulb, Film, Users, Target, Star,
  Crown, Check, X, BarChart3, Award, Rocket
} from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Navigation */}
      <header className="fixed top-0 w-full border-b bg-white/80 backdrop-blur-md z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xl">
            <Sparkles className="w-6 h-6 text-blue-600" />
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              小宋编导工作台
            </span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <a href="#features" className="text-gray-600 hover:text-blue-600 transition-colors">核心功能</a>
            <a href="#pricing" className="text-gray-600 hover:text-blue-600 transition-colors">会员定价</a>
            <a href="#advantages" className="text-gray-600 hover:text-blue-600 transition-colors">平台优势</a>
            <Link href="/login" className="text-gray-600 hover:text-blue-600 transition-colors">
              登录
            </Link>
            <Link
              href="/dashboard"
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-5 py-2 rounded-full hover:shadow-lg transition-all"
            >
              免费试用
            </Link>
          </nav>
        </div>
      </header>

      <main className="pt-16">
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 py-20 md:py-32">
          <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
          <div className="container mx-auto px-4 relative">
            <div className="max-w-4xl mx-auto text-center space-y-8">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/80 backdrop-blur-sm border border-blue-200 px-4 py-2 text-sm font-medium text-blue-700 shadow-sm">
                <Sparkles className="h-4 w-4 animate-pulse" />
                AI + 专业知识库驱动，MCN团队级质量
              </div>
              
              <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
                <span className="block">3秒生成</span>
                <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                  爆款短视频脚本
                </span>
              </h1>
              
              <p className="text-xl md:text-2xl text-gray-600 max-w-2xl mx-auto">
                从选题策划到分镜设计，7大专业模块<br/>
                让每个创作者都能产出<span className="text-blue-600 font-semibold">MCN级脚本</span>
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                <Link
                  href="/dashboard"
                  className="group inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-4 rounded-xl text-lg font-semibold hover:shadow-2xl hover:scale-105 transition-all"
                >
                  <Rocket className="w-5 h-5 group-hover:animate-bounce" />
                  立即免费体验
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
                <a
                  href="#features"
                  className="inline-flex items-center justify-center gap-2 bg-white text-gray-700 border-2 border-gray-300 px-8 py-4 rounded-xl text-lg font-semibold hover:border-blue-600 hover:text-blue-600 transition-all"
                >
                  了解更多
                  <ArrowRight className="w-5 h-5" />
                </a>
              </div>

              <div className="flex items-center justify-center gap-8 pt-8 text-sm text-gray-500">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-600" />
                  <span>无需信用卡</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-600" />
                  <span>7天免费试用</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-600" />
                  <span>随时可取消</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="py-12 bg-white border-y">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              <div>
                <div className="text-4xl font-bold text-blue-600">50万+</div>
                <div className="text-sm text-gray-500 mt-1">脚本生成量</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-purple-600">20+</div>
                <div className="text-sm text-gray-500 mt-1">行业覆盖</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-pink-600">35/35分</div>
                <div className="text-sm text-gray-500 mt-1">专业评分</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-orange-600">98%</div>
                <div className="text-sm text-gray-500 mt-1">用户好评</div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-20 bg-gradient-to-b from-white to-gray-50">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold mb-4">
                7大核心功能模块
              </h2>
              <p className="text-xl text-gray-600">
                覆盖短视频创作全流程，从0到1专业输出
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {[
                {
                  icon: FileText,
                  title: "脚本生成",
                  desc: "内容类+广告类双引擎，支持20+脚本公式，3秒生成完整可拍脚本",
                  color: "blue",
                  features: ["开场钩子设计", "情绪波点设计", "成交理由植入"]
                },
                {
                  icon: Lightbulb,
                  title: "选题策划",
                  desc: "结合八大爆款元素，智能推荐热门选题+创作方向+拍摄思路",
                  color: "purple",
                  features: ["爆款元素分析", "AI推荐选题", "编导思路输出"]
                },
                {
                  icon: Film,
                  title: "分镜脚本",
                  desc: "自动生成景别组合、运镜方式、打光方案，一人一机可完成",
                  color: "pink",
                  features: ["景别设计", "运镜方案", "置景建议"]
                },
                {
                  icon: Target,
                  title: "账号定位",
                  desc: "精准人设IP定位，15天冷启动计划，差异化标签提炼",
                  color: "orange",
                  features: ["IP定位", "冷启动计划", "差异化分析"]
                },
                {
                  icon: CheckCircle,
                  title: "审稿优化",
                  desc: "专业编导视角审稿，给出具体优化建议和改进方向",
                  color: "green",
                  features: ["专业评分", "问题诊断", "优化方案"]
                },
                {
                  icon: Star,
                  title: "标题封面",
                  desc: "吸睛标题生成，封面设计建议，提升点击率和播放量",
                  color: "yellow",
                  features: ["爆款标题", "封面配色", "文案优化"]
                },
                {
                  icon: Users,
                  title: "成交理由库",
                  desc: "本地生活专属，15-17个成交理由智能分析，提升转化",
                  color: "red",
                  features: ["成交理由提炼", "卖点分析", "广告植入"]
                }
              ].map((feature, i) => (
                <div
                  key={i}
                  className="group relative bg-white rounded-2xl p-6 border-2 border-gray-100 hover:border-blue-300 hover:shadow-xl transition-all duration-300"
                >
                  <div className={`inline-flex p-3 rounded-xl bg-${feature.color}-100 text-${feature.color}-600 mb-4`}>
                    <feature.icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold mb-2 group-hover:text-blue-600 transition-colors">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 mb-4 text-sm leading-relaxed">
                    {feature.desc}
                  </p>
                  <ul className="space-y-2">
                    {feature.features.map((item, j) => (
                      <li key={j} className="flex items-center gap-2 text-sm text-gray-500">
                        <Check className="w-4 h-4 text-green-600" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Advantages Section */}
        <section id="advantages" className="py-20 bg-white">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold mb-4">
                为什么选择我们
              </h2>
              <p className="text-xl text-gray-600">
                不只是AI生成，而是专业编导级输出
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
              <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl p-8 border border-blue-200">
                <Award className="w-12 h-12 text-blue-600 mb-4" />
                <h3 className="text-2xl font-bold mb-3">专业知识库驱动</h3>
                <p className="text-gray-600 leading-relaxed">
                  基于4大专业知识库：脚本公式库、选题定位库、拍摄执行库、系统手册库。不是通用AI，而是深度训练的编导助手。
                </p>
              </div>

              <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-8 border border-purple-200">
                <TrendingUp className="w-12 h-12 text-purple-600 mb-4" />
                <h3 className="text-2xl font-bold mb-3">爆款元素体系</h3>
                <p className="text-gray-600 leading-relaxed">
                  八大爆款元素（成本/人群/头牌/奇葩/最差/反差/怀旧/荷尔蒙）+ 六大开场钩子类型，每条内容都有爆款基因。
                </p>
              </div>

              <div className="bg-gradient-to-br from-pink-50 to-orange-50 rounded-2xl p-8 border border-pink-200">
                <Zap className="w-12 h-12 text-pink-600 mb-4" />
                <h3 className="text-2xl font-bold mb-3">实时流式生成</h3>
                <p className="text-gray-600 leading-relaxed">
                  智能AI引擎，实时流式输出，所见即所得。支持一键复制、下载TXT，直接用于拍摄。
                </p>
              </div>

              <div className="bg-gradient-to-br from-orange-50 to-yellow-50 rounded-2xl p-8 border border-orange-200">
                <BarChart3 className="w-12 h-12 text-orange-600 mb-4" />
                <h3 className="text-2xl font-bold mb-3">双引擎支持</h3>
                <p className="text-gray-600 leading-relaxed">
                  内容创作类（教知识/晒过程/聊观点/讲故事）+ 广告引流类（留资/团购/引流/种草），覆盖所有短视频场景。
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="py-20 bg-gradient-to-b from-gray-50 to-white">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold mb-4">
                灵活的定价方案
              </h2>
              <p className="text-xl text-gray-600">
                从个人创作者到专业团队，总有适合你的选择
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {/* Free Plan */}
              <div className="bg-white rounded-2xl p-8 border-2 border-gray-200 hover:shadow-lg transition-all">
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold mb-2">免费版</h3>
                  <div className="text-4xl font-bold mb-2">¥0</div>
                  <div className="text-gray-500">永久免费</div>
                </div>
                <ul className="space-y-3 mb-8">
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">每日10次生成</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">基础脚本生成</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">选题策划功能</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <X className="w-5 h-5 text-gray-300 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-400">广告类脚本</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <X className="w-5 h-5 text-gray-300 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-400">成交理由分析</span>
                  </li>
                </ul>
                <Link
                  href="/dashboard"
                  className="block text-center bg-gray-100 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
                >
                  开始使用
                </Link>
              </div>

              {/* Pro Plan */}
              <div className="relative bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl p-8 text-white hover:shadow-2xl transition-all transform hover:scale-105">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-yellow-400 text-gray-900 px-4 py-1 rounded-full text-sm font-bold">
                  推荐
                </div>
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold mb-2">专业版</h3>
                  <div className="text-4xl font-bold mb-2">¥199</div>
                  <div className="text-blue-100">每月</div>
                </div>
                <ul className="space-y-3 mb-8">
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-yellow-300 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">无限次生成</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-yellow-300 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">全部7大核心功能</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-yellow-300 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">广告引流类脚本</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-yellow-300 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">成交理由智能分析</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-yellow-300 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">优先客服支持</span>
                  </li>
                </ul>
                <Link
                  href="/dashboard"
                  className="block text-center bg-white text-blue-600 py-3 rounded-xl font-semibold hover:bg-blue-50 transition-colors"
                >
                  开始7天试用
                </Link>
              </div>

              {/* Team Plan */}
              <div className="bg-white rounded-2xl p-8 border-2 border-gray-200 hover:shadow-lg transition-all">
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold mb-2">团队版</h3>
                  <div className="text-4xl font-bold mb-2">¥999</div>
                  <div className="text-gray-500">每月</div>
                </div>
                <ul className="space-y-3 mb-8">
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">专业版全部功能</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">5个团队账号</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">协作与分享</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">数据分析看板</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">专属客户经理</span>
                  </li>
                </ul>
                <Link
                  href="/dashboard"
                  className="block text-center bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-xl font-semibold hover:shadow-lg transition-all"
                >
                  联系我们
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              准备好开始了吗？
            </h2>
            <p className="text-xl mb-8 text-blue-100">
              加入数万创作者，用AI编导助手提升10倍创作效率
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center gap-2 bg-white text-blue-600 px-8 py-4 rounded-xl text-lg font-semibold hover:shadow-2xl hover:scale-105 transition-all"
              >
                <Rocket className="w-5 h-5" />
                立即免费开始
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-12 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 font-bold text-lg mb-4">
                <Sparkles className="w-5 h-5 text-blue-600" />
                <span>小宋编导工作台</span>
              </div>
              <p className="text-sm text-gray-600">
                AI驱动的专业短视频脚本创作工具
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">产品</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><a href="#features" className="hover:text-blue-600">功能特色</a></li>
                <li><a href="#pricing" className="hover:text-blue-600">定价方案</a></li>
                <li><Link href="/dashboard" className="hover:text-blue-600">立即使用</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">支持</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><a href="#" className="hover:text-blue-600">使用文档</a></li>
                <li><a href="#" className="hover:text-blue-600">常见问题</a></li>
                <li><a href="#" className="hover:text-blue-600">联系我们</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">关注我们</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><a href="#" className="hover:text-blue-600">抖音号</a></li>
                <li><a href="#" className="hover:text-blue-600">小红书</a></li>
                <li><a href="#" className="hover:text-blue-600">微信公众号</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t pt-8 text-center text-sm text-gray-500">
            <p>© 2026 小宋编导工作台. AI驱动的短视频脚本创作工具 | 让创作更简单</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

