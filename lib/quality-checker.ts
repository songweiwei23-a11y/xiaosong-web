// ========== 阶段1：强制质量检查模块 ==========
// 目标：让脚本质量从8.4分提升到9.0分

// 1. MCN级脚本示例库（9.5分参考模板）
export const MCN_SCRIPT_EXAMPLES = {
  // 60秒教知识示例（对比型）
  teach_60s: `# 【开场钩子】0-8秒 | 💰金钱型+⚡反差

**【镜头1】0-3秒**
- **台词**："我见过最快的，拍抖音3天涨粉2000；也见过最慢的，3个月粉丝还是0——差距就在这3件事上。"
- **情绪**：开局语速快，"2000"和"0"要重读，制造极端对比
- **画面**：正对镜头，手势配合数字（竖起三根手指强调"3件事"），眼神坚定

**【镜头2】3-8秒**
- **台词**："你每天早上6点起来拍，发出去一看——播放量37，点赞3个，还有俩是你妈给的。听我把这3个差异讲透，能省你半年弯路。"
- **情绪**：前半段无奈+自嘲，后半段转为真诚劝告
- **画面**：模拟刷手机动作，从期待到失望的表情变化
- **波点标记**：😰 焦虑+共鸣波点

---

# 【中段展开】8-52秒

**第1差异（8-20秒）**
- **台词**："第一个差异——定位。涨粉快的人，一句话就能说清自己是干嘛的，比如'专教实体老板拍抖音获客'。涨粉慢的呢？今天拍美食，明天拍风景，后天又发鸡汤——用户根本不知道你是干嘛的，关注你干啥？"
- **波点标记**：🤝 共鸣波点

**第2差异（20-35秒）**
- **台词**："第二个差异——内容公式。会拍的人，开场3秒先抛钩子，比如数字对比、利益冲突。不会的呢？镜头一开就是'大家好我是XX，今天给大家分享……'——观众手指头都划走了。"
- **波点标记**：😓 学习+认同波点

**第3差异（35-52秒）⚡⚡ 情绪高潮**
- **台词**："第三个差异，也是最致命的——不懂用户要什么。做抖音不是展示你多厉害，而是解决用户的问题！你得天天想：我的粉丝是谁？他们有什么痛点？我的内容能帮他们解决什么？想不明白这3个问题，拍1000条也白费！"
- **情绪**：语速加快，音量提高，像在敲警钟
- **波点标记**：⚡⚡ 最强情绪波点

---

# 【收尾金句】52-60秒

**【镜头】**
- **台词**："所以记住这句话——**抖音不是拍给自己看的，是拍给用户要的！**定位、公式、用户思维，这3件事想明白了，涨粉只是时间问题。"
- **金句**："抖音不是拍给自己看的，是拍给用户要的"（15字）
- **画面**：手掌向前推，像在传递力量，眼神真诚坚定

---

**【CTA行动指令】**
"评论区扣1，我给你免费诊断账号问题。"`,

  // 30秒推荐型示例（美食探店）
  recommend_30s: `# 【开场钩子】0-5秒 | 🤪反常识

**【镜头1】0-5秒**
- **台词**："这家店我来了8次才敢推荐！人均80块，但很多人吃一次就再也不来了——因为他们不知道这3个点单秘诀。"
- **情绪**：语速快，"8次"重读，制造好奇
- **画面**：店门口，手里拿着菜单，表情神秘

---

# 【中段展开】5-25秒

**【镜头2】5-10秒 - 秘诀1**
- **台词**："第一，别点招牌菜！他们的招牌烤鱼太油腻，内行都点隐藏菜单——老板自己吃的麻辣香锅，只要68。"
- **画面**：指着菜单，做"嘘"的手势

**【镜头3】10-18秒 - 秘诀2 ⚡情绪波点**
- **台词**："第二，一定要晚上8点后来！白天的菜是中午剩的，8点后老板重新起锅，现炒的才够香。我上周中午来吃，差点把这家店踢出榜单。"
- **情绪**：带点愤怒+后悔
- **画面**：看手表，强调"8点后"

**【镜头4】18-25秒 - 秘诀3**
- **台词**："第三，别自己点！直接跟老板说'按你们家人标准来'，能省20%的钱，菜品还更好。"
- **画面**：跟老板对话的场景

---

# 【收尾金句】25-30秒

**【镜头5】**
- **台词**："**好吃不难找，难的是吃对方法。**记住这3点，80块吃出200块的体验。团购链接在左下角！"
- **金句**："好吃不难找，难的是吃对方法"（14字）
- **CTA**：团购链接购买`
};

// 2. 话术禁忌清单（必须强制检查）
export const FORBIDDEN_PHRASES = {
  // 一级禁忌：开场废话（直接判定不合格）
  level1: [
    "大家好我是",
    "今天我要分享",
    "今天给大家带来",
    "欢迎来到我的频道",
    "感谢大家观看",
    "Hello大家好",
    "嗨喽大家好",
  ],
  
  // 二级禁忌：书面语（扣分项）
  level2: [
    "综上所述",
    "通过以上分析",
    "根据调查显示",
    "由此可见",
    "总而言之",
    "首先其次最后",
    "第一点第二点",
  ],
  
  // 三级禁忌：空洞表达（必须具体化）
  level3: [
    "非常好",
    "特别棒",
    "超级赞",
    "真的很不错",
    "我觉得",
    "可能",
    "应该",
    "大概",
  ],
};

// 3. 必备元素检查清单
export const REQUIRED_ELEMENTS = {
  basic: [
    { id: "hook", name: "开场钩子", check: /开场钩子|0\s*-\s*\d+\s*秒/i, weight: 20 },
    { id: "emotion", name: "情绪波点", check: /[😰😓💕🤝⚡]|波点/i, weight: 20 },
    { id: "timing", name: "秒数标注", check: /\d+-\d+秒/g, minCount: 3, weight: 15 },
    { id: "scene", name: "镜头描述", check: /【?镜头\d*】?|画面[：:]/i, weight: 15 },
  ],
  
  advanced: [
    { id: "golden", name: "金句", check: /金句[^\n\u0022\u201C\u300C\u300E]{0,10}[\u0022\u201C\u300C\u300E]([^\n\u0022\u201D\u300D\u300F]{6,24})[\u0022\u201D\u300D\u300F]/, weight: 10 },
    { id: "cta", name: "行动指令", check: /评论区|扣1|点赞|关注|私信|到店|团购|左下角/i, weight: 10 },
    { id: "colloquial", name: "接地气表达", phrases: ["你妈", "手指头", "干嘛", "说人话", "你是不是也", "划走", "白费", "你猜"], minCount: 2, weight: 10 },
  ],
};

// 4. 质量评分函数（严格版）
export function evaluateScriptQualityStrict(script: string): {
  score: number;
  level: string;
  issues: string[];
  suggestions: string[];
  passCheck: boolean;
} {
  let score = 0;
  const issues: string[] = [];
  const suggestions: string[] = [];
  
  const level1Violations = FORBIDDEN_PHRASES.level1.filter(phrase => script.includes(phrase));
  if (level1Violations.length > 0) {
    issues.push(`致命错误：包含废话开场"${level1Violations.join('、')}"`);
    return {
      score: 0,
      level: "不合格",
      issues,
      suggestions: ["必须删除所有废话开场，直接用钩子开场"],
      passCheck: false,
    };
  }
  
  let basicScore = 0;
  
  for (const element of REQUIRED_ELEMENTS.basic) {
    if ('minCount' in element) {
      const matches = script.match(element.check as RegExp);
      const count = matches ? matches.length : 0;
      if (count >= element.minCount!) {
        basicScore += element.weight;
      } else if (count > 0) {
        basicScore += element.weight * 0.5;
        issues.push(`${element.name}不足：需要${element.minCount}处，实际${count}处`);
      } else {
        issues.push(`缺少${element.name}`);
      }
    } else {
      if (element.check && (element.check as RegExp).test(script)) {
        basicScore += element.weight;
      } else {
        issues.push(`缺少${element.name}`);
      }
    }
  }
  
  for (const element of REQUIRED_ELEMENTS.advanced) {
    if (element.check) {
      const match = script.match(element.check as RegExp);
      if (match) {
        if (element.id === "golden") {
          const sentence = match[1];
          if (sentence && sentence.length >= 8 && sentence.length <= 20) {
            basicScore += element.weight;
          } else {
            basicScore += element.weight * 0.5;
            suggestions.push(`金句长度不佳（${sentence?.length}字），建议8-20字`);
          }
        } else {
          basicScore += element.weight;
        }
      } else {
        issues.push(`缺少${element.name}`);
      }
    } else if (element.phrases) {
      const count = element.phrases.filter(phrase => script.includes(phrase)).length;
      if (count >= element.minCount!) {
        basicScore += element.weight;
      } else if (count > 0) {
        basicScore += element.weight * 0.5;
        suggestions.push(`接地气表达不足：需要${element.minCount}处，实际${count}处`);
      } else {
        issues.push(`缺少${element.name}（如"你妈给的点赞""手指头都划走了"）`);
      }
    }
  }
  
  score = basicScore;
  
  const level2Violations = FORBIDDEN_PHRASES.level2.filter(phrase => script.includes(phrase));
  if (level2Violations.length > 0) {
    score -= level2Violations.length * 5;
    issues.push(`存在书面语：${level2Violations.join('、')}`);
    suggestions.push("用口语化表达替换书面语");
  }
  
  const level3Violations = FORBIDDEN_PHRASES.level3.filter(phrase => script.includes(phrase));
  if (level3Violations.length > 0) {
    score -= level3Violations.length * 2;
    suggestions.push(`空洞表达需具体化：${level3Violations.join('、')}`);
  }
  
  score = Math.max(0, Math.min(100, score));
  const convertedScore = score / 10;
  
  let level = "";
  let passCheck = false;
  
  if (convertedScore >= 9.0) {
    level = "MCN级";
    passCheck = true;
  } else if (convertedScore >= 8.5) {
    level = "优秀";
    passCheck = true;
  } else if (convertedScore >= 8.0) {
    level = "良好";
    passCheck = true;
  } else if (convertedScore >= 7.0) {
    level = "及格";
    passCheck = false;
  } else {
    level = "不合格";
    passCheck = false;
  }
  
  return {
    score: convertedScore,
    level,
    issues,
    suggestions,
    passCheck,
  };
}

// 5. 获取示例脚本（智能推荐）
export function getRelevantExample(
  scriptType: string,
  duration: string,
  structureType: string
): string {
  const durationNum = parseInt(duration);
  
  if (scriptType.includes("ad")) {
    return MCN_SCRIPT_EXAMPLES.teach_60s;
  }
  
  if (durationNum <= 30) {
    return MCN_SCRIPT_EXAMPLES.recommend_30s;
  }
  
  if (scriptType === "teach" || structureType === "compare") {
    return MCN_SCRIPT_EXAMPLES.teach_60s;
  }
  
  return MCN_SCRIPT_EXAMPLES.teach_60s;
}

// 6. 格式化质量报告
export function formatQualityReport(evaluation: ReturnType<typeof evaluateScriptQualityStrict>): string {
  const scoreColor = evaluation.score >= 9 ? "🟢" : evaluation.score >= 8 ? "🟡" : "🔴";
  
  let report = `## ${scoreColor} 脚本质量评分\n\n`;
  report += `**得分**：${evaluation.score.toFixed(1)} / 10.0 分\n`;
  report += `**等级**：${evaluation.level}\n`;
  report += `**状态**：${evaluation.passCheck ? "✅ 达标" : "❌ 需要改进"}\n\n`;
  
  if (evaluation.issues.length > 0) {
    report += `### 发现的问题\n`;
    evaluation.issues.forEach(issue => {
      report += `- ${issue}\n`;
    });
    report += '\n';
  }
  
  if (evaluation.suggestions.length > 0) {
    report += `### 改进建议\n`;
    evaluation.suggestions.forEach(sug => {
      report += `- ${sug}\n`;
    });
  }
  
  return report;
}