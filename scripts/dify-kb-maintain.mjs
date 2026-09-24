#!/usr/bin/env node
/**
 * Dify 知识库日常维护：备份、查看、检索测试、按原规则更新文档、停用/启用文档。
 *
 * 为什么另写一个：dify-kb-upload.mjs 管的是"从零建库、批量上传"，
 * 它的 export 只备份要删的库。日常维护要的是：动任何一篇之前先把**全部**库备份下来、
 * 改完用真实检索验证、有问题能一键恢复。停用（disable）优先于删除——停用可以随时恢复。
 *
 * 密钥读 .env.local 里的 DIFY_DATASET_API_KEY（也可以用同名环境变量），绝不打印。
 *
 * 用法：
 *   node scripts/dify-kb-maintain.mjs backup <目录>                   全部库、全部文档、全部分段备份到本地
 *   node scripts/dify-kb-maintain.mjs docs [库名]                      列出文档（名称、状态、字数、分段数）
 *   node scripts/dify-kb-maintain.mjs retrieve <库名|all> "<检索词>"   检索测试，看能召回什么
 *   node scripts/dify-kb-maintain.mjs update <库名> <本地文件>         用本地文件覆盖同名文档（分段规则同上传脚本）
 *   node scripts/dify-kb-maintain.mjs disable|enable <库名> <文档名>   停用 / 恢复一篇文档
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BASE = process.env.DIFY_API_BASE || 'https://api.dify.ai/v1';

function readKey() {
  if (process.env.DIFY_DATASET_API_KEY) return process.env.DIFY_DATASET_API_KEY.trim();
  try {
    const line = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')
      .split(/\r?\n/).find((l) => l.startsWith('DIFY_DATASET_API_KEY='));
    return line ? line.slice('DIFY_DATASET_API_KEY='.length).trim().replace(/^["']|["']$/g, '') : '';
  } catch {
    return '';
  }
}
const KEY = readKey();

function die(msg) {
  console.error('\n[错误] ' + msg + '\n');
  process.exit(1);
}
if (!KEY.startsWith('dataset-')) die('没有找到知识库密钥：在 .env.local 里加一行 DIFY_DATASET_API_KEY=dataset-…');

async function api(method, endpoint, body, { form } = {}) {
  const res = await fetch(BASE + endpoint, {
    method,
    headers: form ? { Authorization: 'Bearer ' + KEY } : { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
    body: form || (body ? JSON.stringify(body) : undefined),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) throw new Error(`HTTP ${res.status} ${endpoint}: ${json.message || json.code || text.slice(0, 200)}`);
  return json;
}

async function datasets() {
  const r = await api('GET', '/datasets?page=1&limit=100');
  return r.data || [];
}

async function datasetByName(name) {
  const all = await datasets();
  const hit = all.find((d) => d.name === name) || all.find((d) => d.name.includes(name));
  if (!hit) die(`找不到知识库「${name}」。现有：${all.map((d) => d.name).join('、')}`);
  return hit;
}

async function documents(datasetId) {
  const out = [];
  for (let page = 1; ; page++) {
    const r = await api('GET', `/datasets/${datasetId}/documents?page=${page}&limit=100`);
    out.push(...(r.data || []));
    if (!r.has_more) break;
  }
  return out;
}

async function segments(datasetId, docId) {
  const out = [];
  for (let page = 1; ; page++) {
    const r = await api('GET', `/datasets/${datasetId}/documents/${docId}/segments?page=${page}&limit=100`);
    out.push(...(r.data || []));
    if (!r.has_more) break;
  }
  return out;
}

/** 与 dify-kb-upload.mjs 的 buildProcessRule 保持一致：有标题层级按标题切，否则整篇一段 */
function buildProcessRule(text) {
  const h3 = (text.match(/^### /gm) || []).length;
  const h2 = (text.match(/^## /gm) || []).length;
  let separator = '\n<<<NEVER_SPLIT_HERE>>>\n';
  if (h3 >= 10) separator = '\n###';
  else if (h2 >= 10) separator = '\n##';
  return {
    mode: 'custom',
    rules: {
      pre_processing_rules: [
        { id: 'remove_extra_spaces', enabled: true },
        { id: 'remove_urls_emails', enabled: false },
      ],
      segmentation: { separator, max_tokens: 1000, chunking_overlap: 120 },
    },
  };
}

const safe = (s) => s.replace(/[\\/:*?"<>|]/g, '_');

async function cmdBackup(dir) {
  if (!dir) die('用法：backup <目录>');
  fs.mkdirSync(dir, { recursive: true });
  const all = await datasets();
  let docCount = 0;
  for (const ds of all) {
    const dsDir = path.join(dir, safe(ds.name));
    fs.mkdirSync(dsDir, { recursive: true });
    const docs = await documents(ds.id);
    const meta = [];
    for (const d of docs) {
      const segs = await segments(ds.id, d.id);
      const body = segs.sort((a, b) => a.position - b.position).map((s) => s.content).join('\n\n');
      fs.writeFileSync(path.join(dsDir, safe(d.name) + '.md'), body);
      meta.push({ id: d.id, name: d.name, enabled: d.enabled, word_count: d.word_count, segments: segs.length });
      docCount++;
    }
    fs.writeFileSync(path.join(dsDir, '_文档清单.json'), JSON.stringify({ dataset: { id: ds.id, name: ds.name }, docs: meta }, null, 2));
    console.log(`  ${ds.name}：${docs.length} 篇`);
  }
  console.log(`已备份 ${all.length} 个库、${docCount} 篇文档到 ${dir}`);
}

async function cmdDocs(name) {
  const list = name ? [await datasetByName(name)] : await datasets();
  for (const ds of list) {
    const docs = await documents(ds.id);
    console.log(`\n== ${ds.name}（${docs.length} 篇）`);
    for (const d of docs) {
      console.log(`  ${d.enabled ? '启用' : '停用'}  ${String(d.word_count).padStart(7)}字  ${d.indexing_status}  ${d.name}`);
    }
  }
}

async function cmdRetrieve(name, query) {
  if (!query) die('用法：retrieve <库名|all> "<检索词>"');
  const list = name === 'all' ? await datasets() : [await datasetByName(name)];
  for (const ds of list) {
    const r = await api('POST', `/datasets/${ds.id}/retrieve`, { query });
    console.log(`\n== ${ds.name}`);
    for (const rec of r.records || []) {
      const seg = rec.segment || {};
      console.log(`  ${(rec.score ?? 0).toFixed(2)}  ${seg.document?.name}  「${(seg.content || '').replace(/\s+/g, ' ').slice(0, 60)}」`);
    }
  }
}

async function cmdUpdate(name, file) {
  if (!file || !fs.existsSync(file)) die('用法：update <库名> <本地文件>');
  const ds = await datasetByName(name);
  const base = path.basename(file);
  // Dify 里的文档名多半不带扩展名（上传脚本传的是去掉 .md 的名字）
  const stem = base.replace(/\.[^.]+$/, '');
  const doc = (await documents(ds.id)).find((d) => d.name === base || d.name === stem);
  if (!doc) die(`库「${ds.name}」里没有叫「${stem}」的文档`);
  const text = fs.readFileSync(file, 'utf8');
  const rule = buildProcessRule(text);
  try {
    const r = await api('POST', `/datasets/${ds.id}/documents/${doc.id}/update-by-text`, {
      name: doc.name,
      text,
      process_rule: rule,
    });
    console.log(`已提交更新：${ds.name} / ${doc.name}（批次 ${r.batch}），Dify 正在重新分段索引`);
  } catch (e) {
    /*
     * 实测：网页上传建的文档，接口更新会被拒（"Document is not available"），
     * 尽管它的状态是可用的。退路：用清理后的内容新建一篇同名文档，
     * 再把旧的停用——停用随时可以恢复，不删任何东西。
     */
    console.log(`  原文档不接受接口更新（${e.message.slice(0, 60)}），改为新建一篇再停用旧的`);
    const r = await api('POST', `/datasets/${ds.id}/document/create-by-text`, {
      name: doc.name,
      text,
      indexing_technique: 'high_quality',
      process_rule: rule,
    });
    await api('PATCH', `/datasets/${ds.id}/documents/status/disable`, { document_ids: [doc.id] });
    console.log(`已新建：${ds.name} / ${doc.name}（新文档 ${r.document?.id}，批次 ${r.batch}）；旧文档 ${doc.id} 已停用，可用 enable 恢复`);
  }
}

async function cmdStatus(action, name, docName) {
  if (!docName) die(`用法：${action} <库名> <文档名>`);
  const ds = await datasetByName(name);
  const doc = (await documents(ds.id)).find((d) => d.name === docName || d.name.includes(docName));
  if (!doc) die(`库「${ds.name}」里没有「${docName}」`);
  await api('PATCH', `/datasets/${ds.id}/documents/status/${action}`, { document_ids: [doc.id] });
  console.log(`${action === 'disable' ? '已停用' : '已恢复'}：${ds.name} / ${doc.name}`);
}

const [cmd, ...args] = process.argv.slice(2);
try {
  if (cmd === 'backup') await cmdBackup(args[0]);
  else if (cmd === 'docs') await cmdDocs(args[0]);
  else if (cmd === 'retrieve') await cmdRetrieve(args[0], args[1]);
  else if (cmd === 'update') await cmdUpdate(args[0], args[1]);
  else if (cmd === 'disable' || cmd === 'enable') await cmdStatus(cmd, args[0], args[1]);
  else console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 18).join('\n'));
} catch (e) {
  die(e.message);
}
