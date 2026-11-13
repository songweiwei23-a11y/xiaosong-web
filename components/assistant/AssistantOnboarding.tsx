/**
 * 新用户首次登录引导
 * 帮助用户快速了解和使用助理
 */

'use client';

import { useState, useEffect } from 'react';
import { Bot, Sparkles, X, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function AssistantOnboarding() {
  const router = useRouter();
  const [isVisible, setIsVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    // 检查是否已经看过引导
    const hasSeenOnboarding = localStorage.getItem('kaiwu:assistant-onboarding-seen');
    const hasUsedAssistant = localStorage.getItem('kaiwu:assistant-used');
    
    // 新用户且没用过助理，显示引导
    if (!hasSeenOnboarding && !hasUsedAssistant) {
      // 延迟2秒显示，让用户先看到主界面
      setTimeout(() => {
        setIsVisible(true);
      }, 2000);
    }
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    localStorage.setItem('kaiwu:assistant-onboarding-seen', 'true');
  };

  const handleTryIt = () => {
    localStorage.setItem('kaiwu:assistant-onboarding-seen', 'true');
    localStorage.setItem('kaiwu:assistant-used', 'true');
    router.push('/dashboard/free-chat');
  };

  const examples = [
    { icon: '📝', text: '帮我写3个带货脚本' },
    { icon: '💡', text: '给我10个美妆类选题' },
    { icon: '✨', text: '帮我优化这个脚本' },
    { icon: '🎯', text: '分析一下我的账号定位' },
  ];

  if (!isVisible) return null;

  return (
    <>
      {/* 遮罩层 */}
      <div 
        className="fixed inset-0 bg-black/50 z-50 animate-fade-in"
        onClick={handleClose}
      />

      {/* 引导弹窗 */}
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md p-4 animate-scale-in">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 relative">
          {/* 关闭按钮 */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
            aria-label="关闭"
          >
            <X className="w-5 h-5" />
          </button>

          {/* 头部 */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <Bot className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold mb-2">
              👋 认识开物助理
            </h2>
            <p className="text-muted-foreground text-sm">
              你的24小时AI创作搭档
            </p>
          </div>

          {/* 功能介绍 */}
          <div className="mb-6 space-y-3">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <Sparkles className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm">快速生成内容</p>
                <p className="text-xs text-muted-foreground">选题、脚本、标题...一句话搞定</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <Sparkles className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm">解答创作疑问</p>
                <p className="text-xs text-muted-foreground">随时提问，实时回答</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <Sparkles className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm">记住你的习惯</p>
                <p className="text-xs text-muted-foreground">越用越懂你，越来越高效</p>
              </div>
            </div>
          </div>

          {/* 示例 */}
          <div className="mb-6">
            <p className="text-sm font-medium mb-3">试试这样说：</p>
            <div className="grid grid-cols-2 gap-2">
              {examples.map((example, i) => (
                <button
                  key={i}
                  onClick={handleTryIt}
                  className="text-left p-2 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors text-xs"
                >
                  <span className="mr-1">{example.icon}</span>
                  {example.text}
                </button>
              ))}
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              className="flex-1 px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors text-sm"
            >
              稍后再说
            </button>
            <button
              onClick={handleTryIt}
              className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium flex items-center justify-center gap-2"
            >
              立即体验
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
