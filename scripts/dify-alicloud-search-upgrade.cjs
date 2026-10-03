/** 只生成阿里云接入草稿，保留正式 Tavily DSL；文件中不包含 API Key。 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const yaml = require('js-yaml');
const base = path.join(__dirname, '..');
const doc = yaml.load(fs.readFileSync(path.join(base, 'docs/dify/小宋编导文案工作台.yml'), 'utf8'));
const graph = doc.workflow.graph;
const search = graph.nodes.find(n => n.id === '1790086576262');
const format = graph.nodes.find(n => n.id === 'web_search_format');
if (!search || search.data.title !== 'Tavily Search' || !format) throw new Error('正式 DSL 搜索结构发生变化，请先核对');
const httpId = search.id;
const payloadId = 'ali_search_payload';
const node = (id, type, title, x, y, extra) => ({
  id, type: 'custom', width: 244, height: 100, position: { x, y }, positionAbsolute: { x, y },
  sourcePosition: 'right', targetPosition: 'left',
  data: { type, title, desc: '开物服务端授权后才执行；不自动重试付费搜索', selected: false, ...extra },
});
const noRetry = { retry_enabled: false, enabled: false, max_retries: 0, retry_interval: 0 };
// Dify 会将旧 image.number_limits 覆盖到新版统一附件上限；仅保留现代结构。
delete doc.workflow.features.file_upload.image;
Object.assign(doc.workflow.features.file_upload, {
  enabled: true, number_limits: 6, allowed_file_types: ['image', 'document'],
  allowed_file_upload_methods: ['local_file', 'remote_url'],
});
const payload = node(payloadId, 'code', '准备搜索请求', 620, 1190, {
  code_language: 'javascript', code: fs.readFileSync(path.join(base, 'docs/dify/code/ali-search-payload.js'), 'utf8'),
  variables: [{ variable: 'query', value_selector: ['start', 'search_query'] }],
  outputs: { body: { type: 'string', children: null } },
});
search.data = {
  type: 'http-request', title: '阿里云联网搜索 Lite', desc: '固定 way=lite，一轮一次；密钥仅引用加密环境变量', selected: false,
  method: 'post', url: 'https://default-2te6.platform-cn-shanghai.opensearch.aliyuncs.com/v3/openapi/workspaces/default/web-search/ops-web-search-001',
  authorization: { type: 'no-auth' },
  headers: 'Content-Type:application/json\nAuthorization:Bearer {{#env.ALI_SEARCH_API_KEY#}}', params: '',
  body: { type: 'json', data: [{ id: 'ali-search-json', key: '', type: 'text', value: '{{#ali_search_payload.body#}}' }] },
  timeout: { connect: 10, read: 30, write: 10 }, ssl_verify: true, retry_config: noRetry,
  error_strategy: 'default-value', default_value: [{ key: 'body', type: 'string', value: '' }, { key: 'status_code', type: 'number', value: 0 }],
};
search.position = { x: 940, y: 1190 }; search.positionAbsolute = { ...search.position };
format.data = {
  type: 'code', title: '整理联网结果', desc: '只向模型传递最多六个真实来源；错误、空结果明确未核实', selected: false,
  code_language: 'javascript', code: fs.readFileSync(path.join(base, 'docs/dify/code/ali-search-results.js'), 'utf8'),
  variables: [{ variable: 'body', value_selector: [httpId, 'body'] }, { variable: 'status_code', value_selector: [httpId, 'status_code'] }],
  outputs: { output: { type: 'string', children: null } },
};
format.position = { x: 1260, y: 1190 }; format.positionAbsolute = { ...format.position };
graph.nodes.push(payload);
graph.edges = graph.edges.filter(e => !(e.source === 'web_search_gate' && e.target === httpId));
const edge = (source, target, handle = 'source') => ({
  id: `${source}-${handle}-${target}-ali-lite`, source, target, sourceHandle: handle, targetHandle: 'target', type: 'custom', zIndex: 0,
  data: { isInIteration: false, isInLoop: false, sourceType: graph.nodes.find(n => n.id === source).data.type, targetType: graph.nodes.find(n => n.id === target).data.type },
});
graph.edges.push(edge('web_search_gate', payloadId, 'true'), edge(payloadId, httpId));
for (const e of graph.edges) {
  e.data.sourceType = graph.nodes.find(n => n.id === e.source).data.type;
  e.data.targetType = graph.nodes.find(n => n.id === e.target).data.type;
}
doc.workflow.environment_variables.push({ id: crypto.randomUUID(), name: 'ALI_SEARCH_API_KEY', value_type: 'secret', value: '', description: '在 Dify 填写阿里云 OpenSearch API Key；不导出到代码或聊天' });
// 覆盖现有应用时复用工作区已安装的模型插件；不要按旧 DSL 降级插件。
// 阿里云通过 HTTP 节点接入，无须新装工具插件。
doc.dependencies = [];
const target = path.join(base, 'docs/dify/开物_阿里云Lite联网接入_20261002.yml');
const serialized = yaml.dump(doc, { lineWidth: -1, noRefs: true });
fs.writeFileSync(target, serialized, 'utf8');
fs.writeFileSync(path.join(base, 'docs/dify/开物_阿里云Lite六附件兼容修复_20261002.yml'), serialized, 'utf8');
console.log('阿里云 Lite 接入草稿已生成；API Key 为空，尚未发布。');
