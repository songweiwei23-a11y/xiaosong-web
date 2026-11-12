/**
 * 页面加载状态组件
 * 创建日期: 2026-11-12
 * 用途: 为所有页面提供统一的加载状态提示
 */

import React from 'react';
import LoadingRings from '@/components/ui/loading';

interface PageLoadingProps {
  /**
   * 自定义加载提示文本
   * @default '正在加载数据...'
   */
  message?: string;
  
  /**
   * 最小高度（CSS值）
   * @default '400px'
   */
  minHeight?: string;
}

/**
 * 页面加载状态组件
 * 
 * @example
 * ```tsx
 * if (loading) {
 *   return <PageLoading />;
 * }
 * ```
 * 
 * @example
 * ```tsx
 * if (loading) {
 *   return <PageLoading message="正在加载档案信息..." minHeight="600px" />;
 * }
 * ```
 */
export function PageLoading({ 
  message = '正在加载数据...',
  minHeight = '400px'
}: PageLoadingProps) {
  return (
    <div 
      className="flex flex-col items-center justify-center p-12"
      style={{ minHeight }}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <LoadingRings size={48} />
      <p className="mt-3 text-sm text-muted-foreground">
        {message}
      </p>
      <span className="sr-only">加载中，请稍候</span>
    </div>
  );
}
