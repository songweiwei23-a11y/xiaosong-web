// 联网搜索整条流程取样（真实阿里云调用，只读，不写库，不扣用户额度）。输出只含来源域名、标题、发布时间和判定，不含密钥。
import { searchFreeChatWeb } from '../lib/free-chat-web';
import { getSearchConfig } from '../lib/search-config';

const QUERIES = [
  '今天有什么热搜',
  '今天国内有哪些重要新闻',
  '2026年抖音本地生活团购佣金比例',
  '短视频 广告 标识 新规 2026',
  '抖音本地生活 商家入驻 要求',
  'Dify 工作流 知识检索节点 参数',
  '抖音热榜 今日热点',
  '南乐县 今天 新闻',
  '什么是复利',
  '抖音热榜 今天',
  '郑州最近的热点新闻',
];

async function main() {
  const config = await getSearchConfig();
  if (!config) {
    console.log(JSON.stringify({ error: 'no-config' }));
    return;
  }
  console.log(JSON.stringify({ source: config.source, host: new URL(config.endpoint).host }));
  for (const q of QUERIES) {
    const t0 = Date.now();
    const r = await searchFreeChatWeb(q, { config, onStarted: async () => {} });
    const ms = Date.now() - t0;
    if (!r) {
      console.log(JSON.stringify({ q, ms, result: null }));
      continue;
    }
    // 来源的发布时间和类型只在模型上下文里（JSON 段），从那里读出来
    const json = r.context.slice(r.context.lastIndexOf('{"sources"'));
    let detail: { sources: { url: string; title: string; published_time: string; read_status: string }[] } = { sources: [] };
    try { detail = JSON.parse(json); } catch { /* 没有来源段 */ }
    console.log(JSON.stringify({
      q, ms, status: r.status.status, message: r.status.message ?? null, readCount: r.readCount,
      sources: detail.sources.map((s) => {
        let d = '?';
        try { d = new URL(s.url).hostname; } catch { /* 地址不对 */ }
        return { d, t: s.title.slice(0, 40), p: s.published_time || '', read: s.read_status.slice(0, 6) };
      }),
    }));
  }
}

main().catch((e) => console.log(JSON.stringify({ error: String(e?.message || e).slice(0, 200) })));
