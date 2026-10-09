/**
 * 从脚本生成结果里取出「第2步：纯文字文案」——只有要念出来的话，方便复制去提词器、配音。
 *
 * 取不到（旧的结果、模型没按格式写）返回空串，调用方自己决定退回什么。
 */
export function extractPlainCopy(markdown: string): string {
  if (!markdown) return "";
  const lines = markdown.split("\n");
  const start = lines.findIndex((l) => /^#{1,4}\s*.*纯(?:文字)?文案/.test(l.trim()));
  if (start === -1) return "";

  const body: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i];
    // 到下一个标题或分隔线为止
    if (/^#{1,4}\s/.test(l.trim()) || /^-{3,}\s*$/.test(l.trim())) break;
    body.push(l);
  }

  return body
    .join("\n")
    // 模型有时会包一层代码块
    .replace(/^\s*```[a-z]*\s*$/gim, "")
    .split("\n")
    // 保险：万一还是带了列表符号、加粗、引号框，去掉，只留要念的字
    .map((l) => l.replace(/^\s*(?:[-*>]\s+|\d+[.、)]\s*)/, "").replace(/\*\*(.+?)\*\*/g, "$1").trim())
    // 真实产出有时把采访执行标记混入这一节；复制和后续生成只带已知台词。
    .filter((l) => !/^[（(【\[].*[）)】\]]$/.test(l)
      || !/按现场真实回答|根据(?:现场)?回答|^.[第一二三四五六七八九十\d]+家店|到达第|移动到第|继续追问|重复.{0,8}家店/.test(l))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
