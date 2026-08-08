import { notify } from '@/components/ui/feedback';
﻿/**
 * 统一错误处理工具
 */

export class AppError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number
  ) {
    super(message)
    this.name = 'AppError'
  }
}

/**
 * 处理 API 错误
 */
export function handleApiError(error: any): string {
  console.error('API Error:', error)

  // 网络错误
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return '网络连接失败，请检查网络后重试'
  }

  // 自定义错误
  if (error instanceof AppError) {
    return error.message
  }

  // HTTP 错误
  if (error.statusCode) {
    switch (error.statusCode) {
      case 400:
        return '请求参数错误，请检查输入'
      case 401:
        return '未登录或登录已过期，请重新登录'
      case 403:
        return '没有权限执行此操作'
      case 404:
        return '请求的资源不存在'
      case 429:
        return '请求过于频繁，请稍后再试'
      case 500:
        return '服务器错误，请稍后重试'
      case 503:
        return '服务暂时不可用，请稍后重试'
      default:
        return `请求失败 (${error.statusCode})`
    }
  }

  // Supabase 错误
  if (error.code) {
    switch (error.code) {
      case 'PGRST116':
        return '数据不存在'
      case '23505':
        return '数据已存在'
      case '23503':
        return '关联数据不存在'
      case '42501':
        return '权限不足'
      default:
        return `数据库错误 (${error.code})`
    }
  }

  // 默认错误消息
  return error.message || '操作失败，请稍后重试'
}

/**
 * 异步操作包装器，统一处理错误
 */
export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  errorMessage?: string
): Promise<{ data: T | null; error: string | null }> {
  try {
    const data = await fn()
    return { data, error: null }
  } catch (error) {
    const message = errorMessage || handleApiError(error)
    return { data: null, error: message }
  }
}

/**
 * 显示用户友好的错误提示
 */
export function showError(error: any, defaultMessage = '操作失败') {
  const message = handleApiError(error) || defaultMessage
  
  // 在生产环境中，可以集成 toast 组件
  if (typeof window !== 'undefined') {
    notify(message)
  }
  
  return message
}

/**
 * 重试逻辑
 */
export async function retryOperation<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delay = 1000
): Promise<T> {
  let lastError: any

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      
      // 不重试的错误类型
      if (
        error instanceof AppError &&
        [400, 401, 403, 404].includes(error.statusCode || 0)
      ) {
        throw error
      }

      // 最后一次尝试失败
      if (i === maxRetries - 1) {
        throw error
      }

      // 等待后重试
      await new Promise(resolve => setTimeout(resolve, delay * (i + 1)))
    }
  }

  throw lastError
}
