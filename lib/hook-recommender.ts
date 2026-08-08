// 阶段2优化模块2：智能钩子推荐

/**
 * 根据主题和场景智能推荐最佳钩子类型
 * 避免钩子类型错配，提升开场吸引力
 */

export type HookType = 
  | 'money'       // 💰 金钱型
  | 'contrast'    // ⚡ 对比型
  | 'counter'     // 🤪 反常识型
  | 'pain'        // 🤝 痛点型
  | 'curiosity'   // 🔍 好奇型
  | 'number'      // 📊 数据型
  | 'story';      // 📖 故事型

export interface HookRecommendation {
  type: HookType;
  typeName: string;
  emoji: string;
  reason: string;
  template: string;
  example: string;
  score: number; // 匹配度评分 0-100
}

/**
 * 智能推荐钩子类型
 */
export function recommendHook(
  topic: string,
  scriptType: string,
  additionalContext?: string
): HookRecommendation[] {
  const recommendations: HookRecommendation[] = [];
  
  // 分析主题关键词
  const topicLower = topic.toLowerCase();
  const contextLower = (additionalContext || '').toLowerCase();
  const combined = topicLower + ' ' + contextLower;
  
  // 规则1：包含数字 → 数据型钩子
  if (/\d+/.test(topic)) {
    recommendations.push({
      type: 'number',
      typeName: '数据型',
      emoji: '📊',
      reason: '主题包含具体数字，用数据冲击开场最有力',
      template: '我见过最[极端词]的[X数字]，也见过最[极端词]的[Y数字]',
      example: '我见过最快的3天涨粉2000，也见过最慢的3个月还是0',
      score: 95
    });
  }
  
  // 规则2：涨粉/赚钱/省钱等 → 金钱型钩子
  if (/涨粉|赚钱|省钱|月入|收入|成本|便宜|贵/.test(combined)) {
    recommendations.push({
      type: 'money',
      typeName: '金钱型',
      emoji: '💰',
      reason: '主题与金钱/收益相关，直击用户利益点',
      template: '[时间]前，我[困境状态]；但现在[成功状态]，就因为[一件事]',
      example: '3个月前账上只剩2800块，但现在月入3万，就因为做对了一件事',
      score: 90
    });
  }
  
  // 规则3：包含"秘密/真相/内幕" → 好奇型钩子
  if (/秘密|真相|内幕|揭秘|不为人知|隐藏/.test(combined)) {
    recommendations.push({
      type: 'curiosity',
      typeName: '好奇型',
      emoji: '🔍',
      reason: '主题制造悬念，用好奇心引导用户看下去',
      template: '你知道[X]背后的真相吗？[Y]次后我才发现...',
      example: '你知道爆款视频背后的秘密吗？拍了50条后我才发现...',
      score: 85
    });
  }
  
  // 规则4：包含"为什么/怎么/如何" → 对比型钩子
  if (/为什么|怎么|如何|差距|区别/.test(combined) || scriptType.includes('teach')) {
    recommendations.push({
      type: 'contrast',
      typeName: '对比型',
      emoji: '⚡',
      reason: '教知识类内容，用对比展示差距最有说服力',
      template: '同样[做X]，为什么[A快/好]，[B慢/差]？差距就在[Y]',
      example: '同样拍视频，为什么有人3天涨粉2000，有人3个月还是0？差距就在这一个动作',
      score: 88
    });
  }
  
  // 规则5：推荐探店类 → 反常识钩子
  if (scriptType.includes('recommend') || /探店|推荐|好吃|好用/.test(combined)) {
    recommendations.push({
      type: 'counter',
      typeName: '反常识型',
      emoji: '🤪',
      reason: '推荐类内容，反常识开场制造反差和好奇',
      template: '这家店我来了[N]次才敢推荐！[正面描述]，但[转折]...',
      example: '这家店我来了8次才敢推荐！人均80块，但很多人吃一次就再也不来了',
      score: 92
    });
  }
  
  // 规则6：广告引流类 → 痛点型钩子
  if (scriptType.includes('ad') || /广告|引流|到店|团购/.test(combined)) {
    recommendations.push({
      type: 'pain',
      typeName: '痛点型',
      emoji: '🤝',
      reason: '广告引流类，先戳痛点引发共鸣，再给解决方案',
      template: '[痛点场景]——你们是不是也遇到过？',
      example: '29块钱剪个头发，结果Tony老师非要给我烫——你们是不是也遇到过？',
      score: 90
    });
  }
  
  // 规则7：故事类 → 故事型钩子
  if (scriptType.includes('story') || /经历|故事|创业|失败|成功/.test(combined)) {
    recommendations.push({
      type: 'story',
      typeName: '故事型',
      emoji: '📖',
      reason: '故事类内容，用戏剧化开场吸引用户进入故事',
      template: '[时间]前的我[状态A]，现在的我[状态B]，中间发生了什么？',
      example: '3个月前的我负债累累，现在的我月入10万，中间发生了什么？',
      score: 87
    });
  }
  
  // 如果没有匹配到任何规则，给出通用推荐
  if (recommendations.length === 0) {
    recommendations.push({
      type: 'contrast',
      typeName: '对比型',
      emoji: '⚡',
      reason: '通用型钩子，适用范围广',
      template: '做[X]，[A方法]和[B方法]差距有多大？',
      example: '拍抖音，会玩的和不会玩的差距有多大？',
      score: 75
    });
  }
  
  // 按匹配度排序
  return recommendations.sort((a, b) => b.score - a.score);
}

/**
 * 生成钩子使用指南
 */
export function generateHookGuide(hook: HookRecommendation): string {
  const guide: string[] = [];
  
  guide.push(`## 🎯 推荐钩子类型：${hook.emoji} ${hook.typeName}`);
  guide.push('');
  guide.push(`**推荐理由**：${hook.reason}`);
  guide.push('');
  guide.push(`**开场模板**：`);
  guide.push(`\`\`\`\n${hook.template}\n\`\`\``);
  guide.push('');
  guide.push(`**参考示例**：`);
  guide.push(`"${hook.example}"`);
  guide.push('');
  guide.push(`**执行要点**：`);
  
  switch (hook.type) {
    case 'money':
      guide.push('- 开场3秒内必须抛出金钱数字');
      guide.push('- 用极端对比制造冲击（如：2800块 vs 月入3万）');
      guide.push('- 情绪要有从困境到成功的转变');
      break;
      
    case 'number':
      guide.push('- 数字要极端对比（大 vs 小，快 vs 慢）');
      guide.push('- 重读数字，给用户心理冲击');
      guide.push('- 配合手势强调数字（竖手指）');
      break;
      
    case 'contrast':
      guide.push('- 明确A和B的对比（成功 vs 失败）');
      guide.push('- 用"为什么""差距"等词强化对比');
      guide.push('- 开场就要点出差距在哪里');
      break;
      
    case 'counter':
      guide.push('- 先说一个反常识的行为（"来了8次才敢推荐"）');
      guide.push('- 制造悬念和好奇（"为什么这么谨慎？"）');
      guide.push('- 用转折词"但是"增加反差');
      break;
      
    case 'pain':
      guide.push('- 直接描述痛点场景，要具体');
      guide.push('- 用"你是不是也..."引发共鸣');
      guide.push('- 情绪要有代入感，像在吐槽');
      break;
      
    case 'curiosity':
      guide.push('- 用"秘密""真相"制造神秘感');
      guide.push('- 设置悬念，不要马上揭晓答案');
      guide.push('- 用"你知道吗""告诉你"吸引注意');
      break;
      
    case 'story':
      guide.push('- 开场直接进入戏剧化场景');
      guide.push('- 用时间对比（过去 vs 现在）');
      guide.push('- 制造悬念："中间发生了什么？"');
      break;
  }
  
  return guide.join('\n');
}

/**
 * 批量推荐并生成完整指南
 */
export function generateSmartHookRecommendation(
  topic: string,
  scriptType: string,
  additionalContext?: string
): string {
  const hooks = recommendHook(topic, scriptType, additionalContext);
  const topHook = hooks[0]; // 最佳推荐
  
  const sections: string[] = [];
  
  sections.push('# 🎣 智能钩子推荐\n');
  
  // 1. 最佳推荐
  sections.push(generateHookGuide(topHook));
  
  // 2. 备选方案（如果有多个）
  if (hooks.length > 1) {
    sections.push('\n---\n');
    sections.push('## 📋 备选钩子类型\n');
    hooks.slice(1, 3).forEach((hook, index) => {
      sections.push(`### 备选${index + 1}：${hook.emoji} ${hook.typeName}（匹配度：${hook.score}%）`);
      sections.push(`**理由**：${hook.reason}`);
      sections.push(`**示例**："${hook.example}"`);
      sections.push('');
    });
  }
  
  // 3. 使用提示
  sections.push('---\n');
  sections.push('## ⚠️ 钩子使用提示\n');
  sections.push('1. **必须在3秒内抛出钩子**，不要铺垫');
  sections.push('2. **钩子要与主题强相关**，不要为了抓人而偏离主题');
  sections.push('3. **配合情绪和画面**，单纯的文字钩子力度不够');
  sections.push('4. **避免钩子过度承诺**，后续内容要能兑现');
  
  return sections.join('\n');
}