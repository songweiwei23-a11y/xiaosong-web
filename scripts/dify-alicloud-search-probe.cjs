/** 验证已发布的阿里云联网和六附件；凭据仅用于现有 Dify 服务，不写入报告。 */
const fs = require('node:fs');
for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([A-Z_][A-Z_0-9]*)=(.*)$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '');
}
const base = process.env.DIFY_BASE_URL || 'https://api.dify.ai/v1';
const headers = { Authorization: `Bearer ${process.env.DIFY_API_KEY}` };
const user = 'kaiwu-ali-search-validation-20261002';
const report = { time: new Date().toISOString(), tests: [] };
function assert(condition, name, detail = {}) {
  const result = { name, passed: !!condition, ...detail };
  report.tests.push(result); console.log(JSON.stringify(result));
  if (!condition) throw Error(name);
}
async function run(name, enabled, query, files = []) {
  const res = await fetch(`${base}/chat-messages`, {
    method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ user, files, response_mode: 'streaming',
      query: '【高阶自由对话】请直接回答问题，控制在150字内。\n' + query,
      inputs: { search_query: '阿里云 OpenSearch 联网搜索 Lite 计费 价格', dealReasons: '', web_search_enabled: enabled,
        web_search_note: enabled === '1' ? '本轮授权联网一次' : '本轮不联网，请基于已有资料回答' },
    }), signal: AbortSignal.timeout(180000),
  });
  assert(res.ok, `${name}: HTTP 成功`, { status: res.status });
  const reader = res.body.getReader(), decoder = new TextDecoder();
  let buffer = '', answer = '', searches = 0, httpStatus = null, usage = null;
  const errors = [], nodes = [], sources = [];
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n'); buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      let event; try { event = JSON.parse(line.slice(6)); } catch { continue; }
      if (event.event === 'message_replace') answer = event.answer || '';
      else if (event.event === 'message' && event.answer) answer += event.answer;
      if (event.event === 'error') errors.push(String(event.message || event.code).slice(0, 300));
      const data = event.data || {};
      if (event.event === 'node_started' && data.node_id === '1790086576262') searches++;
      if (event.event === 'node_finished') {
        nodes.push({ title: data.title, status: data.status });
        if (data.node_id === '1790086576262') {
          httpStatus = data.outputs?.status_code;
          let parsed; try { parsed = JSON.parse(data.outputs?.body || ''); } catch {}
          usage = parsed?.usage || null;
          for (const page of (parsed?.result?.search_result || []).slice(0, 6)) {
            if (typeof page.link === 'string') sources.push({ title: String(page.title || '').slice(0, 180), url: page.link });
          }
        }
      }
      if (event.event === 'workflow_finished' && data.status !== 'succeeded') errors.push(String(data.error || 'workflow failed').slice(0, 300));
    }
  }
  assert(!errors.length && !!answer && searches === (enabled === '1' ? 1 : 0), `${name}: 正确分支与回答`, { searches, errors, nodes, answer });
  if (enabled === '1') {
    assert(httpStatus === 200 && sources.length > 0, '阿里云接口返回真实来源', { httpStatus, sources, usage });
    assert(JSON.stringify(usage).includes('lite'), '实际计费类型为 Lite');
    assert(/https?:\/\//.test(answer), '回答保留来源链接');
  }
  return answer;
}
async function parameters() {
  const res = await fetch(`${base}/parameters?ali_validation=${Date.now()}`, { headers: { ...headers, 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(30000) });
  const data = await res.json();
  assert(res.ok && data.file_upload?.enabled && data.file_upload?.number_limits === 6
    && data.file_upload?.allowed_file_types?.includes('document'), '发布参数支持六附件和文档', { fileUpload: data.file_upload });
}
async function sixFiles() {
  const files = [];
  for (const [name, type] of [['视觉识别测试.png', 'image'], ['正文识别测试.txt', 'document'], ['Word识别测试.docx', 'document'], ['表格识别测试.xlsx', 'document'], ['PPT识别测试.pptx', 'document'], ['PDF识别测试.pdf', 'document']]) {
    const form = new FormData();
    form.append('file', new Blob([fs.readFileSync(`docs/chat-capability-fixtures/${name}`)]), name); form.append('user', user);
    const res = await fetch(`${base}/files/upload`, { method: 'POST', headers, body: form, signal: AbortSignal.timeout(60000) });
    const data = await res.json(); assert(res.ok && !!data.id, `${name}: 上传成功`);
    files.push({ type, transfer_method: 'local_file', upload_file_id: data.id });
  }
  const answer = await run('六附件读取且不联网', '0', '读取6个附件：1图片左右颜色；2TXT暗号预算；3Word暗号；4Excel两行amount总和；5PPT validation code；6PDF validation code。只回答6项，不要猜测。', files);
  assert(['红', '绿', '蓝', '松果7319', '24680', '梧桐5826', '400', 'CEDAR-9462', 'MAPLE-8047'].every(token => answer.includes(token)), '六种附件识别与测试内容一致');
}
(async () => {
  if (process.argv.includes('--attachments-only')) return sixFiles();
  if (!process.argv.includes('--search-only')) await parameters();
  if (process.argv.includes('--parameters')) return;
  await run('关闭联网普通创作', '0', '把“我们店的串串很好吃”改写为一句自然的开篇，不要联网。');
  await run('开启阿里云联网', '1', '联网查阿里云 OpenSearch 联网搜索 Lite 当前收费，给出官方来源链接。');
  if (process.argv.includes('--six-files')) await sixFiles();
})().catch(error => { report.error = error.message; console.error(error.message); process.exitCode = 1; }).finally(() => {
  const output = process.argv.includes('--parameters') ? 'docs/阿里云附件参数验收_20261002.json'
    : process.argv.includes('--search-only') ? 'docs/阿里云联网回答验收_20261002.json'
    : process.argv.includes('--six-files') || process.argv.includes('--attachments-only') ? 'docs/阿里云联网六附件验收_20261002.json'
    : 'docs/阿里云联网真实接口验收_20261002.json';
  fs.writeFileSync(output, JSON.stringify(report, null, 2));
});
