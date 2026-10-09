// Dify DSL 一致性核对（2026-10-04）：只读，解析 docs/dify 下的 DSL，输出脱敏的结构摘要和差异。不联网、不改任何文件。
// 用法：node scripts/dify-dsl-diff.cjs . > dsl-diff.json
// 环境变量值只输出指纹或「已脱敏」，不会打印密钥。
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const root = path.resolve(process.argv[2] || '.')
const yaml = require('js-yaml')
const dir = path.join(root, 'docs', 'dify')
const files = fs.readdirSync(dir).filter((f) => /\.ya?ml$/.test(f))
const h = (s) => crypto.createHash('sha256').update(String(s ?? '')).digest('hex').slice(0, 10)
const SECRET = /(key|token|secret|password|authorization|cookie)/i

function summarize(file) {
  const doc = yaml.load(fs.readFileSync(path.join(dir, file), 'utf8'))
  const app = doc.app || {}
  const wf = doc.workflow || {}
  const g = wf.graph || {}
  const nodes = (g.nodes || []).map((n) => {
    const d = n.data || {}
    const out = { id: n.id, type: d.type, title: d.title }
    if (d.type === 'llm') out.model = `${d.model?.provider}/${d.model?.name}`
    if (d.type === 'tool') out.tool = `${d.provider_id || d.provider_name}/${d.tool_name}`
    if (d.type === 'code') out.code = h(d.code)
    if (d.type === 'llm') out.prompt = h(JSON.stringify(d.prompt_template))
    if (d.type === 'http-request') out.url = String(d.url || '').replace(/\/\/[^/]+/, '//<host>')
    if (d.type === 'if-else') out.cases = (d.cases || []).length
    if (d.type === 'knowledge-retrieval') out.datasets = (d.dataset_ids || []).length
    return out
  })
  const features = wf.features || doc.model_config || {}
  const fu = features.file_upload || {}
  const envs = (wf.environment_variables || []).map((e) => ({ name: e.name, type: e.value_type, value: SECRET.test(e.name) || e.value_type === 'secret' ? '<已脱敏>' : `<${h(e.value)}>` }))
  const convs = (wf.conversation_variables || []).map((e) => `${e.name}:${e.value_type}`)
  const deps = (doc.dependencies || []).map((d) => d.value?.marketplace_plugin_unique_identifier || d.value?.plugin_unique_identifier || d.type).map((s) => String(s).replace(/@[0-9a-f]{20,}/, '@<hash>'))
  const startVars = (g.nodes || []).filter((n) => n.data?.type === 'start').flatMap((n) => (n.data.variables || []).map((v) => `${v.variable}:${v.type}`))
  return {
    file, name: app.name, mode: app.mode, version: doc.version, kind: doc.kind,
    nodeCount: nodes.length, edgeCount: (g.edges || []).length,
    fileUpload: { enabled: fu.enabled, number_limits: fu.number_limits, types: fu.allowed_file_types, methods: fu.allowed_file_upload_methods, image: fu.image ? { enabled: fu.image.enabled, number_limits: fu.image.number_limits } : undefined },
    opening: h(features.opening_statement), suggested: (features.suggested_questions || []).length,
    envs, convs, startVars, deps, nodes,
  }
}

const sums = files.map(summarize)
const brief = sums.map((s) => ({ file: s.file, name: s.name, mode: s.mode, version: s.version, nodes: s.nodeCount, edges: s.edgeCount,
  tools: [...new Set(s.nodes.filter((n) => n.tool).map((n) => n.tool))], models: [...new Set(s.nodes.filter((n) => n.model).map((n) => n.model))],
  fileUpload: s.fileUpload, envNames: s.envs.map((e) => `${e.name}(${e.type})`), convs: s.convs, startVars: s.startVars, deps: s.deps }))

function diff(a, b) {
  const A = new Map(a.nodes.map((n) => [n.id, n]))
  const B = new Map(b.nodes.map((n) => [n.id, n]))
  const onlyA = a.nodes.filter((n) => !B.has(n.id)).map((n) => `${n.type}:${n.title}${n.tool ? ' ' + n.tool : ''}`)
  const onlyB = b.nodes.filter((n) => !A.has(n.id)).map((n) => `${n.type}:${n.title}${n.tool ? ' ' + n.tool : ''}`)
  const changed = []
  for (const [id, n] of A) {
    const m = B.get(id)
    if (!m) continue
    const keys = ['title', 'model', 'tool', 'code', 'prompt', 'url', 'cases', 'datasets'].filter((k) => JSON.stringify(n[k]) !== JSON.stringify(m[k]))
    if (keys.length) changed.push(`${n.type}:${n.title} → ${keys.join(',')}`)
  }
  return { a: a.file, b: b.file, onlyA, onlyB, changed,
    envOnlyA: a.envs.filter((e) => !b.envs.some((x) => x.name === e.name)).map((e) => e.name),
    envOnlyB: b.envs.filter((e) => !a.envs.some((x) => x.name === e.name)).map((e) => e.name),
    envValueChanged: a.envs.filter((e) => b.envs.some((x) => x.name === e.name && x.value !== e.value)).map((e) => e.name),
    fileUpload: JSON.stringify(a.fileUpload) === JSON.stringify(b.fileUpload) ? '相同' : { a: a.fileUpload, b: b.fileUpload },
    convs: JSON.stringify(a.convs) === JSON.stringify(b.convs) ? '相同' : { a: a.convs, b: b.convs } }
}

const byName = Object.fromEntries(sums.map((s) => [s.file, s]))
const main = byName['小宋编导文案工作台.yml']
const latest = byName['开物_阿里云Lite六附件修正_20261002.yml']
const out = { brief, mainVsLatest: diff(main, latest), compatVsLatest: diff(byName['开物_阿里云Lite六附件兼容修复_20261002.yml'], latest) }
console.log(JSON.stringify(out, null, 1))
