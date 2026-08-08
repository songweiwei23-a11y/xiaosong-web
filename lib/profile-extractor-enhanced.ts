// 阶段2优化模块1：档案信息深度提取增强

/**
 * 从用户档案深度提取关键信息
 * 用于生成更精准、更个性化的脚本
 */

export interface ProfileData {
  // 基础信息
  accountName?: string;
  industry?: string;
  platform?: string;
  
  // 受众画像
  targetAudience?: string;
  audienceAge?: string;
  audienceGender?: string;
  audiencePain?: string;
  
  // 账号定位
  positioning?: string;
  differentiation?: string;
  coreValue?: string;
  
  // 账号阶段
  accountStage?: 'new' | 'growing' | 'stable' | 'mature';
  followerCount?: number;
  
  // 内容风格
  contentStyle?: string;
  tonePreference?: string;
}

/**
 * 生成档案洞察描述
 * 用于增强提示词，让AI更了解用户
 */
export function generateProfileInsights(profile: ProfileData): string {
  const insights: string[] = [];
  
  // 1. 受众画像洞察
  if (profile.targetAudience) {
    insights.push(`## 📊 目标受众画像`);
    insights.push(`**核心人群**：${profile.targetAudience}`);
    
    if (profile.audienceAge) {
      insights.push(`**年龄段**：${profile.audienceAge}`);
    }
    
    if (profile.audiencePain) {
      insights.push(`**核心痛点**：${profile.audiencePain}`);
      insights.push(`**台词建议**：多用"你是不是也..."类型的共鸣表达`);
    }
  }
  
  // 2. 账号阶段策略
  if (profile.accountStage || profile.followerCount !== undefined) {
    insights.push(`\n## 🎯 账号阶段策略`);
    
    const stage = determineAccountStage(profile.followerCount || 0, profile.accountStage);
    
    switch (stage) {
      case 'new':
        insights.push(`**阶段**：新号期（0-1000粉）`);
        insights.push(`**策略**：`);
        insights.push(`- 开场必须用强钩子（数字对比、反常识）`);
        insights.push(`- 内容要极致垂直，避免泛泛而谈`);
        insights.push(`- CTA必须明确：关注+评论扣1`);
        insights.push(`- 降低用户决策门槛`);
        break;
        
      case 'growing':
        insights.push(`**阶段**：成长期（1000-1万粉）`);
        insights.push(`**策略**：`);
        insights.push(`- 开场可以稍微铺垫（但不超过5秒）`);
        insights.push(`- 内容要有深度，展示专业性`);
        insights.push(`- CTA可以加引导：点赞收藏+持续关注`);
        insights.push(`- 建立信任感和专业形象`);
        break;
        
      case 'stable':
        insights.push(`**阶段**：稳定期（1万-10万粉）`);
        insights.push(`**策略**：`);
        insights.push(`- 开场可以用故事或场景引入`);
        insights.push(`- 内容要有独特观点，体现差异化`);
        insights.push(`- CTA可以引导互动：分享你的故事`);
        insights.push(`- 强化个人IP和风格`);
        break;
        
      case 'mature':
        insights.push(`**阶段**：成熟期（10万+粉）`);
        insights.push(`**策略**：`);
        insights.push(`- 开场可以更有个性和态度`);
        insights.push(`- 内容要有价值输出，引领行业`);
        insights.push(`- CTA可以轻松自然，不强求`);
        insights.push(`- 保持风格一致性`);
        break;
    }
  }
  
  // 3. 差异化定位
  if (profile.differentiation) {
    insights.push(`\n## 🎨 差异化要点`);
    insights.push(`**你的差异化**：${profile.differentiation}`);
    insights.push(`**在脚本中体现**：`);
    insights.push(`- 台词要突出这个差异点`);
    insights.push(`- 用具体案例证明差异化价值`);
    insights.push(`- 避免与竞品同质化`);
  }
  
  // 4. 内容风格匹配
  if (profile.contentStyle) {
    insights.push(`\n## 🎭 风格匹配`);
    insights.push(`**风格**：${profile.contentStyle}`);
    
    const styleGuide = getStyleGuide(profile.contentStyle);
    if (styleGuide) {
      insights.push(`**语言特点**：${styleGuide.language}`);
      insights.push(`**情绪表达**：${styleGuide.emotion}`);
      insights.push(`**节奏控制**：${styleGuide.pace}`);
    }
  }
  
  // 5. 平台特性适配
  if (profile.platform) {
    insights.push(`\n## 📱 平台适配`);
    const platformGuide = getPlatformGuide(profile.platform);
    if (platformGuide) {
      insights.push(`**平台**：${profile.platform}`);
      insights.push(`**用户特点**：${platformGuide.userCharacter}`);
      insights.push(`**内容偏好**：${platformGuide.contentPref}`);
      insights.push(`**互动方式**：${platformGuide.interaction}`);
    }
  }
  
  return insights.join('\n');
}

/**
 * 判断账号阶段
 */
function determineAccountStage(
  followerCount: number,
  explicitStage?: string
): 'new' | 'growing' | 'stable' | 'mature' {
  if (explicitStage) {
    return explicitStage as any;
  }
  
  if (followerCount < 1000) return 'new';
  if (followerCount < 10000) return 'growing';
  if (followerCount < 100000) return 'stable';
  return 'mature';
}

/**
 * 获取风格指南
 */
function getStyleGuide(style: string): {
  language: string;
  emotion: string;
  pace: string;
} | null {
  const styleMap: Record<string, any> = {
    '专业': {
      language: '准确、严谨，但要口语化',
      emotion: '理性中带温度，避免冰冷',
      pace: '稳健，重点处放慢'
    },
    '幽默': {
      language: '俏皮、夸张，多用比喻',
      emotion: '轻松愉快，自嘲自黑',
      pace: '快节奏，制造反转'
    },
    '犀利': {
      language: '直接、尖锐，一针见血',
      emotion: '态度鲜明，敢说敢批',
      pace: '快速有力，字字珠玑'
    },
    '温暖': {
      language: '温柔、鼓励，多用"你"',
      emotion: '共情、理解、支持',
      pace: '舒缓温柔，娓娓道来'
    }
  };
  
  return styleMap[style] || null;
}

/**
 * 获取平台指南
 */
function getPlatformGuide(platform: string): {
  userCharacter: string;
  contentPref: string;
  interaction: string;
} | null {
  const platformMap: Record<string, any> = {
    '抖音': {
      userCharacter: '年轻化，追求新鲜感和刺激',
      contentPref: '快节奏、强视觉冲击、BGM配合',
      interaction: '点赞为主，评论互动率中等'
    },
    '小红书': {
      userCharacter: '女性为主，注重品质和美感',
      contentPref: '干货实用、美学呈现、详细步骤',
      interaction: '收藏为主，评论互动率高'
    },
    '视频号': {
      userCharacter: '年龄偏大，偏好正能量内容',
      contentPref: '故事性强、价值观正、易传播',
      interaction: '转发为主，家人朋友传播'
    },
    'B站': {
      userCharacter: '年轻群体，内容要求高',
      contentPref: '深度、专业、有梗、长视频OK',
      interaction: '弹幕+评论，互动性强'
    }
  };
  
  return platformMap[platform] || null;
}

/**
 * 生成受众共鸣点
 */
export function generateAudienceResonance(profile: ProfileData): string[] {
  const resonances: string[] = [];
  
  if (profile.audiencePain) {
    resonances.push(`痛点共鸣："你是不是也遇到过[${profile.audiencePain}]？"`);
  }
  
  if (profile.targetAudience) {
    resonances.push(`人群定位："作为${profile.targetAudience}，你肯定..."`);
  }
  
  return resonances;
}

/**
 * 生成CTA策略
 */
export function generateCTAStrategy(profile: ProfileData): string {
  const stage = determineAccountStage(profile.followerCount || 0, profile.accountStage);
  
  const ctaMap: Record<string, string> = {
    'new': '**强CTA**：评论区扣1+关注我（降低门槛，强引导）',
    'growing': '**中CTA**：点赞收藏+关注（建立信任，持续关注）',
    'stable': '**软CTA**：分享你的经验+互动讨论（强化粘性）',
    'mature': '**自然CTA**：如果认同就点个赞（轻松自然）'
  };
  
  return ctaMap[stage] || ctaMap['new'];
}

/**
 * 导出完整的档案增强描述
 */
export function generateProfileEnhancedPrompt(profile: ProfileData): string {
  const sections: string[] = [];
  
  sections.push('# 📋 用户档案深度分析\n');
  
  // 1. 档案洞察
  const insights = generateProfileInsights(profile);
  if (insights) {
    sections.push(insights);
  }
  
  // 2. 受众共鸣点
  const resonances = generateAudienceResonance(profile);
  if (resonances.length > 0) {
    sections.push('\n## 💡 受众共鸣点建议');
    resonances.forEach(r => sections.push(`- ${r}`));
  }
  
  // 3. CTA策略
  const ctaStrategy = generateCTAStrategy(profile);
  sections.push(`\n## 🎯 CTA策略\n${ctaStrategy}`);
  
  // 4. 总体建议
  sections.push('\n## ✅ 生成要求');
  sections.push('- 脚本必须紧扣以上档案信息');
  sections.push('- 台词要符合目标受众的语言习惯');
  sections.push('- 内容要体现账号定位和差异化');
  sections.push('- CTA要匹配账号当前阶段');
  
  return sections.join('\n');
}