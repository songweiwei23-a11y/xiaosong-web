"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// .tmp/content-repair-mode-check_20261008.ts
var import_node_fs = __toESM(require("node:fs"));

// lib/dify-errors.ts
function isContextOverflowError(message) {
  return /context (window|length)|maximum context|too many tokens|prompt is too long|input (is )?too long|exceeds the model/i.test(
    message || ""
  );
}
function difyEventError(data) {
  if (!data || typeof data !== "object") return null;
  if (data.event === "error") return String(data.message || data.code || "\u751F\u6210\u5931\u8D25");
  if (data.event === "workflow_finished" && data.data?.status === "failed") {
    return String(data.data?.error || "\u5DE5\u4F5C\u6D41\u8FD0\u884C\u5931\u8D25");
  }
  return null;
}
var PAYLOAD_TOO_LARGE = /PayloadTooLarge|payload_bytes|request entity too large|\b413\b/i;
function friendlyDifyError(message) {
  if (isContextOverflowError(message)) return "\u8FD9\u6B21\u8981\u5904\u7406\u7684\u5185\u5BB9\u592A\u957F\u4E86\uFF0C\u5DF2\u7ECF\u4E3A\u4F60\u6362\u4E86\u4E00\u4E2A\u65B0\u7A97\u53E3\uFF0C\u8BF7\u518D\u70B9\u4E00\u6B21\u751F\u6210";
  if (PAYLOAD_TOO_LARGE.test(message)) return "\u8FD9\u6B21\u53D1\u7ED9 AI \u7684\u622A\u56FE\u592A\u5927\u4E86\uFF0C\u8BF7\u70B9\u300C\u91CD\u65B0\u62C6\u89E3\u300D\u518D\u8BD5\u4E00\u6B21";
  if (/rate limit|429|overloaded|529|too many requests/i.test(message)) return "AI \u8FD9\u4F1A\u513F\u592A\u5FD9\u4E86\uFF0C\u8BF7\u8FC7\u534A\u5206\u949F\u518D\u8BD5";
  if (/timeout|timed out/i.test(message)) return "AI \u54CD\u5E94\u8D85\u65F6\u4E86\uFF0C\u8BF7\u518D\u8BD5\u4E00\u6B21";
  return "\u751F\u6210\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5";
}

// lib/admin-auth.ts
var import_headers = require("next/headers");

// lib/supabase/fetch.ts
function createSupabaseFetch({
  authTimeoutMs = 12e3,
  requestTimeoutMs = 15e3,
  fetchImpl = (...args) => globalThis.fetch(...args)
} = {}) {
  return async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const isAuth = new URL(url).pathname.startsWith("/auth/v1/");
    const sourceSignal = init?.signal ?? (input instanceof Request ? input.signal : void 0);
    const controller = new AbortController();
    const forwardAbort = () => controller.abort(sourceSignal?.reason);
    if (sourceSignal?.aborted) forwardAbort();
    else sourceSignal?.addEventListener("abort", forwardAbort, { once: true });
    const timeout = setTimeout(() => {
      const error = new Error(isAuth ? "Authentication request timed out" : "Supabase request timed out");
      error.name = "TimeoutError";
      controller.abort(error);
    }, isAuth ? authTimeoutMs : requestTimeoutMs);
    try {
      const response = await fetchImpl(input, {
        ...init,
        ...isAuth ? { cache: "no-store" } : {},
        signal: controller.signal
      });
      if (response.body && (isAuth || response.headers.get("content-type")?.includes("json"))) {
        await response.clone().arrayBuffer();
      }
      return response;
    } finally {
      clearTimeout(timeout);
      sourceSignal?.removeEventListener("abort", forwardAbort);
    }
  };
}
var supabaseFetch = createSupabaseFetch();

// lib/config/plans.ts
var COUNTED_FEATURES = [
  { key: "script", column: "script_used", name: "\u811A\u672C\u751F\u6210" },
  { key: "topic", column: "topic_used", name: "\u9009\u9898\u7B56\u5212" },
  { key: "positioning", column: "positioning_used", name: "\u8D26\u53F7\u5B9A\u4F4D" },
  { key: "freeChat", column: "free_chat_used", name: "\u81EA\u7531\u5BF9\u8BDD" },
  { key: "storyboard", column: "storyboard_used", name: "\u5206\u955C\u811A\u672C" },
  { key: "review", column: "review_used", name: "\u5BA1\u7A3F\u4F18\u5316" },
  { key: "title", column: "title_used", name: "\u6807\u9898\u5C01\u9762" },
  { key: "dealReason", column: "deal_reason_used", name: "\u6210\u4EA4\u7406\u7531" },
  // 前采建档：user_quotas.interview_used 由 20260929_interview_import.sql 加
  { key: "interview", column: "interview_used", name: "\u524D\u91C7\u5EFA\u6863" },
  // 拆解爆款：user_quotas.breakdown_used 由 20260930_breakdown.sql 加
  { key: "breakdown", column: "breakdown_used", name: "\u62C6\u89E3\u7206\u6B3E" },
  // 跨行业二创：user_quotas.remix_used 由 20260930_remix.sql 加
  { key: "remix", column: "remix_used", name: "\u8DE8\u884C\u4E1A\u4E8C\u521B" },
  // 创作方向：user_quotas.direction_used 由 20261002_direction.sql 加
  { key: "direction", column: "direction_used", name: "\u521B\u4F5C\u65B9\u5411" },
  { key: "knowledge", column: "knowledge_used", name: "\u77E5\u8BC6\u5E93\u67E5\u8BE2" }
];
var FEATURE_NAMES = Object.fromEntries(
  COUNTED_FEATURES.map((f) => [f.key, f.name])
);

// lib/creation-quota.ts
function completionUsage(event) {
  if (!event || typeof event !== "object") return {};
  const e = event;
  const usage = e.metadata?.usage || e.data?.usage || {};
  const out = {};
  for (const key of ["prompt_tokens", "completion_tokens", "total_tokens", "latency", "total_price"]) {
    const raw = usage[key];
    if ((typeof raw === "number" || typeof raw === "string" && raw.trim() !== "") && Number.isFinite(Number(raw)) && Number(raw) >= 0) out[key] = Number(raw);
  }
  if (typeof usage.currency === "string" && /^[A-Za-z]{3}$/.test(usage.currency)) out.currency = usage.currency;
  for (const key of ["total_tokens", "elapsed_time"]) {
    const value = e.data?.[key];
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) out[key] = value;
  }
  return out;
}

// lib/chat-attachments.ts
var MAX_CHAT_FILE_BYTES = 10 * 1024 * 1024;
var CHAT_FILE_ACCEPT = ".jpg,.jpeg,.png,.webp,.gif,.pdf,.docx,.xlsx,.csv,.pptx,.txt,.md,.html,.xml";
var CHAT_FILE_EXTENSIONS = new Set(CHAT_FILE_ACCEPT.split(",").map((x) => x.slice(1)));

// lib/chat-attachments-server.ts
function toDifyFiles(files) {
  return files.map((file) => ({ type: file.type, transfer_method: "local_file", upload_file_id: file.id }));
}

// lib/result-reconciliation.ts
function hasObviousCutoff(text) {
  return /【(?:画面|口播|台词|镜头|字幕|动作|第\d+步)?[^】\n]{0,10}$/.test(text.trimEnd()) || /(?:^|\n)\*\*(?:画|画面|台|台词|口|口播|字|字幕|动|动作|镜|镜头)$/.test(text.trimEnd());
}

// lib/dify-task.ts
var DIFY_BASE_URL = process.env.DIFY_BASE_URL || "https://api.dify.ai/v1";
async function askDify(query, userId, searchQuery, options = {}) {
  const res = await fetch(`${DIFY_BASE_URL}/chat-messages`, {
    method: "POST",
    signal: options.signal,
    headers: { Authorization: `Bearer ${process.env.DIFY_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      inputs: { query, search_query: searchQuery, conversation_history: "", dealReasons: "", web_search_enabled: "0", web_search_note: "\u672C\u8F6E\u4E0D\u6267\u884C\u8054\u7F51\u641C\u7D22\uFF1B\u4F9D\u636E\u5F53\u524D\u7528\u6237\u6750\u6599\u4E0E\u53EF\u68C0\u7D22\u7684\u77E5\u8BC6\u5E93\u4F5C\u7B54\uFF0C\u7F3A\u5C11\u4F9D\u636E\u7684\u4FDD\u6301\u672A\u77E5\u3002" },
      query,
      response_mode: "streaming",
      user: userId,
      ...options.files?.length ? { files: toDifyFiles(options.files) } : {}
    })
  });
  if (!res.ok || !res.body) {
    console.error("[dify-task] Dify \u8C03\u7528\u5931\u8D25:", res.status, (await res.text().catch(() => "")).slice(0, 200));
    return { ok: false, message: "AI \u670D\u52A1\u6682\u65F6\u4E0D\u53EF\u7528\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5" };
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let terminal;
  let conversationId;
  let messageId;
  let usage = {};
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += done ? decoder.decode() + "\n" : decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        let data;
        try {
          data = JSON.parse(line.slice(5).trim());
        } catch {
          continue;
        }
        const failure = difyEventError(data);
        if (failure) return { ok: false, message: friendlyDifyError(failure) };
        if (typeof data.conversation_id === "string") conversationId = data.conversation_id;
        if (typeof data.message_id === "string") messageId = data.message_id;
        if (data.event === "message_end" || data.event === "workflow_finished") {
          terminal = data.event;
          usage = { ...usage, ...completionUsage(data) };
        }
        const chunk = typeof data.answer === "string" ? data.answer : typeof data.text === "string" ? data.text : "";
        if ((data.event === "message" || data.event === "text_chunk") && chunk) text += chunk;
      }
      if (done) break;
    }
  } finally {
    reader.releaseLock();
  }
  if (!text.trim()) return { ok: false, message: "\u8FD9\u6B21\u6CA1\u8BFB\u51FA\u7ED3\u679C\uFF0C\u8BF7\u91CD\u8BD5" };
  if (!terminal) return { ok: false, message: "\u56DE\u7B54\u6CA1\u6709\u5B8C\u6574\u7ED3\u675F\uFF0C\u8BF7\u91CD\u8BD5" };
  if (hasObviousCutoff(text)) return { ok: false, message: "\u56DE\u7B54\u5728\u7ED3\u6784\u6807\u7B7E\u5904\u4E2D\u65AD\uFF0C\u8BF7\u91CD\u8BD5" };
  return { ok: true, text, completion: { terminal, conversationId, messageId, usage } };
}

// .tmp/content-repair-mode-check_20261008.ts
for (const line of import_node_fs.default.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z_0-9]*)=(.*)$/);
  if (m) process.env[m[1]] = m[2].trim().replace(/^(['"])(.*)\1$/, "$2");
}
var root = "docs/\u5168\u677F\u5757\u8D28\u91CF\u4FEE\u590D_20261008/\u6B63\u5F0F\u6A21\u578B\u5BF9\u7167";
async function run(id) {
  const query = "\u3010\u672C\u8F6E\u5185\u5BB9\u843D\u5B9E\u89C4\u5219\u3011\n" + import_node_fs.default.readFileSync(`${root}/${id}_after_\u8F93\u5165.txt`, "utf8");
  import_node_fs.default.writeFileSync(`${root}/${id}_\u89C4\u5219\u5206\u652F\u8F93\u5165.txt`, query);
  const start = Date.now();
  const r = await askDify(query, `kaiwu-repair-synthetic-20261008-mode-${id}`, "\u5185\u5BB9\u4E8B\u5B9E\u8FB9\u754C \u521B\u4F5C\u65B9\u6CD5", { signal: AbortSignal.timeout(24e4) });
  import_node_fs.default.writeFileSync(`${root}/${id}_\u89C4\u5219\u5206\u652F\u7ED3\u679C.json`, JSON.stringify({ ...r, elapsedMs: Date.now() - start }, null, 2));
  if (r.ok) import_node_fs.default.writeFileSync(`${root}/${id}_\u89C4\u5219\u5206\u652F\u8F93\u51FA.md`, r.text);
  console.log(JSON.stringify({ id, ok: r.ok, elapsedMs: Date.now() - start }));
}
Promise.allSettled([run("knowledge"), run("brief")]).then((rs) => {
  for (const r of rs) if (r.status === "rejected") console.error(String(r.reason));
});
