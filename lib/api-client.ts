/**
 * 统一 API 客户端
 * 创建日期: 2026-11-12
 * 用途: 提供统一的 API 调用、错误处理和用户通知
 */

import { notify } from '@/components/ui/feedback';

/**
 * API 错误类
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * API 调用选项
 */
export interface ApiCallOptions extends RequestInit {
  /**
   * 超时时间（毫秒）
   * @default 30000
   */
  timeout?: number;
  
  /**
   * 是否自动重试
   * @default false
   */
  retry?: boolean;
  
  /**
   * 重试次数
   * @default 2
   */
  retryCount?: number;
}

/**
 * 统一的 API 调用函数
 * 
 * @example
 * ```ts
 * const data = await apiCall<ScriptHistory>('/api/script-history');
 * ```
 */
export async function apiCall<T>(
  url: string,
  options: ApiCallOptions = {}
): Promise<T> {
  const {
    timeout = 30000,
    retry = false,
    retryCount = 2,
    ...fetchOptions
  } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers: {
        'Content-Type': 'application/json',
        ...fetchOptions.headers,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new ApiError(
        error.error || `请求失败 (${response.status})`,
        response.status,
        error.code,
        error
      );
    }

    return response.json();
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof ApiError) {
      throw error;
    }

    // 超时错误
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError('请求超时，请重试', 408);
    }

    // 网络错误
    if (error instanceof TypeError) {
      // 如果允许重试且还有次数
      if (retry && retryCount > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return apiCall<T>(url, { ...options, retryCount: retryCount - 1 });
      }
      throw new ApiError('网络连接失败，请检查网络后重试', 0);
    }

    throw new ApiError('未知错误，请重试', 500);
  }
}

/**
 * 带用户通知的 API 调用
 * 失败时自动显示错误通知
 * 
 * @example
 * ```ts
 * const data = await apiCallWithNotify('/api/profiles', {}, '加载档案失败');
 * if (data) {
 *   // 成功处理
 * }
 * ```
 */
export async function apiCallWithNotify<T>(
  url: string,
  options?: ApiCallOptions,
  errorMessage?: string
): Promise<T | null> {
  try {
    return await apiCall<T>(url, options);
  } catch (error) {
    if (error instanceof ApiError) {
      const message = errorMessage || error.message;
      notify(message, 'error');
      
      // 特殊错误码处理
      if (error.status === 401) {
        notify('登录已过期，请重新登录', 'warning');
        // 可以在这里触发跳转到登录页
      } else if (error.status === 402) {
        notify('额度不足，请充值后继续', 'warning');
      }
    } else {
      notify('操作失败，请重试', 'error');
    }
    
    console.error('[API Error]', url, error);
    return null;
  }
}

/**
 * 带成功通知的 API 调用
 * 成功时自动显示成功通知
 * 
 * @example
 * ```ts
 * await apiCallWithSuccess('/api/save', { method: 'POST', body: ... }, '保存成功');
 * ```
 */
export async function apiCallWithSuccess<T>(
  url: string,
  options: ApiCallOptions,
  successMessage: string,
  errorMessage?: string
): Promise<T | null> {
  const result = await apiCallWithNotify<T>(url, options, errorMessage);
  if (result !== null) {
    notify(successMessage, 'success');
  }
  return result;
}

/**
 * 批量 API 调用
 * 支持并发控制
 * 
 * @example
 * ```ts
 * const results = await batchApiCall(
 *   ['/api/item/1', '/api/item/2', '/api/item/3'],
 *   { concurrency: 2 }
 * );
 * ```
 */
export async function batchApiCall<T>(
  urls: string[],
  options: ApiCallOptions & { concurrency?: number } = {}
): Promise<Array<T | null>> {
  const { concurrency = 3, ...apiOptions } = options;
  const results: Array<T | null> = [];
  
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(url => apiCallWithNotify<T>(url, apiOptions))
    );
    results.push(...batchResults);
  }
  
  return results;
}
