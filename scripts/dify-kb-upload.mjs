#!/usr/bin/env node
/**
 * Dify 知识库批量上传
 *
 * 为什么需要它：_导入Dify 下有 153 篇 markdown，手工在 Web 界面逐个上传不现实，
 * 且不同文件需要不同的分段参数——两个精编版有完整 H3 层级(141/87 个)必须按标题切，
 * 而 141 篇单节课件平均仅 1212 字，整篇就是一个完整知识单元，切开反而破坏语义。
 * 本脚本按文件实际结构自动选择分段规则。
 *
 * 用法：
 *   set DIFY_DATASET_API_KEY=dataset-xxxx        (Windows CMD)
 *   $env:DIFY_DATASET_API_KEY="dataset-xxxx"     (PowerShell)
 *
 *   node scripts/dify-kb-upload.mjs list                  列出账号下的知识库及其 id
 *   node scripts/dify-kb-upload.mjs plan                  预览上传计划，不发请求
 *   node scripts/dify-kb-upload.mjs upload <库目录名> <dataset_id>
 *   node scripts/dify-kb-upload.mjs upload --all          按 mapping.json 全量上传
 *
 * Dataset API Key 与应用的 API Key 不同，在 Dify「知识库 → API 访问」处获取。
 */

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KB_ROOT = path.resolve(__dirname, '..', '编导知识大全', '_导入Dify');
const MAPPING_FILE = path.join(KB_ROOT, '_mapping.json');
const STATE_FILE = path.join(KB_ROOT, '_uploaded.json');
const BASE = process.env.DIFY_API_BASE || 'https://api.dify.ai/v1';
const KEY = process.env.DIFY_DATASET_API_KEY || '';

/** 请求间隔，避免触发限流 */
const DELAY_MS = 600;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * 5 个目标知识库的规格。
 * 名称与工作流系统提示词中的称谓保持一致（定位与选题库 / 脚本与文案库 /
 * 拍摄与执行库 / 综合知识手册 / 成交理由知识库），便于对照排查。
 */
const KB_SPEC = [
  { dir: '库1_定位与选题', name: '定位与选题库', desc: '账号定位、IP定位、赛道与人群、选题方法、八大爆款元素、起号36计与79节打法' },
  { dir: '库2_脚本与文案', name: '脚本与文案库', desc: '开篇36计、四类脚本公式（教知识/晒过程/聊观点/讲故事）、文案写作、情绪波点' },
  { dir: '库3_拍摄与执行', name: '拍摄与执行库', desc: '拆片技巧、镜头表现力、场景选择、拍摄呈现基础与进阶' },
  { dir: '库4_综合知识手册', name: '综合知识手册', desc: '底层逻辑、平台变现方式、编导完整知识手册、先导课' },
  { dir: '库5_成交理由与实战', name: '成交理由知识库', desc: '17个核心成交理由、实体商家选题SOP、本地推爆款素材、15天变现实操' },
];

/**
 * Embedding 模型。必须作为建库请求的顶层参数传递——写在 retrieval_model
 * 里会被忽略，Dify 将回落到工作区默认模型。曾因此落到 gemini-embedding-2
 * （免费档每分钟仅 100 次请求），153 篇中 140 篇索引报 429 失败。
 * 默认沿用原有知识库所用的 OpenAI 模型，可用环境变量覆盖。
 */
const EMBED_MODEL = process.env.DIFY_EMBED_MODEL || 'text-embedding-3-large';
const EMBED_PROVIDER = process.env.DIFY_EMBED_PROVIDER || 'langgenius/openai/openai';

/** 与现有工作流中知识检索节点一致的检索配置 */
const RETRIEVAL_MODEL = {
  search_method: 'hybrid_search',
  reranking_enable: false,
  top_k: 4,
  score_threshold_enabled: false,
  weights: {
    weight_type: 'customized',
    vector_setting: {
      vector_weight: 0.7,
      embedding_model_name: 'text-embedding-3-large',
      embedding_provider_name: 'langgenius/openai/openai',
    },
    keyword_setting: { keyword_weight: 0.3 },
  },
};

function die(msg) {
  console.error('\n[错误] ' + msg + '\n');
  process.exit(1);
}

/**
 * 密钥格式自检。
 * 直接把非 ASCII 字符塞进 Authorization 头会抛出 ByteString 转换错误，
 * 信息晦涩难以定位，这里提前给出可操作的提示。
 */
function validateKey() {
  if (!KEY) {
    die(
      '未设置环境变量 DIFY_DATASET_API_KEY。\n' +
      '       PowerShell:  $env:DIFY_DATASET_API_KEY="dataset-实际密钥"'
    );
  }
  if (/[^\x20-\x7E]/.test(KEY)) {
    die(
      '密钥里含有中文或不可见字符，多半是把示例中的占位文字原样粘贴了。\n' +
      `       当前值: ${KEY}\n` +
      '       请到 Dify -> 知识库 -> 右上角「服务 API」-> 「API 密钥」创建，\n' +
      '       复制到的是一串英文数字，形如 dataset-AbC123XyZ...'
    );
  }
  if (!KEY.startsWith('dataset-')) {
    die(
      '密钥应以 dataset- 开头，当前为: ' + KEY.slice(0, 12) + '...\n' +
      '       注意区分：应用的 API Key 是 app- 开头（.env.local 里那两个），\n' +
      '       知识库的是 dataset- 开头，两者不通用。'
    );
  }
}

async function api(method, endpoint, body) {
  validateKey();
  const res = await fetch(BASE + endpoint, {
    method,
    headers: { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) {
    const detail = json.message || json.code || text.slice(0, 200);
    throw new Error(`HTTP ${res.status}: ${detail}`);
  }
  return json;
}

/**
 * 按文件实际结构决定分段规则。
 * 有 H3 层级的长文档按标题切，保证"一计 = 一个完整分段"；
 * 其余按空行切，短文件自然落成单个分段。
 */
function buildProcessRule(text) {
  const h3 = (text.match(/^### /gm) || []).length;
  const h2 = (text.match(/^## /gm) || []).length;
  // 正文中不会出现的标记：用它当 separator 等同于"整篇不切分"，
  // 仅当整篇超过 max_tokens 时 Dify 才会按长度兜底切分。
  //
  // 不能用 "\n\n"：转换出的 markdown 段落之间均有空行，按它切会让
  // 每一行变成独立分块，实测召回出的分段只有 7~47 字（全是标题和短语），
  // 完全没有实质内容。max_tokens 是上限而非下限，Dify 不会把小块合并回去。
  const NO_SPLIT = '\n<<<NEVER_SPLIT_HERE>>>\n';
  let separator = NO_SPLIT;
  let reason = '无标题层级，整篇作为一个分段';
  if (h3 >= 10) {
    separator = '\n###';
    reason = `含 ${h3} 个三级标题，按标题切分`;
  } else if (h2 >= 10) {
    separator = '\n##';
    reason = `含 ${h2} 个二级标题，按标题切分`;
  }
  return {
    rule: {
      mode: 'custom',
      rules: {
        pre_processing_rules: [
          { id: 'remove_extra_spaces', enabled: true },
          { id: 'remove_urls_emails', enabled: false },
        ],
        segmentation: { separator, max_tokens: 1000, chunking_overlap: 120 },
      },
    },
    reason,
  };
}

function listLocalDirs() {
  if (!fs.existsSync(KB_ROOT)) die('找不到目录: ' + KB_ROOT);
  return fs.readdirSync(KB_ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

function listMd(dir) {
  const full = path.join(KB_ROOT, dir);
  return fs.readdirSync(full).filter((f) => f.endsWith('.md')).sort()
    .map((f) => path.join(full, f));
}

function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return {}; }
}
function saveState(s) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2), 'utf8');
}

async function cmdList() {
  const data = await api('GET', '/datasets?page=1&limit=100');
  const items = data.data || [];
  if (!items.length) return console.log('账号下没有知识库。');
  console.log(`\n共 ${items.length} 个知识库：\n`);
  console.log('id'.padEnd(38) + '文档数'.padStart(6) + '  名称');
  console.log('-'.repeat(78));
  for (const d of items) {
    console.log(String(d.id).padEnd(38) + String(d.document_count ?? '-').padStart(6) + '  ' + d.name);
  }
  console.log(`\n本地待上传目录：\n  ` + listLocalDirs().join('\n  '));
  console.log(`\n下一步：把对应关系写入 ${MAPPING_FILE}`);
  console.log('格式： { "库1_定位与选题": "<dataset_id>", ... }\n');
}

/**
 * 创建 5 个目标知识库并写入映射表。
 * 同名库已存在时直接复用，不重复创建，因此可以安全重跑。
 */
async function cmdInit() {
  const existing = await api('GET', '/datasets?page=1&limit=100');
  const byName = new Map((existing.data || []).map((d) => [d.name, d.id]));
  console.log(`\n账号下现有 ${byName.size} 个知识库。\n`);

  const map = {};
  for (const spec of KB_SPEC) {
    if (byName.has(spec.name)) {
      map[spec.dir] = byName.get(spec.name);
      console.log(`复用已存在  ${spec.name}  -> ${map[spec.dir]}`);
      continue;
    }
    const payload = {
      name: spec.name,
      description: spec.desc,
      indexing_technique: 'high_quality',
      permission: 'only_me',
      embedding_model: EMBED_MODEL,
      embedding_model_provider: EMBED_PROVIDER,
      retrieval_model: RETRIEVAL_MODEL,
    };
    let res;
    try {
      res = await api('POST', '/datasets', payload);
    } catch (e) {
      // 不再静默降级：embedding 模型配不上就必须让使用者知道，
      // 否则会回落到工作区默认模型，索引到一半才因限流大面积失败。
      die(
        `创建知识库「${spec.name}」失败: ${e.message}\n` +
        `       当前指定的 embedding 模型: ${EMBED_MODEL} (${EMBED_PROVIDER})\n` +
        `       若该模型在你的 Dify 工作区不可用，请改用其他模型后重试，例如：\n` +
        `         $env:DIFY_EMBED_MODEL="text-embedding-3-small"\n` +
        `         $env:DIFY_EMBED_PROVIDER="langgenius/openai/openai"`
      );
    }
    map[spec.dir] = res.id;
    console.log(`已创建      ${spec.name}  -> ${res.id}   [embedding: ${EMBED_MODEL}]`);
    await sleep(DELAY_MS);
  }

  fs.writeFileSync(MAPPING_FILE, JSON.stringify(map, null, 2) + '\n', 'utf8');
  console.log(`\n映射已写入 ${MAPPING_FILE}`);
  console.log('\n下一步：node scripts/dify-kb-upload.mjs upload --all\n');
}

/**
 * 索引状态诊断：统计 5 个目标库中每篇文档的索引进度与启用状态。
 * Dify 界面上的「不可用」有多种成因——仍在排队/解析中、索引报错、
 * 或被显式禁用，处理方式完全不同，需要先区分清楚。
 */
async function cmdStatus() {
  if (!fs.existsSync(MAPPING_FILE)) die('缺少映射文件，请先运行 init');
  const map = JSON.parse(fs.readFileSync(MAPPING_FILE, 'utf8'));
  const STATUS_CN = {
    waiting: '排队中', parsing: '解析中', cleaning: '清洗中', splitting: '分段中',
    indexing: '索引中', completed: '已完成', error: '失败', paused: '已暂停',
  };
  let totalDocs = 0, totalDone = 0, totalErr = 0, totalPending = 0, totalDisabled = 0;
  const errorSamples = [];

  for (const [dir, id] of Object.entries(map)) {
    if (!id || String(id).startsWith('<')) continue;
    let docs = [];
    try { docs = await fetchDocs(id); } catch (e) { console.log(`${dir}: 读取失败 ${e.message}`); continue; }
    const byStatus = {};
    let disabled = 0;
    for (const d of docs) {
      const s = d.indexing_status || 'unknown';
      byStatus[s] = (byStatus[s] || 0) + 1;
      if (d.enabled === false) disabled++;
      if (s === 'error') {
        totalErr++;
        if (errorSamples.length < 10) {
          errorSamples.push(`[${dir}] ${d.name}: ${d.error || '(接口未返回错误详情)'}`);
        }
      } else if (s === 'completed') totalDone++;
      else totalPending++;
    }
    totalDocs += docs.length;
    totalDisabled += disabled;
    const parts = Object.entries(byStatus)
      .map(([k, v]) => `${STATUS_CN[k] || k} ${v}`)
      .join('  ');
    console.log(`${dir.padEnd(22)} ${String(docs.length).padStart(3)} 篇   ${parts}${disabled ? `   已禁用 ${disabled}` : ''}`);
    await sleep(200);
  }

  console.log('\n' + '-'.repeat(60));
  console.log(`合计 ${totalDocs} 篇：已完成 ${totalDone}，处理中 ${totalPending}，失败 ${totalErr}，被禁用 ${totalDisabled}`);
  if (errorSamples.length) {
    console.log('\n失败样例：');
    for (const s of errorSamples) console.log('  ' + s);
  }
  if (totalPending > 0) {
    console.log('\n仍有文档在排队或索引中，属正常现象，稍后重跑本命令即可。');
  }
  if (totalErr > 0) {
    console.log('\n存在索引失败的文档。常见原因：embedding 模型额度用尽、');
    console.log('模型配置缺失、或单篇内容过大。请在 Dify 界面点开失败文档查看详情。');
  }
  console.log('');
}

/**
 * 把知识库实际使用的 embedding 模型同步写回工作流 DSL。
 *
 * 检索节点里的 embedding 配置必须与建库时完全一致，否则向量维度对不上，
 * 检索会失效（bge-large-zh-v1.5 是 1024 维，text-embedding-3-large 是 3072 维）。
 * 手工改 5 处极易遗漏，这里直接以线上知识库的真实配置为准覆盖。
 */
async function cmdSyncYml() {
  if (!fs.existsSync(MAPPING_FILE)) die('缺少映射文件，请先运行 init');
  const map = JSON.parse(fs.readFileSync(MAPPING_FILE, 'utf8'));
  const ids = Object.values(map).filter((v) => v && !String(v).startsWith('<'));
  if (!ids.length) die('映射表里没有有效的 dataset_id');

  const r = await api('GET', '/datasets?page=1&limit=100');
  const mine = (r.data || []).filter((d) => ids.includes(d.id));
  if (!mine.length) die('未找到映射表中的知识库，可能已被删除');

  const combos = new Set(mine.map((d) => `${d.embedding_model}|${d.embedding_model_provider}`));
  if (combos.size > 1) {
    console.log('\n[警告] 5 个库的 embedding 配置不一致：');
    for (const c of combos) console.log('  ' + c.replace('|', '  <-  '));
    die('请先让它们统一（reset 后重新 init），否则检索行为不可预期');
  }
  const model = mine[0].embedding_model;
  const provider = mine[0].embedding_model_provider;
  console.log(`\n线上知识库实际使用: ${model}  (${provider})`);

  const targets = [
    path.resolve(__dirname, '..', 'docs', 'dify', '小宋编导文案工作台.yml'),
    path.join(process.env.USERPROFILE || '', 'Desktop', '小宋编导文案工作台.yml'),
  ];
  for (const f of targets) {
    if (!fs.existsSync(f)) { console.log(`  跳过(不存在): ${f}`); continue; }
    const before = fs.readFileSync(f, 'utf8');
    const after = before
      .replace(/embedding_model_name: .*/g, `embedding_model_name: ${model}`)
      .replace(/embedding_provider_name: .*/g, `embedding_provider_name: ${provider}`);
    const n = (before.match(/embedding_model_name: /g) || []).length;
    if (before === after) {
      console.log(`  已是最新(${n} 处): ${f}`);
    } else {
      fs.writeFileSync(f, after, 'utf8');
      console.log(`  已更新(${n} 处): ${f}`);
    }
  }
  console.log('\n改完记得重新导入 yml 到 Dify，并在工作流里确认检索节点绑定的是新库。\n');
}

/**
 * 重建索引：清空 5 个库里的全部文档后重新上传，但保留知识库本身。
 *
 * 相比 reset，它不删库，因此 dataset_id 不变——工作流里 5 个检索节点
 * 已绑定的知识库无需重新选择。调整分段规则后应当用它，而不是 reset。
 */
async function cmdReindex() {
  if (!fs.existsSync(MAPPING_FILE)) die('缺少映射文件，请先运行 init');
  const map = JSON.parse(fs.readFileSync(MAPPING_FILE, 'utf8'));
  const jobs = Object.entries(map).filter(([, v]) => v && !String(v).startsWith('<'));
  if (!jobs.length) die('映射表里没有有效的 dataset_id');

  let total = 0;
  const plan = [];
  for (const [dir, id] of jobs) {
    const docs = await fetchDocs(id);
    plan.push({ dir, id, docs });
    total += docs.length;
    await sleep(200);
  }

  console.log(`\n将清空以下知识库中的文档后重新上传（知识库本身保留，ID 不变）：\n`);
  for (const p of plan) console.log(`    ${p.dir.padEnd(22)} ${String(p.docs.length).padStart(3)} 篇`);
  console.log(`\n合计删除 ${total} 篇，随后重新上传 153 篇。`);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ans = await rl.question('\n确认请完整输入 REINDEX 后回车（其他任何输入均取消）: ');
  rl.close();
  if (ans.trim() !== 'REINDEX') {
    console.log('\n已取消，未改动任何内容。\n');
    return;
  }

  let del = 0, fail = 0;
  for (const p of plan) {
    console.log(`\n>>> 清空 ${p.dir}`);
    for (const d of p.docs) {
      try {
        await api('DELETE', `/datasets/${p.id}/documents/${d.id}`);
        del++;
      } catch (e) {
        fail++;
        console.log(`  删除失败 ${d.name}: ${e.message}`);
      }
      await sleep(250);
    }
    console.log(`  已删除 ${p.docs.length} 篇`);
  }
  console.log(`\n共删除 ${del} 篇，失败 ${fail} 篇。`);

  if (fs.existsSync(STATE_FILE)) fs.unlinkSync(STATE_FILE);
  console.log('上传进度已清空。\n下一步：node scripts/dify-kb-upload.mjs upload --all\n');
}

/**
 * 重置：删除本次创建的 5 个目标库并清空上传进度，用于换 embedding 模型后重来。
 * 只动 _mapping.json 里记录的库，旧库不受影响。
 */
async function cmdReset() {
  if (!fs.existsSync(MAPPING_FILE)) die('没有映射文件，无需重置');
  const map = JSON.parse(fs.readFileSync(MAPPING_FILE, 'utf8'));
  const jobs = Object.entries(map).filter(([, v]) => v && !String(v).startsWith('<'));
  if (!jobs.length) die('映射表里没有有效的 dataset_id，无需重置');

  console.log('\n将删除以下本次创建的知识库（账号内其他知识库不受影响）：\n');
  for (const [dir, id] of jobs) console.log(`    ${dir.padEnd(22)} ${id}`);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ans = await rl.question('\n确认请完整输入 RESET 后回车（其他任何输入均取消）: ');
  rl.close();
  if (ans.trim() !== 'RESET') {
    console.log('\n已取消，未删除任何内容。\n');
    return;
  }

  let ok = 0;
  for (const [dir, id] of jobs) {
    try {
      await api('DELETE', `/datasets/${id}`);
      ok++;
      console.log(`  已删除  ${dir}`);
    } catch (e) {
      console.log(`  失败    ${dir}: ${e.message}`);
    }
    await sleep(DELAY_MS);
  }

  // 映射表复位为模板，上传进度清空，以便 init/upload 重新来过
  const tpl = {};
  for (const s of KB_SPEC) tpl[s.dir] = '<运行 init 后自动填入>';
  fs.writeFileSync(MAPPING_FILE, JSON.stringify(tpl, null, 2) + '\n', 'utf8');
  if (fs.existsSync(STATE_FILE)) fs.unlinkSync(STATE_FILE);

  console.log(`\n已删除 ${ok} 个库，映射表与上传进度已清空。`);
  console.log('下一步：确认 embedding 模型后重新 init 并 upload --all\n');
}

/** 递归统计备份目录下的 markdown 篇数 */
function countBackupFiles(dir) {
  if (!fs.existsSync(dir)) return 0;
  let n = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) n += countBackupFiles(p);
    else if (e.name.endsWith('.md')) n++;
  }
  return n;
}

/** 取某个知识库下的文档列表 */
async function fetchDocs(datasetId) {
  const out = [];
  for (let page = 1; page <= 20; page++) {
    const r = await api('GET', `/datasets/${datasetId}/documents?page=${page}&limit=100`);
    const items = r.data || [];
    out.push(...items);
    if (items.length < 100) break;
    await sleep(200);
  }
  return out;
}

/**
 * 审计：列出所有知识库及其文档，标记哪些是本次新建的 5 个。
 * 只读，不做任何修改。删除前务必先看这份清单——旧库里可能存有
 * 本地素材中没有的内容，删掉无法恢复。
 */
async function cmdAudit() {
  const r = await api('GET', '/datasets?page=1&limit=100');
  const all = r.data || [];
  const targetNames = new Set(KB_SPEC.map((s) => s.name));
  const keep = [];
  const others = [];

  console.log(`\n账号下共 ${all.length} 个知识库，逐个读取文档清单...\n`);
  for (const d of all) {
    let docs = [];
    try { docs = await fetchDocs(d.id); } catch (e) { docs = []; }
    const row = { id: d.id, name: d.name, count: docs.length, docs: docs.map((x) => x.name) };
    (targetNames.has(d.name) ? keep : others).push(row);
    await sleep(200);
  }

  console.log('='.repeat(72));
  console.log(`本次新建，需保留 (${keep.length} 个)`);
  console.log('='.repeat(72));
  for (const k of keep) console.log(`  ${String(k.count).padStart(3)} 篇  ${k.name}`);

  console.log('\n' + '='.repeat(72));
  console.log(`其余知识库 (${others.length} 个) —— 删除前请逐行确认`);
  console.log('='.repeat(72));
  for (const o of others) {
    console.log(`\n  [${o.id}]  ${o.name}   (${o.count} 篇)`);
    for (const n of o.docs.slice(0, 5)) console.log(`      - ${n}`);
    if (o.docs.length > 5) console.log(`      ... 另有 ${o.docs.length - 5} 篇`);
  }

  const listFile = path.join(KB_ROOT, '_audit.json');
  fs.writeFileSync(listFile, JSON.stringify({ keep, others }, null, 2), 'utf8');
  console.log(`\n完整清单已写入 ${listFile}`);
  console.log(`\n下一步：`);
  console.log(`  备份旧库内容:  node scripts/dify-kb-upload.mjs export`);
  console.log(`  备份后再删除:  node scripts/dify-kb-upload.mjs prune --confirm\n`);
}

/**
 * 导出：把非目标知识库的全部内容抓回本地 markdown，作为删除前的备份。
 */
async function cmdExport() {
  const auditFile = path.join(KB_ROOT, '_audit.json');
  if (!fs.existsSync(auditFile)) die('请先运行 audit 命令生成清单');
  const { others } = JSON.parse(fs.readFileSync(auditFile, 'utf8'));
  const outDir = path.resolve(KB_ROOT, '..', '_旧知识库备份');
  fs.mkdirSync(outDir, { recursive: true });

  let files = 0;
  let skipped = 0;
  const failed = [];
  for (const kb of others) {
    // 知识库名常以 ".md..." 结尾。Windows 会截掉路径尾部的点，
    // 造成资源管理器与 PowerShell 无法进入该目录（Node 却能读写），
    // 因此建目录前必须去掉尾部的点和空格。
    const safeKb = kb.name.replace(/[\\/:*?"<>|]/g, '_').replace(/[.\s]+$/, '') || 'unnamed';
    const dir = path.join(outDir, safeKb);
    fs.mkdirSync(dir, { recursive: true });
    let docs = [];
    try { docs = await fetchDocs(kb.id); } catch (e) { console.log(`  读取失败 ${kb.name}: ${e.message}`); continue; }
    for (const doc of docs) {
      const safe = String(doc.name).replace(/[\\/:*?"<>|]/g, '_').slice(0, 120);
      const outPath = path.join(dir, safe.endsWith('.md') ? safe : safe + '.md');
      // 断点续传：已导出且非空的直接跳过，中断后重跑只补缺失部分
      if (fs.existsSync(outPath) && fs.statSync(outPath).size > 0) {
        skipped++;
        continue;
      }
      try {
        const seg = await api('GET', `/datasets/${kb.id}/documents/${doc.id}/segments`);
        const body = (seg.data || []).map((s) => s.content).join('\n\n');
        fs.writeFileSync(
          outPath,
          `---\n来源知识库: ${kb.name}\n原文档名: ${doc.name}\n---\n\n${body}\n`,
          'utf8'
        );
        files++;
        console.log(`  已导出 [${kb.name}] ${doc.name}  (${body.length} 字)`);
      } catch (e) {
        failed.push(`${kb.name} / ${doc.name}  ->  ${e.message}`);
        console.log(`  导出失败 [${kb.name}] ${doc.name}: ${e.message}`);
      }
      await sleep(300);
    }
  }

  const expected = others.reduce((s, o) => s + (o.count || 0), 0);
  const have = countBackupFiles(outDir);
  console.log(`\n本次导出 ${files} 篇，跳过已存在 ${skipped} 篇，失败 ${failed.length} 篇`);
  console.log(`备份目录现有 ${have} 篇 / 应有 ${expected} 篇`);
  if (failed.length) {
    console.log('\n失败明细：');
    for (const f of failed.slice(0, 20)) console.log('  ' + f);
    if (failed.length > 20) console.log(`  ... 另有 ${failed.length - 20} 条`);
  }
  if (have < expected) {
    console.log(`\n仍缺 ${expected - have} 篇。重跑本命令可继续补齐，补齐前 prune 会拒绝执行。\n`);
  } else {
    console.log(`\n备份完整，可以执行 prune 预览。\n`);
  }
}

/**
 * 删除非目标知识库。不可恢复，默认只预览，必须显式加 --confirm 才真正执行。
 */
async function cmdPrune(args) {
  const auditFile = path.join(KB_ROOT, '_audit.json');
  if (!fs.existsSync(auditFile)) die('请先运行 audit 命令生成清单');
  const { others } = JSON.parse(fs.readFileSync(auditFile, 'utf8'));
  const confirmed = args.includes('--confirm');
  const backupDir = path.resolve(KB_ROOT, '..', '_旧知识库备份');

  if (!confirmed) {
    console.log(`\n将要删除以下 ${others.length} 个知识库（当前为预览，未执行）：\n`);
    for (const o of others) console.log(`  ${String(o.count).padStart(3)} 篇  ${o.name}`);
    console.log(`\n删除不可恢复。确认无误后加 --confirm 执行：`);
    console.log(`  node scripts/dify-kb-upload.mjs prune --confirm\n`);
    return;
  }

  if (!fs.existsSync(backupDir)) {
    die(`未找到备份目录 ${backupDir}，请先运行 export 备份，避免误删无法恢复的内容`);
  }

  // 仅检查目录是否存在并不足以保证安全：export 中途失败时目录已建好、
  // 内容却几乎是空的。这里按文档篇数核对，数量对不上就拒绝删除。
  const backupCount = countBackupFiles(backupDir);
  const expected = others.reduce((s, o) => s + (o.count || 0), 0);
  if (backupCount < expected) {
    die(
      `备份不完整，拒绝删除。\n` +
      `       应备份 ${expected} 篇，实际只有 ${backupCount} 篇，缺 ${expected - backupCount} 篇。\n` +
      `       请重新运行 export 补齐（已导出的会自动跳过）：\n` +
      `         node scripts/dify-kb-upload.mjs export`
    );
  }
  console.log(`\n备份核对通过：${backupCount} 篇 >= 应备份 ${expected} 篇`);

  // 交互式二次确认。仅靠一个命令行标志就能触发 31 次不可逆删除太危险，
  // 误加参数、翻历史命令重跑都可能造成无法挽回的后果。
  console.log(`\n即将永久删除以下 ${others.length} 个知识库：`);
  for (const o of others) console.log(`    ${String(o.count).padStart(3)} 篇  ${o.name}`);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`\n此操作不可恢复。确认请完整输入 DELETE 后回车（其他任何输入均取消）: `);
  rl.close();
  if (answer.trim() !== 'DELETE') {
    console.log('\n已取消，未删除任何内容。\n');
    return;
  }

  console.log(`\n开始删除 ${others.length} 个知识库...\n`);
  let ok = 0, fail = 0;
  for (const o of others) {
    try {
      await api('DELETE', `/datasets/${o.id}`);
      ok++;
      console.log(`  已删除  ${o.name}  (${o.count} 篇)`);
    } catch (e) {
      fail++;
      console.log(`  失败    ${o.name}: ${e.message}`);
    }
    await sleep(DELAY_MS);
  }
  console.log(`\n完成：删除 ${ok} 个，失败 ${fail} 个。备份保留在 ${backupDir}\n`);
}

function cmdPlan() {
  console.log('\n上传计划（不发送任何请求）\n');
  let total = 0;
  for (const dir of listLocalDirs()) {
    const files = listMd(dir);
    const stat = { '\n###': 0, '\n##': 0, '\n\n': 0 };
    let chars = 0;
    for (const f of files) {
      const t = fs.readFileSync(f, 'utf8');
      chars += t.length;
      stat[buildProcessRule(t).rule.rules.segmentation.separator]++;
    }
    total += files.length;
    console.log(`${dir}`);
    console.log(`  ${files.length} 篇 / ${chars.toLocaleString()} 字符`);
    console.log(`  按三级标题切: ${stat['\n###']}   按二级标题切: ${stat['\n##']}   按空行切: ${stat['\n\n']}`);
  }
  console.log(`\n合计 ${total} 篇。预计耗时约 ${Math.ceil((total * DELAY_MS) / 1000 / 60)} 分钟（含限流间隔）。\n`);
}

async function uploadDir(dir, datasetId) {
  const files = listMd(dir);
  const state = loadState();
  state[dir] = state[dir] || {};
  let ok = 0, skip = 0, fail = 0;
  console.log(`\n>>> ${dir} -> ${datasetId}  (${files.length} 篇)\n`);
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const name = path.basename(f, '.md');
    const tag = `[${String(i + 1).padStart(3)}/${files.length}]`;
    if (state[dir][name]) { skip++; console.log(`${tag} 跳过(已传) ${name}`); continue; }
    const text = fs.readFileSync(f, 'utf8');
    const { rule, reason } = buildProcessRule(text);
    try {
      const res = await api('POST', `/datasets/${datasetId}/document/create-by-text`, {
        name,
        text,
        indexing_technique: 'high_quality',
        process_rule: rule,
      });
      state[dir][name] = res.document?.id || true;
      saveState(state);
      ok++;
      console.log(`${tag} 已上传 ${name}  (${text.length} 字, ${reason})`);
    } catch (e) {
      fail++;
      console.log(`${tag} 失败   ${name}  -> ${e.message}`);
    }
    await sleep(DELAY_MS);
  }
  console.log(`\n${dir} 完成：成功 ${ok}，跳过 ${skip}，失败 ${fail}\n`);
  return { ok, skip, fail };
}

async function cmdUpload(args) {
  let jobs = [];
  if (args[0] === '--all') {
    if (!fs.existsSync(MAPPING_FILE)) die(`缺少映射文件 ${MAPPING_FILE}，先运行 list 命令`);
    const map = JSON.parse(fs.readFileSync(MAPPING_FILE, 'utf8'));
    jobs = Object.entries(map).filter(([, v]) => v && !String(v).startsWith('<'));
    if (!jobs.length) die('映射文件里没有有效的 dataset_id');
  } else {
    const [dir, id] = args;
    if (!dir || !id) die('用法: upload <库目录名> <dataset_id>   或   upload --all');
    jobs = [[dir, id]];
  }
  const sum = { ok: 0, skip: 0, fail: 0 };
  for (const [dir, id] of jobs) {
    if (!listLocalDirs().includes(dir)) { console.log(`跳过未知目录: ${dir}`); continue; }
    const r = await uploadDir(dir, id);
    sum.ok += r.ok; sum.skip += r.skip; sum.fail += r.fail;
  }
  console.log('='.repeat(50));
  console.log(`全部完成：成功 ${sum.ok}，跳过 ${sum.skip}，失败 ${sum.fail}`);
  console.log(`进度已记录在 ${STATE_FILE}，中断后重跑会自动跳过已传文件。`);
  if (sum.fail) console.log('失败项重跑本命令即可，成功的不会重复上传。');
}

const [cmd, ...rest] = process.argv.slice(2);
try {
  if (cmd === 'list') await cmdList();
  else if (cmd === 'init') await cmdInit();
  else if (cmd === 'plan') cmdPlan();
  else if (cmd === 'upload') await cmdUpload(rest);
  else if (cmd === 'status') await cmdStatus();
  else if (cmd === 'reindex') await cmdReindex();
  else if (cmd === 'reset') await cmdReset();
  else if (cmd === 'sync-yml') await cmdSyncYml();
  else if (cmd === 'audit') await cmdAudit();
  else if (cmd === 'export') await cmdExport();
  else if (cmd === 'prune') await cmdPrune(rest);
  else {
    console.log(`
Dify 知识库批量上传

上传：
  list                列出账号下所有知识库及 id（只读）
  init                创建 5 个目标知识库并写入映射表
  plan                预览上传计划（不发请求）
  upload --all        按映射表全量上传
  upload <目录> <id>  上传单个目录

清理旧库：
  status              诊断 5 个目标库的索引进度与失败原因（只读）
  reindex             清空库内文档后重传（保留库与ID，绑定无需重做）
  reset               删除本次创建的 5 个库并清空进度，用于换模型重来
  sync-yml            把线上知识库的 embedding 配置同步写回工作流 DSL
  audit               列出所有库及其文档清单，标记新旧（只读）
  export              把非目标库的内容导出到本地备份
  prune               预览将删除的库
  prune --confirm     执行删除（不可恢复，要求已完成 export）

典型流程：
  1) $env:DIFY_DATASET_API_KEY="dataset-xxxx"
  2) node scripts/dify-kb-upload.mjs init
  3) node scripts/dify-kb-upload.mjs upload --all

密钥在 Dify「知识库 → 服务 API → API 密钥」处创建，只从环境变量读取。
`);
  }
} catch (e) {
  die(e.message);
}
