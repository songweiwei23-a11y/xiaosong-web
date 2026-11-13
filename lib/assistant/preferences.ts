/**
 * 用户习惯记忆系统
 * 记住用户的创作偏好，减少重复询问
 */

'use client';

/**
 * 用户创作偏好
 */
export interface UserPreferences {
  // 平台偏好
  preferredPlatform?: '抖音' | '视频号' | '小红书' | '快手' | 'B站';
  
  // 脚本类型偏好
  preferredScriptType?: string;
  
  // 内容角色偏好
  preferredRole?: string;
  
  // 时长偏好
  preferredDuration?: number;
  
  // 风格偏好
  preferredStyle?: string[];
  
  // 工作时段
  activeHours?: number[]; // 0-23
  
  // 创作频率
  creationPattern?: {
    topicPerWeek: number;
    scriptPerWeek: number;
    lastWeekTopics: number;
    lastWeekScripts: number;
  };
  
  // 质量偏好
  qualityPattern?: {
    avgRevisionCount: number;  // 平均修改次数
    acceptanceRate: number;     // 接受率
    preferredLength: number;    // 偏好长度
  };
  
  // 上次更新时间
  lastUpdated: number;
}

/**
 * 创作记录
 */
interface CreationRecord {
  type: 'topic' | 'script' | 'title' | 'storyboard' | 'review';
  timestamp: number;
  platform?: string;
  scriptType?: string;
  role?: string;
  duration?: number;
  accepted: boolean;
  revisionCount: number;
  contentLength: number;
}

const STORAGE_KEY = 'kaiwu:user-preferences';
const RECORDS_KEY = 'kaiwu:creation-records';
const MAX_RECORDS = 100; // 保留最近100条记录

/**
 * 获取用户偏好
 */
export function getUserPreferences(): UserPreferences | null {
  if (typeof window === 'undefined') return null;
  
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return null;
  
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

/**
 * 保存用户偏好
 */
export function saveUserPreferences(prefs: UserPreferences) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

/**
 * 记录一次创作
 */
export function recordCreation(record: Omit<CreationRecord, 'timestamp'>) {
  if (typeof window === 'undefined') return;
  
  // 获取现有记录
  const stored = localStorage.getItem(RECORDS_KEY);
  let records: CreationRecord[] = [];
  
  if (stored) {
    try {
      records = JSON.parse(stored);
    } catch {
      records = [];
    }
  }
  
  // 添加新记录
  records.push({
    ...record,
    timestamp: Date.now(),
  });
  
  // 只保留最近的记录
  if (records.length > MAX_RECORDS) {
    records = records.slice(-MAX_RECORDS);
  }
  
  localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
  
  // 更新偏好
  updatePreferencesFromRecords(records);
}

/**
 * 从记录中分析并更新偏好
 */
function updatePreferencesFromRecords(records: CreationRecord[]) {
  if (records.length === 0) return;
  
  const prefs: UserPreferences = getUserPreferences() || {
    lastUpdated: Date.now(),
  };
  
  // 分析平台偏好
  const platforms = records
    .filter(r => r.platform)
    .map(r => r.platform as string);
  if (platforms.length > 0) {
    prefs.preferredPlatform = getMostFrequent(platforms) as any;
  }
  
  // 分析脚本类型偏好
  const scriptTypes = records
    .filter(r => r.type === 'script' && r.scriptType)
    .map(r => r.scriptType as string);
  if (scriptTypes.length > 0) {
    prefs.preferredScriptType = getMostFrequent(scriptTypes);
  }
  
  // 分析时长偏好
  const durations = records
    .filter(r => r.duration)
    .map(r => r.duration as number);
  if (durations.length > 0) {
    prefs.preferredDuration = Math.round(
      durations.reduce((a, b) => a + b, 0) / durations.length
    );
  }
  
  // 分析工作时段
  const hours = records.map(r => new Date(r.timestamp).getHours());
  prefs.activeHours = Array.from(new Set(hours)).sort((a, b) => a - b);
  
  // 分析创作频率（最近7天）
  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const lastWeekRecords = records.filter(r => r.timestamp > weekAgo);
  
  prefs.creationPattern = {
    topicPerWeek: lastWeekRecords.filter(r => r.type === 'topic').length,
    scriptPerWeek: lastWeekRecords.filter(r => r.type === 'script').length,
    lastWeekTopics: lastWeekRecords.filter(r => r.type === 'topic').length,
    lastWeekScripts: lastWeekRecords.filter(r => r.type === 'script').length,
  };
  
  // 分析质量偏好
  const avgRevisions = records.reduce((sum, r) => sum + r.revisionCount, 0) / records.length;
  const acceptedCount = records.filter(r => r.accepted).length;
  const avgLength = records.reduce((sum, r) => sum + r.contentLength, 0) / records.length;
  
  prefs.qualityPattern = {
    avgRevisionCount: Math.round(avgRevisions * 10) / 10,
    acceptanceRate: Math.round((acceptedCount / records.length) * 100),
    preferredLength: Math.round(avgLength),
  };
  
  prefs.lastUpdated = Date.now();
  saveUserPreferences(prefs);
}

/**
 * 获取最常见的值
 */
function getMostFrequent<T>(arr: T[]): T | undefined {
  if (arr.length === 0) return undefined;
  
  const counts = new Map<T, number>();
  arr.forEach(item => {
    counts.set(item, (counts.get(item) || 0) + 1);
  });
  
  let maxCount = 0;
  let mostFrequent: T | undefined;
  
  counts.forEach((count, item) => {
    if (count > maxCount) {
      maxCount = count;
      mostFrequent = item;
    }
  });
  
  return mostFrequent;
}

/**
 * 生成个性化的默认参数
 */
export function getPersonalizedDefaults(): {
  platform?: string;
  scriptType?: string;
  role?: string;
  duration?: number;
  message?: string;
} {
  const prefs = getUserPreferences();
  if (!prefs) return {};
  
  const defaults: any = {};
  let message = '';
  
  if (prefs.preferredPlatform) {
    defaults.platform = prefs.preferredPlatform;
    message += `${prefs.preferredPlatform}平台`;
  }
  
  if (prefs.preferredScriptType) {
    defaults.scriptType = prefs.preferredScriptType;
    if (message) message += '、';
    message += prefs.preferredScriptType;
  }
  
  if (prefs.preferredDuration) {
    defaults.duration = prefs.preferredDuration;
    if (message) message += '、';
    message += `${prefs.preferredDuration}秒`;
  }
  
  if (message) {
    defaults.message = `按你平时的习惯：${message}。如果不对可以随时调整`;
  }
  
  return defaults;
}

/**
 * 获取创作建议
 */
export function getCreationInsights(): string[] {
  const prefs = getUserPreferences();
  if (!prefs || !prefs.creationPattern || !prefs.qualityPattern) {
    return [];
  }
  
  const insights: string[] = [];
  const { creationPattern, qualityPattern } = prefs;
  
  // 频率分析
  if (creationPattern.scriptPerWeek > 0) {
    const avg = creationPattern.scriptPerWeek;
    if (avg < 3) {
      insights.push(`建议：每周至少创作3个脚本，保持创作节奏`);
    } else if (avg > 10) {
      insights.push(`👍 创作频率很高！保持这个节奏`);
    }
  }
  
  // 质量分析
  if (qualityPattern.avgRevisionCount > 2) {
    insights.push(`提示：平均修改${qualityPattern.avgRevisionCount.toFixed(1)}次，可以尝试在生成时提供更详细的要求`);
  }
  
  if (qualityPattern.acceptanceRate < 50) {
    insights.push(`建议：接受率${qualityPattern.acceptanceRate}%，可以多和我沟通你的具体需求`);
  } else if (qualityPattern.acceptanceRate > 80) {
    insights.push(`👍 接受率${qualityPattern.acceptanceRate}%，我们配合很默契！`);
  }
  
  return insights;
}

/**
 * 清除用户数据（用于测试或隐私）
 */
export function clearUserData() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(RECORDS_KEY);
}
