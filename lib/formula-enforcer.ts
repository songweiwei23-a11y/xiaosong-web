// 阶段2优化模块3：脚本公式强化执行

/**
 * 确保脚本严格按照公式结构生成
 * 避免结构混乱、逻辑跳跃
 */

export type FormulaType =
  | 'compare'     // 对比型公式
  | 'solve'       // 解题型公式
  | 'recommend'   // 推荐型公式
  | 'story';      // 故事型公式

export interface FormulaStructure {
  name: string;
  description: string;
  sections: FormulaSection[];
  timeAllocation: Record<string, string>;
  keyPoints: string[];
}

export interface FormulaSection {
  name: string;
  timeRange: string;
  purpose: string;
  mustInclude: string[];
  example: string;
}

/**
 * 获取公式详细结构
 */
export function getFormulaStructure(formulaType: FormulaType): FormulaStructure {
  const formulas: Record<FormulaType, FormulaStructure> = {
    compare: {
      name: '对比型公式',
      description: '通过A方案（错误）vs B方案（正确）的对比，揭示差距和原因',
      sections: [
        {
          name: '开场钩子',
          timeRange: '0-8秒',
          purpose: '用极端对比抓住注意力',
          mustInclude: [
            '两个极端案例（成功 vs 失败）',
            '具体数字对比',
            '提出差距疑问'
          ],
          example: '我见过最快的3天涨粉2000，也见过最慢的3个月还是0——差距就在这3件事上'
        },
        {
          name: 'A方案：错误做法',
          timeRange: '8-25秒',
          purpose: '展示大部分人的错误做法和后果',
          mustInclude: [
            '"大部分人/很多人是这么干的"',
            '具体错误行为描述',
            '导致的负面结果',
            '痛点共鸣：😓'
          ],
          example: '大部分人是这么干的：拍完就发，发完就等，等着等着就凉了。为啥？因为系统根本不知道把你的视频推给谁'
        },
        {
          name: 'B方案：正确做法',
          timeRange: '25-45秒',
          purpose: '展示会玩的人的正确做法',
          mustInclude: [
            '"但会玩的人/高手是这么做的"',
            '具体正确步骤（分步骤说明）',
            '为什么这样做有效',
            '顿悟波点：💡'
          ],
          example: '但会玩的人，发布前会先做这个：打开同类爆款视频，刷5条，点赞2条，评论1条。说人话就是：先告诉系统你是干啥的'
        },
        {
          name: '差异揭示',
          timeRange: '45-52秒',
          purpose: '总结AB差异的根本原因',
          mustInclude: [
            '"这就是为什么..."',
            '揭示本质原因/底层逻辑',
            '金句总结',
            '情绪高潮：⚡'
          ],
          example: '这就是为什么同样的内容，人家3天2000粉，你3个月还在原地踏步。抖音不是拍给自己看的，是拍给算法要流量的'
        },
        {
          name: '行动召唤',
          timeRange: '52-60秒',
          purpose: '给出具体行动指令',
          mustInclude: [
            '金句',
            'CTA行动指令',
            '降低行动门槛'
          ],
          example: '记住：涨粉不靠运气，靠懂规则。评论区扣1，我教你找对标账号的方法'
        }
      ],
      timeAllocation: {
        '开场': '0-8秒（13%）',
        'A方案': '8-25秒（28%）',
        'B方案': '25-45秒（33%）',
        '差异揭示': '45-52秒（12%）',
        '行动召唤': '52-60秒（14%）'
      },
      keyPoints: [
        '对比要极端，制造强烈反差',
        'A方案要有痛点共鸣',
        'B方案要有具体步骤',
        '必须揭示本质原因',
        '金句要总结核心道理'
      ]
    },
    
    solve: {
      name: '解题型公式',
      description: '提出问题 → 分析原因 → 给出解决方案',
      sections: [
        {
          name: '问题呈现',
          timeRange: '0-10秒',
          purpose: '抛出用户关心的具体问题',
          mustInclude: [
            '具体问题场景',
            '痛点描述',
            '用户共鸣点：🤝'
          ],
          example: '为什么你的视频播放量总是卡在500？问题出在这3个地方'
        },
        {
          name: '原因分析',
          timeRange: '10-35秒',
          purpose: '分步骤剖析问题原因',
          mustInclude: [
            '第一、第二、第三（清晰分点）',
            '每个原因的具体表现',
            '为什么会导致问题'
          ],
          example: '第一，开场太废话；第二，内容不垂直；第三，没给系统打标签'
        },
        {
          name: '解决方案',
          timeRange: '35-55秒',
          purpose: '给出可执行的解决步骤',
          mustInclude: [
            '对应每个原因的解决方法',
            '具体操作步骤',
            '预期效果'
          ],
          example: '怎么改？第一步...第二步...第三步...'
        },
        {
          name: '总结强调',
          timeRange: '55-60秒',
          purpose: '强化记忆点和行动',
          mustInclude: [
            '金句',
            'CTA'
          ],
          example: '记住：问题不可怕，可怕的是不知道问题在哪。点赞收藏，照着做'
        }
      ],
      timeAllocation: {
        '问题': '0-10秒（17%）',
        '原因': '10-35秒（42%）',
        '方案': '35-55秒（33%）',
        '总结': '55-60秒（8%）'
      },
      keyPoints: [
        '问题要具体，不要泛泛而谈',
        '原因要分点说清楚',
        '方案要可执行，有具体步骤',
        '总结要简洁有力'
      ]
    },
    
    recommend: {
      name: '推荐型公式',
      description: '制造好奇 → 展示亮点 → 给出行动',
      sections: [
        {
          name: '反常识开场',
          timeRange: '0-5秒',
          purpose: '用反常识制造好奇和反差',
          mustInclude: [
            '反常识行为描述',
            '制造悬念',
            '好奇波点：🔍'
          ],
          example: '这家店我来了8次才敢推荐！人均80块，但很多人吃一次就再也不来了'
        },
        {
          name: '秘诀揭示',
          timeRange: '5-25秒',
          purpose: '分步骤展示独家秘诀/亮点',
          mustInclude: [
            '第一、第二、第三秘诀',
            '每个秘诀的具体内容',
            '为什么别人不知道'
          ],
          example: '第一，别点招牌菜；第二，一定要晚上8点后来；第三，别自己点'
        },
        {
          name: '价值证明',
          timeRange: '25-28秒',
          purpose: '强化推荐理由和价值',
          mustInclude: [
            '性价比说明',
            '独特价值',
            '真实体验感受'
          ],
          example: '记住这3点，80块吃出200块的体验'
        },
        {
          name: '行动转化',
          timeRange: '28-30秒',
          purpose: '引导用户行动',
          mustInclude: [
            '金句',
            'CTA（团购链接/到店）'
          ],
          example: '好吃不难找，难的是吃对方法。团购链接在左下角'
        }
      ],
      timeAllocation: {
        '开场': '0-5秒（17%）',
        '秘诀': '5-25秒（67%）',
        '价值': '25-28秒（10%）',
        '转化': '28-30秒（6%）'
      },
      keyPoints: [
        '开场必须反常识，制造悬念',
        '秘诀要独家，别人不知道',
        '价值要具体，不说空话',
        'CTA要明确转化路径'
      ]
    },
    
    story: {
      name: '故事型公式',
      description: '困境 → 转折 → 成功 → 启发',
      sections: [
        {
          name: '困境呈现',
          timeRange: '0-15秒',
          purpose: '展示主人公的困境和痛苦',
          mustInclude: [
            '具体困境场景',
            '金钱/时间数据',
            '情绪低谷：😰'
          ],
          example: '3个月前，我账上只剩2800块，房租都快交不起了。每天早上5点起来备菜，晚上12点才收摊'
        },
        {
          name: '转折点',
          timeRange: '15-30秒',
          purpose: '遇到改变的契机',
          mustInclude: [
            '转折事件',
            '关键决定',
            '初步尝试',
            '顿悟波点：💡'
          ],
          example: '直到有一天，一个顾客跟我说：你手艺这么好，干嘛不拍抖音？我当时觉得，拍抖音能干嘛？但我还是试了试'
        },
        {
          name: '成功展示',
          timeRange: '30-50秒',
          purpose: '展示改变后的结果',
          mustInclude: [
            '具体成果数据',
            '生活改变',
            '情感高潮：⚡'
          ],
          example: '没想到第一条视频就爆了，一天涨粉5000！现在我每天拍15分钟视频，客人自己找上门，排队都要等1小时'
        },
        {
          name: '启发总结',
          timeRange: '50-60秒',
          purpose: '提炼普适价值和行动',
          mustInclude: [
            '励志金句',
            'CTA行动鼓励'
          ],
          example: '记住：穷不可怕，可怕的是不敢改变。如果你也想翻身，评论区扣1，我教你怎么拍第一条'
        }
      ],
      timeAllocation: {
        '困境': '0-15秒（25%）',
        '转折': '15-30秒（25%）',
        '成功': '30-50秒（33%）',
        '启发': '50-60秒（17%）'
      },
      keyPoints: [
        '困境要具体，有画面感',
        '转折要戏剧化，有命运感',
        '成功要有数据对比',
        '金句要励志，引发共鸣'
      ]
    }
  };
  
  return formulas[formulaType];
}

/**
 * 生成公式执行指南
 */
export function generateFormulaGuide(formulaType: FormulaType): string {
  const formula = getFormulaStructure(formulaType);
  const sections: string[] = [];
  
  sections.push(`# 📐 ${formula.name}执行指南\n`);
  sections.push(`**公式说明**：${formula.description}\n`);
  
  // 1. 时间分配
  sections.push('## ⏱️ 时间分配\n');
  Object.entries(formula.timeAllocation).forEach(([section, time]) => {
    sections.push(`- **${section}**：${time}`);
  });
  
  // 2. 分段结构
  sections.push('\n## 📋 分段结构（严格执行）\n');
  formula.sections.forEach((section, index) => {
    sections.push(`### ${index + 1}. ${section.name}（${section.timeRange}）\n`);
    sections.push(`**目的**：${section.purpose}\n`);
    sections.push(`**必须包含**：`);
    section.mustInclude.forEach(item => {
      sections.push(`- ${item}`);
    });
    sections.push(`\n**参考示例**：`);
    sections.push(`"${section.example}"\n`);
  });
  
  // 3. 关键要点
  sections.push('## ✅ 关键要点\n');
  formula.keyPoints.forEach((point, index) => {
    sections.push(`${index + 1}. ${point}`);
  });
  
  // 4. 执行检查
  sections.push('\n## 🎯 执行检查清单\n');
  sections.push('生成脚本后，必须检查：');
  formula.sections.forEach((section, index) => {
    sections.push(`- [ ] ${section.name}：是否包含所有必备元素？`);
  });
  sections.push('- [ ] 时间分配：是否符合比例要求？');
  sections.push('- [ ] 逻辑连贯：各部分是否自然衔接？');
  sections.push('- [ ] 情绪曲线：是否有层层递进？');
  
  return sections.join('\n');
}

/**
 * 根据脚本类型智能推荐公式
 */
export function recommendFormula(scriptType: string, structureHint?: string): FormulaType {
  // 优先使用用户明确指定的结构
  if (structureHint) {
    const structureMap: Record<string, FormulaType> = {
      '对比': 'compare',
      '对比型': 'compare',
      '解题': 'solve',
      '解题型': 'solve',
      '推荐': 'recommend',
      '推荐型': 'recommend',
      '故事': 'story',
      '故事型': 'story'
    };
    
    if (structureMap[structureHint]) {
      return structureMap[structureHint];
    }
  }
  
  // 根据脚本类型推荐
  if (scriptType.includes('teach') || scriptType.includes('教知识')) {
    return 'compare'; // 教知识默认用对比型
  }
  
  if (scriptType.includes('recommend') || scriptType.includes('晒过程')) {
    return 'recommend'; // 推荐类用推荐型
  }
  
  if (scriptType.includes('story') || scriptType.includes('讲故事')) {
    return 'story'; // 故事类用故事型
  }
  
  // 默认用对比型（最通用）
  return 'compare';
}