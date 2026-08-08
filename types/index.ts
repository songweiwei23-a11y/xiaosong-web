// types/index.ts
export type TaskType = '脚本生成' | '选题策划' | '分镜脚本' | '审稿优化';
export type Platform = '抖音' | '小红书' | '视频号' | 'B站';
export type Duration = '15秒' | '30秒' | '60秒' | '90秒';
export type Style = '犀利' | '温暖' | '专业' | '幽默';

export interface GenerateRequest {
  taskType: TaskType;
  topic: string;
  platform: Platform;
  duration: Duration;
  style: Style;
}

export interface GenerateResult {
  id: string;
  content: string;
  taskType: TaskType;
  topic: string;
  platform: Platform;
  duration: Duration;
  style: Style;
  createdAt: Date;
}

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
