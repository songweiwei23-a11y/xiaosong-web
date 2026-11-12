import { ROLE_SPECS, type ContentRole } from './content-roles';

/*
 * 每种目的的"开场 / 中段 / 结尾"写法和自查重点。
 *
 * 原来这里是二选一：勾了成交理由或是广告 → "变现转化"，否则 → "大流量涨粉"，
 * 大流量的结尾写着"点赞/评论/关注"、变现写着"到店/团购/加微信"——一次要三个，
 * 正是 SOP 说的"三个都要 = 三个都失败"；人设型整个没有。
 * 定义统一从 lib/content-roles 取。
 */
const ROLE_CRAFT: Record<ContentRole, { open: string; middle: string; checks: string[] }> = {
  流量型: {
    open: '制造悬念、反认知或情绪共鸣（3秒内）',
    middle: '观点 + 论据，给情绪价值（和观众站在一起），覆盖面要广',
    checks: [
      '话题是不是目标人群也关心的（人群垂直，不是随便蹭热闹）？',
      '有没有让人想转发、想评论的点？',
      '结尾是不是只要了一个动作（关注或评论）？',
    ],
  },
  人设型: {
    open: '结果前置或那一刻的画面（3秒内）',
    middle: '真实经历里的阻碍和转机，靠细节验证，不靠形容词',
    checks: [
      '是不是一个具体的人、具体的事，而不是"专业、靠谱"这种形容词？',
      '有没有编造或煽情过度？',
      '结尾是不是只要了一个动作（关注或看主页）？',
    ],
  },
  变现型: {
    open: '直击痛点或展示结果（3秒内）',
    middle: '落在一个成交理由上，晒过程或教知识，先给价值再谈成交',
    checks: [
      '成交理由有没有具体场景（不能只提一句）？',
      '行动指令是否明确（去哪、怎么做、有什么福利）且只有一个？',
      '是不是硬广（只讲产品不讲用户关心什么）？',
    ],
  },
};

// MCN级提示词增强函数
export function enhancePromptWithMCNStandards(params: {
  structureDetail: any;
  hookDetail: any;
  elementsWithNames: string;
  duration: string;
  /** 这条视频的目的 */
  role: ContentRole;
}) {
  const { structureDetail, hookDetail, elementsWithNames, duration, role } = params;
  const craft = ROLE_CRAFT[role];
  const cta = ROLE_SPECS[role].cta;

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

  const formatRequirements = `
## 🎯 脚本目标：${role}（${ROLE_SPECS[role].job}）

- 开场：${craft.open}
- 中段：${craft.middle}
- 结尾：金句 + **一个**行动指令（${cta}）

---

## ✅ 输出格式要求

⚠️ **重要**：请严格参考上下文知识库中的【MCN级脚本示例】

**必须包含**：
- 开场钩子（0-X秒）：钩子类型标注 + 波点标注
- 中段展开：按${structureDetail.name}公式展开
- 情绪高潮（X-X秒）：⚡最强波点标注
- 结尾收口（X-${duration}）：金句（≤20字）+ 一个行动指令

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

**${role}检查重点**：
${craft.checks.map((c) => `✓ ${c}`).join('\n')}

---

💡 **核心原则**：说人话、有画面、带情绪、一条视频只干一件事

📚 **详细格式标准和优秀案例请参考上下文知识库**
`;

  return {
    structureGuide,
    hookGuide,
    formatRequirements
  };
}
