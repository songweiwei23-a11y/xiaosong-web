/**
 * 悬浮助手组件
 * 让助理"无处不在"，提升存在感
 */

'use client';

import { useState, useEffect } from 'react';
import { Bot, X, Minimize2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface FloatingAssistantProps {
  /**
   * 是否在当前页面显示新手提示
   * 某些关键页面会主动提示用户
   */
  showTip?: boolean;
  
  /**
   * 自定义提示文本
   */
  tipText?: string;
}

export function FloatingAssistant({ 
  showTip = false,
  tipText 
}: FloatingAssistantProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [hasUsedBefore, setHasUsedBefore] = useState(true);

  useEffect(() => {
    // 检查用户是否用过助理
    const used = localStorage.getItem('kaiwu:assistant-used');
    setHasUsedBefore(!!used);
  }, []);

  const handleOpen = () => {
    // 标记为已使用
    localStorage.setItem('kaiwu:assistant-used', 'true');
    setHasUsedBefore(true);
    
    // 跳转到助理页面
    router.push('/dashboard/free-chat');
  };

  const handleDismissTip = () => {
    setDismissed(true);
    localStorage.setItem('kaiwu:assistant-tip-dismissed', 'true');
  };

  // 如果用户已经关闭过提示，不再显示
  useEffect(() => {
    const dismissed = localStorage.getItem('kaiwu:assistant-tip-dismissed');
    if (dismissed) {
      setDismissed(true);
    }
  }, []);

  const shouldShowTip = (showTip || !hasUsedBefore) && !dismissed;

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* 提示气泡 */}
      {shouldShowTip && (
        <div className="absolute bottom-full mb-3 right-0 animate-fade-in">
          <div className="relative bg-white dark:bg-gray-800 shadow-xl rounded-lg p-4 w-72 border border-border">
            <button
              onClick={handleDismissTip}
              className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
              aria-label="关闭提示"
            >
              <X className="w-4 h-4" />
            </button>
            
            <div className="pr-6">
              <p className="text-sm font-medium mb-2">
                💡 {tipText || '需要帮助吗？'}
              </p>
              <p className="text-xs text-muted-foreground mb-3">
                {!hasUsedBefore ? (
                  '我是开物助理，试试对我说："帮我写3个带货脚本"'
                ) : (
                  '点我可以随时聊聊创作想法、解答疑问'
                )}
              </p>
              <button
                onClick={handleOpen}
                className="text-xs text-primary hover:underline font-medium"
              >
                点击开始 →
              </button>
            </div>

            {/* 箭头指示 */}
            <div className="absolute -bottom-2 right-8 w-4 h-4 bg-white dark:bg-gray-800 border-r border-b border-border transform rotate-45" />
          </div>
        </div>
      )}

      {/* 助手按钮 */}
      <button
        onClick={handleOpen}
        className="w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all hover:scale-110 flex items-center justify-center group relative"
        aria-label="打开开物助理"
      >
        <Bot className="w-7 h-7" />
        
        {/* 新用户标识 */}
        {!hasUsedBefore && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
        )}

        {/* Hover 提示 */}
        <span className="absolute bottom-full mb-2 px-3 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
          开物助理
        </span>
      </button>
    </div>
  );
}

/**
 * 智能提示包装器
 * 根据页面和用户状态自动显示合适的提示
 */
export function FloatingAssistantSmart() {
  const [tipConfig, setTipConfig] = useState<{ show: boolean; text?: string }>({ 
    show: false 
  });

  useEffect(() => {
    // 根据当前页面路径决定提示内容
    const path = window.location.pathname;
    
    if (path.includes('/topic')) {
      setTipConfig({ 
        show: true, 
        text: '不知道写什么选题？问问我吧' 
      });
    } else if (path.includes('/script')) {
      setTipConfig({ 
        show: true, 
        text: '想要更好的脚本？我可以帮你' 
      });
    } else if (path.includes('/dashboard') && path === '/dashboard') {
      setTipConfig({ 
        show: true, 
        text: '有什么可以帮你的吗？' 
      });
    }
  }, []);

  return (
    <FloatingAssistant 
      showTip={tipConfig.show}
      tipText={tipConfig.text}
    />
  );
}
