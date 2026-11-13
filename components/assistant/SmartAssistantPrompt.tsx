/**
 * 主动提示系统
 * 在用户需要帮助时，智能弹出助理提示
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bot, X, Sparkles } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';

interface SmartPromptConfig {
  // 页面路径匹配
  path: string;
  // 触发条件
  trigger: {
    // 停留时间（毫秒）
    idleTime?: number;
    // 特定操作（可选）
    action?: string;
  };
  // 提示内容
  message: {
    title: string;
    description: string;
    suggestions: string[];
  };
}

// 预定义的智能提示配置
const PROMPT_CONFIGS: SmartPromptConfig[] = [
  {
    path: '/dashboard/topic',
    trigger: { idleTime: 120000 }, // 2分钟
    message: {
      title: '💡 不知道写什么选题？',
      description: '我可以帮你：',
      suggestions: [
        '根据你的定位生成10个选题',
        '分析当前热点趋势',
        '参考同行爆款案例',
      ],
    },
  },
  {
    path: '/dashboard/script',
    trigger: { idleTime: 120000 },
    message: {
      title: '✨ 想要更好的脚本？',
      description: '试试让我：',
      suggestions: [
        '优化现有脚本的钩子',
        '增加互动和转化元素',
        '调整节奏和结构',
      ],
    },
  },
  {
    path: '/dashboard',
    trigger: { idleTime: 180000 }, // 3分钟
    message: {
      title: '👋 需要帮助吗？',
      description: '我可以帮你：',
      suggestions: [
        '快速生成选题和脚本',
        '分析账号数据和方向',
        '解答创作疑问',
      ],
    },
  },
];

export function SmartAssistantPrompt() {
  const router = useRouter();
  const pathname = usePathname();
  const [isVisible, setIsVisible] = useState(false);
  const [config, setConfig] = useState<SmartPromptConfig | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // 检查当前页面是否有配置的提示
    const matchedConfig = PROMPT_CONFIGS.find(c => pathname?.includes(c.path));
    if (!matchedConfig) return;

    // 检查是否已经关闭过（本次会话）
    const sessionKey = `kaiwu:prompt-dismissed:${matchedConfig.path}`;
    if (sessionStorage.getItem(sessionKey)) {
      return;
    }

    // 检查用户是否最近用过助理
    const lastUsed = localStorage.getItem('kaiwu:assistant-last-used');
    if (lastUsed) {
      const lastUsedTime = parseInt(lastUsed, 10);
      const now = Date.now();
      // 如果5分钟内用过助理，不显示提示
      if (now - lastUsedTime < 5 * 60 * 1000) {
        return;
      }
    }

    setConfig(matchedConfig);

    // 设置定时器
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, matchedConfig.trigger.idleTime || 120000);

    return () => clearTimeout(timer);
  }, [pathname]);

  const handleClose = useCallback(() => {
    setIsVisible(false);
    setDismissed(true);
    if (config) {
      sessionStorage.setItem(`kaiwu:prompt-dismissed:${config.path}`, 'true');
    }
  }, [config]);

  const handleOpenAssistant = useCallback(() => {
    localStorage.setItem('kaiwu:assistant-last-used', Date.now().toString());
    handleClose();
    router.push('/dashboard/free-chat');
  }, [router, handleClose]);

  if (!isVisible || !config || dismissed) return null;

  return (
    <div className="fixed bottom-24 right-6 z-40 animate-slide-up">
      <div className="bg-white dark:bg-gray-800 shadow-2xl rounded-xl p-5 w-80 border border-border relative">
        {/* 关闭按钮 */}
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
          aria-label="关闭"
        >
          <X className="w-4 h-4" />
        </button>

        {/* 头部 */}
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Bot className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 pt-1">
            <h3 className="font-semibold text-sm mb-1">
              {config.message.title}
            </h3>
            <p className="text-xs text-muted-foreground">
              {config.message.description}
            </p>
          </div>
        </div>

        {/* 建议列表 */}
        <div className="space-y-2 mb-4">
          {config.message.suggestions.map((suggestion, i) => (
            <div
              key={i}
              className="flex items-start gap-2 text-xs text-muted-foreground"
            >
              <Sparkles className="w-3 h-3 flex-shrink-0 mt-0.5 text-primary" />
              <span>{suggestion}</span>
            </div>
          ))}
        </div>

        {/* 操作按钮 */}
        <button
          onClick={handleOpenAssistant}
          className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
        >
          点这里和我聊聊
        </button>
      </div>
    </div>
  );
}
