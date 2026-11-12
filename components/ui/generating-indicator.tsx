/**
 * AI 生成任务指示器组件
 * 创建日期: 2026-11-12
 * 用途: 为 AI 生成任务提供时间预期和进度提示
 */

'use client';

import { useEffect, useState } from 'react';
import { LoadingRings } from '@/components/ui/loading';

interface GeneratingIndicatorProps {
  /**
   * 任务名称
   * @default 'AI 生成'
   */
  taskName?: string;
  
  /**
   * 预计耗时（秒）
   * @default 90
   */
  estimatedSeconds?: number;
  
  /**
   * 取消回调
   */
  onCancel?: () => void;
  
  /**
   * 自定义提示文本
   */
  customMessage?: string;
}

/**
 * AI 生成任务指示器
 * 
 * @example
 * ```tsx
 * {isGenerating && (
 *   <GeneratingIndicator 
 *     taskName="AI 正在生成脚本"
 *     estimatedSeconds={120}
 *     onCancel={handleCancel}
 *   />
 * )}
 * ```
 */
export function GeneratingIndicator({ 
  taskName = 'AI 生成',
  estimatedSeconds = 90,
  onCancel,
  customMessage
}: GeneratingIndicatorProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(s => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const minutes = Math.ceil(estimatedSeconds / 60);
  const showWarning = elapsed > 30;
  const showSlowWarning = elapsed > estimatedSeconds * 1.5;

  return (
    <div 
      className="flex flex-col items-center justify-center p-8"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <LoadingRings size={64} />
      
      <p className="mt-4 text-base font-medium text-foreground">
        {taskName}中...
      </p>
      
      {customMessage ? (
        <p className="mt-1 text-sm text-muted-foreground">
          {customMessage}
        </p>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">
          预计需要 {minutes} 分钟
        </p>
      )}
      
      {showWarning && (
        <p className="mt-2 text-sm text-amber-600 animate-fade-in">
          已等待 {elapsed} 秒，马上就好
        </p>
      )}
      
      {showSlowWarning && (
        <p className="mt-2 text-sm text-red-600 animate-fade-in">
          生成时间较长，可能网络或服务繁忙
        </p>
      )}
      
      {onCancel && elapsed > 10 && (
        <button 
          onClick={onCancel}
          className="mt-4 px-4 py-2 text-sm text-muted-foreground hover:text-foreground border border-border rounded hover:bg-muted transition-colors"
          aria-label="取消生成"
        >
          取消生成
        </button>
      )}
      
      <span className="sr-only">
        {taskName}中，已等待 {elapsed} 秒
      </span>
    </div>
  );
}

/**
 * 格式化时长显示
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} 秒`;
  }
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins} 分 ${secs} 秒` : `${mins} 分钟`;
}
