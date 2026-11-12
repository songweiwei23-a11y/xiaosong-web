/**
 * 骨架屏组件库
 * 创建日期: 2026-11-12
 * 用途: 为各种内容提供加载占位符
 */

import React from 'react';

interface SkeletonProps {
  className?: string;
}

/**
 * 基础骨架屏元素
 */
export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-muted rounded ${className}`}
      aria-live="polite"
      aria-busy="true"
    />
  );
}

/**
 * 列表骨架屏
 */
interface ListSkeletonProps {
  count?: number;
  className?: string;
}

export function ListSkeleton({ count = 3, className = '' }: ListSkeletonProps) {
  return (
    <div className={`space-y-3 ${className}`} role="status" aria-label="正在加载列表">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="glass-panel rounded-xl p-4 space-y-2">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ))}
      <span className="sr-only">加载中...</span>
    </div>
  );
}

/**
 * 卡片骨架屏
 */
export function CardSkeleton({ className = '' }: SkeletonProps) {
  return (
    <div className={`glass-panel rounded-xl p-6 space-y-4 ${className}`} role="status">
      <Skeleton className="h-6 w-1/3" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-20" />
      </div>
      <span className="sr-only">加载中...</span>
    </div>
  );
}

/**
 * 表单骨架屏
 */
export function FormSkeleton({ className = '' }: SkeletonProps) {
  return (
    <div className={`space-y-6 ${className}`} role="status">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
      <div className="flex gap-3">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-24" />
      </div>
      <span className="sr-only">正在加载表单...</span>
    </div>
  );
}

/**
 * 表格骨架屏
 */
interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export function TableSkeleton({ rows = 5, columns = 4, className = '' }: TableSkeletonProps) {
  return (
    <div className={`space-y-3 ${className}`} role="status">
      {/* 表头 */}
      <div className="flex gap-4 p-4 border-b">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {/* 表格行 */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 p-4">
          {Array.from({ length: columns }).map((_, j) => (
            <Skeleton key={j} className="h-4 flex-1" />
          ))}
        </div>
      ))}
      <span className="sr-only">正在加载表格数据...</span>
    </div>
  );
}

/**
 * 文本内容骨架屏
 */
interface TextSkeletonProps {
  lines?: number;
  className?: string;
}

export function TextSkeleton({ lines = 3, className = '' }: TextSkeletonProps) {
  return (
    <div className={`space-y-2 ${className}`} role="status">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={`h-4 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`}
        />
      ))}
      <span className="sr-only">正在加载内容...</span>
    </div>
  );
}

/**
 * 头像骨架屏
 */
interface AvatarSkeletonProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function AvatarSkeleton({ size = 'md', className = '' }: AvatarSkeletonProps) {
  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-12 w-12',
    lg: 'h-16 w-16',
  };

  return (
    <Skeleton className={`${sizeClasses[size]} rounded-full ${className}`} />
  );
}

/**
 * 图片骨架屏
 */
interface ImageSkeletonProps {
  aspectRatio?: '1:1' | '16:9' | '4:3' | '3:4';
  className?: string;
}

export function ImageSkeleton({ aspectRatio = '16:9', className = '' }: ImageSkeletonProps) {
  const aspectClasses = {
    '1:1': 'aspect-square',
    '16:9': 'aspect-video',
    '4:3': 'aspect-[4/3]',
    '3:4': 'aspect-[3/4]',
  };

  return (
    <Skeleton className={`w-full ${aspectClasses[aspectRatio]} ${className}`} />
  );
}
