/**
 * 从完整的账号定位内容中提取选题策划相关的核心信息
 * 只保留：账号核心定位、目标用户、差异化优势等战略层信息
 * 移除：内容配比、拍摄方向、15天计划等执行层信息
 */
export function extractStrategySummary(fullContent: string): string {
  if (!fullContent) return '';
  
  const lines = fullContent.split('\n');
  let relevantContent = '';
  let skipSection = false;
  
  for (const line of lines) {
    // 黑名单：需要跳过的章节和内容
    if (
      line.includes('15天冷启动') ||
      line.includes('Day ') ||
      line.includes('执行计划') ||
      line.includes('Day1') ||
      line.includes('Day2') ||
      line.includes('变现路径') ||
      line.includes('时间节点') ||
      line.includes('数据指标') ||
      line.includes('发布时间') ||
      line.includes('内容战略矩阵') ||
      line.includes('人设IP完整设计') ||
      line.includes('对标账号参考') ||
      line.includes('参考账号') ||
      line.includes('视觉呈现设计') ||
      line.includes('视觉呈现（') ||
      line.includes('话术风格设计') ||
      line.includes('独特记忆点') ||
      line.includes('内容配比') ||
      line.includes('内容方向与配比') ||
      line.includes('流量型内容') ||
      line.includes('变现型内容') ||
      line.includes('人设型内容') ||
      line.includes('流量型（') ||
      line.includes('变现型（') ||
      line.includes('人设型（') ||
      line.includes('拍摄方向') ||
      line.includes('拍摄目的') ||
      line.includes('占比') ||
      line.includes('发布节奏') ||
      line.includes('差异化卖点详细') ||
      line.includes('执行清单') ||
      line.includes('主赛道') ||
      line.includes('副赛道') ||
      line.includes('方向1：') ||
      line.includes('方向2：') ||
      line.includes('方向3：') ||
      line.includes('选题公式') ||
      line.includes('脚本类型') ||
      line.includes('**拍摄') ||
      line.includes('**目的**')
    ) {
      skipSection = true;
      continue;
    }
    
    // 遇到新的章节标题，检查是否在黑名单中
    if (line.startsWith('##') || line.startsWith('###')) {
      if (line.includes('内容方向与配比') || 
          line.includes('内容配比') ||
          line.includes('拍摄方向') ||
          line.includes('执行计划') ||
          line.includes('流量型') ||
          line.includes('变现型')) {
        skipSection = true;
      } else {
        skipSection = false;
      }
    }
    
    // 如果不在跳过区域，保留内容
    if (!skipSection && line.trim() !== '') {
      relevantContent += line + '\n';
    }
  }
  
  // 如果提取失败，返回前800字符作为摘要
  if (relevantContent.trim().length < 50) {
    return fullContent.substring(0, 800) + '...';
  }
  
  return relevantContent.trim();
}

/**
 * 从完整的账号定位内容中提取脚本生成需要的执行层信息
 * 保留：人设标签、话术风格、视觉呈现、口头禅等
 * 移除：内容配比、发布节奏、15天计划等运营层信息
 */
export function extractScriptContext(fullContent: string): string {
  if (!fullContent) return '';
  
  const lines = fullContent.split('\n');
  let relevantContent = '';
  let inRelevantSection = false;
  
  for (const line of lines) {
    // 白名单：脚本需要的章节
    if (
      line.includes('人设三要素') ||
      line.includes('核心人设标签') ||
      line.includes('视觉呈现') ||
      line.includes('话术风格') ||
      line.includes('口头禅') ||
      line.includes('语气特点') ||
      line.includes('固定动作') ||
      line.includes('视觉符号') ||
      line.includes('结尾金句') ||
      line.includes('妆容设计') ||
      line.includes('穿搭设计') ||
      line.includes('拍摄场景') ||
      line.includes('道具')
    ) {
      inRelevantSection = true;
      relevantContent += line + '\n';
      continue;
    }
    
    // 黑名单：脚本不需要的章节
    if (
      line.includes('15天冷启动') ||
      line.includes('Day ') ||
      line.includes('内容配比') ||
      line.includes('内容方向与配比') ||
      line.includes('流量型内容') ||
      line.includes('变现型内容') ||
      line.includes('人设型内容') ||
      line.includes('发布节奏') ||
      line.includes('周计划') ||
      line.includes('主赛道') ||
      line.includes('副赛道') ||
      line.includes('方向1：') ||
      line.includes('方向2：') ||
      line.includes('方向3：') ||
      line.includes('选题公式') ||
      line.includes('例子：') ||
      line.includes('脚本类型：')
    ) {
      inRelevantSection = false;
      continue;
    }
    
    // 遇到新章节，判断是否继续
    if (line.startsWith('##') || line.startsWith('###')) {
      if (line.includes('人设IP') || line.includes('视觉') || line.includes('话术')) {
        inRelevantSection = true;
      } else if (line.includes('内容战略') || line.includes('发布') || line.includes('冷启动')) {
        inRelevantSection = false;
      }
    }
    
    // 如果在相关区域，保留内容
    if (inRelevantSection && line.trim() !== '') {
      relevantContent += line + '\n';
    }
  }
  
  // 如果提取失败，返回空字符串
  if (relevantContent.trim().length < 20) {
    return '';
  }
  
  return relevantContent.trim();
}
