/**
 * 主动建议系统
 * 根据用户状态，在合适的时机给出建议
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { getCurrentContext, getSmartSuggestions } from '@/lib/assistant/context';
import { getUserPreferences, getCreationInsights } from '@/lib/assistant/preferences';
import { useRouter } from 'next/navigation';
import { Bot, Sparkles, TrendingUp, X } from 'lucide-react';

interface ProactiveSuggestion {
  id: string;
  title: string;
  description: string;
  actions: {
    label: string;
    onClick: () => void;
  }[];
  priority: 'high' | 'medium' | 'low';
}

/**
 * 主动建议组件
 * 在合适的时机弹出建议
 */
export function ProactiveSuggestions() {
  const router = useRouter();
  const [suggestion, setSuggestion] = useState<ProactiveSuggestion | null>(null);
  const [dismissed, setDismissed] = useState<string[]>([]);

  const checkAndShowSuggestion = useCallback(() => {
    const context = getCurrentContext();
    const prefs = getUserPreferences();
    
    if (!context) return;
    
    const suggestions: ProactiveSuggestion[] = [];
    
    // 建议1：完成定位后，建议生成选题
    if (context.userState.hasPositioning && context.userState.topicCount === 0) {
      const suggestionId = 'after-positioning-suggest-topics';
      if (!dismissed.includes(suggestionId)) {
        suggestions.push({
          id: suggestionId,
          title: '🎉 定位完成了！',
          description: '现在有了明确的方向，要不要生成一些选题试试？',
          actions: [
            {
              label: '生成10个选题',
              onClick: () => {
                setDismissed([...dismissed, suggestionId]);
                router.push('/dashboard/topic');
              },
            },
            {
              label: '稍后再说',
              onClick: () => {
                setDismissed([...dismissed, suggestionId]);
                setSuggestion(null);
              },
            },
          ],
          priority: 'high',
        });
      }
    }
    
    // 建议2：有选题但没脚本，建议开始写
    if (context.userState.topicCount >= 5 && context.userState.scriptCount === 0) {
      const suggestionId = 'has-topics-suggest-script';
      if (!dismissed.includes(suggestionId)) {
        suggestions.push({
          id: suggestionId,
          title: '💡 选题不错！',
          description: `你已经有${context.userState.topicCount}个选题了，要不要挑几个开始写脚本？`,
          actions: [
            {
              label: '开始写脚本',
              onClick: () => {
                setDismissed([...dismissed, suggestionId]);
                router.push('/dashboard/script');
              },
            },
            {
              label: '再想想',
              onClick: () => {
                setDismissed([...dismissed, suggestionId]);
                setSuggestion(null);
              },
            },
          ],
          priority: 'high',
        });
      }
    }
    
    // 建议3：创作频率低，鼓励多创作
    if (prefs?.creationPattern && prefs.creationPattern.lastWeekScripts < 3) {
      const suggestionId = 'low-frequency-encourage';
      if (!dismissed.includes(suggestionId)) {
        suggestions.push({
          id: suggestionId,
          title: '📈 保持创作节奏',
          description: '这周创作有点少哦，要不要生成几个新内容保持手感？',
          actions: [
            {
              label: '去创作',
              onClick: () => {
                setDismissed([...dismissed, suggestionId]);
                router.push('/dashboard/script');
              },
            },
            {
              label: '知道了',
              onClick: () => {
                setDismissed([...dismissed, suggestionId]);
                setSuggestion(null);
              },
            },
          ],
          priority: 'medium',
        });
      }
    }
    
    // 建议4：接受率低，提供帮助
    if (prefs?.qualityPattern && prefs.qualityPattern.acceptanceRate < 50 && prefs.qualityPattern.acceptanceRate > 0) {
      const suggestionId = 'low-acceptance-help';
      if (!dismissed.includes(suggestionId)) {
        suggestions.push({
          id: suggestionId,
          title: '💬 需要帮助吗？',
          description: `我注意到你经常需要修改内容，要不要和我聊聊怎样才能更符合你的需求？`,
          actions: [
            {
              label: '和助理聊聊',
              onClick: () => {
                setDismissed([...dismissed, suggestionId]);
                router.push('/dashboard/free-chat');
              },
            },
            {
              label: '不用了',
              onClick: () => {
                setDismissed([...dismissed, suggestionId]);
                setSuggestion(null);
              },
            },
          ],
          priority: 'medium',
        });
      }
    }
    
    // 显示优先级最高的建议
    if (suggestions.length > 0) {
      const highPriority = suggestions.find(s => s.priority === 'high');
      setSuggestion(highPriority || suggestions[0]);
    }
  }, [dismissed, router]);

  useEffect(() => {
    // 延迟3秒后检查
    const timer = setTimeout(() => {
      checkAndShowSuggestion();
    }, 3000);
    
    return () => clearTimeout(timer);
  }, [checkAndShowSuggestion]);

  if (!suggestion) return null;

  return (
    <div className="fixed bottom-24 left-6 z-40 animate-slide-up max-w-sm">
      <div className="bg-white dark:bg-gray-800 shadow-2xl rounded-xl p-5 border border-border relative">
        {/* 关闭按钮 */}
        <button
          onClick={() => {
            setDismissed([...dismissed, suggestion.id]);
            setSuggestion(null);
          }}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
          aria-label="关闭"
        >
          <X className="w-4 h-4" />
        </button>

        {/* 头部 */}
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            {suggestion.priority === 'high' ? (
              <Sparkles className="w-5 h-5 text-primary" />
            ) : (
              <TrendingUp className="w-5 h-5 text-primary" />
            )}
          </div>
          <div className="flex-1 pt-1">
            <h3 className="font-semibold text-sm mb-1">
              {suggestion.title}
            </h3>
            <p className="text-xs text-muted-foreground">
              {suggestion.description}
            </p>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-2">
          {suggestion.actions.map((action, i) => (
            <button
              key={i}
              onClick={action.onClick}
              className={
                i === 0
                  ? 'flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium'
                  : 'flex-1 px-4 py-2 border border-border rounded-lg hover:bg-muted transition-colors text-sm'
              }
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Hook: 在页面中使用主动建议
 */
export function useProactiveSuggestions() {
  const context = getCurrentContext();
  const smartSuggestions = getSmartSuggestions();
  const insights = getCreationInsights();
  
  return {
    context,
    smartSuggestions,
    insights,
  };
}
