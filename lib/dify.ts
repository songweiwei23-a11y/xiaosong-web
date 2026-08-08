// lib/dify.ts
import axios from 'axios';

const DIFY_API_KEY = process.env.DIFY_API_KEY!;
const DIFY_API_URL = process.env.DIFY_API_URL || 'https://api.dify.ai/v1';

export interface DifyRequest {
  taskType: string;
  topic: string;
  platform: string;
  duration: string;
  style: string;
}

export interface DifyResponse {
  answer: string;
  conversationId?: string;
  messageId?: string;
}

/**
 * 流式调用（逐字返回，实时显示）
 */
export async function* generateScriptStream(request: DifyRequest): AsyncGenerator<string> {
  const prompt = formatPrompt(request);
  
  const response = await fetch(`${DIFY_API_URL}/workflows/run`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${DIFY_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      inputs: { query: prompt },
      response_mode: 'streaming',
      user: 'web-user-' + Date.now()
    })
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('无法获取响应流');

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim() || !line.startsWith('data: ')) continue;
        
        try {
          const data = JSON.parse(line.slice(6));
          
          if (data.event === 'workflow_finished') {
            const output = data.data?.outputs?.text || '';
            if (output) yield output;
          } else if (data.event === 'text_chunk') {
            yield data.data?.text || '';
          } else if (data.event === 'agent_message') {
            yield data.answer || '';
          } else if (data.event === 'error') {
            throw new Error(data.message || '生成过程出错');
          }
        } catch (e) {
          console.warn('解析SSE行失败:', line, e);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * 格式化请求为Dify提示词
 */
function formatPrompt(request: DifyRequest): string {
  return `任务类型：${request.taskType}
主题：${request.topic}
平台：${request.platform}
视频时长：${request.duration}
风格：${request.style}`;
}
