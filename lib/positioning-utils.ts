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
