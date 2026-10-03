const fs = require('fs');
const path = require('path');
for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z_0-9]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
}
const base = process.env.DIFY_BASE_URL || 'https://api.dify.ai/v1';
const user = 'codex-capability-validation-20260930';
const headers = { Authorization: `Bearer ${process.env.DIFY_API_KEY}` };
const dir = 'docs/chat-capability-fixtures';
async function upload(name, type) {
  const form = new FormData(); form.append('file', new Blob([fs.readFileSync(path.join(dir, name))]), name); form.append('user', user);
  const res = await fetch(`${base}/files/upload`, { method: 'POST', headers, body: form, signal: AbortSignal.timeout(60000) });
  const data = await res.json();
  if (!res.ok || !data.id) throw new Error(`Upload failed: ${name}, status ${res.status}, code ${data.code || ''}`);
  return { type, transfer_method: 'local_file', upload_file_id: data.id };
}
async function run(name, query, files = [], search = 'Dify documentation document extractor', conversationId = '') {
  const started = Date.now();
  const res = await fetch(`${base}/chat-messages`, {
    method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ inputs: { search_query: search, dealReasons: '' }, query: '【高阶自由对话】请直接回答问题，不要创作文案。\n' + query, user, files, ...(conversationId ? { conversation_id: conversationId } : {}), response_mode: 'streaming' }), signal: AbortSignal.timeout(180000),
  });
  if (!res.ok) throw new Error(`${name}: Dify HTTP ${res.status}`);
  const reader = res.body.getReader(), decoder = new TextDecoder();
  let buffer = '', answer = '', errors = []; const nodes = [];
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    buffer += decoder.decode(value, { stream: true }); const lines = buffer.split('\n'); buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      let e; try { e = JSON.parse(line.slice(6)); } catch { continue; }
      if (e.conversation_id) conversationId = e.conversation_id;
      if (e.event === 'message_replace') answer = e.answer || '';
      else if ((e.event === 'message' || e.event === 'agent_message') && e.answer) answer += e.answer;
      if (e.event === 'error') errors.push(String(e.message || e.code));
      if (e.event === 'node_finished') {
        const d = e.data;
        nodes.push({ title: d.title, status: d.status, error: d.error || null,
          ...(d.title === 'Tavily Search' ? { output: d.outputs } : {}),
          ...(d.title === '读取文档正文' ? { extracted: d.outputs } : {}),
        });
        console.log(JSON.stringify({ test: name, node: d.title, status: d.status }));
      }
      if (e.event === 'workflow_finished' && e.data?.status !== 'succeeded') errors.push(e.data.error || 'workflow failed');
    }
  }
  const result = { name, seconds: Math.round((Date.now() - started) / 1000), answer, errors, nodes, conversationId };
  console.log(JSON.stringify({ test: name, seconds: result.seconds, answer, errors }));
  return result;
}
(async () => {
  const results = [];
  if (process.argv.includes('--switch-files')) {
    const image = await upload('视觉识别测试.png', 'image');
    const doc = await upload('Word识别测试.docx', 'document');
    const first = await run('先看图片', '图片是什么颜色？', [image]); results.push(first);
    const query = '这个文档里都有什么内容？\n【本轮实际提供的附件】Word识别测试.docx（文档）。用户问这个文档指本轮附件，不是历史图片。请读取本轮正文提取内容。';
    const second = await run('换成新Word', query, [doc], 'Word document', first.conversationId); results.push(second);
    results.push(await run('不重传继续追问Word', '请确认 Word识别测试.docx 的暗号，并给出原文中除此以外的内容。当前附件仅这份Word，不是历史图片。', [doc], 'Word document', second.conversationId));
  }
  else if (process.argv.includes('--text-only')) results.push(await run('无附件与联网', '联网查一下 Dify 官方文档中 Document Extractor 支持哪些文件格式，给出至少一个官方链接。'));
  else {
    const group1 = await Promise.all([upload('视觉识别测试.png', 'image'), upload('正文识别测试.txt', 'document'), upload('Word识别测试.docx', 'document')]);
    results.push(await run('图片、文本和Word', '请读附件：1. 图片从左到右三块分别是什么颜色？2. TXT 项目暗号和预算是什么？3. Word 的暗号是什么？只回答三项，不得猜测。', group1));
    const group2 = await Promise.all([upload('表格识别测试.xlsx', 'document'), upload('PPT识别测试.pptx', 'document'), upload('PDF识别测试.pdf', 'document')]);
    results.push(await run('Excel、PPT和PDF', '请读附件：1. Excel 两行 amount 总和是多少？2. PPT validation code 是什么？3. PDF validation code 是什么？只回答三项，不得猜测。', group2));
    results.push(await run('无附件与联网', '联网查一下 Dify 官方文档中 Document Extractor 支持哪些文件格式，给出至少一个官方链接。'));
  }
  fs.writeFileSync(process.argv.includes('--switch-files') ? 'docs/chat-file-switch-probe_20261001.json' : 'docs/chat-capability-probe_20260930.json', JSON.stringify(results, null, 2));
  if (results.some(r => r.errors.length || !r.answer)) process.exitCode = 1;
})().catch(e => { console.error(e.message); process.exitCode = 1; });
