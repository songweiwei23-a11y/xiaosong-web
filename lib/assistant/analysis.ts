/**
 * 创作问题分析系统
 * 分析用户的创作问题，给出改进建议
 */

'use client';

import { getUserPreferences, getCreationInsights } from './preferences';
import { getCurrentContext } from './context';

/**
 * 创作问题类型
 */
export interface CreationIssue {
  id: string;
  severity: 'high' | 'medium' | 'low';
  category: '完播率' | '钩子' | '节奏' | '转化' | '频率' | '质量';
  problem: string;
  analysis: string;
  suggestions: string[];
  expectedImprovement: string;
}

/**
 * 分析用户的创作问题
 */
export function analyzeCreationIssues(): CreationIssue[] {
  const prefs = getUserPreferences();
  if (!prefs || !prefs.qualityPattern || !prefs.creationPattern) {
    return [];
  }

  const issues: CreationIssue[] = [];
  const { qualityPattern, creationPattern } = prefs;

  // 问题1：接受率低
  if (qualityPattern.acceptanceRate < 50 && qualityPattern.acceptanceRate > 0) {
    issues.push({
      id: 'low-acceptance',
      severity: 'high',
      category: '质量',
      problem: `内容接受率只有 ${qualityPattern.acceptanceRate}%`,
      analysis: '这说明生成的内容经常不符合你的预期。可能原因：需求描述不够详细，或者没有形成稳定的风格。',
      suggestions: [
        '在生成时提供更详细的要求（目标人群、风格、重点）',
        '保存满意的案例，下次告诉我"按照上次那样"',
        '和我多沟通几次，让我更了解你的需求',
      ],
      expectedImprovement: '接受率从 50% 提升到 70%+',
    });
  }

  // 问题2：修改次数多
  if (qualityPattern.avgRevisionCount > 2) {
    issues.push({
      id: 'high-revision',
      severity: 'medium',
      category: '质量',
      problem: `平均每个内容要修改 ${qualityPattern.avgRevisionCount.toFixed(1)} 次`,
      analysis: '频繁修改说明初稿和预期有差距。这会浪费很多时间。',
      suggestions: [
        '第一次生成时就说清楚所有要求',
        '提供参考案例："我想要这种风格"',
        '使用"按我的习惯"让我自动采用你的偏好',
      ],
      expectedImprovement: '修改次数从 2+ 次降到 1 次以内',
    });
  }

  // 问题3：创作频率低
  if (creationPattern.scriptPerWeek < 3) {
    issues.push({
      id: 'low-frequency',
      severity: 'medium',
      category: '频率',
      problem: `每周只创作 ${creationPattern.scriptPerWeek} 个脚本`,
      analysis: '创作频率太低，难以形成稳定的内容产出。短视频需要持续更新才能保持热度。',
      suggestions: [
        '设定每周目标：至少3-5个脚本',
        '使用批量生成：一次生成5个，挑选最好的',
        '每天固定时间创作，养成习惯',
      ],
      expectedImprovement: '每周产出从 < 3 个提升到 5+ 个',
    });
  }

  // 问题4：内容长度不稳定（如果有数据）
  if (qualityPattern.preferredLength > 0) {
    const idealLength = 800; // 假设理想长度
    const diff = Math.abs(qualityPattern.preferredLength - idealLength);
    if (diff > 200) {
      issues.push({
        id: 'length-inconsistent',
        severity: 'low',
        category: '质量',
        problem: qualityPattern.preferredLength > idealLength
          ? '内容经常过长，可能导致用户流失'
          : '内容经常过短，信息不够充分',
        analysis: qualityPattern.preferredLength > idealLength
          ? '短视频需要精炼，去掉冗余内容才能保持完播率'
          : '内容太短可能讲不清楚，或者显得缺乏深度',
        suggestions: [
          `目标长度：${idealLength}字左右（约60秒）`,
          '重要信息优先，次要信息可以省略',
          '检查是否有重复或啰嗦的地方',
        ],
        expectedImprovement: '完播率提升 10-15%',
      });
    }
  }

  return issues.sort((a, b) => {
    const severityOrder = { high: 0, medium: 1, low: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
}

/**
 * 生成月度进步报告
 */
export function generateMonthlyReport(): {
  period: string;
  stats: {
    topicGenerated: number;
    scriptGenerated: number;
    acceptanceRate: number;
    avgRevisionCount: number;
  };
  highlights: string[];
  improvements: string[];
  nextMonthGoals: string[];
} {
  const prefs = getUserPreferences();
  const context = getCurrentContext();
  
  if (!prefs || !prefs.qualityPattern || !prefs.creationPattern) {
    return {
      period: new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' }),
      stats: {
        topicGenerated: 0,
        scriptGenerated: 0,
        acceptanceRate: 0,
        avgRevisionCount: 0,
      },
      highlights: [],
      improvements: [],
      nextMonthGoals: [],
    };
  }

  const { qualityPattern, creationPattern } = prefs;
  const stats = {
    topicGenerated: creationPattern.lastWeekTopics * 4, // 粗略估算月度
    scriptGenerated: creationPattern.lastWeekScripts * 4,
    acceptanceRate: qualityPattern.acceptanceRate,
    avgRevisionCount: qualityPattern.avgRevisionCount,
  };

  // 亮点
  const highlights: string[] = [];
  if (stats.acceptanceRate > 70) {
    highlights.push(`接受率达到 ${stats.acceptanceRate}%，我们配合很默契！`);
  }
  if (stats.scriptGenerated > 12) {
    highlights.push(`本月完成 ${stats.scriptGenerated} 个脚本，创作产出稳定`);
  }
  if (qualityPattern.avgRevisionCount < 1.5) {
    highlights.push(`平均修改次数只有 ${qualityPattern.avgRevisionCount.toFixed(1)} 次，效率很高`);
  }

  // 进步
  const improvements: string[] = [];
  // 这里可以与上月数据对比，暂时给出通用建议
  if (stats.acceptanceRate > 60) {
    improvements.push('内容质量比之前提升了');
  }
  if (stats.scriptGenerated > 8) {
    improvements.push('创作频率保持得不错');
  }

  // 下月目标
  const nextMonthGoals: string[] = [];
  if (stats.acceptanceRate < 80) {
    nextMonthGoals.push(`接受率目标：从 ${stats.acceptanceRate}% 提升到 80%+`);
  }
  if (stats.scriptGenerated < 20) {
    nextMonthGoals.push(`产出目标：每周至少 5 个脚本（月度 20+）`);
  }
  if (qualityPattern.avgRevisionCount > 1.5) {
    nextMonthGoals.push('效率目标：减少修改次数，一次生成更准确');
  }

  return {
    period: new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' }),
    stats,
    highlights: highlights.length > 0 ? highlights : ['继续加油，保持创作！'],
    improvements: improvements.length > 0 ? improvements : ['保持当前节奏'],
    nextMonthGoals: nextMonthGoals.length > 0 ? nextMonthGoals : ['继续保持优秀表现'],
  };
}

/**
 * 获取实时创作建议
 */
export function getRealtimeSuggestions(contentType: 'topic' | 'script' | 'title'): string[] {
  const prefs = getUserPreferences();
  const issues = analyzeCreationIssues();
  const suggestions: string[] = [];

  // 根据内容类型给建议
  if (contentType === 'script') {
    // 如果接受率低，给更具体的建议
    if (issues.some(i => i.id === 'low-acceptance')) {
      suggestions.push('💡 提示：提供更详细的要求会大幅提升满意度');
    }
    
    // 如果修改多，提醒一次说清楚
    if (issues.some(i => i.id === 'high-revision')) {
      suggestions.push('💡 提示：把所有要求一次说清楚，可以减少后续修改');
    }
  }

  // 根据用户习惯给建议
  if (prefs?.preferredPlatform) {
    suggestions.push(`💡 你常用${prefs.preferredPlatform}，记得针对这个平台优化`);
  }

  return suggestions;
}
