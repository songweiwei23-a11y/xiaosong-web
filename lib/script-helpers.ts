// 脚本生成辅助函数库
// 用于支持10个维度的优化

// ========== 维度1：档案信息深度提取 ==========

export function getAudienceProfile(profile: any): string {
  const audienceMap: Record<string, string> = {
    '自媒体运营': '30-45岁想做短视频的实体老板/创业者，有店铺但不懂运营',
    '美食探店': '25-40岁爱吃爱玩的本地白领，关注生活品质',
    '职场干货': '22-35岁职场人士，有晋升焦虑和学习欲望',
    '教育培训': '25-45岁家长或职场人，重视教育投资',
    '美妆护肤': '20-35岁女性，追求变美和精致生活',
    '母婴育儿': '25-40岁新手妈妈，焦虑孩子成长问题',
    '健身减肥': '22-40岁男女，有体型焦虑和健康意识',
    '数码科技': '20-40岁男性为主，喜欢新鲜事物',
    '情感咨询': '22-45岁有情感困扰的都市人群',
    '财经理财': '28-50岁有一定积蓄的中产人群',
  };
  
  const track = profile.account_track?.[0] || '';
  return audienceMap[track] || '18-50岁泛用户群体，对该领域有兴趣或需求';
}

export function getDifferentiation(profile: any): string {
  const name = profile.profile_name || '创作者';
  const track = profile.account_track?.[0] || '通用内容';
  
  return `${name}的独特视角：从${track}领域的实战经验出发，用真实案例和接地气的方式讲专业内容，让用户觉得"学得会、用得上"`;
}

export function getAvoidStyles(selectedStyles: string[]): string {
  const allStyles = ['幽默', '情感', '实用', '励志', '轻松', '专业', '接地气', '高级'];
  const avoidStyles = allStyles.filter(s => !selectedStyles?.includes(s));
  
  return avoidStyles.slice(0, 3).join('、') || '过度娱乐化';
}

export function getShouldSayExamples(profile: any): string {
  const styleMap: Record<string, string> = {
    '专业': '"我见过很多案例""数据显示""根据经验""行业内幕"',
    '幽默': '"你妈给的点赞""手指头都划走了""说人话就是""你猜怎么着"',
    '接地气': '"咱们聊聊""说实话""你肯定遇到过""换我我也急"',
    '实用': '"直接上干货""3步搞定""学会这招""拿去就能用"',
    '励志': '"当时我也觉得不可能""但我没放弃""现在回头看"',
    '情感': '"你是不是也这样""我特别理解""心疼你们""别怪自己"',
    '轻松': '"别紧张""其实很简单""没那么复杂""放轻松"',
    '高级': '"深层逻辑""底层思维""认知差距""格局打开"',
  };
  
  const examples = profile.content_style?.map((s: string) => styleMap[s]).filter(Boolean);
  return examples?.join('、') || '"你是不是也遇到过""咱们聊聊"';
}

export function getShouldNotSayExamples(profile: any): string {
  const avoidMap: Record<string, string> = {
    '专业': '"大家好我是XX""今天分享""希望对你有帮助"',
    '幽默': '"综上所述""根据调查显示""通过以上分析"',
    '接地气': '"您好""敬请期待""感谢观看"',
  };
  
  const mainStyle = profile.content_style?.[0] || '专业';
  return avoidMap[mainStyle] || '"大家好我是XX""今天要分享"';
}

export function getContentFocus(fansLevel: string): string {
  const focusMap: Record<string, string> = {
    '0-1万': '重点建立认知，让用户知道你是谁、能提供什么价值。内容要极致垂直，每条都围绕核心定位',
    '1-10万': '重点建立信任，用案例和干货证明专业度。可以适当扩展内容边界，但不能偏离主赛道',
    '10-50万': '重点做差异化，找到独特的内容角度和人设标签。可以尝试创新内容形式',
    '50万以上': '重点做IP化，建立个人品牌和影响力。内容可以更多元，但要保持核心价值观',
  };
  
  return focusMap[fansLevel] || '建立认知，垂直深耕';
}

// ========== 维度2：智能钩子推荐 ==========

export function getSmartHookRecommendation(
  topic: string,
  targetGroup: string,
  boomElements: string[]
): { hookType: string; reason: string } {
  
  // 规则1：主题包含价格/优惠 → 金钱型
  if (/价格|便宜|省钱|优惠|打折|划算/.test(topic)) {
    return { hookType: 'money', reason: '主题涉及价格优势，用金钱型钩子直击利益点' };
  }
  
  // 规则2：目标人群是老板/创业者 → 金钱型
  if (/老板|创业|实体|生意/.test(targetGroup)) {
    return { hookType: 'money', reason: '目标人群是老板，对成本和收益最敏感' };
  }
  
  // 规则3：主题包含"为什么/原因/差距" → 验证解密型
  if (/为什么|为啥|原因|差距|秘密|真相/.test(topic)) {
    return { hookType: 'verify', reason: '主题是揭秘类，用验证解密型钩子制造好奇' };
  }
  
  // 规则4：爆款元素包含"反差" → 冲突对立型
  if (boomElements.includes('contrast')) {
    return { hookType: 'conflict', reason: '选了反差元素，用冲突对立型钩子放大对比' };
  }
  
  // 规则5：主题包含情感词 → 情感共鸣型
  if (/心疼|焦虑|孤独|委屈|难过/.test(topic)) {
    return { hookType: 'emotion', reason: '主题涉及情感，用情感共鸣型钩子引发共鸣' };
  }
  
  // 规则6：主题包含"测评/对比" → 悬疑解密型
  if (/测评|对比|实测|挑战/.test(topic)) {
    return { hookType: 'mystery', reason: '主题是测评类，用悬疑解密型钩子制造期待' };
  }
  
  // 默认：冲突对立型（最通用）
  return { hookType: 'conflict', reason: '通用选择，用反常识观点抓住注意力' };
}

// ========== 维度4：时间分配和任务分解 ==========

export function getTimeAllocation(structureName: string, duration: string): string {
  const dur = parseInt(duration);
  
  const allocations: Record<string, string> = {
    '对比型': `
- 开场钩子：0-8秒（极端对比，制造震撼）
- 对比A（成功方）：8-25秒（展示正确做法）
- 对比B（失败方）：25-42秒（展示错误做法）
- 揭示原因：42-52秒 ⚡情绪高潮（点破本质）
- 结尾总结+CTA：52-${dur}秒（金句+行动指令）`,
    
    '解题型': `
- 难题呈现：0-10秒（具体场景，制造焦虑）
- 危机升级：10-25秒（不解决会怎样）
- 解决方案：25-45秒（分步骤讲清楚）
- 执行要点：45-55秒 ⚡情绪高潮（关键点强调）
- 行动指令：55-${dur}秒（降低门槛）`,
    
    '推荐型': `
- 美好愿景：0-8秒（使用后的效果）
- 目标人群：8-20秒（适合谁、不适合谁）
- 制造好奇：20-35秒（为什么推荐）
- 推荐理由：35-52秒 ⚡情绪高潮（核心卖点）
- 降低门槛：52-${dur}秒（试试看，不吃亏）`,
    
    '揭秘型': `
- 反常识观点：0-8秒（挑战认知）
- 内幕揭露：8-35秒（行业秘密）
- 真相示范：35-52秒 ⚡情绪高潮（证据展示）
- 总结升华：52-${dur}秒（记住这个真相）`,
    
    '案例型': `
- 案例呈现：0-15秒（谁、什么结果）
- 关键拆解：15-45秒（怎么做到的）
- 可复制方法：45-55秒 ⚡情绪高潮（你也能做）
- 降低门槛：55-${dur}秒（简单3步）`,
  };
  
  return allocations[structureName] || `请根据${structureName}的公式合理分配${dur}秒时长`;
}

export function getStepTasks(structureName: string): string {
  const tasks: Record<string, string> = {
    '对比型': `
1. 开场：用极端数据对比制造震撼（成功vs失败）
2. 对比A：展示成功者的做法（用具体场景）
3. 对比B：展示失败者的做法（戳中痛点）
4. 揭示：点破本质差异（这是最重要的）
5. 收尾：金句总结+行动指令`,
    
    '解题型': `
1. 难题：用具体场景描述问题（让人共鸣）
2. 危机：放大焦虑（不解决会更惨）
3. 方案：给出解决方法（分步骤）
4. 要点：强调关键点（这步最重要）
5. 行动：降低执行门槛（现在就能做）`,
  };
  
  return tasks[structureName] || '请严格按照公式的每个环节展开';
}

// ========== 维度10：脚本质量评分 ==========

export function evaluateScriptQuality(script: string): number {
  let score = 6; // 基础分
  
  // 检查1：是否有金句（+1分）
  const goldSentenceMatch = script.match(/【?金句】?.*[:：]\s*[""]([^""]{10,25})[""]/)  ||
                           script.match(/\*\*金句\*\*.*[""]([^""]{10,25})[""]/) ||
                           script.match(/金句[：:]\s*[""]([^""]{10,25})[""]/);
  if (goldSentenceMatch) {
    const sentence = goldSentenceMatch[1];
    // 金句长度合适（10-20字）
    if (sentence.length >= 10 && sentence.length <= 20) {
      score += 1;
    } else {
      score += 0.5;
    }
  }
  
  // 检查2：是否有情绪波点标注（+1分）
  const emotionMarks = (script.match(/⚡/g) || []).length;
  if (emotionMarks >= 1) {
    score += 1;
  } else if (emotionMarks === 0 && /情绪|波点|高潮/.test(script)) {
    score += 0.5; // 有提到但没标注
  }
  
  // 检查3：是否有接地气表达（+1分）
  const colloquialPhrases = [
    '你妈', '手指头', '干嘛', '干啥', '咋', '你是不是也',
    '说人话', '划走', '白费', '你猜', '关注你干啥'
  ];
  const colloquialCount = colloquialPhrases.filter(phrase => script.includes(phrase)).length;
  if (colloquialCount >= 2) {
    score += 1;
  } else if (colloquialCount === 1) {
    score += 0.5;
  }
  
  // 检查4：是否有画面感描述（+0.5分）
  if ((script.includes('【镜头') || script.includes('**镜头')) && 
      (script.includes('【画面') || script.includes('**画面'))) {
    score += 0.5;
  }
  
  // 检查5：是否有秒数标注（+0.5分）
  const timeMarks = (script.match(/\d+-\d+秒/g) || []).length;
  if (timeMarks >= 3) {
    score += 0.5;
  } else if (timeMarks >= 1) {
    score += 0.25;
  }
  
  // 检查6：是否有CTA行动指令（+0.5分）
  if (/评论区|扣1|点赞|关注|私信|到店|团购/.test(script)) {
    score += 0.5;
  }
  
  // 检查7：是否避免了书面语（+0.5分）
  const formalPhrases = ['大家好我是', '今天我要分享', '综上所述', '通过以上分析'];
  const hasFormal = formalPhrases.some(phrase => script.includes(phrase));
  if (!hasFormal) {
    score += 0.5;
  }
  
  return Math.min(score, 10); // 最高10分
}

export function getImprovementSuggestions(script: string, score: number): string {
  const suggestions = [];
  
  // 检查金句
  if (!script.match(/金句.*[""]([^""]{10,20})[""]/)) {
    suggestions.push('缺少金句或金句不够精炼（建议10-20字）');
  }
  
  // 检查情绪波点
  if ((script.match(/⚡/g) || []).length < 1) {
    suggestions.push('缺少明确的情绪高潮点标注（用⚡标注）');
  }
  
  // 检查接地气
  const colloquialPhrases = ['你妈', '手指头', '干嘛', '说人话', '你是不是也'];
  if (!colloquialPhrases.some(phrase => script.includes(phrase))) {
    suggestions.push('台词不够接地气，缺少口语化表达（如"你妈给的点赞""手指头都划走了"）');
  }
  
  // 检查书面语
  if (/大家好我是|今天我要分享|综上所述/.test(script)) {
    suggestions.push('存在书面语或废话开场，需要更直接的钩子');
  }
  
  // 检查画面感
  if (!script.includes('【镜头') && !script.includes('**镜头')) {
    suggestions.push('缺少详细的镜头和画面描述');
  }
  
  return suggestions.join('；') || '无明显问题，继续优化细节';
}

