/**
 * API 工具库 - 统一错误处理、验证和响应格式
 * 创建日期: 2026-11-12
 * 用途: 为所有 API 路由提供统一的工具函数
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';

/**
 * 统一错误响应
 * @param message 用户友好的错误消息
 * @param status HTTP 状态码
 * @returns NextResponse
 */
export function apiError(message: string, status: number = 500): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/**
 * 统一成功响应
 * @param data 响应数据
 * @param status HTTP 状态码
 * @returns NextResponse
 */
export function apiSuccess<T>(data: T, status: number = 200): NextResponse {
  return NextResponse.json(data, { status });
}

/**
 * 验证请求体
 * @param request Request 对象
 * @param schema Zod 验证模式
 * @returns 验证后的数据或错误响应
 */
export async function validateBody<T>(
  request: Request,
  schema: z.ZodSchema<T>
): Promise<{ data: T; error: null } | { data: null; error: NextResponse }> {
  try {
    const body = await request.json();
    const data = schema.parse(body);
    return { data, error: null };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
      return {
        data: null,
        error: apiError(`请求参数错误: ${messages}`, 400),
      };
    }
    return {
      data: null,
      error: apiError('请求格式错误', 400),
    };
  }
}

/**
 * API 处理包装器 - 统一日志和错误处理
 * @param handler API 处理函数
 * @returns 包装后的处理函数
 */
export function apiHandler(
  handler: (request: Request, context?: any) => Promise<Response>
) {
  return async (request: Request, context?: any) => {
    const start = Date.now();
    const url = new URL(request.url);
    const method = request.method;

    try {
      const response = await handler(request, context);
      const duration = Date.now() - start;

      // 记录成功的请求
      if (process.env.NODE_ENV === 'development') {
        console.log(`[API] ${method} ${url.pathname} ${response.status} ${duration}ms`);
      }

      return response;
    } catch (error) {
      const duration = Date.now() - start;

      // 记录错误
      console.error(
        `[API] ${method} ${url.pathname} ERROR ${duration}ms`,
        error instanceof Error ? error.message : error
      );

      // 如果是 Response 对象，直接返回
      if (error instanceof Response) {
        return error;
      }

      // 如果有特定的错误码，使用它
      if (error && typeof error === 'object' && 'code' in error) {
        const errorWithCode = error as { code: string; message?: string };
        if (errorWithCode.code === 'creation_window_wait') {
          return apiError(errorWithCode.message || '请稍后重试', 409);
        }
      }

      // 返回通用错误
      return apiError('服务器内部错误，请稍后重试', 500);
    }
  };
}

/**
 * 从 cookie 或 header 获取用户
 * 注意：这是一个简化示例，实际实现需要根据项目的认证系统调整
 */
export async function getUserFromRequest(request: Request): Promise<{ id: string; email: string } | null> {
  // TODO: 实现实际的用户验证逻辑
  // 这里需要集成项目现有的 Supabase 认证
  return null;
}

/**
 * 要求用户已登录
 * @param request Request 对象
 * @returns 用户对象或抛出 401 错误
 */
export async function requireUser(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    throw new Response('未授权，请先登录', { status: 401 });
  }
  return user;
}

/**
 * 常用验证模式
 */
export const schemas = {
  // ID 验证
  id: z.string().uuid('无效的 ID 格式'),

  // 字符串验证
  nonEmptyString: z.string().min(1, '不能为空'),
  shortText: z.string().min(1).max(200, '长度不能超过 200 字符'),
  longText: z.string().min(1).max(5000, '长度不能超过 5000 字符'),

  // 数字验证
  positiveInt: z.number().int().positive('必须是正整数'),
  pageNumber: z.number().int().min(1, '页码必须大于 0'),
  pageSize: z.number().int().min(1).max(100, '每页数量必须在 1-100 之间'),

  // 邮箱验证
  email: z.string().email('无效的邮箱格式'),

  // URL 验证
  url: z.string().url('无效的 URL 格式'),

  // 日期验证
  date: z.string().datetime('无效的日期格式'),
};

/**
 * 分页参数验证
 */
export const paginationSchema = z.object({
  page: schemas.pageNumber.optional().default(1),
  pageSize: schemas.pageSize.optional().default(20),
});

export type PaginationParams = z.infer<typeof paginationSchema>;

/**
 * 分页响应格式
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

/**
 * 创建分页响应
 */
export function createPaginatedResponse<T>(
  data: T[],
  page: number,
  pageSize: number,
  total: number
): PaginatedResponse<T> {
  return {
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}
