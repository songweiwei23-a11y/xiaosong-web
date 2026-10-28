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
    open: '用一个爆款元素做看点（反差、奇葩、人群、成本等），3秒内让陌生人停下来',
    middle: '围绕人、货、场展开，至少符合有用、有趣、有共鸣中的一条；形式（36计或四大脚本）在爆款元素定好之后再选',
    checks: [
      '有没有用上至少一个爆款元素，并且在画面或台词里看得见（不能只写在标题里）？',
      '是否围绕人、货、场，并至少符合有用、有趣、有共鸣中的一条？',
      '结尾只留关注或评论，不带成交理由、不引导私信或到店？',
    ],
  },
  人设型: {
    open: '一个具体的举动或"这个人就是这样"的瞬间（3秒内）',
    middle: '真实的性格、人品、行为或举动，配真实经历（成长、职业、与客户家人员工的相处、价值边界），靠细节验证，不靠形容词',
    checks: [
      '是不是一个具体的人、具体的事，而不是"专业、靠谱"这种形容词？',
      '素材是否真实，有没有编造或煽情过度？',
      '结尾是否自然、真实（关注或看主页），不带成交理由？',
    ],
  },
  变现型: {
    open: '直击目标客人的难题，把要突出的成交理由摆在前面（3秒内）',
    middle: '围绕人、货、场，突出一个成交理由（用户为什么选你），要在画面、过程或结果里看得见；形式不限，晒过程、教知识、案例都可以',
    checks: [
      '成交理由是否有依据，并且在画面、过程或结果里看得见（不能只提一句）？',
      '行动指令是否明确（去哪、怎么做）且只有一个（私信、到店或留资）？',
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
- 尽早交代观众关心的具体问题、动作或现场信息；不强制每秒一句话
- 悬念、冲突、利益点与反常识只在材料确实支持时使用，不预设反转
- 开头许下的内容要由正文兑现，采访尚无答案时以问题切入
`;

  const formatRequirements = `
## 🎯 脚本目标：${role}（${ROLE_SPECS[role].job}）

- 开场：${craft.open}
- 中段：${craft.middle}
- 结尾：按这条的目的给一个行动指令（${cta}），只要一个；只有用户明确说不要结尾指令时才自然收束

---

## ✅ 输出格式要求

⚠️ **重要**：请严格参考上下文知识库中的【MCN级脚本示例】

**必须包含**：
- 开场（0-X秒）：清楚而有吸引力的切口；钩子与情绪提示按内容需要标注
- 中段展开：按${structureDetail.name}公式展开
- 信息递进：按材料和内容形式推进，不预设情绪高潮
- 结尾收口（X-${duration}）：兑现当前问题；有适合的金句才用，行动指令按用户目的决定

**每个镜头必须包含**：
- **镜头X**（X-X秒）
- **台词**："[大白话台词]"
- **情绪**：[语速、重读、语气]
- **画面**：[具体画面描述]
- **动作**：[手势、表情]

**质量检查点**：
- [ ] 开头是否切中核心问题，正文是否兑现？
- [ ] 信息与真实情绪是否自然递进，而非凑波点数量？
- [ ] 每句台词都是大白话吗？
- [ ] ${elementsWithNames}这些爆款元素都用上了吗？
- [ ] 结尾是否符合原意，没有多余金句或营销动作？
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
