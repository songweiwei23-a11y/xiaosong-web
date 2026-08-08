// MCN级提示词增强函数（优化版 - 减少30%冗余）
export function enhancePromptWithMCNStandards(params: {
  structureDetail: any;
  hookDetail: any;
  elementsWithNames: string;
  duration: string;
  isAd: boolean;
  dealReasonsCount: number;
}) {
  const { structureDetail, hookDetail, elementsWithNames, duration, isAd, dealReasonsCount } = params;
  
  // ========== 智能判断：大流量脚本 vs 变现类脚本 ==========
  const isMonetization = dealReasonsCount > 0 || isAd;
  const scriptGoal = isMonetization ? "变现转化" : "大流量涨粉";
  const ctaType = isMonetization ? "到店/团购/加微信" : "点赞/评论/关注";
  const contentFocus = isMonetization ? "成交理由具体化" : "价值输出饱满";
  
  const structureGuide = `
## 🎯 脚本创作框架（MCN级标准）

### 脚本结构：${structureDetail.name}
**公式**：${structureDetail.formula}

**必须做到**：
${structureDetail.keyPoints.map((p: string, i: number) => `${i+1}. ${p}`).join('\n')}

**必须避免**：
${structureDetail.avoidMistakes.map((m: string) => `❌ ${m}`).join('\n')}
`;

  const hookGuide = `
### 开场钩子要求（前3秒生死线）

**具体要求**：
${hookDetail.requirements.map((r: string) => `- ${r}`).join('\n')}

**黄金原则**：
- 第1秒：必须有冲突/悬念/利益点/反常识之一
- 第2秒：放大冲突或制造好奇
- 第3秒：给出承诺或引发期待
`;

  // ========== 核心优化：大幅简化格式要求 ==========
  const formatRequirements = `
## 🎯 脚本目标：${scriptGoal}

${isMonetization ? `
**变现类脚本核心**：
- 开场：直击痛点或展示利益（3秒内）
- 中段：${contentFocus}，每个成交理由要有具体场景
- 结尾：强行动指令（${ctaType}）+ 降低决策门槛
` : `
**大流量类脚本核心**：
- 开场：制造悬念或情感共鸣（3秒内）
- 中段：${contentFocus} + 干货实用
- 结尾：升华主题 + 自然引导（${ctaType}）
`}

---

## ✅ 输出格式要求

⚠️ **重要**：请严格参考上下文知识库中的【MCN级脚本示例】

**必须包含**：
- 开场钩子（0-X秒）：钩子类型标注 + 波点标注
- 中段展开：按${structureDetail.name}公式展开
- 情绪高潮（X-X秒）：⚡最强波点标注
- 结尾收口（X-${duration}）：金句（≤20字）+ 行动指令（${ctaType}）

**每个镜头必须包含**：
- **镜头X**（X-X秒）
- **台词**："[大白话台词]"
- **情绪**：[语速、重读、语气]
- **画面**：[具体画面描述]
- **动作**：[手势、表情]

**质量检查点**：
- [ ] 第1秒是钩子吗？
- [ ] 有3个情绪波点吗？
- [ ] 每句台词都是大白话吗？
- [ ] ${elementsWithNames}这些爆款元素都用上了吗？
- [ ] 结尾有金句和行动指令吗？
- [ ] 总时长控制在${duration}吗？

${isMonetization ? `
**变现类检查重点**：
✓ 成交理由是否具体体现？（不能只提及，要有场景）
✓ 行动指令是否明确？（到哪里、怎么做、什么福利）
✓ 转化门槛是否降低？（限时优惠、赠品福利）
` : `
**大流量类检查重点**：
✓ 价值输出是否饱满？（用户能学到什么）
✓ 情感共鸣是否到位？（是否戳中痛点）
✓ 互动引导是否自然？（不硬广、不说教）
`}

---

💡 **核心原则**：说人话、有画面、带情绪、${isMonetization ? '能转化' : '有价值'}

📚 **详细格式标准和优秀案例请参考上下文知识库**
`;

  return {
    structureGuide,
    hookGuide,
    formatRequirements
  };
}
