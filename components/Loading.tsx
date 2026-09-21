// 全局加载动画组件
import React from 'react';

interface LoadingProps {
  message?: string;
  size?: 'small' | 'medium' | 'large';
}

export default function Loading({ message = "正在加载...", size = 'medium' }: LoadingProps) {
  const sizeClasses = {
    small: 'w-12 h-12',
    medium: 'w-24 h-24',
    large: 'w-32 h-32'
  };

  const textSizes = {
    small: 'text-lg',
    medium: 'text-2xl',
    large: 'text-3xl'
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        {/* 双层旋转圆圈 */}
        <div className={`relative ${sizeClasses[size]} mx-auto mb-8`}>
          <div className="absolute inset-0 rounded-full border-4 border-primary/20 dark:border-border"></div>
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-600 dark:border-t-blue-400 animate-spin"></div>
          <div 
            className="absolute inset-2 rounded-full border-4 border-transparent border-t-purple-600 dark:border-t-purple-400 animate-spin" 
            style={{ animationDuration: '1.5s', animationDirection: 'reverse' }}
          ></div>
        </div>

        {/* 加载文字 */}
        <h2 className={`${textSizes[size]} font-bold brand-gradient bg-clip-text text-transparent mb-2`}>
          小宋编导工作台
        </h2>
        <p className="text-muted-foreground animate-pulse">
          {message}
        </p>

        {/* 加载进度点 */}
        <div className="flex items-center justify-center gap-2 mt-6">
          <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-2 h-2 rounded-full bg-accent animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-2 h-2 rounded-full bg-accent animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
      </div>
    </div>
  );
}

// 导出快捷使用的变体
export const PageLoading = () => <Loading message="正在加载页面..." size="medium" />;
export const DataLoading = () => <Loading message="正在加载数据..." size="small" />;
export const ContentLoading = () => <Loading message="正在生成内容..." size="medium" />;
