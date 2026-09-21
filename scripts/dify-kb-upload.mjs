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
  let separator = '\n\n';
  let reason = '无标题层级，按空行切分';
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
      retrieval_model: RETRIEVAL_MODEL,
    };
    let res;
    try {
      res = await api('POST', '/datasets', payload);
    } catch (e) {
      // 某些 Dify 版本不接受 retrieval_model，降级为基础参数重试，
      // 检索配置改由界面调整
      console.log(`  (带检索配置创建失败，降级重试: ${e.message})`);
      delete payload.retrieval_model;
      res = await api('POST', '/datasets', payload);
    }
    map[spec.dir] = res.id;
    console.log(`已创建      ${spec.name}  -> ${res.id}`);
    await sleep(DELAY_MS);
  }

  fs.writeFileSync(MAPPING_FILE, JSON.stringify(map, null, 2) + '\n', 'utf8');
  console.log(`\n映射已写入 ${MAPPING_FILE}`);
  console.log('\n下一步：node scripts/dify-kb-upload.mjs upload --all\n');
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
  for (const kb of others) {
    const safeKb = kb.name.replace(/[\\/:*?"<>|]/g, '_');
    const dir = path.join(outDir, safeKb);
    fs.mkdirSync(dir, { recursive: true });
    let docs = [];
    try { docs = await fetchDocs(kb.id); } catch (e) { console.log(`  读取失败 ${kb.name}: ${e.message}`); continue; }
    for (const doc of docs) {
      try {
        const seg = await api('GET', `/datasets/${kb.id}/documents/${doc.id}/segments`);
        const body = (seg.data || []).map((s) => s.content).join('\n\n');
        const safe = String(doc.name).replace(/[\\/:*?"<>|]/g, '_').slice(0, 120);
        fs.writeFileSync(
          path.join(dir, safe.endsWith('.md') ? safe : safe + '.md'),
          `---\n来源知识库: ${kb.name}\n原文档名: ${doc.name}\n---\n\n${body}\n`,
          'utf8'
        );
        files++;
        console.log(`  已导出 [${kb.name}] ${doc.name}  (${body.length} 字)`);
      } catch (e) {
        console.log(`  导出失败 [${kb.name}] ${doc.name}: ${e.message}`);
      }
      await sleep(300);
    }
  }
  console.log(`\n共导出 ${files} 篇到 ${outDir}`);
  console.log('确认备份无误后再执行 prune。\n');
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
