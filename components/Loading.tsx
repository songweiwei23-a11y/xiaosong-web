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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center">
      <div className="text-center">
        {/* 双层旋转圆圈 */}
        <div className={`relative ${sizeClasses[size]} mx-auto mb-8`}>
          <div className="absolute inset-0 rounded-full border-4 border-blue-200 dark:border-slate-700"></div>
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-600 dark:border-t-blue-400 animate-spin"></div>
          <div 
            className="absolute inset-2 rounded-full border-4 border-transparent border-t-purple-600 dark:border-t-purple-400 animate-spin" 
            style={{ animationDuration: '1.5s', animationDirection: 'reverse' }}
          ></div>
        </div>

        {/* 加载文字 */}
        <h2 className={`${textSizes[size]} font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2`}>
          小宋编导工作台
        </h2>
        <p className="text-slate-600 dark:text-slate-400 animate-pulse">
          {message}
        </p>

        {/* 加载进度点 */}
        <div className="flex items-center justify-center gap-2 mt-6">
          <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-2 h-2 rounded-full bg-purple-600 animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-2 h-2 rounded-full bg-pink-600 animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
      </div>
    </div>
  );
}

// 导出快捷使用的变体
export const PageLoading = () => <Loading message="正在加载页面..." size="medium" />;
export const DataLoading = () => <Loading message="正在加载数据..." size="small" />;
export const ContentLoading = () => <Loading message="正在生成内容..." size="medium" />;
