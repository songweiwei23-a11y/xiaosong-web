'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { CheckCircle2, Sparkles, FileText, MessageSquare, Target, Zap } from 'lucide-react'

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(true)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    checkUser()
  }, [])

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
    } else {
      setLoading(false)
    }
  }

  const steps = [
    {
      title: '欢迎来到小宋编导工作台',
      description: '专为短视频创作者打造的 AI 创作助手',
      icon: Sparkles,
      content: (
        <div className="space-y-6">
          <p className="text-lg text-muted-foreground text-center">我们将帮助你快速生成专业的短视频内容</p>
          <div className="grid gap-4">
            <div className="p-4 rounded-xl bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-accent/30 hover:border-accent/50 transition-all">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full brand-gradient flex items-center justify-center flex-shrink-0">
                  <Target className="w-5 h-5 text-white" />
                </div>
                <div><h3 className="font-semibold text-white mb-1">账号定位</h3><p className="text-sm text-muted-foreground">明确你的账号方向和目标受众</p></div>
              </div>
            </div>
            <div className="p-4 rounded-xl bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-accent/30 hover:border-accent/50 transition-all">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <div><h3 className="font-semibold text-white mb-1">选题策划</h3><p className="text-sm text-muted-foreground">为你提供热门选题灵感</p></div>
              </div>
            </div>
            <div className="p-4 rounded-xl bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-accent/30 hover:border-accent/50 transition-all">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full brand-gradient flex items-center justify-center flex-shrink-0">
                  <MessageSquare className="w-5 h-5 text-white" />
                </div>
                <div><h3 className="font-semibold text-white mb-1">脚本生成</h3><p className="text-sm text-muted-foreground">AI 帮你写出爆款脚本</p></div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      title: '你的免费额度',
      description: '新用户专享，立即开始创作',
      icon: Zap,
      content: (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-gradient-to-br from-purple-900/50 to-blue-900/50 border border-accent/50 shadow-[0_0_30px_rgba(168,85,247,0.3)]">
            <div className="flex items-center gap-2 mb-6">
              <span className="px-3 py-1 rounded-full bg-accent/20 text-accent text-sm font-medium border border-accent/30">免费版</span>
              <span className="text-sm text-muted-foreground">已为你开通</span>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-border/50"><span className="text-foreground">账号定位</span><span className="px-3 py-1 rounded-full bg-primary/20 text-primary text-sm font-medium border border-primary/30">1 次（永久）</span></div>
              <div className="flex justify-between items-center pb-3 border-b border-border/50"><span className="text-foreground">选题策划</span><span className="px-3 py-1 rounded-full bg-emerald-500/20 text-green-300 text-sm font-medium border border-green-500/30">3 次/月</span></div>
              <div className="flex justify-between items-center pb-3 border-b border-border/50"><span className="text-foreground">脚本生成</span><span className="px-3 py-1 rounded-full bg-accent/20 text-accent text-sm font-medium border border-accent/30">20 次/月</span></div>
              <div className="flex justify-between items-center pb-3 border-b border-border/50"><span className="text-foreground">自由对话</span><span className="px-3 py-1 rounded-full bg-amber-500/20 text-orange-300 text-sm font-medium border border-orange-500/30">20 次/月</span></div>
              <div className="flex justify-between items-center"><span className="text-foreground">知识库</span><span className="px-3 py-1 rounded-full bg-accent/20 text-accent text-sm font-medium border border-accent/30">无限使用</span></div>
            </div>
          </div>
        </div>
      )
    },
    {
      title: '准备好了吗？',
      description: '让我们开始你的第一次创作',
      icon: Sparkles,
      content: (
        <div className="space-y-8 text-center">
          <div className="text-7xl mb-4">🎬</div>
          <p className="text-lg text-foreground">点击下方按钮，开始生成你的第一个爆款脚本</p>
          <div className="grid gap-4 max-w-md mx-auto pt-4">
            <button onClick={() => router.push('/dashboard/script')} className="w-full px-6 py-4 brand-gradient hover:from-purple-500 hover:to-blue-500 text-white rounded-xl font-medium transition-all shadow-[0_0_20px_rgba(168,85,247,0.5)]"><span className="flex items-center justify-center gap-2"><Sparkles className="w-5 h-5" />开始创作脚本</span></button>
            <button onClick={() => router.push('/dashboard/topic')} className="w-full px-6 py-4 bg-muted/50 hover:bg-muted/50 text-foreground rounded-xl font-medium transition-all border border-border/50"><span className="flex items-center justify-center gap-2"><FileText className="w-5 h-5" />先看看选题灵感</span></button>
          </div>
        </div>
      )
    }
  ]

  const currentStep = steps[step]
  const Icon = currentStep.icon

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0e27] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent/50 mx-auto"></div>
          <p className="mt-4 text-muted-foreground">加载中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0e27] flex items-center justify-center p-4">
      <div className="max-w-2xl w-full p-8 rounded-2xl bg-gradient-to-br from-gray-900/80 to-gray-800/80 border border-accent/30 shadow-[0_0_50px_rgba(168,85,247,0.2)]">
        <div className="flex justify-center mb-10">
          {steps.map((_, index) => (
            <div key={index} className="flex items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all ${index <= step ? 'brand-gradient text-white shadow-[0_0_15px_rgba(168,85,247,0.5)]' : 'bg-muted/50 text-muted-foreground'}`}>
                {index < step ? <CheckCircle2 className="w-5 h-5" /> : index + 1}
              </div>
              {index < steps.length - 1 && <div className={`w-12 sm:w-16 h-1 rounded-full transition-all ${index < step ? 'brand-gradient' : 'bg-muted/50'}`} />}
            </div>
          ))}
        </div>
        <div className="text-center mb-10">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full brand-gradient flex items-center justify-center shadow-[0_0_30px_rgba(168,85,247,0.4)]">
            <Icon className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold mb-3 brand-gradient bg-clip-text text-transparent">{currentStep.title}</h1>
          <p className="text-muted-foreground text-lg">{currentStep.description}</p>
        </div>
        <div className="mb-10">{currentStep.content}</div>
        <div className="flex justify-between items-center">
          <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0} className="px-6 py-2 rounded-lg bg-muted/50 text-muted-foreground hover:bg-muted/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all border border-border/50">上一步</button>
          {step < steps.length - 1 ? (
            <button onClick={() => setStep(step + 1)} className="px-8 py-2 rounded-lg brand-gradient hover:from-purple-500 hover:to-blue-500 text-white font-medium transition-all shadow-[0_0_15px_rgba(168,85,247,0.4)]">下一步</button>
          ) : (
            <button onClick={() => router.push('/dashboard')} className="px-8 py-2 rounded-lg brand-gradient hover:from-purple-500 hover:to-blue-500 text-white font-medium transition-all shadow-[0_0_15px_rgba(168,85,247,0.4)]">进入工作台</button>
          )}
        </div>
        <div className="text-center mt-8">
          <button onClick={() => router.push('/dashboard')} className="text-sm text-muted-foreground hover:text-muted-foreground transition-colors">跳过引导</button>
        </div>
      </div>
    </div>
  )
}
