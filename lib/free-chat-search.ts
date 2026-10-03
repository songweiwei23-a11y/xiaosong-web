/** 长问题同时要求读附件和联网时，优先搜索用户明确提出的联网部分。 */
export function freeChatSearchQuery(question: string): string {
  const input = question.replace(/\s+/g, ' ').trim();
  const matches = Array.from(input.matchAll(/(?:联网|上网)(?:搜索|查询|查找|查|核实)?|搜索一下|查一下|查询一下/g));
  const start = matches.at(-1)?.index;
  return (start === undefined ? input : input.slice(start)).slice(0, 200) || '短视频编导';
}
