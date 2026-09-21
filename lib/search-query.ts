// 知识库检索查询构建
//
// 背景：发给模型的 query 是拼装出来的完整指令（账号定位可达 4800+ 字符），
// 其中绝大部分是输出格式、禁止事项、示例模板等约束，与知识库里的编导方法论
// 没有语义关联。若直接拿它做向量检索，真正的检索意图会被严重稀释，
// 知识库内容越丰富，召回越不准。
//
// 因此检索与生成分离：生成仍用完整长指令，检索改用此处构建的短查询，
// 由 Dify 工作流的 5 个知识检索节点通过 start.search_query 消费。

/** 各任务对应的检索主题词，用于把检索意图锚定到知识库的对应领域 */
export const SEARCH_TOPIC_HINT: Record<string, string> = {
  脚本生成: '短视频脚本创作 脚本公式 开篇钩子',
  选题策划: '选题策划 爆款选题方法 八大爆款元素',
  分镜脚本: '分镜脚本 镜头语言 景别 运镜 拍摄执行',
  审稿优化: '短视频脚本审稿 优化 质量诊断',
  账号定位: '账号定位 IP定位 赛道选择 人群画像',
  标题封面: '短视频标题 封面文案',
  成交理由: '成交理由 商家变现 转化',
  知识库查询: '',
  自由对话: '',
};

/**
 * 这些字段要么是长正文（用户提供的脚本原文、档案、对标稿），
 * 要么是控制参数，放进检索查询只会引入噪声。
 */
export const SEARCH_SKIP_FIELDS = new Set([
  'query',
  'taskType',
  'conversationHistory',
  'sessionId',
  'saveHistory',
  'draftContent',
  'scriptContent',
  'benchmarkScript',
  'profileInfo',
  'additionalInfo',
  'additionalNotes',
  'positioningExtra',
]);

/** 单个字段值超过此长度就认为是正文而非选择项，不纳入检索查询 */
const MAX_FIELD_LEN = 60;
/** 检索查询总长上限，超出会稀释语义 */
const MAX_QUERY_LEN = 200;

const squash = (s: unknown, n: number) =>
  String(s ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, n);

/**
 * 构建知识库检索专用的短查询。
 *
 * 不依赖具体字段名——各功能页传参结构并不统一（topic 页传 query+inputs，
 * script/storyboard/title 页传前端拼好的完整 query），因此这里按
 * "短字符串即用户选择项" 的启发式收集，并对纯 query 型页面回退到取其开头。
 */
export function buildSearchQuery(
  taskType: string,
  body: Record<string, unknown>,
  originalQuery: string
): string {
  const parts: string[] = [];

  const hint = SEARCH_TOPIC_HINT[taskType];
  if (hint) parts.push(hint);

  const collect = (obj: unknown) => {
    if (!obj || typeof obj !== 'object') return;
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (SEARCH_SKIP_FIELDS.has(k)) continue;
      if (k === 'inputs') {
        collect(v);
        continue;
      }
      if (typeof v === 'string') {
        const t = v.trim();
        if (t && t.length <= MAX_FIELD_LEN) parts.push(t);
      }
    }
  };
  collect(body);

  // 由前端拼好完整 query 的页面取不到结构化字段，
  // 退而取其开头一段——核心意图通常就在最前面。
  if (parts.length <= 1) parts.push(squash(originalQuery, 120));

  const q = squash(parts.join(' '), MAX_QUERY_LEN);
  return q || squash(originalQuery, 120) || '短视频编导';
}
