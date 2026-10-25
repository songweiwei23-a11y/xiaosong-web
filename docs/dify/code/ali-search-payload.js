function main({ query, web_query, today }) {
  // 优先用网站生成的联网专用搜索词；旧版网站没传时退回知识库检索词
  const q = String(web_query || query || '').slice(0, 300);
  // 关闭改写（2026-10-25 实测）：开启后地名会被改掉（「南乐」被换成台前县、华龙区），结果跑到别处
  const body = { query: q, query_rewrite: false, top_k: 10, content_type: 'mainText', way: 'lite' };
  if (today) {
    // 2026-10-17 去掉「最近/本周/今天换成具体日期」：实测会把搜索词改写丢掉地名（南乐），结果跑到别处
    body.history = [{ role: 'system', content: '今天是' + today + '（北京时间）。保留问题的实体、地区、比较对象和技术限定；只改写检索措辞，不添加不存在的事实。' }];
  }
  return { body: JSON.stringify(body) };
}
