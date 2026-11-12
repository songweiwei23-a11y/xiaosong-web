const fs=require('fs'),path=require('path');
function edit(file,fn){let original=fs.readFileSync(file,'utf8'),s=original.replace(/\r\n/g,'\n');const b=path.join('.tmp/craft-fix-baseline_20261007',file);if(!fs.existsSync(b)){fs.mkdirSync(path.dirname(b),{recursive:true});fs.writeFileSync(b,original);}function r(a,b){if(!s.includes(a))throw Error(`Missing ${file}: ${a.slice(0,60)}`);s=s.replace(a,b);}function block(a,b,t){let x=s.indexOf(a),y=s.indexOf(b,x);if(x<0||y<0)throw Error('Missing block '+file);s=s.slice(0,x)+t+s.slice(y);}fn(r,block);fs.writeFileSync(file,s);}
edit('lib/review-standards.ts',(r,b)=>{
 r("import { AI_LENGTH_RULE", "import { resultStats } from './script-result-utils';\nimport { AI_LENGTH_RULE");
 b('function rubricTable()', '/**\n * 用代码先量', `function rubricTable(): string {
  return [
    '| 维度 | 权重 | 达标的含义 |', '|---|---|---|',
    '| 核心目的与开场钩子 | 20 分 | 切中用户核心问题、立场与人群，开头承诺能由正文兑现，不强制3秒冲突 |',
    '| 信息递进与情绪波点适配 | 20 分 | 主体有具体问题、有效细节与递进；情绪服务真实内容，不要求数量或符号 |',
    '| 事实与证据 | 20 分 | 事实有材料支持，未知回答与结果不冒充事实；比较口径一致，追问能获得证据 |',
    '| 表达与人设 | 15 分 | 清楚自然、符合用户口吻，采访保留真实原话，不套统一俚语 |',
    '| 拍摄执行与时长 | 15 分 | 镜头、资源、台词与时长可执行；纯文字或局部优化不因缺镜头标注扣分 |',
    '| 收束与目的兑现 | 10 分 | 核心问题得到回应；金句与行动指令仅在内容和用户目的需要时使用 |',
  ].join('\\n');
}

`);
 b('function machineFindings(draft: string)', '/** 把话术禁忌', `function machineFindings(draft: string): string {
  const timingCount = (draft.match(/\\d+\\s*-\\s*\\d+\\s*秒/g) || []).length;
  const emotionCount = (draft.match(/(?:😰|😓|💕|🤝|⚡)|波点/g) || []).length;
  const shotCount = (draft.match(/【?镜头\\s*\\d*】?/g) || []).length;
  const stats = resultStats(draft);
  return [
    '## 🔍 系统预检结果（格式计数，仅作线索）', '',
    \`- 可识别口播：\${stats.spokenChars} 字，按口播5字/秒约 \${stats.seconds} 秒；待采访回答与动作时长需实拍后确定\`,
    \`- 时间区间标注：**\${timingCount} 处**；镜头编号：**\${shotCount} 处**\`,
    \`- 情绪波点标记：**\${emotionCount} 处**，不设数量达标线\`,
    '- 系统初判得分：不采用固定格式分；请按本次内容适用的编辑标准判断。',
    '缺少金句、CTA、emoji或秒数标签不等于内容差；不需要的项目不用补。用户只改局部时只评和改那一部分。',
  ].join('\\n');
}

`);
 r('那一计的结构公式是不是真落在片子的事件上，还是只在开头提了一句。没落上的算问题。', '检查用户明确采用的那一计是否服务核心目的；若只是候选标签，不能据此重写真实事件。合适的节点要落实，不合适的说明理由，不编素材去凑公式。');
 r('目的和结构、结尾指令对不上的，列进问题清单', '实际内容违背用户目的、人群、立场或限制的，列进问题清单');
 r('这套标准与本产品的脚本生成模块完全一致——同一篇稿子在两边应当得到同一个分数。', '这是当前稿件的编辑判断，不是程序验证结果；分数不能证明事实真实或传播效果。金句、CTA、波点不适用时不扣分，也不为了评分强行补入。');
 r('7.0-8.0 及格但不建议直接拍，7.0 以下不合格必须重写。', '7.0-8.0表示还有明确改进点；低于7.0先解释问题，改动范围服从用户要求，不自动推翻原稿。');
 r("parts.push(getRelevantExample(p.scriptType || '教知识型', p.duration && p.duration !== AI_DURATION ? p.duration : '', ''));", "if (/教知识|测评/.test(p.scriptType)) parts.push(getRelevantExample(p.scriptType, p.duration && p.duration !== AI_DURATION ? p.duration : '', ''));\n  else parts.push('先辨认稿件形式。采访保留主问、具体追问、不同回答与证据，未知回答保持待实拍；观察保留现场信息；讨论保留论点与依据。不要拿教学或广告范例改写其他形式。');");
 r('- **视频目的**：流量型 / 人设型 / 变现型，目的、结构、结尾指令是否一致', '- **用户目的与核心问题**：明确当前要解决什么、给谁看、哪些不做；混合目的照原要求保留');
 r('直接给出可以拿去拍的完整版本，保留秒数、镜头、台词、情绪、画面五要素，', '按当前内容形式给出可用完整版本；原稿是纯文字或用户只改局部时不强行扩成五要素镜头稿，已有镜头稿保留适用的秒数、镜头、台词与画面，');
 r('并确保它自己能通过上面那套评分标准（目标 9.0 分以上）。', '重点解决核心问题、信息深度、依据和执行性，不为达到目标分数补金句、情绪高潮或营销结尾。采访尚未实拍时补具体追问与取证动作，不编受访者回答。');
 r('一句一行；结尾金句也写进去（不加"金句"两个字，也不加引号）', '一句一行；适用的自然收束原句保留，不强写金句，不把未知采访答案放进纯文案');
});
edit('lib/quality-checker.ts',(r)=>{
 r('evaluateScriptQualityStrict(script: string)', 'evaluateScriptQualityStrict(script: string, options: { adaptive?: boolean } = {})');
 r('for (const element of REQUIRED_ELEMENTS.basic)', "const basic = options.adaptive ? REQUIRED_ELEMENTS.basic.filter(e => e.id === 'timing' || e.id === 'scene') : REQUIRED_ELEMENTS.basic;\n  const advanced = options.adaptive ? [] : REQUIRED_ELEMENTS.advanced;\n  const applicableWeight = [...basic, ...advanced].reduce((n,e) => n + e.weight, 0);\n  for (const element of basic)");
 r('if (count >= element.minCount!)', 'if (count >= (options.adaptive ? 1 : element.minCount!))');
 r('for (const element of REQUIRED_ELEMENTS.advanced)', 'for (const element of advanced)');
 r('score = basicScore;', 'score = applicableWeight ? basicScore * 100 / applicableWeight : 0;');
 r('if (level2Violations.length > 0)', 'if (!options.adaptive && level2Violations.length > 0)');
 r('if (level3Violations.length > 0)', 'if (!options.adaptive && level3Violations.length > 0)');
});
console.log('Adaptive review and format inspection updated.');
