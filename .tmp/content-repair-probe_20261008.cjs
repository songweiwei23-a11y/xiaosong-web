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

// .tmp/content-repair-probe_20261008.ts
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
  return files.map((file2) => ({ type: file2.type, transfer_method: "local_file", upload_file_id: file2.id }));
}

// lib/result-reconciliation.ts
function titleCharacterCount(title) {
  return (title.match(/[\p{L}\p{N}]/gu) ?? []).length;
}
function reconcileTitleCounts(markdown) {
  let title = "";
  let fenced = false;
  return markdown.split("\n").map((line3) => {
    if (/^\s*(```|~~~)/.test(line3)) {
      fenced = !fenced;
      title = "";
      return line3;
    }
    if (fenced) return line3;
    const heading = line3.replace(/\*\*/g, "").match(/^\s*(?:#{1,4}\s*)?(?:标题\s*)?\d{1,2}[.、．:：)）]\s*(.+?)\s*$/);
    if (heading) title = heading[1];
    else if (/^\s*#{1,4}\s/.test(line3)) title = "";
    if (title && /^\s*(?:[-*+]\s*)?\*{0,2}字数\*{0,2}\s*[：:]\s*\*{0,2}\d+/.test(line3)) {
      return `- **\u5B57\u6570**\uFF1A${titleCharacterCount(title)} \u5B57\uFF08\u4E0D\u542B\u6807\u70B9\u548C\u7A7A\u683C\uFF09`;
    }
    return line3;
  }).join("\n");
}
function hasObviousCutoff(text5) {
  return /【(?:画面|口播|台词|镜头|字幕|动作|第\d+步)?[^】\n]{0,10}$/.test(text5.trimEnd()) || /(?:^|\n)\*\*(?:画|画面|台|台词|口|口播|字|字幕|动|动作|镜|镜头)$/.test(text5.trimEnd());
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
  let text5 = "";
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
      for (const line3 of lines) {
        if (!line3.startsWith("data:")) continue;
        let data;
        try {
          data = JSON.parse(line3.slice(5).trim());
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
        if ((data.event === "message" || data.event === "text_chunk") && chunk) text5 += chunk;
      }
      if (done) break;
    }
  } finally {
    reader.releaseLock();
  }
  if (!text5.trim()) return { ok: false, message: "\u8FD9\u6B21\u6CA1\u8BFB\u51FA\u7ED3\u679C\uFF0C\u8BF7\u91CD\u8BD5" };
  if (!terminal) return { ok: false, message: "\u56DE\u7B54\u6CA1\u6709\u5B8C\u6574\u7ED3\u675F\uFF0C\u8BF7\u91CD\u8BD5" };
  if (hasObviousCutoff(text5)) return { ok: false, message: "\u56DE\u7B54\u5728\u7ED3\u6784\u6807\u7B7E\u5904\u4E2D\u65AD\uFF0C\u8BF7\u91CD\u8BD5" };
  return { ok: true, text: text5, completion: { terminal, conversationId, messageId, usage } };
}

// lib/output-rules.ts
var PRIORITY_ORDER = "\u4E8B\u5B9E\u4E0E\u5B89\u5168\u8FB9\u754C\uFF08\u4EBA\u8BBE\u4E8B\u5B9E\u5361\u3001\u7981\u5FCC\u3001\u5E73\u53F0\u89C4\u5219\uFF09 > \u7528\u6237\u8FD9\u6B21\u7684\u660E\u786E\u8981\u6C42 > \u8FD9\u6761\u5185\u5BB9\u7684\u521B\u4F5C\u76EE\u7684 > \u6A21\u677F\u548C\u6807\u51C6";
var OUTPUT_RULE_BOARDS = /* @__PURE__ */ new Set(["topic", "script", "storyboard", "review", "title", "growth", "remix", "freeChat", "direction", "knowledge", "breakdown", "dealReason"]);
var FACT_RULES = [
  "\u4EF7\u683C\u3001\u767E\u5206\u6BD4\u3001\u9500\u91CF\u3001\u5E74\u9650\u3001\u5206\u5E97\u6570\u3001\u83B7\u5956\u3001\u987E\u5BA2\u7ECF\u5386\u2014\u2014\u8D44\u6599\u91CC\u6CA1\u6709\u4F9D\u636E\u7684\u4FDD\u6301\u672A\u77E5\uFF1B\u4E0D\u80FD\u628A\u300C90%\u7684\u4EBA\u300D\u6539\u6210\u300C\u4E0D\u5C11\u4EBA\u300D\u3001\u628A\u672A\u77E5\u4EF7\u683C\u6539\u6210\u300C\u4EF7\u683C\u5F88\u4EB2\u6C11\u300D\u6765\u63A9\u76D6\u65E0\u4F9D\u636E\u7684\u5224\u65AD\u3002\u9700\u8981\u5177\u4F53\u611F\u65F6\uFF0C\u7528\u5DF2\u63D0\u4F9B\u7684\u5B9E\u7269\u3001\u52A8\u4F5C\u4E0E\u539F\u8BDD\u3002",
  "\u8D26\u53F7\u5B9A\u4F4D\u3001\u5546\u4E1A/\u5185\u5BB9\u65B9\u6848\u3001\u521B\u4F5C\u7B80\u62A5\u548C\u65E7AI\u7A3F\u662F\u7B56\u7565\u53C2\u8003\uFF0C\u4E0D\u662F\u65B0\u7684\u7ECF\u8425\u4E8B\u5B9E\u6765\u6E90\uFF1B\u6863\u6848\u6CA1\u6709\u786E\u8BA4\u7684\u5C3A\u5BF8\u3001\u4EF7\u683C\u3001\u670D\u52A1\u3001\u80FD\u529B\u3001\u7ECF\u5386\u548C\u62CD\u6444\u8D44\u6E90\uFF0C\u4E0D\u80FD\u56E0\u4E3A\u4E0A\u6E38AI\u5199\u8FC7\u5C31\u91C7\u7528\u3002",
  "\u5C1A\u672A\u91C7\u8BBF\u3001\u5C1A\u672A\u62CD\u6444\u7684\u8BA1\u5212\uFF0C\u53EA\u5199\u63D0\u95EE\u4E0E\u4E0D\u540C\u7B54\u6848\u7684\u8FFD\u95EE\u5206\u652F\uFF1B\u6807\u9898\u3001\u5F00\u7BC7\u548C\u6B63\u6587\u90FD\u4E0D\u80FD\u5199\u6210\u300C\u6211\u95EE\u4E86\u300D\u300C\u4E09\u5BB6\u771F\u5B9E\u56DE\u7B54\u300D\uFF0C\u4E0D\u80FD\u9884\u5B9A\u53D7\u8BBF\u8005\u7B54\u6848\u3002",
  "\u77E5\u8BC6\u5E93\u4E2D\u7684\u7F16\u5BFC\u65B9\u6CD5\u4E0D\u7B49\u4E8E\u884C\u4E1A\u4E13\u4E1A\u8BC1\u636E\uFF1B\u6CA1\u6709\u8D44\u6599\u652F\u6301\u7684\u5C3A\u5BF8\u6807\u51C6\u3001\u8D28\u91CF\u8BCA\u65AD\u3001\u7EF4\u4FEE\u64CD\u4F5C\u4E0E\u884C\u4E1A\u7EDF\u8BA1\uFF0C\u4E0D\u8981\u4E3A\u4E3E\u4F8B\u800C\u8865\u9020\u3002",
  "\u53EF\u4EE5\u5199\u865A\u6784\u7684\u793A\u4F8B\u5E2E\u52A9\u7406\u89E3\uFF0C\u4F46\u5FC5\u987B\u6807\u3010\u793A\u4F8B\u3011\uFF0C\u4E0D\u80FD\u5199\u6210\u300C\u6709\u4F4D\u987E\u5BA2\u8BF4\u2026\u2026\u300D\u8FD9\u79CD\u771F\u5B9E\u89C1\u8BC1\u3002",
  "\u9001\u4EC0\u4E48\u3001\u5305\u4EC0\u4E48\u3001\u4FDD\u8BC1\u4EC0\u4E48\u3001\u6253\u51E0\u6298\u2014\u2014\u8001\u677F\u6CA1\u8BF4\u8FC7\u7684\u7ECF\u8425\u627F\u8BFA\u4E0D\u80FD\u66FF\u4ED6\u7B54\u5E94\u3002",
  "\u771F\u60F3\u5199\u4E00\u4E2A\u5177\u4F53\u6570\u5B57\u53C8\u6CA1\u6709\u8D44\u6599\uFF0C\u7528\u3010\u5F85\u786E\u8BA4\uFF1Axx\u3011\u5360\u4F4D\uFF0C\u8BA9\u7528\u6237\u81EA\u5DF1\u586B\u3002",
  "\u4E0D\u8981\u5199\u300C\u81EA\u68C0\u901A\u8FC7\u300D\u300C\u65E0\u7F16\u9020\u300D\u300C\u6570\u636E\u771F\u5B9E\u300D\u8FD9\u7C7B\u81EA\u6211\u8BA4\u8BC1\uFF0C\u7CFB\u7EDF\u4F1A\u5355\u72EC\u6838\u5BF9\u3002"
];
function outputRulesBlock() {
  return ["## \u{1F9ED} \u5199\u4F5C\u5E95\u7EBF\uFF08\u6BCF\u6761\u90FD\u8981\u9075\u5B88\uFF09", "", `- **\u4F18\u5148\u7EA7**\uFF1A${PRIORITY_ORDER}\u3002\u7528\u6237\u7684\u660E\u786E\u8981\u6C42\u54EA\u6015\u53EA\u6709\u4E00\u53E5\uFF08\u300C\u53EA\u6362\u5F00\u5934\u300D\u300C\u522B\u63D0\u4EF7\u683C\u300D\uFF09\uFF0C\u4E5F\u6392\u5728\u6A21\u677F\u524D\u9762\u3002`, ...FACT_RULES.map((r) => `- ${r}`)].join("\n");
}
var FREE_CHAT_FACT_LINE = FACT_RULES.join(" ") + " \u7528\u6237\u8FD9\u6B21\u8BF4\u7684\u660E\u786E\u8981\u6C42\u4F18\u5148\u4E8E\u4EFB\u4F55\u6A21\u677F\u3002";

// lib/context-manifest.ts
var BOARD_MANIFESTS = [
  {
    board: "topic",
    label: "\u9009\u9898\u7B56\u5212",
    job: '\u627E"\u5F80\u54EA\u4E2A\u65B9\u5411\u62CD"\u3002\u8981\u77E5\u9053\u8D5B\u9053\u3001\u8BF4\u7ED9\u8C01\u542C\u3001\u6709\u4EC0\u4E48\u53EF\u6316\u7684\u3001\u4EC0\u4E48\u4E0D\u80FD\u78B0',
    profile: ["account", "audience", "viral", "restrictions"],
    brief: ["oneline", "audience", "direction", "forbidden"],
    dealReasons: true
  },
  {
    board: "script",
    label: "\u811A\u672C\u751F\u6210",
    job: '\u51B3\u5B9A"\u600E\u4E48\u8BF4"\u3002\u53E3\u543B\u3001\u8BF4\u670D\u70B9\u3001\u8BB0\u5FC6\u70B9\uFF0C\u7F3A\u4E00\u6837\u90FD\u4F1A\u5199\u6210\u901A\u7A3F',
    profile: ["account", "audience", "tone", "selling", "restrictions"],
    brief: ["oneline", "persona", "audience", "direction", "trust", "memory", "forbidden"],
    dealReasons: true
  },
  {
    board: "storyboard",
    label: "\u5206\u955C\u811A\u672C",
    job: '\u51B3\u5B9A"\u600E\u4E48\u62CD"\u3002\u53EA\u5173\u5FC3\u771F\u5B9E\u62CD\u6444\u6761\u4EF6\u548C\u753B\u9762\uFF0C\u4E0D\u9700\u8981\u77E5\u9053\u53D8\u73B0\u8DEF\u5F84',
    // 分镜表里有台词一列，禁忌同样适用——这条是测试逮出来的，原来漏了
    profile: ["account", "shooting", "restrictions"],
    brief: ["oneline", "shooting", "memory", "forbidden"],
    dealReasons: false
  },
  {
    board: "review",
    label: "\u5BA1\u7A3F\u4F18\u5316",
    job: "\u5F53\u5224\u636E\u7528\u3002\u8BED\u6C14\u5BF9\u4E0D\u5BF9\u3001\u8BF4\u7684\u662F\u4E0D\u662F\u8FD9\u7FA4\u4EBA\u5173\u5FC3\u7684\u3001\u6709\u6CA1\u6709\u8E29\u7981\u5FCC",
    profile: ["account", "audience", "tone", "restrictions"],
    brief: ["oneline", "persona", "audience", "forbidden"],
    dealReasons: false
  },
  {
    board: "title",
    label: "\u6807\u9898\u5C01\u9762",
    job: "\u7ED9\u8C01\u770B\u3001\u51ED\u4EC0\u4E48\u70B9\u3002\u8981\u4EBA\u7FA4\u75DB\u70B9\u548C\u8BF4\u670D\u70B9\uFF0C\u4E0D\u9700\u8981\u62CD\u6444\u6761\u4EF6",
    profile: ["account", "audience", "selling", "restrictions"],
    brief: ["oneline", "audience", "trust", "forbidden"],
    dealReasons: true
  },
  {
    board: "dealReason",
    label: "\u6210\u4EA4\u7406\u7531",
    job: '\u627E"\u51ED\u4EC0\u4E48\u8BA9\u4EBA\u4E70"\u3002\u8981\u5356\u70B9\u3001\u53D8\u73B0\u8DEF\u5F84\u3001\u5BA2\u6237\u987E\u8651\u2014\u2014\u4E4B\u524D\u8FD9\u4E2A\u677F\u5757\u5B8C\u5168\u6CA1\u63A5\u4E0A\u4E0B\u6587',
    profile: ["account", "audience", "selling", "monetize", "restrictions"],
    brief: ["oneline", "audience", "trust", "forbidden"],
    dealReasons: false
    // 它本身就是产出成交理由的，不该拿旧的当输入
  },
  {
    board: "growth",
    label: "\u8D77\u53F7\u65B9\u6848",
    /*
     * 原来借用的是脚本那一套，没有拍摄条件、没有爆款基因——
     * 而起号的核心就是「按真实资源挑他拍得出来的打法」，
     * 提示词让模型对照团队、设备、场地去选，模型却一样都看不到。
     */
    job: '\u6311"\u4ED6\u62CD\u5F97\u51FA\u6765\u7684"\u6253\u6CD5\u3002\u8981\u771F\u5B9E\u62CD\u6444\u6761\u4EF6\u3001\u64C5\u957F\u4EC0\u4E48\u3001\u6570\u636E\u6700\u597D\u7684\u5185\u5BB9\u7C7B\u578B\u3001\u53D8\u73B0\u65B9\u5F0F',
    profile: ["account", "audience", "tone", "shooting", "monetize", "viral", "restrictions"],
    brief: ["oneline", "persona", "audience", "direction", "shooting", "forbidden"],
    dealReasons: false
  },
  {
    board: "freeChat",
    label: "\u9AD8\u9636\u81EA\u7531",
    job: "\u968F\u53E3\u95EE\u4EC0\u4E48\u90FD\u53EF\u80FD\u3002\u7ED9\u4E00\u4EFD\u8D26\u53F7\u5168\u8C8C\uFF0C\u8BA9\u5B83\u81F3\u5C11\u77E5\u9053\u4F60\u662F\u8C01\u3001\u505A\u4EC0\u4E48\u3001\u4E0D\u80FD\u8BF4\u4EC0\u4E48",
    profile: ["account", "audience", "tone", "selling", "shooting", "restrictions"],
    brief: ["oneline", "persona", "audience", "direction", "trust", "shooting", "forbidden"],
    dealReasons: false
  },
  /*
   * 下面三个是 2026-09-30 补接的（产品方："每个板块都要有记忆，互相关联互通"）。
   * 拆解和二创另外还传了整份档案摘要（lib/profile-summary，含经营品类、团队设备），
   * 所以档案这边只切禁忌，不重复塞。
   */
  {
    board: "breakdown",
    label: "\u62C6\u89E3\u7206\u6B3E",
    job: '\u62C6\u5B8C\u4E4B\u540E"\u5957\u5230\u8FD9\u4E2A\u8D26\u53F7\u4E0A"\u7ED9 3 \u4E2A\u9009\u9898\u3002\u8981\u77E5\u9053\u8D26\u53F7\u65B9\u5411\u548C\u8BF4\u7ED9\u8C01\u542C\uFF0C\u5957\u51FA\u6765\u7684\u9009\u9898\u624D\u4E0D\u8DD1\u504F',
    profile: ["restrictions"],
    brief: ["oneline", "audience", "direction", "forbidden"],
    dealReasons: false
  },
  {
    board: "remix",
    label: "\u8DE8\u884C\u4E1A\u4E8C\u521B",
    job: "\u628A\u522B\u7684\u884C\u4E1A\u7684\u7206\u6B3E\u6362\u6210\u8FD9\u4E2A\u8D26\u53F7\u7684\u8840\u8089\u3002\u8981\u4EBA\u8BBE\u53E3\u543B\u3001\u8BF4\u7ED9\u8C01\u542C\u3001\u51ED\u4EC0\u4E48\u4FE1\u4F60\u3001\u8BB0\u5FC6\u70B9\uFF0C\u5916\u52A0\u6210\u4EA4\u7406\u7531\u5F53\u7ED3\u5C3E\u7684\u8BF4\u670D\u70B9",
    profile: ["restrictions"],
    brief: ["oneline", "persona", "audience", "trust", "memory", "forbidden"],
    dealReasons: true
  },
  {
    board: "direction",
    label: "\u521B\u4F5C\u65B9\u5411",
    /*
     * 2026-10-02 新板块。档案摘要另传（含经营品类、团队设备），这里切的是方向判断要用的：
     * 已有的内容方向和爆款基因（别重复、接着长）、变现方式（目的要落到钱上）、拍摄条件（方向要拍得出来）
     */
    job: "\u5E26\u7740\u76EE\u7684\u627E\u65B9\u5411\uFF1A\u8981\u77E5\u9053\u8FD9\u4E2A\u53F7\u5B9A\u597D\u7684\u65B9\u5411\u3001\u8BF4\u7ED9\u8C01\u542C\u3001\u51ED\u4EC0\u4E48\u4FE1\u4F60\u3001\u80FD\u62CD\u4EC0\u4E48\u3001\u9760\u4EC0\u4E48\u8D5A\u94B1\uFF0C\u65B9\u5411\u624D\u80FD\u65E2\u8FBE\u5230\u76EE\u7684\u53C8\u62CD\u5F97\u51FA\u6765",
    profile: ["monetize", "viral", "restrictions"],
    brief: ["oneline", "persona", "audience", "direction", "trust", "shooting", "forbidden"],
    dealReasons: true
  },
  {
    board: "knowledge",
    label: "\u77E5\u8BC6\u5E93",
    job: "\u7B54\u65B9\u6CD5\u8BBA\u95EE\u9898\u3002\u77E5\u9053\u8FD9\u4E2A\u53F7\u662F\u505A\u4EC0\u4E48\u7684\u3001\u8BF4\u7ED9\u8C01\u542C\uFF0C\u4E3E\u4F8B\u65F6\u5C31\u80FD\u7528\u4ED6\u81EA\u5DF1\u7684\u884C\u4E1A\uFF0C\u800C\u4E0D\u662F\u6CDB\u6CDB\u800C\u8C08",
    profile: ["account", "restrictions"],
    brief: ["oneline", "audience", "forbidden"],
    dealReasons: false
  }
];
var BY_BOARD = new Map(BOARD_MANIFESTS.map((m) => [m.board, m]));
function manifestOf(board) {
  return BY_BOARD.get(board);
}
var BOARD_LABEL = Object.fromEntries(
  BOARD_MANIFESTS.map((m) => [m.board, m.label])
);

// lib/creative-brief.ts
var BRIEF_FIELDS = [
  {
    key: "oneline",
    label: "\u4E00\u53E5\u8BDD\u5B9A\u4F4D",
    spec: "\u4E0D\u8D85\u8FC730\u5B57\u3002[\u8EAB\u4EFD]+[\u7279\u70B9]+[\u4EF7\u503C]\uFF0C\u8981\u80FD\u8BA9\u964C\u751F\u4EBA\u7ACB\u523B\u77E5\u9053\u8FD9\u4E2A\u53F7\u662F\u5E72\u4EC0\u4E48\u7684\u3002",
    hint: "\u6240\u6709\u677F\u5757\u90FD\u4F1A\u8BFB\u5230\u8FD9\u53E5\uFF0C\u5199\u5F97\u8D8A\u51C6\uFF0C\u4EA7\u51FA\u8D8A\u4E0D\u8DD1\u504F"
  },
  {
    key: "persona",
    label: "\u4EBA\u8BBE\u4E0E\u53E3\u543B",
    spec: `\u5206\u56DB\u884C\u5199\uFF0C\u6BCF\u884C\u90FD\u8981\u80FD\u76F4\u63A5\u6307\u5BFC\u5199\u6587\u6848\uFF1A
- **\u6211\u662F\u8C01**\uFF1A\u4E00\u53E5\u80FD\u88AB\u89C2\u4F17\u590D\u8FF0\u7684\u4EBA\u8BBE\u6807\u7B7E
- **\u8BF4\u8BDD\u4EC0\u4E48\u8C03**\uFF1A\u5177\u4F53\u5230\u8BED\u6C14\u8BCD\u548C\u53E5\u5F0F\u4E60\u60EF\uFF0C\u4E0D\u8981\u5199"\u4EB2\u5207\u4E13\u4E1A"\u8FD9\u79CD
- **\u4F1A\u8BF4\u7684\u4E00\u53E5\u8BDD**\uFF1A\u4E3E\u4E00\u4E2A\u771F\u5B9E\u4F8B\u5B50
- **\u4E0D\u4F1A\u8BF4\u7684\u4E00\u53E5\u8BDD**\uFF1A\u4E3E\u4E00\u4E2A\u771F\u5B9E\u4F8B\u5B50\uFF08\u8FD9\u6761\u6BD4\u4E0A\u4E00\u6761\u66F4\u6709\u7528\uFF09`,
    hint: '\u811A\u672C\u548C\u5BA1\u7A3F\u9760\u8FD9\u6BB5\u5B9A\u53E3\u543B\u3002"\u4F1A\u8BF4/\u4E0D\u4F1A\u8BF4"\u5404\u4E3E\u4E00\u4F8B\uFF0C\u6BD4\u5F62\u5BB9\u8BCD\u7BA1\u7528\u5F97\u591A'
  },
  {
    key: "audience",
    label: "\u8BF4\u7ED9\u8C01\u542C",
    spec: `\u5206\u56DB\u884C\uFF1A
- **\u753B\u50CF**\uFF1A\u4E00\u53E5\u8BDD\uFF0C\u8981\u5177\u4F53\u5230\u80FD\u60F3\u8D77\u67D0\u4E2A\u771F\u5B9E\u7684\u4EBA
- **\u4ED6\u6700\u6015\u4EC0\u4E48**\uFF1A3\u6761\uFF0C\u6BCF\u6761\u90FD\u80FD\u76F4\u63A5\u62CD\u6210\u5185\u5BB9
- **\u4ED6\u6700\u60F3\u8981\u4EC0\u4E48**\uFF1A3\u6761
- **\u4ED6\u4F1A\u641C\u4EC0\u4E48\u8BCD**\uFF1A\u5199\u51FA\u4ED6\u771F\u4F1A\u6253\u51FA\u6765\u7684\u90A3\u51E0\u4E2A\u8BCD`,
    hint: "\u9009\u9898\u3001\u811A\u672C\u3001\u6807\u9898\u3001\u5BA1\u7A3F\u90FD\u8BFB\u8FD9\u6BB5\u3002\u75DB\u70B9\u5199\u5F97\u8D8A\u5177\u4F53\uFF0C\u9009\u9898\u8D8A\u597D\u51FA"
  },
  {
    key: "direction",
    label: "\u5185\u5BB9\u65B9\u5411",
    spec: `\u5206\u4E94\u884C\uFF1A
- **\u4E09\u79CD\u89C6\u9891\u7684\u914D\u6BD4**\uFF1A\u7167\u5B9A\u4F4D\u91CC\u5B9A\u7684\u6284\uFF0C\u5199\u6210"\u6D41\u91CF\u578BX%\uFF08\u4E3B\u6253\u4EC0\u4E48\uFF09+ \u4EBA\u8BBE\u578BX%\uFF08\u4E3B\u6253\u4EC0\u4E48\uFF09+ \u53D8\u73B0\u578BX%\uFF08\u4E3B\u6253\u4EC0\u4E48\uFF09"\u2014\u2014\u914D\u6BD4\u8BF4\u7684\u662F\u76EE\u7684\uFF0C\u4E0D\u662F\u811A\u672C\u7C7B\u578B
- **\u5404\u81EA\u7684\u7ED3\u5C3E\u6307\u4EE4**\uFF1A\u6D41\u91CF\u578B\u8981\u4EC0\u4E48\u3001\u4EBA\u8BBE\u578B\u8981\u4EC0\u4E48\u3001\u53D8\u73B0\u578B\u8981\u4EC0\u4E48\uFF0C\u6BCF\u79CD\u53EA\u4E00\u4E2A
- **\u4E24\u5957\u6253\u6CD5\u5404\u7528\u4EC0\u4E48**\uFF1A\u56DB\u5927\u811A\u672C\u4E3B\u6253\u54EA\u51E0\u79CD\u7ED3\u6784\uFF1B\u8D77\u53F736\u8BA1\u4E3B\u6253\u54EA\u51E0\u8BA1\uFF08\u5199\u8BA1\u540D\uFF0C\u7167\u5B9A\u4F4D\u91CC\u6311\u7684\u6765\uFF09
- **\u80FD\u957F\u671F\u6316\u7684\u9009\u9898\u6765\u6E90**\uFF1A4-5\u4E2A\uFF0C\u6BCF\u4E2A\u4E3E\u4E00\u4E2A\u5177\u4F53\u4F8B\u5B50
- **\u660E\u786E\u4E0D\u505A\u7684\u65B9\u5411**\uFF1A3\u6761\uFF0C\u8BF4\u660E\u4E3A\u4EC0\u4E48\u4E0D\u505A`,
    hint: '"\u4E0D\u505A\u4EC0\u4E48"\u548C"\u505A\u4EC0\u4E48"\u4E00\u6837\u91CD\u8981\u2014\u2014\u5B83\u80FD\u6321\u4F4F\u8DD1\u504F\u7684\u9009\u9898'
  },
  {
    key: "trust",
    label: "\u51ED\u4EC0\u4E48\u4FE1\u4F60",
    spec: `\u5206\u4E24\u884C\uFF1A
- **\u6838\u5FC3\u5356\u70B9**\uFF1A2-3\u6761\uFF0C\u6BCF\u6761\u4E00\u53E5\u8BDD
- **\u53EF\u4EE5\u62CD\u6210\u753B\u9762\u7684\u8BC1\u636E**\uFF1A4-6\u6761\uFF0C\u5FC5\u987B\u662F\u80FD\u771F\u5B9E\u62CD\u5230\u7684\u4E1C\u897F\uFF0C\u4E0D\u662F\u5F62\u5BB9\u8BCD`,
    hint: '\u811A\u672C\u548C\u6807\u9898\u9760\u8FD9\u6BB5\u627E\u8BF4\u670D\u70B9\u3002\u8BC1\u636E\u8981\u80FD\u62CD\u51FA\u6765\uFF0C\u4E0D\u80FD\u662F"\u54C1\u8D28\u597D"\u8FD9\u79CD'
  },
  {
    key: "shooting",
    label: "\u600E\u4E48\u62CD",
    spec: `\u5206\u4E09\u884C\uFF1A
- **\u5448\u73B0\u5F62\u5F0F**\uFF1A\u53E3\u64AD/\u63A2\u5E97/Vlog/\u60C5\u666F\u5267\u7B49\uFF0C\u4E00\u53E5\u8BDD\u8BF4\u660E\u4E3A\u4EC0\u4E48\u662F\u5B83
- **\u771F\u5B9E\u6761\u4EF6**\uFF1A\u8BBE\u5907\u3001\u573A\u5730\u3001\u4E00\u4E2A\u4EBA\u8FD8\u662F\u6709\u5E2E\u624B\u3001\u4E00\u5468\u80FD\u51FA\u51E0\u6761
- **\u89C6\u89C9\u8C03\u6027**\uFF1A\u5149\u7EBF\u3001\u8272\u5F69\u3001\u955C\u5934\u7A33\u4E0D\u7A33\uFF0C\u4E00\u53E5\u8BDD`,
    hint: "\u5206\u955C\u53EA\u8BFB\u8FD9\u4E00\u6BB5\u3002\u5199\u51C6\u4E86\uFF0C\u5206\u955C\u5C31\u4E0D\u4F1A\u7ED9\u51FA\u62CD\u4E0D\u51FA\u6765\u7684\u65B9\u6848"
  },
  {
    key: "memory",
    label: "\u8BB0\u5FC6\u70B9",
    spec: "2-3\u6761\u3002\u8BED\u8A00/\u52A8\u4F5C/\u9053\u5177/\u670D\u88C5/\u573A\u666F\u58F0\u97F3\u91CC\u6311\uFF0C\u6BCF\u6761\u8BF4\u660E\u600E\u4E48\u91CD\u590D\u3002\u6807\u660E\u54EA\u4E9B\u8FD8\u5F85\u9A8C\u8BC1\u3002",
    hint: "\u56FA\u5B9A\u7684\u53E3\u5934\u7985\u3001\u624B\u52BF\u3001\u9053\u5177\u2014\u2014\u8BA9\u89C2\u4F17\u80FD\u590D\u8FF0\u4F60"
  },
  {
    key: "forbidden",
    label: "\u7EDD\u5BF9\u4E0D\u80FD\u8BF4",
    spec: "\u9010\u6761\u5217\u51FA\u3002\u5305\u542B\u8D26\u53F7\u81EA\u5DF1\u7684\u7981\u5FCC\u548C\u901A\u7528\u7EA2\u7EBF\uFF08\u7EDD\u5BF9\u5316\u7528\u8BED\u3001\u627F\u8BFA\u7597\u6548\u7B49\uFF09\u3002",
    hint: "\u786C\u7EA6\u675F\uFF0C\u6240\u6709\u677F\u5757\u90FD\u4F1A\u5E26\u4E0A\u3002\u6F0F\u4E00\u6761\u53EF\u80FD\u76F4\u63A5\u8FDD\u89C4"
  }
];
var BY_KEY = new Map(BRIEF_FIELDS.map((f) => [f.key, f]));
function buildBriefPrompt(params) {
  const fields = BRIEF_FIELDS.map(
    (f, i) => `### ${i + 1}. ${f.label}
${f.spec}`
  ).join("\n\n");
  return `\u4F60\u662F\u4E00\u4F4D\u77ED\u89C6\u9891\u4EE3\u8FD0\u8425\u7684\u4E3B\u7F16\u3002\u4E0B\u9762\u6709\u4E00\u4EFD\u5DF2\u7ECF\u5B9A\u597D\u7684\u8D26\u53F7\u5B9A\u4F4D\u65B9\u6848\uFF0C
\u73B0\u5728\u8981\u628A\u5B83**\u8F6C\u8BD1**\u6210\u4E00\u4EFD\u300C\u521B\u4F5C\u7B80\u62A5\u300D\u2014\u2014\u4F9B\u9009\u9898\u3001\u811A\u672C\u3001\u5206\u955C\u3001\u5BA1\u7A3F\u3001\u6807\u9898\u5404\u4E2A\u73AF\u8282\u76F4\u63A5\u4F7F\u7528\u3002

## \u26A0\uFE0F \u8FD9\u4E0D\u662F\u6458\u8981\uFF0C\u662F\u8F6C\u8BD1

\u5B9A\u4F4D\u65B9\u6848\u662F\u7ED9\u4EBA\u770B\u7684\uFF1A\u6709\u8BBA\u8BC1\u3001\u6709\u63A8\u5BFC\u3001\u6709\u53D6\u820D\u8FC7\u7A0B\u3002
\u7B80\u62A5\u662F\u7ED9\u521B\u4F5C\u73AF\u8282\u7528\u7684\uFF1A**\u6BCF\u4E00\u53E5\u90FD\u8981\u80FD\u76F4\u63A5\u6307\u5BFC\u751F\u6210\uFF0C\u4E0D\u8981\u8BBA\u8BC1\u8FC7\u7A0B**\u3002

\u4E3E\u4E2A\u4F8B\u5B50\uFF1A
- \u5B9A\u4F4D\u91CC\u5199\u7684\u662F\uFF1A\u300C\u540C\u884C\u4EBA\u8BBE\u5206\u5E03\uFF1A\u5927\u5E08\u578B/\u6570\u636E\u578B/\u6848\u4F8B\u578B \u2192 \u4F60\u662F\u719F\u4EBA\u578B\uFF0C\u5728\u53BF\u57DF\u4FE1\u4EFB\u58C1\u5792\u6700\u9AD8\u300D
- \u7B80\u62A5\u91CC\u5E94\u8BE5\u662F\uFF1A\u300C**\u4EBA\u8BBE**\uFF1A\u5357\u4E50\u672C\u5730\u3001\u63A5\u5355\u5148\u770B\u4EBA\u7684\u719F\u4EBA\u578B\u7F16\u5BFC\u3002\u5199\u6587\u6848\u7528\u5520\u55D1\u7684\u53E3\u6C14\uFF0C
  \u4E0D\u7528\u4E13\u4E1A\u672F\u8BED\uFF0C\u4E0D\u6446\u4E13\u5BB6\u67B6\u5B50\u300D

\u524D\u8005\u5728\u5206\u6790\uFF0C\u540E\u8005\u80FD\u7167\u7740\u5199\u3002**\u4F60\u8981\u4EA7\u51FA\u7684\u662F\u540E\u8005\u3002**

## \u{1F4C4} \u5DF2\u786E\u5B9A\u7684\u8D26\u53F7\u5B9A\u4F4D

${params.positioningFull.trim()}
${params.businessPositioning?.trim() ? `
## \u{1F4B0} \u5DF2\u505A\u8FC7\u7684\u5546\u4E1A\u5B9A\u4F4D\uFF08\u6DF1\u6316\uFF0C\u7ED3\u8BBA\u8981\u5438\u6536\u8FDB\u300C\u51ED\u4EC0\u4E48\u4FE1\u4F60\u300D\uFF09

${params.businessPositioning.trim()}
` : ""}${params.contentPositioning?.trim() ? `
## \u{1F48E} \u5DF2\u505A\u8FC7\u7684\u5185\u5BB9\u5B9A\u4F4D\uFF08\u6DF1\u6316\uFF0C\u7ED3\u8BBA\u8981\u5438\u6536\u8FDB\u300C\u5185\u5BB9\u65B9\u5411\u300D\uFF09

${params.contentPositioning.trim()}
` : ""}${params.profileSummary?.trim() ? `
## \u{1F4C7} \u8D26\u53F7\u6863\u6848\uFF08\u4E8B\u5B9E\u4EE5\u5B83\u4E3A\u51C6\uFF09

${params.profileSummary.trim()}

\u65B9\u5411\u3001\u53D6\u820D\u542C\u5B9A\u4F4D\u7684\uFF1B**\u4E8B\u5B9E**\uFF08\u51FA\u955C\u4EBA\u662F\u8C01\u3001\u5E72\u4E86\u51E0\u5E74\u3001\u4ECE\u54EA\u6765\u3001\u5728\u672C\u5730\u591A\u4E45\u3001\u4EF7\u683C\u3001\u54C1\u7C7B\uFF09\u4EE5\u8FD9\u4EFD\u6863\u6848\u4E3A\u51C6\u2014\u2014\u6863\u6848\u53EF\u80FD\u6BD4\u5B9A\u4F4D\u65B0\uFF0C\u4E24\u8FB9\u5BF9\u4E0D\u4E0A\u65F6\u6309\u6863\u6848\u5199\uFF0C\u6863\u6848\u6CA1\u5199\u7684\u5E74\u9650\u3001\u7ECF\u5386\u4E0D\u8981\u81EA\u5DF1\u8865\u3002
` : ""}${params.notes?.trim() ? `
## \u{1F4A1} \u8FD9\u6B21\u7684\u989D\u5916\u8981\u6C42

${params.notes.trim()}
` : ""}${params.mixBlock?.trim() ? `
${params.mixBlock.trim()}
- \u7B80\u62A5\u300C\u5185\u5BB9\u65B9\u5411\u300D\u91CC\u7684**\u4E09\u79CD\u89C6\u9891\u7684\u914D\u6BD4**\u7167\u8FD9\u4E2A\u6570\u5199\uFF0C\u4E0D\u7167\u4E0A\u9762\u5B9A\u4F4D\u91CC\u7684\u6284\uFF08\u5B9A\u4F4D\u53EF\u80FD\u662F\u6309\u65E7\u914D\u6BD4\u5199\u7684\uFF09
` : ""}${params.taboos?.trim() ? `
## \u26D4 \u8FD9\u4E2A\u884C\u4E1A\u7684\u7981\u5FCC

${params.taboos.trim()}
- \u7B80\u62A5\u7684\u300C\u7981\u5FCC\u300D\u90A3\u4E00\u8282\u8981\u628A**\u4E0D\u80FD\u62CD\u7684\u65B9\u5411**\u548C\u8FD9\u4E2A\u53F7\u6700\u5BB9\u6613\u8E29\u7684\u51E0\u53E5\u8BDD\u5199\u8FDB\u53BB\uFF1B\u300C\u5185\u5BB9\u65B9\u5411\u300D\u300C\u80FD\u957F\u671F\u6316\u7684\u9009\u9898\u6765\u6E90\u300D\u91CC\u4E0D\u80FD\u51FA\u73B0\u8FD9\u4E9B\u65B9\u5411
` : ""}
## \u{1F4E4} \u8F93\u51FA\u683C\u5F0F

\u4E25\u683C\u6309\u4E0B\u9762\u7684\u5C0F\u8282\u6807\u9898\u548C\u987A\u5E8F\u8F93\u51FA\uFF0C**\u6807\u9898\u4E00\u4E2A\u5B57\u90FD\u4E0D\u8981\u6539**\u2014\u2014
\u5404\u677F\u5757\u9760\u6807\u9898\u628A\u7B80\u62A5\u5207\u5F00\uFF0C\u6539\u4E86\u5C31\u8BFB\u4E0D\u5230\u4E86\u3002

${fields}

## \u270D\uFE0F \u5199\u4F5C\u8981\u6C42

- **\u6BCF\u53E5\u90FD\u662F\u6307\u4EE4**\uFF1A\u80FD\u76F4\u63A5\u62FF\u53BB\u6307\u5BFC\u5199\u6587\u6848\u3001\u8D77\u6807\u9898\u3001\u6392\u955C\u5934\u3002\u4E0D\u8981\u5199"\u8981\u6CE8\u91CD\u2026"\u8FD9\u7C7B\u7A7A\u8BDD
- **\u5177\u4F53\u5230\u80FD\u6267\u884C**\uFF1A\u4E0D\u8981\u5F62\u5BB9\u8BCD\uFF0C\u8981\u5177\u4F53\u7684\u8BCD\u3001\u53E5\u3001\u52A8\u4F5C\u3001\u753B\u9762
- **\u533A\u5206\u7B56\u7565\u548C\u4E8B\u5B9E**\uFF1A\u5B9A\u4F4D\u3001\u5546\u4E1A/\u5185\u5BB9\u65B9\u6848\u53EF\u4EE5\u63D0\u4F9B\u65B9\u5411\uFF0C\u4E0D\u80FD\u8BC1\u660E\u7ECF\u8425\u4E8B\u5B9E\u3002\u53EA\u5728\u4E0A\u6E38AI\u65B9\u6848\u91CC\u51FA\u73B0\u7684\u4EF7\u683C\u3001\u5C3A\u5BF8\u3001\u670D\u52A1\u3001\u4E13\u4E1A\u80FD\u529B\u548C\u7ECF\u5386\uFF0C\u5199\u6210\u3010\u5F85\u786E\u8BA4\u3011\uFF1B\u4E0D\u8981\u628A\u201C\u4E0D\u753B\u56FE\u7EB8\u201D\u7B49\u5EFA\u8BAE\u5199\u6210\u8001\u677F\u73B0\u6709\u505A\u6CD5\u3002\u672A\u77E5\u9879\u5141\u8BB8\u7559\u7A7A\u6216\u5F85\u786E\u8BA4\uFF0C\u4E0D\u4E3A\u586B\u6EE1\u516B\u680F\u7F16\u9020\u3002
- **\u5168\u7BC7\u63A7\u5236\u5728 1500 \u5B57\u4EE5\u5185**\uFF1A\u8FD9\u662F\u8981\u585E\u8FDB\u6BCF\u4E00\u6B21\u751F\u6210\u7684\uFF0C\u957F\u4E86\u5C31\u662F\u7ED9\u6240\u6709\u677F\u5757\u52A0\u8D1F\u62C5
- \u4E0D\u8981\u5199\u524D\u8A00\u3001\u4E0D\u8981\u590D\u8FF0\u5B9A\u4F4D\u3001\u4E0D\u8981\u89E3\u91CA\u4F60\u5728\u505A\u4EC0\u4E48\uFF0C\u76F4\u63A5\u4ECE"### 1. \u4E00\u53E5\u8BDD\u5B9A\u4F4D"\u5F00\u59CB`;
}
function parseBrief(markdown) {
  const out = {};
  if (!markdown?.trim()) return out;
  const lines = markdown.split("\n");
  let current = null;
  let buf = [];
  const flush = () => {
    if (current) out[current] = buf.join("\n").trim();
    buf = [];
  };
  for (const line3 of lines) {
    const m = line3.match(/^#{2,4}\s*(?:\d+[.、]\s*)?(.+?)\s*$/);
    if (m) {
      const hit = BRIEF_FIELDS.find((f) => m[1].includes(f.label));
      if (hit) {
        flush();
        current = hit.key;
        continue;
      }
    }
    if (current) buf.push(line3);
  }
  flush();
  return out;
}
function briefBlockFor(markdown, board) {
  const want = manifestOf(board)?.brief ?? [];
  const values = parseBrief(markdown);
  const picked = BRIEF_FIELDS.filter((f) => want.includes(f.key) && values[f.key]?.trim());
  if (picked.length === 0) return "";
  const body = picked.map((f) => `### ${f.label}

${values[f.key].trim()}`).join("\n\n");
  return `## \u{1F9ED} \u521B\u4F5C\u7B80\u62A5\uFF08\u7B56\u7565\u53C2\u8003\uFF0C\u975E\u4E8B\u5B9E\u51ED\u8BC1\uFF09

${body}

\u4EE5\u4E0A\u662F\u8D26\u53F7\u7684\u957F\u671F\u521B\u4F5C\u80CC\u666F\uFF0C\u7528\u4E8E\u8F85\u52A9\u7406\u89E3\u4EBA\u8BBE\u3001\u8BED\u6C14\u4E0E\u7981\u5FCC\u3002\u7B80\u62A5\u4E2D\u7684\u7ECF\u8425\u80FD\u529B\u3001\u670D\u52A1\u3001\u4EF7\u683C\u3001\u5C3A\u5BF8\u3001\u7ECF\u5386\u4E0E\u62CD\u6444\u6761\u4EF6\uFF0C\u53EA\u6709\u5728\u8D26\u53F7\u6863\u6848\u6216\u672C\u8F6E\u7528\u6237\u6750\u6599\u4E2D\u6709\u4F9D\u636E\u65F6\u624D\u53EF\u4F5C\u4E3A\u4E8B\u5B9E\uFF1B\u5426\u5219\u4FDD\u6301\u5F85\u786E\u8BA4\u3002\u672C\u6761\u7684\u4E3B\u9898\u3001\u4EBA\u7FA4\u3001\u76EE\u7684\u548C\u8868\u8FBE\u4EE5\u5F53\u524D\u539F\u7A3F\u53CA\u7528\u6237\u660E\u786E\u8981\u6C42\u4E3A\u51C6\uFF1B\u4E0D\u80FD\u7528\u957F\u671F\u5546\u4E1A\u5B9A\u4F4D\u66FF\u6362\u672C\u6B21\u89C2\u5BDF\u3001\u8BA8\u8BBA\u6216\u5176\u4ED6\u5185\u5BB9\u76EE\u7684\u3002\u56F4\u7ED5\u7528\u6237\u5F53\u524D\u9009\u62E9\u6DF1\u5316\uFF0C\u4E0D\u8981\u53E6\u8D77\u7089\u7076\u3002`;
}
var BRIEF_FACT_FIELDS = [
  "profile_name",
  "account_platform",
  "account_track",
  "account_stage",
  "product_category",
  "price_range",
  "monetization_model",
  "target_gender",
  "target_age",
  "target_region",
  "target_occupation",
  "target_pain_points",
  "target_needs",
  "target_interests",
  "content_style",
  "content_format",
  "content_tone",
  "content_themes",
  "competitive_advantage",
  "unique_resources",
  "interview_highlights",
  // 人设事实卡改了，简报里的人设当然就旧了
  "persona_facts"
];
var BRIEF_FACTS_PREFIX = "profile-facts:";
function profileFactsFingerprint(profile2) {
  const p = profile2 ?? {};
  const norm = (v) => Array.isArray(v) ? v.filter(Boolean).map(String).map((x) => x.trim()).join("\u3001") : v && typeof v === "object" ? JSON.stringify(Object.fromEntries(Object.entries(v).filter(([, x]) => x != null && x !== "").sort(([a], [b]) => a.localeCompare(b)))) : v == null ? "" : String(v).trim();
  const text5 = BRIEF_FACT_FIELDS.filter((k) => k !== "persona_facts" || !["", "{}"].includes(norm(p[k]))).map((k) => `${k}=${norm(p[k])}`).join("\n");
  let h = 2166136261;
  for (let i = 0; i < text5.length; i++) {
    h ^= text5.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return BRIEF_FACTS_PREFIX + h.toString(16).padStart(8, "0");
}
function briefFactsChanged(briefFacts, profile2) {
  if (!profile2 || !briefFacts || !briefFacts.startsWith(BRIEF_FACTS_PREFIX)) return false;
  return briefFacts !== profileFactsFingerprint(profile2);
}

// lib/profile-options.ts
var SELLING_POINTS = [
  { value: "\u8D28\u91CF\u597D", hint: "\u7528\u6599\u8DB3\u3001\u8D27\u771F\u4EF7\u5B9E" },
  { value: "\u6548\u679C\u597D", hint: "\u505A\u5B8C\u6539\u53D8\u660E\u663E" },
  { value: "\u6027\u4EF7\u6BD4\u9AD8", hint: "\u540C\u7B49\u4EF7\u683C\u7ED9\u5F97\u66F4\u591A" },
  { value: "\u597D\u8BC4\u591A", hint: "\u56DE\u5934\u5BA2\u591A\u3001\u53E3\u7891\u597D" },
  { value: "\u4E13\u4E1A\u5F3A", hint: "\u6709\u8D44\u8D28\u3001\u6709\u5E74\u5934\u3001\u6280\u672F\u8FC7\u786C" },
  { value: "\u8001\u677F\u597D", hint: "\u672C\u4EBA\u70ED\u60C5\u3001\u9760\u8C31\u3001\u6709\u6545\u4E8B" },
  { value: "\u670D\u52A1\u597D", hint: "\u8D34\u5FC3\u3001\u552E\u540E\u7701\u5FC3" },
  { value: "\u5B9E\u5728\u4E0D\u5751", hint: "\u660E\u7801\u6807\u4EF7\u3001\u4E0D\u5BB0\u5BA2" },
  { value: "\u6709\u7279\u8272", hint: "\u522B\u5BB6\u6CA1\u6709\u7684\u505A\u6CD5\u6216\u54C1\u7C7B" },
  { value: "\u9009\u62E9\u591A", hint: "\u54C1\u7C7B\u5168\u3001\u6B3E\u5F0F\u591A" },
  { value: "\u751F\u610F\u597D", hint: "\u6392\u961F\u3001\u706B\u7206\u3001\u5E38\u6EE1\u5EA7" },
  { value: "\u89C4\u6A21\u5927", hint: "\u8FDE\u9501\u3001\u5206\u5E97\u591A\u3001\u573A\u5730\u5927" },
  { value: "\u6848\u4F8B\u591A", hint: "\u505A\u8FC7\u7684\u5355\u5B50\u591A\u3001\u6709\u636E\u53EF\u67E5" },
  { value: "\u4FBF\u5229\u6027", hint: "\u4F4D\u7F6E\u597D\u3001\u79BB\u5F97\u8FD1\u3001\u6765\u53BB\u65B9\u4FBF" },
  { value: "\u989C\u503C\u9AD8", hint: "\u73AF\u5883\u6216\u51FA\u54C1\u597D\u770B\u3001\u9002\u5408\u62CD\u7167" },
  { value: "\u7A00\u7F3A\u552F\u4E00", hint: "\u9650\u91CF\u3001\u72EC\u5BB6\u3001\u522B\u5904\u4E70\u4E0D\u5230" },
  { value: "\u6709\u9762\u5B50", hint: "\u6863\u6B21\u3001\u54C1\u5473\u3001\u8BF7\u5BA2\u4E0D\u4E22\u4EFD" }
];
var PAIN_POINTS = [
  { value: "\u6015\u88AB\u5BB0 / \u4EF7\u683C\u4E0D\u900F\u660E", hint: "\u4E0D\u77E5\u9053\u8BE5\u82B1\u591A\u5C11\u94B1\u624D\u5408\u7406" },
  { value: "\u6015\u8D28\u91CF\u6709\u95EE\u9898", hint: "\u62C5\u5FC3\u4EE5\u6B21\u5145\u597D\u3001\u8D27\u4E0D\u5BF9\u677F" },
  { value: "\u6015\u6548\u679C\u8FBE\u4E0D\u5230\u9884\u671F", hint: "\u82B1\u4E86\u94B1\u6CA1\u7528" },
  { value: "\u4E0D\u77E5\u9053\u600E\u4E48\u6311 / \u5206\u8FA8\u4E0D\u51FA\u597D\u574F", hint: "\u7F3A\u5224\u65AD\u6807\u51C6" },
  { value: "\u88AB\u540C\u884C\u5751\u8FC7 / \u6709\u9634\u5F71", hint: "\u8E29\u8FC7\u5751\u6240\u4EE5\u8C28\u614E" },
  { value: "\u9009\u62E9\u592A\u591A / \u6311\u82B1\u773C", hint: "\u540C\u7C7B\u592A\u591A\u4E0D\u77E5\u9053\u9009\u8C01" },
  { value: "\u6015\u670D\u52A1\u6001\u5EA6\u5DEE", hint: "\u62C5\u5FC3\u88AB\u6577\u884D\u3001\u88AB\u51B7\u843D" },
  { value: "\u6015\u9EBB\u70E6 / \u6D41\u7A0B\u590D\u6742", hint: "\u4E0D\u60F3\u6298\u817E" },
  { value: "\u6015\u552E\u540E\u6CA1\u4EBA\u7BA1", hint: "\u51FA\u4E86\u95EE\u9898\u627E\u4E0D\u5230\u4EBA" },
  { value: "\u9884\u7B97\u6709\u9650\u4F46\u8981\u6C42\u4E0D\u4F4E", hint: "\u60F3\u82B1\u5C0F\u94B1\u529E\u597D\u4E8B" },
  { value: "\u65F6\u95F4\u7D27 / \u7B49\u4E0D\u8D77", hint: "\u9700\u8981\u5FEB" },
  { value: "\u4E0D\u597D\u610F\u601D\u95EE / \u6015\u663E\u5F97\u5916\u884C", hint: "\u6709\u987E\u8651\u4F46\u4E0D\u6562\u5F00\u53E3" }
];
var USER_NEEDS = [
  { value: "\u8981\u771F\u6750\u5B9E\u6599", hint: "\u770B\u5F97\u89C1\u7684\u5B9E\u5728" },
  { value: "\u8981\u660E\u786E\u7684\u6548\u679C", hint: "\u505A\u5B8C\u80FD\u770B\u5230\u53D8\u5316" },
  { value: "\u8981\u6709\u4EBA\u5E2E\u7740\u6311", hint: "\u5E0C\u671B\u6709\u61C2\u884C\u7684\u7ED9\u5EFA\u8BAE" },
  { value: "\u8981\u7701\u5FC3\u7701\u4E8B", hint: "\u4E00\u7AD9\u89E3\u51B3\u4E0D\u6298\u817E" },
  { value: "\u8981\u4EF7\u683C\u900F\u660E", hint: "\u4E8B\u5148\u77E5\u9053\u82B1\u591A\u5C11" },
  { value: "\u8981\u5FEB", hint: "\u65F6\u95F4\u5C31\u662F\u6210\u672C" },
  { value: "\u8981\u6709\u9762\u5B50", hint: "\u62FF\u5F97\u51FA\u624B\u3001\u80FD\u6652" },
  { value: "\u8981\u957F\u671F\u6709\u4EBA\u7BA1", hint: "\u552E\u540E\u548C\u56DE\u8BBF" }
];
var CONTENT_VALUE = [
  { value: "\u8BA9\u4EBA\u957F\u89C1\u8BC6\uFF08\u8BA4\u77E5\u53D8\u5316\uFF09", hint: "\u539F\u6765\u5982\u6B64\u3001\u6DA8\u77E5\u8BC6 \u2192 \u6536\u85CF\u5173\u6CE8" },
  { value: "\u8BA9\u4EBA\u6709\u60C5\u7EEA\uFF08\u60C5\u7EEA\u53D8\u5316\uFF09", hint: "\u723D\u3001\u7B11\u3001\u611F\u52A8\u3001\u6C14\u6124 \u2192 \u8BC4\u8BBA\u8F6C\u53D1" },
  { value: "\u8BA9\u4EBA\u80FD\u7167\u505A\uFF08\u884C\u52A8\u53D8\u5316\uFF09", hint: "\u6211\u73B0\u5728\u5C31\u80FD\u8BD5 \u2192 \u4FDD\u5B58\u5C1D\u8BD5" },
  { value: "\u8BA9\u4EBA\u5BF9\u53F7\u5165\u5EA7\uFF08\u8EAB\u4EFD\u786E\u8BA4\uFF09", hint: "\u8FD9\u8BF4\u7684\u4E0D\u5C31\u662F\u6211 \u2192 \u4E92\u52A8\u5173\u6CE8" },
  { value: "\u8BA9\u4EBA\u4EA7\u751F\u4FE1\u4EFB\uFF08\u4FE1\u4EFB\u53D8\u5316\uFF09", hint: "\u8FD9\u4EBA\u61C2\u884C\u4E14\u505A\u5F97\u5230 \u2192 \u54A8\u8BE2\u8D2D\u4E70" }
];
var FAN_QUESTIONS = [
  { value: "\u591A\u5C11\u94B1 / \u600E\u4E48\u6536\u8D39", hint: "\u4EF7\u683C\u7C7B" },
  { value: "\u771F\u7684\u5047\u7684 / \u662F\u4E0D\u662F\u771F\u6750\u5B9E\u6599", hint: "\u771F\u4F2A\u8D28\u7591\u7C7B" },
  { value: "\u6548\u679C\u80FD\u4FDD\u6301\u591A\u4E45", hint: "\u6548\u679C\u7C7B" },
  { value: "\u9002\u4E0D\u9002\u5408\u6211\u8FD9\u79CD\u60C5\u51B5", hint: "\u9002\u914D\u7C7B" },
  { value: "\u5728\u54EA\u91CC / \u600E\u4E48\u53BB / \u8425\u4E1A\u65F6\u95F4", hint: "\u5230\u5E97\u7C7B" },
  { value: "\u8981\u7B49\u591A\u4E45 / \u8981\u4E0D\u8981\u9884\u7EA6", hint: "\u6D41\u7A0B\u7C7B" },
  { value: "\u548C\u67D0\u67D0\u5BB6\u6BD4\u600E\u4E48\u6837", hint: "\u6BD4\u4EF7\u7C7B" },
  { value: "\u81EA\u5DF1\u5728\u5BB6\u80FD\u4E0D\u80FD\u505A", hint: "\u66FF\u4EE3\u65B9\u6848\u7C7B" },
  { value: "\u51FA\u95EE\u9898\u4E86\u600E\u4E48\u529E", hint: "\u552E\u540E\u7C7B" }
];
var CONVERSION_BARRIERS = [
  { value: "\u89C9\u5F97\u8D35 / \u8D85\u9884\u7B97", hint: "\u4EF7\u683C\u95E8\u69DB" },
  { value: "\u4E0D\u76F8\u4FE1\u662F\u771F\u7684", hint: "\u4FE1\u4EFB\u95E8\u69DB" },
  { value: "\u4E0D\u7740\u6025 / \u518D\u770B\u770B", hint: "\u9700\u6C42\u4E0D\u8FEB\u5207" },
  { value: "\u6015\u8E29\u5751 / \u60F3\u5148\u89C2\u671B", hint: "\u98CE\u9669\u987E\u8651" },
  { value: "\u8DDD\u79BB\u8FDC / \u6765\u4E00\u8D9F\u9EBB\u70E6", hint: "\u4FBF\u5229\u6027\u95E8\u69DB" },
  { value: "\u4E0D\u77E5\u9053\u6548\u679C\u597D\u4E0D\u597D", hint: "\u7F3A\u8BC1\u636E" },
  { value: "\u8981\u548C\u5BB6\u4EBA\u5546\u91CF", hint: "\u51B3\u7B56\u94FE\u957F" },
  { value: "\u540C\u884C\u5728\u6253\u4EF7\u683C\u6218", hint: "\u5916\u90E8\u7ADE\u4E89" }
];
var CONVERSION_PATHS = [
  { value: "\u770B\u89C6\u9891 \u2192 \u8BC4\u8BBA\u533A\u95EE \u2192 \u79C1\u4FE1 \u2192 \u5230\u5E97", hint: "\u672C\u5730\u751F\u610F\u6700\u5E38\u89C1" },
  { value: "\u770B\u89C6\u9891 \u2192 \u70B9\u4E3B\u9875 \u2192 \u52A0\u5FAE\u4FE1 \u2192 \u6210\u4EA4", hint: "\u9700\u8981\u6C9F\u901A\u7684\u670D\u52A1" },
  { value: "\u770B\u89C6\u9891 \u2192 \u56E2\u8D2D\u94FE\u63A5\u4E0B\u5355 \u2192 \u5230\u5E97\u6838\u9500", hint: "\u6807\u51C6\u5316\u5957\u9910" },
  { value: "\u770B\u89C6\u9891 \u2192 \u8FDB\u76F4\u64AD\u95F4 \u2192 \u4E0B\u5355", hint: "\u6709\u76F4\u64AD\u80FD\u529B" },
  { value: "\u770B\u89C6\u9891 \u2192 \u5C0F\u7A0B\u5E8F/\u5546\u57CE\u4E0B\u5355 \u2192 \u53D1\u8D27", hint: "\u5B9E\u7269\u7535\u5546" },
  { value: "\u770B\u89C6\u9891 \u2192 \u7535\u8BDD\u54A8\u8BE2 \u2192 \u4E0A\u95E8/\u5230\u5E97", hint: "\u9AD8\u5BA2\u5355\u670D\u52A1" }
];
var RESTRICTIONS = [
  { value: "\u7EDD\u5BF9\u5316\u7528\u8BED\uFF08\u6700\u597D / \u7B2C\u4E00 / \u5168\u7F51\u6700\u4FBF\u5B9C\uFF09", hint: "\u5E7F\u544A\u6CD5\u7EA2\u7EBF\uFF0C\u5EFA\u8BAE\u90FD\u52FE\u4E0A" },
  { value: "\u4E0D\u80FD\u627F\u8BFA\u7597\u6548\u6216\u6548\u679C", hint: "\u533B\u7F8E\u3001\u5065\u5EB7\u3001\u6559\u80B2\u7C7B\u5C24\u5176\u8981\u6CE8\u610F" },
  { value: "\u4E0D\u80FD\u63D0\u7ADE\u4E89\u5BF9\u624B\u540D\u5B57", hint: "\u907F\u514D\u7EA0\u7EB7" },
  { value: "\u4E0D\u80FD\u51FA\u73B0\u5177\u4F53\u4EF7\u683C\u6570\u5B57", hint: "\u4EF7\u683C\u5E38\u53D8\u6216\u5E73\u53F0\u9650\u6D41\u65F6" },
  { value: "\u4E0D\u80FD\u900F\u9732\u4F9B\u5E94\u5546 / \u8FDB\u8D27\u6E20\u9053", hint: "\u5546\u4E1A\u673A\u5BC6" },
  { value: "\u4E0D\u80FD\u62CD\u5230\u987E\u5BA2\u6B63\u8138", hint: "\u9690\u79C1\u987E\u8651" },
  { value: '\u4E0D\u80FD\u7528"\u63ED\u79D8"\u4E8C\u5B57', hint: "\u5BB9\u6613\u62DB\u540C\u884C\u4E3E\u62A5" },
  { value: "\u4E0D\u78B0\u65F6\u653F / \u5B97\u6559 / \u5730\u57DF\u4E89\u8BAE", hint: "\u901A\u7528\u7EA2\u7EBF" }
];
var RESOURCES = [
  { value: "\u81EA\u6709\u95E8\u5E97 / \u573A\u5730", hint: "\u80FD\u5F53\u62CD\u6444\u73B0\u573A" },
  { value: "\u7A33\u5B9A\u7684\u4F9B\u5E94\u94FE\u6216\u8D27\u6E90", hint: "\u80FD\u62CD\u8FDB\u8D27\u3001\u6EAF\u6E90" },
  { value: "\u8001\u5BA2\u6237\u613F\u610F\u51FA\u955C", hint: "\u771F\u5B9E\u6848\u4F8B\u7D20\u6750" },
  { value: "\u540C\u884C\u4EBA\u8109 / \u884C\u4E1A\u8D44\u6E90", hint: "\u80FD\u505A\u8054\u52A8\u548C\u5185\u5E55" },
  { value: "\u6709\u8D44\u8D28\u8BC1\u4E66 / \u83B7\u5956", hint: "\u4E13\u4E1A\u80CC\u4E66" },
  { value: "\u505A\u4E86\u5F88\u591A\u5E74 / \u6709\u79EF\u7D2F", hint: "\u6545\u4E8B\u548C\u6848\u4F8B\u591A" },
  { value: "\u6709\u4F1A\u62CD\u4F1A\u526A\u7684\u4EBA", hint: "\u751F\u4EA7\u80FD\u529B" },
  { value: "\u6709\u5458\u5DE5/\u5BB6\u4EBA\u80FD\u914D\u5408\u51FA\u955C", hint: "\u80FD\u505A\u5173\u7CFB\u7C7B\u3001\u5267\u60C5\u7C7B" }
];
var WEAKNESSES = [
  { value: "\u4E0D\u4F1A\u8BB2 / \u955C\u5934\u524D\u7D27\u5F20", hint: "\u53E3\u64AD\u7C7B\u8981\u8C28\u614E" },
  { value: "\u6CA1\u65F6\u95F4 / \u53EA\u80FD\u6324\u7A7A\u6863\u62CD", hint: "\u4EA7\u80FD\u53D7\u9650" },
  { value: "\u4F4D\u7F6E\u504F / \u4E0D\u597D\u627E", hint: "\u8981\u9760\u5185\u5BB9\u8865\u4FBF\u5229\u6027" },
  { value: "\u4EF7\u683C\u6BD4\u540C\u884C\u9AD8", hint: "\u5FC5\u987B\u8BB2\u6E05\u51ED\u4EC0\u4E48\u8D35" },
  { value: "\u521A\u5F00\u4E0D\u4E45 / \u6CA1\u4EC0\u4E48\u6848\u4F8B", hint: "\u5148\u6512\u8FC7\u7A0B\u548C\u8BC1\u636E" },
  { value: "\u5E97\u9762\u5C0F / \u73AF\u5883\u4E00\u822C", hint: "\u907F\u5F00\u5168\u666F\uFF0C\u591A\u7528\u7279\u5199" },
  { value: "\u540C\u884C\u592A\u591A / \u7ADE\u4E89\u6FC0\u70C8", hint: "\u5FC5\u987B\u505A\u5DEE\u5F02\u5316" },
  { value: "\u4E0D\u61C2\u5E73\u53F0\u89C4\u5219\u548C\u73A9\u6CD5", hint: "\u9700\u8981\u5148\u8DD1\u901A\u57FA\u7840" }
];
var BEST_PERFORMING = [
  { value: "\u8FD8\u6CA1\u53D1\u8FC7 / \u8FD8\u770B\u4E0D\u51FA\u6765", hint: "\u65B0\u53F7\u9009\u8FD9\u4E2A\u5C31\u884C" },
  { value: "\u8BB2\u77E5\u8BC6 / \u6559\u65B9\u6CD5\u7684", hint: "" },
  { value: "\u62CD\u5DE5\u4F5C\u8FC7\u7A0B\u7684", hint: "" },
  { value: "\u8BB2\u89C2\u70B9 / \u5410\u69FD\u7684", hint: "" },
  { value: "\u8BB2\u6545\u4E8B / \u8BB2\u7ECF\u5386\u7684", hint: "" },
  { value: "\u63A2\u5E97 / \u5E26\u770B\u73AF\u5883\u7684", hint: "" },
  { value: "\u5BF9\u6BD4\u6D4B\u8BC4\u7C7B", hint: "" },
  { value: "\u641E\u7B11 / \u6BB5\u5B50\u7C7B", hint: "" },
  { value: "\u987E\u5BA2\u771F\u5B9E\u53CD\u9988\u7C7B", hint: "" }
];
var OPTION_GROUPS = [
  {
    field: "target_pain_points",
    label: "\u4F60\u7684\u5BA2\u4EBA\u6700\u62C5\u5FC3\u4EC0\u4E48",
    why: "\u8FD9\u662F\u5185\u5BB9\u6700\u597D\u7528\u7684\u5207\u5165\u70B9\u2014\u2014\u5199\u811A\u672C\u3001\u8D77\u6807\u9898\u3001\u60F3\u9009\u9898\u90FD\u4ECE\u8FD9\u91CC\u6765",
    options: PAIN_POINTS,
    allowOther: true,
    maxHint: 4
  },
  {
    field: "target_needs",
    label: "\u4ED6\u4EEC\u771F\u6B63\u60F3\u8981\u4EC0\u4E48",
    why: '\u75DB\u70B9\u662F"\u6015\u4EC0\u4E48"\uFF0C\u9700\u6C42\u662F"\u8981\u4EC0\u4E48"\uFF0C\u4E24\u4E2A\u90FD\u6709\u5185\u5BB9\u624D\u6709\u6B63\u53CD\u4E24\u9762',
    options: USER_NEEDS,
    allowOther: true,
    maxHint: 3
  },
  {
    field: "unique_selling_point",
    label: "\u4F60\u51ED\u4EC0\u4E48\u8BA9\u4EBA\u9009\u4F60",
    why: "\u8FD9\u51B3\u5B9A\u4E86\u89C6\u9891\u91CC\u8981\u53CD\u590D\u8BC1\u660E\u4EC0\u4E48\u3002\u52FE\u592A\u591A\u7B49\u4E8E\u6CA1\u91CD\u70B9\uFF0C\u6311\u6700\u786C\u7684 2-3 \u4E2A",
    options: SELLING_POINTS,
    allowOther: true,
    maxHint: 3
  },
  {
    field: "content_value",
    label: "\u4F60\u60F3\u8BA9\u89C2\u4F17\u770B\u5B8C\u6709\u4EC0\u4E48\u53D8\u5316",
    why: '\u53EA\u6709"\u4EA7\u751F\u4FE1\u4EFB"\u8FD9\u4E00\u9879\u76F4\u63A5\u5E26\u6765\u6210\u4EA4\uFF0C\u5176\u4F59\u662F\u6DA8\u7C89\u548C\u4F20\u64AD',
    options: CONTENT_VALUE,
    allowOther: false,
    maxHint: 2
  },
  {
    field: "fan_common_questions",
    label: "\u5BA2\u4EBA\u6700\u5E38\u95EE\u4F60\u4EC0\u4E48",
    why: "\u6BCF\u4E00\u4E2A\u9AD8\u9891\u95EE\u9898\u90FD\u662F\u4E00\u6761\u73B0\u6210\u7684\u9009\u9898\uFF0C\u8FD9\u4E00\u680F\u586B\u4E86\u9009\u9898\u5C31\u4E0D\u6101",
    options: FAN_QUESTIONS,
    allowOther: true
  },
  {
    field: "conversion_barriers",
    label: "\u4ED6\u4EEC\u4E3A\u4EC0\u4E48\u72B9\u8C6B\u3001\u6CA1\u4E0B\u5355",
    why: "\u5185\u5BB9\u8981\u4E00\u6761\u6761\u628A\u8FD9\u4E9B\u987E\u8651\u62C6\u6389\uFF0C\u4E0D\u7136\u6D41\u91CF\u518D\u5927\u4E5F\u4E0D\u6210\u4EA4",
    options: CONVERSION_BARRIERS,
    allowOther: true,
    maxHint: 3
  },
  {
    field: "conversion_path",
    label: "\u5BA2\u4EBA\u4E00\u822C\u600E\u4E48\u627E\u5230\u4F60\u3001\u600E\u4E48\u6210\u4EA4",
    why: "\u51B3\u5B9A\u89C6\u9891\u7ED3\u5C3E\u628A\u4EBA\u5F80\u54EA\u513F\u5F15",
    options: CONVERSION_PATHS,
    allowOther: true,
    maxHint: 2
  },
  {
    field: "content_restrictions",
    label: "\u7EDD\u5BF9\u4E0D\u80FD\u8BF4\u7684\u8BDD",
    why: "\u786C\u7EA6\u675F\u3002\u52FE\u4E0A\u4E4B\u540E\u6240\u6709\u4EA7\u51FA\u90FD\u4F1A\u907F\u5F00\uFF0C\u6F0F\u6389\u53EF\u80FD\u76F4\u63A5\u8FDD\u89C4",
    options: RESTRICTIONS,
    allowOther: true
  },
  {
    field: "unique_resources",
    label: "\u4F60\u624B\u4E0A\u6709\u4EC0\u4E48\u522B\u4EBA\u6CA1\u6709\u7684",
    why: "\u8FD9\u4E9B\u662F\u80FD\u62CD\u3001\u80FD\u5F53\u8BC1\u636E\u7684\u4E1C\u897F\uFF0C\u51B3\u5B9A\u4E86\u5185\u5BB9\u80FD\u505A\u591A\u6DF1",
    options: RESOURCES,
    allowOther: true
  },
  {
    field: "competitive_weakness",
    label: "\u73B0\u5728\u6700\u5927\u7684\u77ED\u677F",
    why: "\u8BF4\u5B9E\u8BDD\u53CD\u800C\u6709\u7528\u2014\u2014AI \u4F1A\u7ED5\u5F00\u4F60\u505A\u4E0D\u5230\u7684\uFF0C\u4E0D\u7ED9\u4F60\u62CD\u4E0D\u51FA\u6765\u7684\u65B9\u6848",
    options: WEAKNESSES,
    allowOther: true,
    maxHint: 3
  },
  {
    field: "viral_content_pattern",
    label: "\u5DF2\u7ECF\u53D1\u8FC7\u7684\u5185\u5BB9\u91CC\uFF0C\u54EA\u7C7B\u6570\u636E\u6700\u597D",
    why: "\u6709\u9A8C\u8BC1\u8FC7\u7684\u65B9\u5411\u5C31\u987A\u7740\u505A\uFF0C\u522B\u63A8\u5012\u91CD\u6765",
    options: BEST_PERFORMING,
    allowOther: true,
    maxHint: 2
  }
];

// lib/content-roles.ts
var CONTENT_ROLE_LIST = ["\u6D41\u91CF\u578B", "\u4EBA\u8BBE\u578B", "\u53D8\u73B0\u578B"];

// lib/content-mix.ts
var PRESETS = [
  { id: "auto", label: "\u7CFB\u7EDF\u63A8\u8350", hint: "\u6309\u8D26\u53F7\u9636\u6BB5\u548C\u53D8\u73B0\u65B9\u5F0F\u81EA\u52A8\u5B9A" },
  { id: "traffic", label: "\u5F15\u6D41\u4F18\u5148", hint: "\u5148\u628A\u64AD\u653E\u548C\u7C89\u4E1D\u505A\u8D77\u6765", mix: { \u6D41\u91CF\u578B: 70, \u4EBA\u8BBE\u578B: 20, \u53D8\u73B0\u578B: 10 } },
  { id: "balanced", label: "\u5747\u8861", hint: "\u4E09\u79CD\u90FD\u8981\uFF0C\u6BD4\u8F83\u5E73\u5747", mix: { \u6D41\u91CF\u578B: 40, \u4EBA\u8BBE\u578B: 30, \u53D8\u73B0\u578B: 30 } },
  { id: "convert", label: "\u6210\u4EA4\u4F18\u5148", hint: "\u591A\u62CD\u80FD\u5E26\u6765\u54A8\u8BE2\u548C\u8BA2\u5355\u7684", mix: { \u6D41\u91CF\u578B: 25, \u4EBA\u8BBE\u578B: 20, \u53D8\u73B0\u578B: 55 } },
  { id: "custom", label: "\u81EA\u5B9A\u4E49", hint: "\u81EA\u5DF1\u62D6\u5230\u60F3\u8981\u7684\u6BD4\u4F8B" }
];
var STAGE_MIX = [
  { stage: "\u521A\u8D77\u53F7\uFF0C\u5B9A\u4F4D\u672A\u786E\u5B9A", mix: { \u6D41\u91CF\u578B: 60, \u4EBA\u8BBE\u578B: 25, \u53D8\u73B0\u578B: 15 }, why: "\u521A\u8D77\u53F7\u5148\u62FF\u7A33\u5B9A\u6D41\u91CF\u548C\u6B63\u53CD\u9988\uFF0C\u6D41\u91CF\u578B\u6700\u5927\uFF1B\u53D8\u73B0\u578B\u7B2C\u4E00\u5468\u5C31\u6709\uFF0C\u4F46\u53EA\u5360\u5C0F\u5934\uFF0C\u514D\u5F97\u50CF\u5E7F\u544A\u53F7" },
  { stage: "\u6709\u5B9A\u4F4D\uFF0C\u9700\u8981\u5185\u5BB9\u65B9\u5411", mix: { \u6D41\u91CF\u578B: 45, \u4EBA\u8BBE\u578B: 25, \u53D8\u73B0\u578B: 30 }, why: "\u6D41\u91CF\u5F00\u59CB\u7A33\u4E86\uFF0C\u53D8\u73B0\u578B\u6162\u6162\u957F\u4E0A\u6765\uFF0C\u6D41\u91CF\u578B\u4ECD\u7136\u662F\u4E3B\u529B" },
  { stage: "\u7A33\u5B9A\u8FD0\u8425\uFF0C\u9700\u8981\u65B0\u9009\u9898", mix: { \u6D41\u91CF\u578B: 30, \u4EBA\u8BBE\u578B: 20, \u53D8\u73B0\u578B: 50 }, why: "\u6D41\u91CF\u5DF2\u7ECF\u7A33\u5B9A\uFF0C\u6309\u4EE3\u8FD0\u8425 SOP \u7684\u6807\u51C6\u914D\u6BD4\uFF0C\u53D8\u73B0\u578B\u5360\u4E00\u534A" },
  { stage: "\u6210\u719F\u671F\uFF0C\u9700\u8981\u7A81\u7834", mix: { \u6D41\u91CF\u578B: 40, \u4EBA\u8BBE\u578B: 30, \u53D8\u73B0\u578B: 30 }, why: "\u6210\u719F\u671F\u8981\u7A81\u7834\uFF0C\u5F97\u91CD\u65B0\u62C9\u65B0\u4EBA\u3001\u52A0\u6DF1\u4EBA\u8BBE\uFF0C\u6D41\u91CF\u578B\u548C\u4EBA\u8BBE\u578B\u5F80\u56DE\u52A0" }
];
var FALLBACK = STAGE_MIX[1];
var asList = (v) => Array.isArray(v) ? v.filter((x) => typeof x === "string") : typeof v === "string" ? v.split(/[、,，]/).map((x) => x.trim()).filter(Boolean) : [];
function normalizeMix(m) {
  const raw = CONTENT_ROLE_LIST.map((r) => Math.max(0, Number(m[r]) || 0));
  const sum = raw.reduce((a, b) => a + b, 0);
  if (sum <= 0) return { ...FALLBACK.mix };
  const scaled = raw.map((v) => Math.round(v / sum * 100 / 5) * 5);
  const diff = 100 - scaled.reduce((a, b) => a + b, 0);
  const top = scaled.indexOf(Math.max(...scaled));
  scaled[top] += diff;
  return Object.fromEntries(CONTENT_ROLE_LIST.map((r, i) => [r, scaled[i]]));
}
function shift(m, from, to, n, floor) {
  const move = Math.max(0, Math.min(n, m[from] - floor));
  return { ...m, [from]: m[from] - move, [to]: m[to] + move };
}
function recommendMix(profile2, goal = "") {
  const p = profile2;
  const stage = typeof p?.account_stage === "string" ? p.account_stage : "";
  const base = STAGE_MIX.find((s) => s.stage === stage) ?? FALLBACK;
  let mix = { ...base.mix };
  const reasons = [stage ? `${stage}\uFF1A${base.why}` : `\u6863\u6848\u6CA1\u586B\u8D26\u53F7\u9636\u6BB5\uFF0C\u6309\u8FC7\u6E21\u671F\u7ED9\uFF1A${FALLBACK.why}`];
  const money = asList(p?.monetization_model);
  if (money.length > 0 && money.every((x) => x === "\u6682\u4E0D\u8003\u8651")) {
    mix = shift(mix, "\u53D8\u73B0\u578B", "\u6D41\u91CF\u578B", 100, 10);
    reasons.push("\u53D8\u73B0\u65B9\u5F0F\u5199\u7684\u662F\u300C\u6682\u4E0D\u8003\u8651\u300D\uFF0C\u53D8\u73B0\u578B\u538B\u5230 10%");
  }
  if (/大流量|涨粉|曝光|影响力|做博主|上热门/.test(goal)) {
    mix = shift(mix, "\u53D8\u73B0\u578B", "\u6D41\u91CF\u578B", 10, 10);
    reasons.push("\u4F60\u8981\u7684\u662F\u6D41\u91CF\u548C\u66DD\u5149\uFF0C\u6D41\u91CF\u578B\u518D\u52A0 10%");
  } else if (/精准客户|只要成交|不在乎播放|多卖|带货|转化/.test(goal)) {
    mix = shift(mix, "\u6D41\u91CF\u578B", "\u53D8\u73B0\u578B", 10, 20);
    reasons.push("\u4F60\u8981\u7684\u662F\u6210\u4EA4\uFF0C\u53D8\u73B0\u578B\u518D\u52A0 10%");
  }
  return { mix: normalizeMix(mix), reason: reasons.join("\uFF1B") };
}
function readSetting(v) {
  if (!v || typeof v !== "object") return null;
  const s = v;
  if (!PRESETS.some((x) => x.id === s.preset)) return null;
  if (s.preset === "custom") return s.custom ? { preset: "custom", custom: normalizeMix(s.custom) } : null;
  return { preset: s.preset };
}
function mixOfSetting(s, p, goal) {
  if (s.preset === "custom" && s.custom) return { mix: normalizeMix(s.custom) };
  const preset = PRESETS.find((x) => x.id === s.preset);
  if (preset?.mix) return { mix: { ...preset.mix } };
  return recommendMix(p, goal);
}
var presetLabel = (s) => PRESETS.find((x) => x.id === s.preset)?.label ?? "\u7CFB\u7EDF\u63A8\u8350";
function resolveMix(profile2, override, goal = "") {
  const p = profile2;
  if (override) {
    const { mix: mix2, reason: reason2 } = mixOfSetting(override, p, goal);
    return { mix: mix2, source: "override", label: `\u8FD9\u6B21\u4E34\u65F6\u6539\u7684\xB7${presetLabel(override)}`, reason: reason2 };
  }
  const saved = readSetting(p?.content_mix);
  if (saved && saved.preset !== "auto") {
    return { mix: mixOfSetting(saved, p, goal).mix, source: "profile", label: `\u6863\u6848\u8BBE\u7F6E\xB7${presetLabel(saved)}` };
  }
  const { mix, reason } = recommendMix(p, goal);
  const stage = typeof p?.account_stage === "string" && p.account_stage ? p.account_stage.split("\uFF0C")[0] : "";
  return { mix, source: "auto", label: stage ? `\u7CFB\u7EDF\u63A8\u8350\uFF08${stage}\uFF09` : "\u7CFB\u7EDF\u63A8\u8350", reason };
}
var formatMix = (m) => CONTENT_ROLE_LIST.map((r) => `${r} ${m[r]}%`).join(" / ");
function mixContextLine(r) {
  return `- **\u5185\u5BB9\u914D\u6BD4**\uFF1A${formatMix(r.mix)}\uFF08${r.label}\uFF09\u3002\u51FA\u9009\u9898\u3001\u6392\u8BA1\u5212\u65F6\u6309\u8FD9\u4E2A\u6BD4\u4F8B\u5206`;
}

// lib/taboos.ts
var ANALYSIS = "(?!\u7684?(?:\u4F18\u52BF|\u77ED\u677F|\u95EE\u9898|\u96BE\u70B9|\u98CE\u9669|\u533A\u522B|\u597D\u5904|\u7279\u70B9|\u5356\u70B9|\u4EAE\u70B9|\u539F\u56E0|\u6311\u6218|\u969C\u788D|\u963B\u529B|\u53D8\u5316|\u6536\u83B7|\u611F\u53D7|\u56F0\u96BE|\u75DB\u70B9|\u673A\u4F1A|\u5DEE\u8DDD|\u4E0D\u540C|\u6559\u8BAD))";
var MEASURE = "(?!\u7684?(?:\u89D2\u5EA6|\u5C3A\u5BF8|\u627F\u91CD|\u529F\u7387|\u5BB9\u91CF|\u9650\u5EA6|\u7A0B\u5EA6|\u8303\u56F4|\u503C|\u901F\u5EA6|\u6E29\u5EA6|\u5F00\u53E3|\u5E45\u5EA6|\u957F\u5EA6|\u5BBD\u5EA6|\u9AD8\u5EA6|\u6DF1\u5EA6|\u91CD\u91CF|\u9762\u79EF|\u6863|\u706B|\u53F7|\u7801|\u97F3\u91CF|\u4EAE\u5EA6|\u529B\u5EA6|\u538B\u529B))";
var ABSOLUTE = `(?:\u5168\u7F51|\u5168\u57CE|\u5168\u56FD|\u5168\u5E02|\u53F2\u4E0A)?\u6700(?:\u6B63\u5B97|\u597D\u5403|\u597D(?![\u5148\u662F\u522B\u4E0D\u80FD\u7528\u5728\u8FD8\u6BCF\u627E\u628A\u8BA9\u7ED9\u4ECE\u518D\u591A\u5C11\u8D81\u63D0\u65E9\u8DDF])${ANALYSIS}|\u4FBF\u5B9C|\u4F4E\u4EF7|\u5B9E\u60E0|\u5212\u7B97|\u4E13\u4E1A|\u5730\u9053|\u5F3A|\u4F73|\u5927${ANALYSIS}${MEASURE}|\u5168|\u706B|\u9AD8\u7AEF|\u5B89\u5168|\u9760\u8C31)|\u5168\u7F51\u6700|\u5168\u57CE\u6700|\u7B2C\u4E00(?:\u5BB6|\u540D|\u54C1\u724C)|(?:\u5168\u56FD|\u5168\u5E02|\u5168\u57CE|\u5357\u4E50|\u53BF\u57CE)\u7B2C\u4E00|\u9876\u7EA7|\u6781\u81F4|\u56FD\u5BB6\u7EA7|\u72EC\u5BB6|\u552F\u4E00|\u53F2\u4E0A\u6700`;
var PLATFORM_TABOOS = [
  { id: "p-absolute", kind: "say", text: "\u7EDD\u5BF9\u5316\u7528\u8BED\uFF1A\u6700\u3001\u7B2C\u4E00\u3001\u9876\u7EA7\u3001\u6781\u81F4\u3001\u5168\u7F51\u6700\u4F4E\u3001\u56FD\u5BB6\u7EA7\u3001\u72EC\u5BB6\u3001\u552F\u4E00", why: "\u5E7F\u544A\u6CD5\u7EA2\u7EBF", instead: '\u8BF4\u5177\u4F53\u4E8B\u5B9E\uFF1A"\u5F00\u4E86 9 \u5E74""\u4E00\u5929\u5356 300 \u4E32"', words: ABSOLUTE },
  { id: "p-promise", kind: "say", text: "100% \u6709\u6548\u3001\u4FDD\u8BC1\u3001\u7EDD\u5BF9\u3001\u6C38\u4E45\u3001\u65E0\u526F\u4F5C\u7528", why: "\u865A\u5047\u627F\u8BFA", instead: '"\u5927\u591A\u6570\u5BA2\u4EBA\u53CD\u9988\u2026\u2026""\u6211\u4EEC\u7684\u505A\u6CD5\u662F\u2026\u2026"', words: "100%(?:\u6709\u6548|\u597D\u8BC4|\u6EE1\u610F)|\u4FDD\u8BC1(?:\u6709\u6548|\u6548\u679C|\u597D\u5403)|\u7EDD\u5BF9(?:\u6709\u6548|\u6B63\u5B97|\u4E0D)|\u6C38\u4E45(?:\u6709\u6548|\u4FDD\u6301)|\u65E0\u526F\u4F5C\u7528|\u96F6\u98CE\u9669" },
  { id: "p-lure", kind: "say", text: "\u70B9\u8D5E\u62BD\u5956\u3001\u8F6C\u53D1\u9001\u3001\u8BC4\u8BBA\u533A\u6263 1 \u9886\u798F\u5229\uFF08\u62FF\u5956\u52B1\u6362\u4E92\u52A8\uFF09", why: "\u8BF1\u5BFC\u4E92\u52A8\uFF0C\u5BB9\u6613\u9650\u6D41", instead: '\u7528\u5185\u5BB9\u672C\u8EAB\u5F15\u8BC4\u8BBA\uFF1A"\u4F60\u4EEC\u90A3\u8FB9\u4E5F\u8FD9\u6837\u5417\uFF1F"', words: "\u70B9\u8D5E(?:\u62BD\u5956|\u9001)|\u8F6C\u53D1(?:\u62BD\u5956|\u9001|\u6709\u793C)|(?:\u6263|\u6253)1(?:\u9886|\u9001|\u62BD)|\u8BC4\u8BBA(?:\u62BD\u5956|\u9001)" },
  { id: "p-offsite", kind: "say", text: "\u52A0\u5FAE\u4FE1\u3001\u52A0 V\u3001\u79C1\u4FE1\u53D1\u4F60\u4EF7\u683C\u3001\u4E3B\u9875\u6709\u8054\u7CFB\u65B9\u5F0F\uFF08\u53E3\u64AD\u6216\u5B57\u5E55\uFF09", why: "\u7AD9\u5916\u5BFC\u6D41\uFF0C\u6296\u97F3\u4E0A\u5BB9\u6613\u9650\u6D41", instead: "\u5F15\u5230\u5E73\u53F0\u5185\uFF1A\u56E2\u8D2D\u94FE\u63A5\u3001\u5230\u5E97\u5730\u5740\u3001\u8BC4\u8BBA\u533A\u56DE\u590D", words: "\u52A0(?:\u6211)?(?:\u5FAE\u4FE1|V\u4FE1|vx|VX|v\u4FE1|\u5A01\u4FE1)|\u79C1\u4FE1(?:\u53D1|\u7ED9)\u4F60(?:\u4EF7\u683C|\u62A5\u4EF7)|\u4E3B\u9875\u6709(?:\u8054\u7CFB\u65B9\u5F0F|\u5FAE\u4FE1)", closable: true },
  { id: "p-rival", kind: "say", text: '\u8D2C\u4F4E\u540C\u884C\u3001\u70B9\u540D\u7ADE\u54C1\uFF1A"\u9694\u58C1\u90A3\u5BB6\u90FD\u662F\u2026\u2026"', why: "\u4E0D\u6B63\u5F53\u7ADE\u4E89\uFF0C\u5BB9\u6613\u88AB\u4E3E\u62A5", instead: "\u53EA\u8BB2\u81EA\u5DF1\u600E\u4E48\u505A", words: "\u9694\u58C1(?:\u90A3\u5BB6|\u5E97)(?:\u90FD\u662F|\u5168\u662F|\u7528\u7684)|\u522B\u5BB6\u90FD\u662F|\u540C\u884C\u90FD\u662F(?:\u9A97|\u5751)" },
  { id: "p-authority", kind: "say", text: "\u5192\u7528\u6743\u5A01\uFF1A\u592E\u89C6\u63A8\u8350\u3001\u4E13\u5BB6\u8BA4\u8BC1\u3001\u653F\u5E9C\u6307\u5B9A\uFF08\u6CA1\u6709\u5C31\u4E0D\u8BF4\uFF09", why: "\u865A\u5047\u5BA3\u4F20", words: "\u592E\u89C6(?:\u63A8\u8350|\u62A5\u9053)|\u4E13\u5BB6(?:\u8BA4\u8BC1|\u63A8\u8350)|\u653F\u5E9C\u6307\u5B9A|\u5B98\u65B9\u6307\u5B9A" },
  { id: "p-privacy", kind: "shoot", text: "\u672A\u7ECF\u540C\u610F\u62CD\u987E\u5BA2\u3001\u8DEF\u4EBA\u6B63\u8138\uFF1B\u62CD\u672A\u6210\u5E74\u4EBA", why: "\u9690\u79C1\u548C\u672A\u6210\u5E74\u4EBA\u4FDD\u62A4", instead: "\u80CC\u5F71\u3001\u624B\u90E8\u3001\u6253\u7801" },
  { id: "p-politics", kind: "direction", text: "\u65F6\u653F\u3001\u5B97\u6559\u3001\u6C11\u65CF\u3001\u5730\u57DF\u6B67\u89C6\u7684\u8BDD\u9898", why: "\u901A\u7528\u7EA2\u7EBF" },
  { id: "p-fake", kind: "direction", text: "\u865A\u6784\u7ECF\u5386\u3001\u7F16\u9020\u6570\u636E\uFF08\u9500\u91CF\u3001\u64AD\u653E\u91CF\u3001\u5BA2\u6237\u6570\uFF09", why: "\u865A\u5047\u5BA3\u4F20", instead: "\u6CA1\u6709\u4F9D\u636E\u5199\u6210 X \u6216\u3010\u6362\u6210\u4F60\u7684\uFF1A\u2026\u2026\u3011" }
];
var INDUSTRIES = [
  {
    id: "food",
    name: "\u9910\u996E",
    values: ["\u7F8E\u98DF\u70F9\u996A", "\u9910\u996E", "\u98DF\u54C1\u996E\u6599"],
    keywords: /餐饮|餐厅|饭店|饭馆|面馆|火锅|烧烤|串串|小吃|奶茶|咖啡|烘焙|蛋糕|饮品|食堂|川菜|湘菜|粤菜|快餐/,
    items: [
      { id: "food-health", kind: "direction", text: "\u5403\u4E86\u80FD\u6CBB\u75C5\u3001\u517B\u751F\u3001\u51CF\u80A5\u3001\u58EE\u9633\u8FD9\u7C7B\u529F\u6548\u5411\u5185\u5BB9", why: "\u666E\u901A\u98DF\u54C1\u4E0D\u80FD\u5BA3\u4F20\u7597\u6548", instead: "\u53EA\u8BB2\u5473\u9053\u3001\u53E3\u611F\u3001\u5206\u91CF", words: "\u6CBB(?:\u75C5|\u80C3\u75C5|\u5931\u7720)|\u517B\u80C3|\u964D(?:\u4E09\u9AD8|\u8840\u538B|\u8840\u7CD6|\u8840\u8102)|\u6392\u6BD2|\u58EE\u9633|\u8865\u80BE|\u51CF\u80A5(?:\u795E\u5668|\u9910)" },
      { id: "food-dirty", kind: "direction", text: '\u66B4\u9732\u540E\u53A8\u536B\u751F\u95EE\u9898\u7684"\u771F\u5B9E\u63ED\u5E95"\uFF1A\u751F\u719F\u6DF7\u653E\u3001\u5458\u5DE5\u4E0D\u6234\u5E3D\u5B50\u3001\u5F92\u624B\u6293\u719F\u98DF', why: "\u4E00\u62CD\u5C31\u662F\u98DF\u5B89\u6295\u8BC9\u7D20\u6750", instead: "\u62CD\u4E4B\u524D\u5148\u6536\u62FE\uFF0C\u62CD\u5E72\u51C0\u7684\u64CD\u4F5C\u53F0" },
      { id: "food-wild", kind: "direction", text: "\u91CE\u751F\u52A8\u7269\u3001\u4FDD\u62A4\u52A8\u7269\u505A\u83DC", why: "\u8FDD\u6CD5" },
      { id: "food-drink", kind: "direction", text: "\u529D\u9152\u3001\u62FC\u9152\u3001\u559D\u9189\u7684\u753B\u9762\u548C\u8BDD\u9898", why: "\u5E73\u53F0\u9650\u5236\u996E\u9152\u5185\u5BB9", instead: "\u62CD\u6C1B\u56F4\u4E0D\u62CD\u559D" },
      { id: "food-natural", kind: "say", text: "\u96F6\u6DFB\u52A0\u3001\u7EAF\u5929\u7136\u3001\u65E0\u9632\u8150\u5242\uFF08\u6CA1\u6709\u68C0\u6D4B\u4F9D\u636E\uFF09", why: "\u865A\u5047\u5BA3\u4F20", instead: '\u8BF4\u770B\u5F97\u89C1\u7684\uFF1A"\u73B0\u5207\u73B0\u7A7F""\u5F53\u5929\u8FDB\u8D27"', words: "\u96F6\u6DFB\u52A0|\u7EAF\u5929\u7136|\u65E0\u9632\u8150\u5242|\u65E0\u4EFB\u4F55\u6DFB\u52A0" },
      { id: "food-price", kind: "say", text: "\u53E3\u64AD\u4EF7\u683C\u548C\u56E2\u8D2D\u9875\u5BF9\u4E0D\u4E0A", why: "\u4EF7\u683C\u6B3A\u8BC8\u6295\u8BC9", instead: "\u4EE5\u56E2\u8D2D\u9875\u4E3A\u51C6\uFF0C\u6216\u4E0D\u8BF4\u5177\u4F53\u4EF7" }
    ]
  },
  {
    id: "beauty",
    name: "\u7F8E\u5986\u62A4\u80A4",
    values: ["\u7F8E\u5986\u62A4\u80A4"],
    keywords: /美妆|护肤|化妆品|美容|美甲|美睫|皮肤管理/,
    items: [
      { id: "beauty-cure", kind: "direction", text: '\u6CBB\u7597\u76AE\u80A4\u75C5\u3001\u795B\u6591\u795B\u75D8\u7684"\u7597\u6548"\u5411\u5185\u5BB9\uFF08\u666E\u901A\u5316\u5986\u54C1\uFF09', why: "\u529F\u6548\u5BA3\u79F0\u8981\u5907\u6848\uFF0C\u666E\u901A\u5316\u5986\u54C1\u4E0D\u80FD\u8BF4", words: "\u795B\u6591|\u795B\u75D8|\u7F8E\u767D(?:\u6DE1\u6591)?|\u6297\u654F|\u4FEE\u590D(?:\u5C4F\u969C|\u53D7\u635F)|\u6CBB(?:\u75D8|\u6591|\u76AE\u80A4)" },
      { id: "beauty-medical", kind: "say", text: "\u533B\u5B66\u7EA7\u3001\u836F\u5986\u3001\u68B0\u5B57\u53F7\u5F53\u5316\u5986\u54C1\u5356", why: "\u6DF7\u6DC6\u6982\u5FF5", words: "\u533B\u5B66\u7EA7|\u836F\u5986|\u68B0\u5B57\u53F7" },
      { id: "beauty-compare", kind: "shoot", text: "\u5938\u5927\u7684\u524D\u540E\u5BF9\u6BD4\uFF08\u4FEE\u56FE\u3001\u4E0D\u540C\u5149\u7EBF\u89D2\u5EA6\uFF09", why: "\u865A\u5047\u5BA3\u4F20", instead: '\u540C\u5149\u540C\u89D2\u5EA6\uFF0C\u6807\u660E"\u4E2A\u4EBA\u6548\u679C"' },
      { id: "beauty-fast", kind: "say", text: "\u51E0\u5929\u89C1\u6548\u3001\u6C38\u4E45\u3001\u7ACB\u523B\u53D8\u767D", why: "\u865A\u5047\u627F\u8BFA", words: "[\u4E00\u4E8C\u4E09\u56DB\u4E94\u516D\u4E031-7]\u5929(?:\u89C1\u6548|\u53D8\u767D|\u795B)|\u7ACB\u523B\u53D8\u767D|\u4E00\u6B21\u89C1\u6548" }
    ]
  },
  {
    id: "medical",
    name: "\u533B\u7F8E / \u533B\u7597",
    values: [],
    keywords: /医美|整形|整容|诊所|医院|口腔|牙科|中医|理疗|针灸|推拿|植发/,
    items: [
      { id: "med-promise", kind: "direction", text: "\u4FDD\u8BC1\u6548\u679C\u3001\u65E0\u75DB\u3001\u96F6\u98CE\u9669\u3001\u5305\u6CBB\u7684\u627F\u8BFA\u5411\u5185\u5BB9", why: "\u533B\u7597\u5E7F\u544A\u7EA2\u7EBF", words: "\u65E0\u75DB|\u96F6\u98CE\u9669|\u5305\u6CBB|\u6839\u6CBB|\u5305\u6548\u679C|\u4FDD\u8BC1\u6548\u679C" },
      { id: "med-case", kind: "direction", text: "\u7528\u60A3\u8005\u672F\u524D\u672F\u540E\u5BF9\u6BD4\u3001\u60A3\u8005\u540D\u4E49\u505A\u8BC1\u660E", why: "\u533B\u7597\u5E7F\u544A\u4E0D\u80FD\u7528\u60A3\u8005\u540D\u4E49\u8BC1\u660E", instead: "\u8BB2\u6D41\u7A0B\u3001\u6CE8\u610F\u4E8B\u9879\u3001\u533B\u751F\u600E\u4E48\u5224\u65AD" },
      { id: "med-price", kind: "direction", text: '\u4F4E\u4EF7\u5F15\u6D41\u3001"9.9 \u5143\u505A\u2026\u2026"\u8FD9\u7C7B\u533B\u7597\u9879\u76EE\u4FC3\u9500', why: "\u533B\u7597\u670D\u52A1\u4F4E\u4EF7\u8BF1\u5BFC\u6613\u8FDD\u89C4" }
    ]
  },
  {
    id: "fitness",
    name: "\u5065\u8EAB\u8FD0\u52A8",
    values: ["\u5065\u8EAB\u8FD0\u52A8"],
    keywords: /健身|瑜伽|普拉提|减脂|私教|运动馆/,
    items: [
      { id: "fit-fast", kind: "direction", text: "X \u5929\u7626 X \u65A4\u3001\u8EBA\u7740\u7626\u3001\u4E0D\u8282\u98DF\u4E0D\u8FD0\u52A8\u4E5F\u80FD\u7626", why: "\u865A\u5047\u627F\u8BFA", instead: "\u8BB2\u65B9\u6CD5\u548C\u575A\u6301\u591A\u4E45\u7684\u771F\u5B9E\u8BB0\u5F55", words: "\\d+\u5929\u7626\\d*\u65A4?|\u8EBA\u7740(?:\u5C31)?\u7626|\u4E0D\u8282\u98DF(?:\u4E0D\u8FD0\u52A8)?(?:\u4E5F\u80FD|\u5C31\u80FD)?\u7626|\u6708\u7626\\d+" },
      { id: "fit-drug", kind: "direction", text: "\u63A8\u8350\u51CF\u80A5\u836F\u3001\u4EE3\u9910\u66FF\u4EE3\u6B63\u9910\u3001\u5904\u65B9\u836F", why: "\u533B\u7597\u98CE\u9669" },
      { id: "fit-cure", kind: "say", text: "\u6CBB\u7597\u8170\u690E\u3001\u6CBB\u9888\u690E\u75C5\uFF08\u975E\u533B\u7597\u673A\u6784\uFF09", why: "\u533B\u7597\u7528\u8BED", instead: '"\u7F13\u89E3\u4E45\u5750\u7684\u50F5\u786C\u611F"', words: "\u6CBB(?:\u7597)?(?:\u8170\u690E|\u9888\u690E|\u8170\u95F4\u76D8)" },
      { id: "fit-danger", kind: "shoot", text: "\u5371\u9669\u52A8\u4F5C\u4E0D\u52A0\u63D0\u793A", why: "\u5B89\u5168", instead: '\u52A0"\u91CF\u529B\u800C\u884C"\u63D0\u793A' }
    ]
  },
  {
    id: "edu",
    name: "\u6559\u80B2\u57F9\u8BAD",
    values: ["\u77E5\u8BC6\u6559\u80B2", "\u804C\u573A\u6210\u957F"],
    keywords: /教育|培训|辅导|课程|考研|考证|留学|编程|英语|托管/,
    items: [
      { id: "edu-promise", kind: "say", text: "\u4FDD\u8FC7\u3001\u5305\u5C31\u4E1A\u3001\u5305\u62FF\u8BC1\u3001100% \u63D0\u5206", why: "\u5E7F\u544A\u6CD5\u660E\u4EE4\u7981\u6B62\u7684\u6559\u80B2\u627F\u8BFA", instead: "\u8BF4\u5B66\u5458\u771F\u5B9E\u6848\u4F8B\uFF08\u5F81\u5F97\u540C\u610F\uFF09", words: "\u4FDD\u8FC7|\u5305(?:\u5C31\u4E1A|\u8FC7|\u62FF\u8BC1|\u5206\u914D)|(?:100%|\u767E\u5206\u767E)(?:\u63D0\u5206|\u901A\u8FC7|\u4E0A\u5CB8)|\u4E0D\u8FC7\u9000\u6B3E" },
      { id: "edu-rich", kind: "direction", text: "\u6708\u5165\u8FC7\u4E07\u3001\u8EBA\u8D5A\u3001\u526F\u4E1A\u66B4\u5BCC\u8FD9\u7C7B\u6536\u76CA\u627F\u8BFA\u5411\u5185\u5BB9", why: "\u5938\u5927\u6536\u76CA", words: "\u6708\u5165(?:\u8FC7\u4E07|\u5341\u4E07|\\d+\u4E07)|\u8EBA\u8D5A|\u66B4\u5BCC" },
      { id: "edu-anxiety", kind: "direction", text: '\u8D29\u5356\u7126\u8651\uFF1A"\u4E0D\u5B66\u5C31\u88AB\u6DD8\u6C70""\u5B69\u5B50\u8F93\u5728\u8D77\u8DD1\u7EBF"', why: "\u5E73\u53F0\u9650\u6D41", instead: "\u8BB2\u5177\u4F53\u95EE\u9898\u600E\u4E48\u89E3\u51B3", words: "\u8F93\u5728\u8D77\u8DD1\u7EBF|\u4E0D\u5B66\u5C31(?:\u88AB)?\u6DD8\u6C70" },
      { id: "edu-teacher", kind: "say", text: "\u540D\u5E08\u3001\u6E05\u5317\u540D\u5E08\uFF08\u6CA1\u6709\u4F9D\u636E\uFF09", why: "\u865A\u5047\u5BA3\u4F20", words: "\u6E05\u5317\u540D\u5E08|\u9876\u7EA7\u540D\u5E08|\u91D1\u724C\u540D\u5E08" }
    ]
  },
  {
    id: "baby",
    name: "\u6BCD\u5A74\u80B2\u513F",
    values: ["\u6BCD\u5A74\u80B2\u513F"],
    keywords: /母婴|育儿|奶粉|早教|月子|童装|婴/,
    items: [
      { id: "baby-effect", kind: "say", text: "\u589E\u5F3A\u514D\u75AB\u529B\u3001\u4FC3\u8FDB\u5927\u8111\u53D1\u80B2\uFF08\u666E\u901A\u98DF\u54C1\u3001\u7528\u54C1\uFF09", why: "\u529F\u6548\u5BA3\u79F0", words: "\u589E\u5F3A\u514D\u75AB(?:\u529B)?|\u4FC3\u8FDB(?:\u5927\u8111|\u667A\u529B)\u53D1\u80B2|\u957F\u9AD8\u795E\u5668" },
      { id: "baby-milk", kind: "say", text: "\u66FF\u4EE3\u6BCD\u4E73\u3001\u6BD4\u6BCD\u4E73\u597D", why: "\u8FDD\u89C4", words: "\u66FF\u4EE3\u6BCD\u4E73|\u6BD4\u6BCD\u4E73(?:\u8FD8)?\u597D|\u5AB2\u7F8E\u6BCD\u4E73" },
      { id: "baby-danger", kind: "shoot", text: "\u5B9D\u5B9D\u5371\u9669\u52A8\u4F5C\u3001\u88F8\u9732\u753B\u9762", why: "\u672A\u6210\u5E74\u4EBA\u4FDD\u62A4" },
      { id: "baby-scare", kind: "direction", text: '\u5413\u552C\u5BB6\u957F\uFF1A"\u4E0D\u7528\u8FD9\u4E2A\u5B69\u5B50\u5C31\u4F1A\u2026\u2026"', why: "\u8D29\u5356\u7126\u8651" }
    ]
  },
  {
    id: "home",
    name: "\u5BB6\u5C45\u88C5\u4FEE",
    values: ["\u5BB6\u5C45\u88C5\u4FEE"],
    keywords: /装修|家居|家具|建材|全屋定制|瓷砖|门窗|软装/,
    items: [
      { id: "home-promise", kind: "say", text: "\u96F6\u7532\u919B\u3001\u65E0\u6C61\u67D3\u3001\u6C38\u4E0D\u5F00\u88C2\u3001\u7EC8\u8EAB\u8D28\u4FDD\uFF08\u6CA1\u6709\u4F9D\u636E\uFF09", why: "\u865A\u5047\u627F\u8BFA", instead: "\u8BF4\u68C0\u6D4B\u62A5\u544A\u3001\u5B9E\u9645\u8D28\u4FDD\u671F", words: "\u96F6\u7532\u919B|\u65E0\u6C61\u67D3|\u6C38\u4E0D(?:\u5F00\u88C2|\u53D8\u5F62|\u892A\u8272)|\u7EC8\u8EAB\u8D28\u4FDD" },
      { id: "home-privacy", kind: "shoot", text: "\u62CD\u5BA2\u6237\u5BB6\u95E8\u724C\u3001\u5C0F\u533A\u540D\u3001\u5BB6\u91CC\u5168\u8C8C\uFF08\u672A\u540C\u610F\uFF09", why: "\u9690\u79C1", instead: "\u6253\u7801\u3001\u5F81\u5F97\u540C\u610F" },
      { id: "home-scare", kind: "direction", text: '"\u88C5\u4FEE\u516C\u53F8\u90FD\u662F\u9A97\u5B50"\u8FD9\u7C7B\u5168\u884C\u4E1A\u62B9\u9ED1', why: "\u6613\u88AB\u4E3E\u62A5\uFF0C\u4E5F\u4F24\u81EA\u5DF1", instead: "\u8BB2\u600E\u4E48\u907F\u5751" }
    ]
  },
  {
    id: "fashion",
    name: "\u65F6\u5C1A\u7A7F\u642D",
    values: ["\u65F6\u5C1A\u7A7F\u642D", "\u670D\u88C5\u914D\u9970"],
    keywords: /服装|女装|男装|穿搭|饰品|鞋包/,
    items: [
      { id: "fashion-fake", kind: "say", text: "\u5927\u724C\u540C\u6B3E\u3001\u539F\u5355\u3001\u5C3E\u5355\uFF08\u6D89\u5ACC\u4EFF\u5192\uFF09", why: "\u77E5\u8BC6\u4EA7\u6743", words: "\u5927\u724C\u540C\u6B3E|\u539F\u5355|\u5C3E\u5355|\u9AD8\u4EFF|1:1" },
      { id: "fashion-exaggerate", kind: "say", text: "\u663E\u7626 20 \u65A4\u3001\u7A7F\u4E0A\u79D2\u53D8\u2026\u2026\uFF08\u5938\u5927\uFF09", why: "\u5938\u5927\u5BA3\u4F20", instead: "\u8BF4\u7248\u578B\u548C\u9002\u5408\u7684\u8EAB\u6750", words: "\u663E\u7626\\d+\u65A4" },
      { id: "fashion-expose", kind: "direction", text: "\u64E6\u8FB9\u3001\u8FC7\u5EA6\u66B4\u9732\u7684\u7A7F\u642D\u65B9\u5411", why: "\u5E73\u53F0\u9650\u6D41" }
    ]
  },
  {
    id: "digital",
    name: "\u6570\u7801\u79D1\u6280",
    values: ["\u6570\u7801\u79D1\u6280", "\u6570\u7801\u5BB6\u7535"],
    keywords: /数码|手机|电脑|家电|维修/,
    items: [
      { id: "digital-rival", kind: "say", text: "\u79D2\u6740\u6240\u6709\u3001\u540A\u6253 XX\uFF08\u70B9\u540D\u54C1\u724C\uFF09", why: "\u8D2C\u4F4E\u7ADE\u54C1", instead: "\u8BB2\u53C2\u6570\u548C\u5B9E\u6D4B", words: "\u540A\u6253|\u79D2\u6740\u6240\u6709|\u5B8C\u7206" },
      { id: "digital-crack", kind: "direction", text: "\u7834\u89E3\u3001\u5237\u673A\u7ED5\u8FC7\u9650\u5236\u3001\u7FFB\u5899", why: "\u8FDD\u89C4" }
    ]
  },
  {
    id: "local",
    name: "\u672C\u5730\u670D\u52A1 / \u63A2\u5E97",
    values: ["\u65C5\u6E38\u63A2\u5E97", "\u672C\u5730\u670D\u52A1"],
    items: [
      { id: "local-ad", kind: "say", text: "\u5FC5\u5403\u3001\u5FC5\u53BB\u3001\u4E0D\u53BB\u540E\u6094\uFF08\u5546\u4E1A\u5408\u4F5C\u6CA1\u6807\u6CE8\uFF09", why: "\u5E7F\u544A\u672A\u6807\u8BC6", instead: "\u5408\u4F5C\u5185\u5BB9\u8981\u6807\u6CE8", words: "\u5FC5\u5403|\u5FC5\u53BB|\u4E0D\u53BB\u540E\u6094|\u4E0D\u6765\u540E\u6094" },
      { id: "local-staff", kind: "shoot", text: "\u672A\u7ECF\u540C\u610F\u62CD\u5E97\u5458\u3001\u987E\u5BA2\u6B63\u8138", why: "\u9690\u79C1", instead: "\u6253\u7801\u3001\u5F81\u5F97\u540C\u610F" },
      { id: "local-fake", kind: "direction", text: "\u6536\u4E86\u94B1\u5305\u88C5\u6210\u300C\u81EA\u8D39\u771F\u5B9E\u63A2\u5E97\u300D\uFF0C\u6216\u8005\u62CD\u540C\u884C\u5E97\u94FA\u7684\u5DEE\u8BC4\u3001\u66DD\u5149", why: "\u865A\u5047\u5BA3\u4F20\u3001\u4E0D\u6B63\u5F53\u7ADE\u4E89" }
    ]
  },
  {
    id: "emotion",
    name: "\u60C5\u611F\u751F\u6D3B",
    values: ["\u60C5\u611F\u751F\u6D3B"],
    items: [
      { id: "emo-pua", kind: "direction", text: "\u6559\u4EBA\u51FA\u8F68\u3001PUA \u8BDD\u672F\u3001\u64CD\u63A7\u5BF9\u65B9", why: "\u8FDD\u80CC\u516C\u5E8F\u826F\u4FD7" },
      { id: "emo-sexy", kind: "direction", text: "\u6027\u6697\u793A\u3001\u64E6\u8FB9", why: "\u5E73\u53F0\u7EA2\u7EBF" }
    ]
  },
  {
    id: "health-food",
    name: "\u4FDD\u5065\u54C1",
    values: [],
    keywords: /保健品|营养品|滋补|燕窝|阿胶|蛋白粉|益生菌/,
    items: [
      { id: "hf-cure", kind: "direction", text: "\u4FDD\u5065\u54C1\u80FD\u6CBB\u75C5\u3001\u66FF\u4EE3\u836F\u7269", why: "\u4FDD\u5065\u98DF\u54C1\u4E0D\u80FD\u5BA3\u79F0\u7597\u6548", words: "\u6CBB\u7597|\u6CBB\u6108|\u66FF\u4EE3\u836F\u7269|\u836F\u5230\u75C5\u9664|\u5305\u597D" },
      { id: "hf-old", kind: "direction", text: '\u9488\u5BF9\u8001\u4EBA\u7684"\u5305\u6CBB\u767E\u75C5"\u3001\u4F1A\u8BAE\u8425\u9500\u5F0F\u8BDD\u672F', why: "\u91CD\u70B9\u6253\u51FB\u5BF9\u8C61" }
    ]
  },
  {
    id: "finance",
    name: "\u91D1\u878D\u7406\u8D22",
    values: [],
    keywords: /理财|保险|贷款|基金|股票|信用卡|投资/,
    items: [
      { id: "fin-promise", kind: "say", text: "\u4FDD\u672C\u3001\u7A33\u8D5A\u3001\u9AD8\u6536\u76CA\u65E0\u98CE\u9669\u3001\u5E74\u5316 X% \u4FDD\u8BC1", why: "\u91D1\u878D\u5E7F\u544A\u7EA2\u7EBF", words: "\u4FDD\u672C|\u7A33\u8D5A|\u7A33\u8D5A\u4E0D\u8D54|\u65E0\u98CE\u9669|\u4FDD\u8BC1\u6536\u76CA|\u96F6\u98CE\u9669" },
      { id: "fin-loan", kind: "direction", text: '\u8BF1\u5BFC\u501F\u8D37\u3001"\u79D2\u6279""\u4E0D\u770B\u5F81\u4FE1"', why: "\u8FDD\u89C4", words: "\u79D2\u6279|\u4E0D\u770B\u5F81\u4FE1|\u9ED1\u6237\u53EF\u8D37" }
    ]
  },
  {
    id: "alcohol",
    name: "\u9152\u7C7B",
    values: [],
    keywords: /白酒|啤酒|红酒|酒馆|酒吧|精酿|酒坊/,
    items: [
      { id: "alc-drink", kind: "direction", text: "\u529D\u9152\u3001\u62FC\u9152\u3001\u559D\u9189\u3001\u672A\u6210\u5E74\u4EBA\u559D\u9152", why: "\u5E73\u53F0\u9650\u5236\u996E\u9152\u5185\u5BB9" },
      { id: "alc-health", kind: "say", text: "\u559D\u9152\u517B\u751F\u3001\u89E3\u4E4F\u3001\u52A9\u7720", why: "\u9152\u7C7B\u4E0D\u80FD\u5BA3\u4F20\u5065\u5EB7\u529F\u6548", words: "\u559D\u9152\u517B\u751F|\u517B\u751F\u9152|(?:\u52A9\u7720|\u89E3\u4E4F)(?:\u795E\u5668)?" }
    ]
  },
  {
    id: "pet",
    name: "\u5BA0\u7269",
    values: [],
    keywords: /宠物|猫粮|狗粮|猫咖|萌宠|铲屎|宠物店|犬舍|猫舍/,
    items: [
      { id: "pet-abuse", kind: "direction", text: "\u6574\u86CA\u3001\u5413\u552C\u3001\u8650\u5F85\u5BA0\u7269\u6765\u535A\u6D41\u91CF", why: "\u5E73\u53F0\u7EA2\u7EBF" },
      { id: "pet-cure", kind: "say", text: "\u5BA0\u7269\u7528\u54C1\u3001\u98DF\u54C1\u8BF4\u80FD\u6CBB\u75C5", why: "\u529F\u6548\u5BA3\u79F0", words: "\u6CBB(?:\u597D|\u6108)(?:\u732B|\u72D7)?(?:\u7663|\u75C5)" }
    ]
  },
  {
    id: "car",
    name: "\u6C7D\u8F66",
    values: [],
    keywords: /汽车|汽修|4S|二手车|车行|洗车|改装/,
    items: [
      { id: "car-danger", kind: "shoot", text: "\u5371\u9669\u9A7E\u9A76\u3001\u8D85\u901F\u3001\u4E0D\u7CFB\u5B89\u5168\u5E26\u3001\u8FB9\u5F00\u8FB9\u62CD", why: "\u5B89\u5168\u3001\u8FDD\u6CD5" },
      { id: "car-mod", kind: "direction", text: "\u8FDD\u89C4\u6539\u88C5\u6559\u7A0B\uFF08\u62C6\u4E09\u5143\u3001\u6539\u6392\u6C14\u70B8\u8857\uFF09", why: "\u8FDD\u6CD5" },
      { id: "car-used", kind: "say", text: '\u4E8C\u624B\u8F66"\u65E0\u4E8B\u6545""\u51C6\u65B0\u8F66"\uFF08\u6CA1\u6709\u68C0\u6D4B\u4F9D\u636E\uFF09', why: "\u865A\u5047\u5BA3\u4F20", words: "\u65E0\u4E8B\u6545|\u96F6\u4E8B\u6545|\u51C6\u65B0\u8F66" }
    ]
  },
  {
    id: "house",
    name: "\u623F\u4EA7",
    values: [],
    keywords: /房产|楼盘|中介|租房|二手房|置业/,
    items: [
      { id: "house-promise", kind: "say", text: '\u5347\u503C\u4FDD\u8BC1\u3001\u5B66\u533A\u627F\u8BFA\u3001"\u4E70\u5230\u5C31\u662F\u8D5A\u5230"', why: "\u623F\u5730\u4EA7\u5E7F\u544A\u4E0D\u80FD\u627F\u8BFA\u5347\u503C\u3001\u5B66\u533A", words: "(?:\u4FDD\u8BC1|\u7A33)\u5347\u503C|\u4E70\u5230\u5C31\u662F\u8D5A\u5230|\u5B66\u533A(?:\u623F)?\u4FDD\u8BC1|\u5305\u5B66\u4F4D" },
      { id: "house-panic", kind: "direction", text: '\u5236\u9020\u6050\u614C\uFF1A"\u518D\u4E0D\u4E70\u5C31\u4E70\u4E0D\u8D77\u4E86"', why: "\u8FDD\u89C4\u7092\u4F5C", words: "\u518D\u4E0D\u4E70\u5C31(?:\u4E70\u4E0D\u8D77|\u6CA1\u4E86)" }
    ]
  }
];
function readTabooSettings(v) {
  const o = v && typeof v === "object" ? v : {};
  const list = (x) => Array.isArray(x) ? x.filter((s) => typeof s === "string" && Boolean(s.trim())).map((s) => s.trim()) : [];
  return { disabled: list(o.disabled), extra: list(o.extra), added: list(o.added).filter((id) => INDUSTRIES.some((i) => i.id === id)), excluded: list(o.excluded) };
}
var asList2 = (v) => Array.isArray(v) ? v.filter((x) => typeof x === "string") : typeof v === "string" ? v.split(/[、,，]/).map((x) => x.trim()).filter(Boolean) : [];
function industriesOf(profile2) {
  const p = profile2 ?? {};
  const values = [...asList2(p.account_track), ...asList2(p.product_category)];
  const text5 = [p.profile_name, ...values, p.content_themes].filter((x) => typeof x === "string").join(" ");
  const added = readTabooSettings(p.taboo_settings).added;
  return INDUSTRIES.filter((ind) => added.includes(ind.id) || ind.values.some((v) => values.includes(v)) || (ind.keywords ? ind.keywords.test(text5) : false));
}
function activeTaboos(profile2) {
  const s = readTabooSettings(profile2?.taboo_settings);
  const off = new Set(s.disabled);
  return {
    platform: PLATFORM_TABOOS.filter((t) => !(t.closable && off.has(t.id))),
    industries: industriesOf(profile2).map((industry) => ({ industry, items: industry.items.filter((t) => !off.has(t.id)) })).filter((x) => x.items.length > 0),
    extra: s.extra
  };
}
function taboosPromptBlock(profile2) {
  const a = activeTaboos(profile2);
  const all = [...a.platform, ...a.industries.flatMap((x) => x.items)];
  const fmt = (t) => `- ${t.text}${t.instead ? `\uFF08\u6362\u6210\uFF1A${t.instead}\uFF09` : ""}`;
  const dirs = all.filter((t) => t.kind === "direction");
  const says = all.filter((t) => t.kind !== "direction");
  const names = a.industries.map((x) => x.industry.name).join("\u3001");
  const parts = [
    `#### \u{1F6AB} \u4E0D\u80FD\u62CD\u7684\u65B9\u5411${names ? `\uFF08\u5E73\u53F0\u7EA2\u7EBF + ${names}\u884C\u4E1A\uFF09` : "\uFF08\u5E73\u53F0\u7EA2\u7EBF\uFF09"}\u2014\u2014\u9009\u9898\u3001\u65B9\u5411\u3001\u793A\u4F8B\u4E00\u5F8B\u907F\u5F00`,
    ...dirs.map(fmt),
    "",
    "#### \u{1F6AB} \u4E0D\u80FD\u8BF4\u7684\u8BDD / \u4E0D\u80FD\u62CD\u7684\u753B\u9762",
    ...says.map(fmt)
  ];
  if (a.extra.length) parts.push("", "#### \u{1F6AB} \u8FD9\u4E2A\u53F7\u81EA\u5DF1\u8865\u5145\u7684", ...a.extra.map((x) => `- ${x}`));
  const excluded = readTabooSettings(profile2?.taboo_settings).excluded;
  if (excluded.length) {
    parts.push(
      "",
      "#### \u{1F648} \u5EFA\u6863\u65F6\u7F16\u5BFC\u523B\u610F\u53BB\u6389\u7684\u4FE1\u606F\u2014\u2014\u5F53\u5B83\u4E0D\u5B58\u5728",
      ...excluded.map((x) => `- ${x}`),
      '\u8FD9\u4E9B\u662F\u524D\u91C7\u5F55\u97F3\u91CC\u6709\u3001\u4F46\u7F16\u5BFC\u5224\u65AD**\u6CA1\u7528\u6216\u4E0D\u60F3\u8981**\u7684\uFF1A\u4E0D\u5F15\u7528\u3001\u4E0D\u5F53\u4F9D\u636E\u3001\u4E0D\u636E\u6B64\u63A8\u65AD\u65B9\u5411\u548C\u4EBA\u8BBE\uFF0C\u4E5F\u4E0D\u8981\u63D0"\u867D\u7136\u4F60\u6709\xD7\xD7"\uFF1B',
      "\u6863\u6848\u5176\u4ED6\u680F\u3001\u5DF2\u6709\u7684\u5B9A\u4F4D\u6216\u7B80\u62A5\u91CC\u5982\u679C\u8FD8\u6B8B\u7559\u76F8\u5173\u8BF4\u6CD5\uFF0C**\u540C\u6837\u5FFD\u7565**\u3002"
    );
  }
  return parts.join("\n");
}

// lib/profile-fields.ts
var PROFILE_CHOICES = {
  account_platform: ["\u6296\u97F3", "\u5FEB\u624B", "\u89C6\u9891\u53F7", "\u5C0F\u7EA2\u4E66", "B\u7AD9"],
  account_track: ["\u7F8E\u98DF\u70F9\u996A", "\u65F6\u5C1A\u7A7F\u642D", "\u7F8E\u5986\u62A4\u80A4", "\u5065\u8EAB\u8FD0\u52A8", "\u77E5\u8BC6\u6559\u80B2", "\u804C\u573A\u6210\u957F", "\u60C5\u611F\u751F\u6D3B", "\u65C5\u6E38\u63A2\u5E97", "\u5BB6\u5C45\u88C5\u4FEE", "\u6BCD\u5A74\u80B2\u513F", "\u6570\u7801\u79D1\u6280", "\u672C\u5730\u670D\u52A1"],
  account_stage: ["\u521A\u8D77\u53F7\uFF0C\u5B9A\u4F4D\u672A\u786E\u5B9A", "\u6709\u5B9A\u4F4D\uFF0C\u9700\u8981\u5185\u5BB9\u65B9\u5411", "\u7A33\u5B9A\u8FD0\u8425\uFF0C\u9700\u8981\u65B0\u9009\u9898", "\u6210\u719F\u671F\uFF0C\u9700\u8981\u7A81\u7834"],
  fans_level: ["0-1\u4E07", "1-5\u4E07", "5-10\u4E07", "10-50\u4E07", "50\u4E07+"],
  target_gender: ["\u7537\u6027\u4E3A\u4E3B", "\u5973\u6027\u4E3A\u4E3B", "\u4E0D\u9650"],
  target_age: ["18-24\u5C81", "25-30\u5C81", "31-40\u5C81", "41\u5C81\u4EE5\u4E0A"],
  target_region: ["\u4E00\u4E8C\u7EBF\u57CE\u5E02", "\u4E09\u56DB\u7EBF\u57CE\u5E02", "\u5168\u56FD", "\u672C\u5730\u540C\u57CE"],
  target_occupation: ["\u767D\u9886", "\u5B66\u751F", "\u5B9D\u5988", "\u81EA\u7531\u804C\u4E1A", "\u4F01\u4E1A\u4E3B", "\u84DD\u9886\u6280\u5DE5"],
  content_style: ["\u4E13\u4E1A", "\u8F7B\u677E", "\u5E7D\u9ED8", "\u60C5\u611F", "\u52B1\u5FD7", "\u5B9E\u7528", "\u9AD8\u7EA7", "\u63A5\u5730\u6C14"],
  content_format: ["\u53E3\u64AD", "\u5267\u60C5", "\u6559\u7A0B", "Vlog", "\u6D4B\u8BC4", "\u91C7\u8BBF", "\u6DF7\u526A", "\u56FE\u6587"],
  content_tone: ["\u4EB2\u5207\u670B\u53CB\u5F0F", "\u4E13\u4E1A\u6743\u5A01\u5F0F", "\u5E7D\u9ED8\u641E\u7B11\u5F0F", "\u6E29\u6696\u6CBB\u6108\u5F0F", "\u76F4\u7387\u7280\u5229\u5F0F"],
  team_structure: ["\u4E00\u4EBA\u5168\u5305", "2-3\u4EBA\u5C0F\u56E2\u961F", "\u5B8C\u6574\u56E2\u961F(\u7F16\u5BFC/\u6444\u5F71/\u526A\u8F91)", "\u4E13\u4E1AMCN"],
  equipment: ["\u624B\u673A", "\u76F8\u673A", "\u4E13\u4E1A\u6444\u50CF\u673A", "\u706F\u5149", "\u6536\u97F3\u8BBE\u5907", "\u7A33\u5B9A\u5668"],
  shooting_location: ["\u5BB6", "\u5DE5\u4F5C\u5BA4", "\u5916\u666F", "\u5E97\u94FA", "\u529E\u516C\u5BA4"],
  editing_capability: ["\u57FA\u7840\u526A\u8F91", "\u4E2D\u7EA7\u7279\u6548", "\u4E13\u4E1A\u5236\u4F5C"],
  video_duration: ["15-30\u79D2", "30-60\u79D2", "1-3\u5206\u949F", "3-5\u5206\u949F", "5\u5206\u949F\u4EE5\u4E0A"],
  budget_per_video: ["0-500\u5143", "500-2000\u5143", "2000-5000\u5143", "5000\u5143\u4EE5\u4E0A"],
  monetization_model: ["\u5230\u5E97\u6D88\u8D39", "\u5E26\u8D27\u4F63\u91D1", "\u77E5\u8BC6\u4ED8\u8D39", "\u79C1\u57DF\u5F15\u6D41", "\u76F4\u64AD\u6253\u8D4F", "\u54C1\u724C\u5408\u4F5C", "\u7EBF\u4E0B\u670D\u52A1", "\u6682\u4E0D\u8003\u8651"],
  product_category: ["\u9910\u996E", "\u7F8E\u5986\u62A4\u80A4", "\u670D\u88C5\u914D\u9970", "\u751F\u6D3B\u7528\u54C1", "\u98DF\u54C1\u996E\u6599", "\u6570\u7801\u5BB6\u7535", "\u672C\u5730\u670D\u52A1"],
  price_range: ["50\u5143\u4EE5\u4E0B", "50-200\u5143", "200-500\u5143", "500\u5143\u4EE5\u4E0A"]
};
var pickField = (key) => {
  const g = OPTION_GROUPS.find((x) => x.field === key);
  if (!g) throw new Error(`profile-options \u91CC\u6CA1\u6709 ${key}`);
  return { key, label: g.label, kind: "pick", options: g.options.map((o) => o.value), allowOther: g.allowOther !== false };
};
var multi = (key, label3) => ({ key, label: label3, kind: "multi", options: PROFILE_CHOICES[key] });
var single = (key, label3) => ({ key, label: label3, kind: "single", options: PROFILE_CHOICES[key] });
var text = (key, label3) => ({ key, label: label3, kind: "text" });
var PROFILE_SECTIONS = [
  {
    title: "\u8D26\u53F7\u57FA\u7840",
    fields: [
      multi("account_platform", "\u8FD0\u8425\u5E73\u53F0"),
      multi("account_track", "\u5185\u5BB9\u8D5B\u9053"),
      single("account_stage", "\u8D26\u53F7\u9636\u6BB5"),
      single("fans_level", "\u7C89\u4E1D\u91CF\u7EA7")
    ]
  },
  {
    title: "\u76EE\u6807\u53D7\u4F17",
    fields: [
      single("target_gender", "\u4E3B\u8981\u6027\u522B"),
      multi("target_age", "\u5E74\u9F84\u6BB5"),
      multi("target_region", "\u5730\u57DF\u5206\u5E03"),
      multi("target_occupation", "\u804C\u4E1A\u6807\u7B7E"),
      { key: "target_interests", label: "\u76EE\u6807\u4EBA\u7FA4\u7684\u5174\u8DA3", kind: "multi" },
      pickField("target_pain_points"),
      pickField("target_needs"),
      pickField("fan_common_questions")
    ]
  },
  {
    title: "\u5185\u5BB9\u5B9A\u4F4D",
    fields: [
      multi("content_style", "\u5185\u5BB9\u98CE\u683C"),
      multi("content_format", "\u5185\u5BB9\u5F62\u5F0F"),
      single("content_tone", "\u8BED\u8A00\u98CE\u683C"),
      text("content_themes", "\u4E3B\u8981\u9009\u9898\u65B9\u5411"),
      pickField("content_value"),
      pickField("unique_selling_point"),
      pickField("viral_content_pattern"),
      pickField("content_restrictions")
    ]
  },
  {
    title: "\u7ADE\u4E89\u7B56\u7565",
    fields: [
      text("reference_accounts", "\u5BF9\u6807\u8D26\u53F7"),
      text("competitive_advantage", "\u7ADE\u4E89\u4F18\u52BF"),
      pickField("competitive_weakness"),
      pickField("unique_resources")
    ]
  },
  {
    title: "\u8D44\u6E90\u914D\u7F6E",
    fields: [
      single("team_structure", "\u56E2\u961F\u914D\u7F6E"),
      multi("equipment", "\u8BBE\u5907\u6761\u4EF6"),
      multi("shooting_location", "\u62CD\u6444\u573A\u5730"),
      single("editing_capability", "\u540E\u671F\u80FD\u529B"),
      multi("video_duration", "\u89C6\u9891\u65F6\u957F\u504F\u597D"),
      single("budget_per_video", "\u5355\u6761\u9884\u7B97")
    ]
  },
  {
    title: "\u53D8\u73B0\u8DEF\u5F84",
    fields: [
      multi("monetization_model", "\u53D8\u73B0\u65B9\u5F0F"),
      multi("product_category", "\u4EA7\u54C1\u54C1\u7C7B"),
      multi("price_range", "\u4EF7\u683C\u533A\u95F4"),
      pickField("conversion_path"),
      pickField("conversion_barriers")
    ]
  }
];
var PROFILE_FIELDS = PROFILE_SECTIONS.flatMap((s) => s.fields);

// lib/interview-exclusions.ts
var LABEL = new Map(PROFILE_FIELDS.map((f) => [f.key, f.label]));
var LABELS = new Set(PROFILE_FIELDS.map((f) => f.label));
var KIND = new Map(PROFILE_FIELDS.map((f) => [f.key, f.kind]));
function segmentsOf(text5) {
  const out = [];
  let depth = 0;
  let cur = "";
  for (const ch of text5) {
    if ("\uFF08(\u3010\u300C".includes(ch)) depth++;
    if ("\uFF09)\u3011\u300D".includes(ch)) depth = Math.max(0, depth - 1);
    if (depth === 0 && "\u3001\uFF0C,\uFF1B;\n".includes(ch)) {
      if (cur.trim()) out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
function grams(text5, n = 3) {
  const s = /* @__PURE__ */ new Set();
  for (const run2 of text5.match(/[\p{Script=Han}A-Za-z0-9]+/gu) ?? []) {
    for (let i = 0; i + n <= run2.length; i++) {
      const g = run2.slice(i, i + n);
      if ((g.match(/\p{Script=Han}/gu) ?? []).length >= 2) s.add(g);
    }
  }
  return s;
}
function exclusionGrams(excluded, stopText) {
  const stop = grams(stopText);
  return excluded.map((e) => {
    const m = e.match(/^([^：]{1,16})：/);
    const body = m && (m[1].endsWith("\u91CC\u7684") || LABELS.has(m[1])) ? e.slice(m[0].length) : e;
    const needles = /* @__PURE__ */ new Set();
    for (const piece of segmentsOf(body)) {
      const core = piece.replace(/^(?:不要|不提|不做|不拍|不说|别提|别拍|别)/, "").replace(/(?:相关的事|相关的|相关|的事|内容|这类)$/, "").trim();
      const han = (core.match(/\p{Script=Han}/gu) ?? []).length;
      if (han >= 2 && core.length <= 6) needles.add(core);
      for (const g of grams(core)) needles.add(g);
    }
    return [...needles].filter((x) => !stop.has(x));
  });
}
function hitsExclusion(segment, ex) {
  for (const list of ex) {
    const hit = list.find((x) => segment.includes(x));
    if (hit) return hit;
  }
  return void 0;
}
var UNTOUCHED = /* @__PURE__ */ new Set(["id", "user_id", "profile_name", "taboo_settings", "content_mix", "persona_facts", "interview_notes", "created_at", "updated_at", "content_restrictions", "avoid_content"]);
function scrubProfile(profile2, excluded) {
  if (!profile2 || excluded.length === 0) return profile2;
  const p = profile2;
  const ex = exclusionGrams(excluded, String(p.profile_name ?? ""));
  const out = { ...p };
  for (const [k, v] of Object.entries(p)) {
    if (UNTOUCHED.has(k)) continue;
    if (Array.isArray(v)) out[k] = v.filter((x) => typeof x !== "string" || !hitsExclusion(x, ex));
    else if (typeof v === "string" && v.trim()) {
      const parts = k === "interview_highlights" ? v.split("\n") : segmentsOf(v);
      const kept = parts.filter((s) => !hitsExclusion(s, ex));
      if (kept.length !== parts.length) out[k] = kept.join(k === "interview_highlights" ? "\n" : "\u3001");
    }
  }
  return out;
}

// lib/persona-facts.ts
var PERSONA_FIELDS = [
  { key: "host", label: "\u51FA\u955C\u4EBA\u662F\u8C01", placeholder: "\u4F8B\u5982\uFF1A\u4E3B\u53A8\u8001\u738B\u3001\u8001\u677F\u5A18\u5C0F\u82B3" },
  { key: "role", label: "\u548C\u5E97\u7684\u5173\u7CFB", placeholder: "\u4F8B\u5982\uFF1A\u8001\u677F / \u4E3B\u53A8 / \u5E97\u5458 / \u7F16\u5BFC\u672C\u4EBA" },
  { key: "origin", label: "\u4ECE\u54EA\u6765", placeholder: "\u4F8B\u5982\uFF1A\u6210\u90FD\u4EBA" },
  { key: "yearsInTrade", label: "\u5E72\u8FD9\u884C\u51E0\u5E74", placeholder: "\u4F8B\u5982\uFF1A\u505A\u5DDD\u83DC 9 \u5E74" },
  { key: "yearsLocal", label: "\u5728\u672C\u5730\u591A\u4E45", placeholder: "\u4F8B\u5982\uFF1A\u6765\u5357\u4E50\u534A\u5E74" },
  { key: "mainProducts", label: "\u4E3B\u5356\u4EC0\u4E48", placeholder: "\u4F8B\u5982\uFF1A\u5DDD\u5473\u4E32\u4E32\u706B\u9505\u3001\u5DDD\u5473\u70E7\u70E4\u3001\u5DDD\u83DC" },
  { key: "signature", label: "\u62DB\u724C / \u7279\u8272", placeholder: "\u4F8B\u5982\uFF1A\u4E00\u5143\u706B\u9505" },
  { key: "story", label: "\u4E00\u53E5\u8BDD\u7ECF\u5386", placeholder: "\u4F8B\u5982\uFF1A\u5728\u6210\u90FD\u505A\u4E86 9 \u5E74\u5DDD\u83DC\uFF0C\u4ECA\u5E74\u6765\u5357\u4E50\u8DDF\u670B\u53CB\u5408\u4F19\u6446\u5730\u644A", multiline: true },
  { key: "others", label: "\u5176\u4ED6\u786C\u4E8B\u5B9E\uFF08\u4E00\u884C\u4E00\u6761\uFF09", placeholder: "\u4F8B\u5982\uFF1A\n\u6BCF\u5929\u4E0B\u5348 4 \u70B9\u51FA\u644A\n\u4EBA\u5747 30-50 \u5143", multiline: true }
];
var KEYS = PERSONA_FIELDS.map((f) => f.key);
function readPersonaFacts(v) {
  const o = v && typeof v === "object" ? v : {};
  const out = {};
  for (const k of KEYS) {
    const s = typeof o[k] === "string" ? o[k].trim().slice(0, k === "others" || k === "story" ? 600 : 120) : "";
    if (s) out[k] = s;
  }
  return out;
}
function personaFactsBlock(v) {
  const f = readPersonaFacts(v);
  const rows = PERSONA_FIELDS.filter((x) => f[x.key]).map((x) => {
    const val = f[x.key];
    return x.key === "others" ? `- **${x.label.replace(/（.*）/, "")}**\uFF1A
${val.split("\n").map((l) => `  - ${l.trim()}`).filter((l) => l.trim() !== "-").join("\n")}` : `- **${x.label}**\uFF1A${val}`;
  });
  if (rows.length === 0) return "";
  return [
    "### \u{1FAAA} \u4EBA\u8BBE\u4E8B\u5B9E\u5361\uFF08\u6700\u786C\u7684\u4E8B\u5B9E\uFF0C\u4EE5\u5B83\u4E3A\u51C6\uFF09",
    "",
    ...rows,
    "",
    "\u8FD9\u662F\u7F16\u5BFC\u786E\u8BA4\u8FC7\u7684\u4E8B\u5B9E\uFF1A**\u548C\u6863\u6848\u5176\u4ED6\u680F\u3001\u524D\u91C7\u8981\u70B9\u3001\u5DF2\u6709\u7684\u5B9A\u4F4D\u6216\u7B80\u62A5\u5BF9\u4E0D\u4E0A\u65F6\uFF0C\u4E00\u5F8B\u4EE5\u8FD9\u91CC\u4E3A\u51C6**\uFF1B",
    "\u5199\u4EBA\u8BBE\u3001\u7ECF\u5386\u3001\u5E74\u9650\u3001\u7C4D\u8D2F\u3001\u5728\u5356\u4EC0\u4E48\u65F6\u53EA\u7528\u8FD9\u91CC\u7684\u8BF4\u6CD5\uFF0C\u4E0D\u6539\u5199\u3001\u4E0D\u5938\u5927\uFF1B\u8FD9\u91CC\u6CA1\u5199\u7684\u7ECF\u5386\u548C\u6570\u5B57\u4E0D\u8981\u81EA\u5DF1\u7F16\uFF08\u7528 X \u6216\u3010\u6362\u6210\u4F60\u7684\uFF1A\u2026\u2026\u3011\uFF09\u3002"
  ].join("\n");
}

// lib/performance.ts
var METRIC_FIELDS = [
  { key: "views", label: "\u64AD\u653E", max: 1e9 },
  { key: "completion", label: "\u5B8C\u64AD\u7387", unit: "%", max: 100 },
  { key: "likes", label: "\u70B9\u8D5E", max: 1e8 },
  { key: "comments", label: "\u8BC4\u8BBA", max: 1e8 },
  { key: "shares", label: "\u8F6C\u53D1", max: 1e8 },
  { key: "follows", label: "\u6DA8\u7C89", max: 1e8 },
  { key: "inquiries", label: "\u54A8\u8BE2", max: 1e7 },
  { key: "deals", label: "\u6210\u4EA4", max: 1e7 },
  { key: "retention3s", label: "\u4E09\u79D2\u7559\u5B58\u7387", unit: "%", max: 100 },
  { key: "observationHours", label: "\u53D1\u5E03\u540E\u89C2\u5BDF\u65F6\u957F", unit: "\u5C0F\u65F6", max: 8760 }
];
function metricsLine(m) {
  if (!m) return "";
  const fmt = (n) => n >= 1e4 ? `${(n / 1e4).toFixed(n >= 1e5 ? 1 : 2).replace(/\.?0+$/, "")}\u4E07` : String(n);
  return METRIC_FIELDS.filter((f) => typeof m[f.key] === "number").map((f) => `${f.label} ${f.unit ? m[f.key] : fmt(m[f.key])}${f.unit ?? ""}`).join(" \xB7 ");
}
var MIN_SAMPLE = 3;
function performancePromptBlock(s) {
  if (!s || s.count === 0) return "";
  const g = (x) => `- ${x.name}\uFF08${x.n} \u6761\uFF09\uFF1A\u5E73\u5747\u64AD\u653E ${x.avgViews === null ? "\u2014" : Math.round(x.avgViews)}${x.avgCompletion === null ? "" : `\u3001\u5B8C\u64AD ${Math.round(x.avgCompletion)}%`}${x.follows ? `\u3001\u6DA8\u7C89 ${x.follows}` : ""}${x.inquiries ? `\u3001\u54A8\u8BE2 ${x.inquiries}` : ""}${x.deals ? `\u3001\u6210\u4EA4 ${x.deals}` : ""}${x.rates?.inquiries === void 0 ? "" : `\u3001\u6BCF\u5343\u64AD\u653E\u54A8\u8BE2 ${x.rates.inquiries}`}${x.rates?.follows === void 0 ? "" : `\u3001\u6BCF\u5343\u64AD\u653E\u6DA8\u7C89 ${x.rates.follows}`}${x.rates?.deals === void 0 ? "" : `\u3001\u6BCF\u5343\u64AD\u653E\u6210\u4EA4 ${x.rates.deals}`}`;
  const parts = [`### \u{1F4C8} \u8FD9\u4E2A\u53F7\u53D1\u51FA\u53BB\u7684\u771F\u5B9E\u6570\u636E\uFF08${s.count} \u6761\u5F55\u4E86\u6570\u636E\uFF09`, ""];
  if (s.byPurpose.length) parts.push("\u6309\u4E09\u79CD\u89C6\u9891\uFF1A", ...s.byPurpose.map(g), "");
  if (s.byTactic.length) parts.push("\u6309\u62CD\u6CD5\uFF1A", ...s.byTactic.slice(0, 6).map(g), "");
  if (s.byCohort?.length) parts.push("\u540C\u76EE\u7684\u3001\u540C\u5E73\u53F0\u3001\u76F8\u8FD1\u89C2\u5BDF\u65F6\u95F4\u3001\u540C\u6295\u653E\u60C5\u51B5\uFF1A", ...s.byCohort.slice(0, 8).map(g), "\u542B\u6295\u653E\u7684\u7D20\u6750\u8FD8\u9700\u8003\u8651\u6295\u653E\u91D1\u989D\u548C\u4EBA\u7FA4\u5DEE\u5F02\u3002", "");
  if (s.comparisonScope) parts.push(`\u4EE5\u4E0B\u6392\u5E8F\u53EA\u53C2\u8003\u300C${s.comparisonScope}\u300D\uFF0C\u4E0D\u662F\u5168\u8D26\u53F7\u6392\u540D\uFF0C\u4E5F\u4E0D\u662F\u5DF2\u9A8C\u8BC1\u7ED3\u8BBA\u3002`);
  if (s.best.length) parts.push(`\u672C\u7EC4\u8F83\u9AD8\u53C2\u8003\u9879\uFF1A${s.best.map((r) => `\u300C${r.title}\u300D\uFF08${metricsLine(r.metrics)}\uFF09`).join("\uFF1B")}`);
  if (s.worst.length) parts.push(`\u672C\u7EC4\u5F85\u590D\u76D8\u9879\uFF1A${s.worst.map((r) => `\u300C${r.title}\u300D\uFF08${metricsLine(r.metrics)}\uFF09`).join("\uFF1B")}`);
  if (s.insights.length) parts.push("", ...s.insights.map((x) => `- ${x}`));
  parts.push(
    "",
    s.count < MIN_SAMPLE ? "\u26A0\uFE0F \u6837\u672C\u8FD8\u5C11\uFF0C\u4E0A\u9762\u53EA\u5F53\u53C2\u8003\uFF0C\u4E0D\u8981\u636E\u6B64\u4E0B\u7ED3\u8BBA\u6216\u63A8\u7FFB\u5B9A\u4F4D\u3002" : "\u6309\u521B\u4F5C\u76EE\u6807\u63D0\u51FA\u4E0B\u4E00\u8F6E\u5BF9\u7167\u8BD5\u9A8C\uFF0C\u4E0D\u56E0\u64AD\u653E\u4F4E\u5C31\u653E\u5F03\u6709\u54A8\u8BE2\u7684\u4F5C\u54C1\uFF0C\u4E0D\u628A\u76F8\u5173\u6027\u5199\u6210\u56E0\u679C\u6216\u5DF2\u9A8C\u8BC1\u6709\u6548\u3002\u6BCF\u5343\u64AD\u653E\u6307\u6807\u7528\u4E8E\u7EDF\u4E00\u5206\u6BCD\uFF0C\u7F3A\u5931\u9879\u4E0D\u7B49\u4E8E\u96F6\u3002\u6CA1\u6709\u4E09\u79D2\u7559\u5B58\u6570\u636E\uFF0C\u4E0D\u80FD\u65AD\u8A00\u5F00\u5934\u6CA1\u7559\u4F4F\u4EBA\u3002"
  );
  return parts.join("\n");
}

// lib/creator-presets.ts
var PRESET_BOARDS = /* @__PURE__ */ new Set(["script", "review", "title", "growth", "remix", "storyboard", "freeChat"]);
var EXAMPLE_IN_PROMPT = 600;
function presetPromptBlock(p) {
  if (!p) return "";
  const lines = [`## \u270D\uFE0F \u8FD9\u4E2A\u8D26\u53F7\u8BA4\u53EF\u7684\u5199\u6CD5\uFF08\u98CE\u683C\u9884\u8BBE\uFF1A${p.name}\uFF09`, ""];
  if (p.style) lines.push(`- **\u8868\u8FBE\u98CE\u683C**\uFF1A${p.style}`);
  if (p.structure) lines.push(`- **\u7ED3\u6784**\uFF1A${p.structure}`);
  if (p.examples.length) {
    lines.push("", "\u4E0B\u9762\u662F\u7528\u6237\u8BA4\u53EF\u7684\u597D\u7A3F\uFF0C**\u53EA\u5B66\u8BED\u6C14\u3001\u8282\u594F\u548C\u7ED3\u6784**\uFF1A");
    p.examples.forEach((e, i) => {
      const body = e.content.length > EXAMPLE_IN_PROMPT ? `${e.content.slice(0, EXAMPLE_IN_PROMPT)}\u2026` : e.content;
      lines.push("", `### \u793A\u4F8B${i + 1}\uFF1A${e.title}`, body);
    });
  }
  lines.push("", "\u26A0\uFE0F \u793A\u4F8B\u91CC\u7684\u5E97\u540D\u3001\u4EF7\u683C\u3001\u6570\u5B57\u3001\u7ECF\u5386\u3001\u5730\u70B9**\u4E0D\u80FD\u642C\u8FDB\u65B0\u7A3F**\uFF1B\u4E8B\u5B9E\u4EE5\u4E0A\u9762\u7684\u8D26\u53F7\u80CC\u666F\u548C\u8FD9\u6B21\u7684\u7D20\u6750\u4E3A\u51C6\u3002\u98CE\u683C\u9884\u8BBE\u548C\u672C\u6B21\u8981\u6C42\u51B2\u7A81\u65F6\uFF0C\u4EE5\u672C\u6B21\u8981\u6C42\u4E3A\u51C6\u3002");
  return lines.join("\n");
}

// lib/preferences.ts
var PREFERENCE_CATEGORIES = [
  { id: "tone", label: "\u53E3\u543B\u7528\u8BCD" },
  { id: "opening", label: "\u5F00\u5934\u4E60\u60EF" },
  { id: "structure", label: "\u7ED3\u6784\u4E0E\u957F\u5EA6" },
  { id: "content", label: "\u5185\u5BB9\u53D6\u5411" }
];
var CATEGORY_IDS = new Set(PREFERENCE_CATEGORIES.map((c) => c.id));
var PROMPT_MAX = 600;
var PREFERENCE_BOARDS = /* @__PURE__ */ new Set(["topic", "script", "storyboard", "review", "title", "growth", "remix", "freeChat"]);
function preferencePromptBlock(items) {
  const active = (items ?? []).filter((i) => i.status === "active");
  if (!active.length) return "";
  const lines = [];
  let len = 0;
  for (const c of PREFERENCE_CATEGORIES) {
    for (const i of active.filter((x) => x.category === c.id)) {
      const line3 = `- ${c.label}\uFF1A${i.text}`;
      if (len + line3.length > PROMPT_MAX) break;
      lines.push(line3);
      len += line3.length;
    }
  }
  return [
    `## \u{1F9E0} \u8FD9\u4E2A\u53F7\u7684\u521B\u4F5C\u504F\u597D\uFF08\u4ECE\u4ED6\u7684\u4FEE\u6539\u3001\u6536\u85CF\u548C\u53D1\u5E03\u91CC\u5B66\u5230\u7684\uFF0C\u4ED6\u770B\u8FC7\u3001\u53EF\u4EE5\u6539\uFF09`,
    "",
    ...lines,
    "",
    "\u26A0\uFE0F \u8FD9\u4E9B\u662F\u5199\u6CD5\u4E60\u60EF\uFF0C\u7167\u7740\u5199\uFF1B\u548C\u4E0A\u9762\u7684\u4EBA\u8BBE\u4E8B\u5B9E\u5361\u3001\u7981\u5FCC\u3001\u8D26\u53F7\u6863\u6848\u3001\u98CE\u683C\u9884\u8BBE\u6216\u8FD9\u6B21\u7684\u8981\u6C42\u51B2\u7A81\u65F6\uFF0C\u4EE5\u5B83\u4EEC\u4E3A\u51C6\u3002"
  ].join("\n");
}

// lib/creator-context.ts
var PERFORMANCE_BOARDS = /* @__PURE__ */ new Set(["topic", "direction", "growth", "freeChat"]);
function briefOlderThanProfile(ctx2) {
  return !!ctx2.brief && briefFactsChanged(ctx2.briefFacts, ctx2.profile);
}
function text2(v, maxLen = 300) {
  if (v == null) return "";
  const s = Array.isArray(v) ? v.filter(Boolean).join("\u3001") : String(v);
  const t = s.trim();
  if (!t) return "";
  return t.length > maxLen ? t.slice(0, maxLen) + "\u2026" : t;
}
function line(label3, value, maxLen = 300) {
  const t = text2(value, maxLen);
  return t ? `- **${label3}**\uFF1A${t}` : null;
}
var join = (lines) => lines.filter(Boolean).join("\n");
function describeShootingSetup(p) {
  if (!p) return "";
  const rows = join([
    line("\u53EF\u7528\u8BBE\u5907", p.equipment),
    line("\u56E2\u961F\u89C4\u6A21", p.team_structure),
    line("\u5E38\u7528\u573A\u5730", p.shooting_location),
    line("\u526A\u8F91\u80FD\u529B", p.editing_capability),
    line("\u5355\u6761\u9884\u7B97", p.budget_per_video),
    line("\u60EF\u7528\u65F6\u957F", p.video_duration)
  ]);
  if (!rows) return "";
  return `## \u{1F3A5} \u8FD9\u4E2A\u8D26\u53F7\u7684\u771F\u5B9E\u62CD\u6444\u6761\u4EF6

${rows}

**\u6309\u8FD9\u4E9B\u6761\u4EF6\u8BBE\u8BA1\u5206\u955C**\uFF1A\u6709\u7A33\u5B9A\u5668\u624D\u5B89\u6392\u8FD0\u52A8\u955C\u5934\uFF0C\u6709\u706F\u5149\u624D\u8BBE\u8BA1\u5149\u4F4D\uFF0C
\u56E2\u961F\u53EA\u6709\u4E00\u4E2A\u4EBA\u5C31\u4E0D\u8981\u51FA\u73B0\u9700\u8981\u7B2C\u4E8C\u673A\u4F4D\u540C\u65F6\u62CD\u7684\u955C\u5934\u3002
\u6761\u4EF6\u6CA1\u5199\u5230\u7684\u6309\u6700\u4FDD\u5B88\u7684\u60C5\u51B5\u5904\u7406\uFF08\u624B\u673A\u3001\u5355\u4EBA\u3001\u81EA\u7136\u5149\uFF09\u3002`;
}
function describeAudience(p, detail) {
  const base = join([
    line("\u4EBA\u7FA4", [text2(p.target_age), text2(p.target_gender), text2(p.target_occupation)].filter(Boolean).join(" \xB7 ")),
    line("\u5730\u57DF", p.target_region)
  ]);
  if (detail === "brief") return base;
  return join([
    base,
    line("\u771F\u5B9E\u75DB\u70B9", p.target_pain_points, 500),
    line("\u771F\u6B63\u9700\u6C42", p.target_needs, 500),
    line("\u7C89\u4E1D\u5E38\u95EE", p.fan_common_questions, 400)
  ]);
}
function describeRestrictions(p) {
  const rows = join([
    line("\u7EDD\u5BF9\u4E0D\u80FD\u8BF4", p.content_restrictions, 500),
    line("\u907F\u514D\u7684\u5185\u5BB9", p.avoid_content, 300)
  ]);
  return `### \u26D4 \u786C\u6027\u7981\u5FCC\uFF08\u8FDD\u53CD\u5373\u4E0D\u53EF\u7528\uFF09

${rows ? `${rows}

` : ""}${taboosPromptBlock(p)}`;
}
function buildContextBlock(ctx2, module2) {
  const p = ctx2.profile ? scrubProfile(ctx2.profile, readTabooSettings(ctx2.profile.taboo_settings).excluded) ?? null : null;
  if (!p && !ctx2.positioning && ctx2.dealReasons.length === 0) return "";
  const parts = [];
  const title = p?.profile_name ? `## \u{1F4C7} \u8D26\u53F7\u80CC\u666F\uFF1A${p.profile_name}` : "## \u{1F4C7} \u8D26\u53F7\u80CC\u666F";
  if (p) {
    const want = new Set(manifestOf(module2)?.profile ?? []);
    parts.push(title, "");
    const persona = personaFactsBlock(p.persona_facts);
    if (persona) parts.push(persona, "");
    if (want.has("account")) {
      parts.push(join([
        line("\u5E73\u53F0", p.account_platform),
        line("\u8D5B\u9053", p.account_track),
        line("\u8D26\u53F7\u9636\u6BB5", [text2(p.account_stage), text2(p.fans_level)].filter(Boolean).join(" \xB7 ")),
        line("\u5185\u5BB9\u5F62\u5F0F", p.content_format)
      ]), "");
      const facts = line("\u771F\u5B9E\u60C5\u51B5\uFF08\u5E74\u9650\u3001\u7ECF\u5386\u3001\u7C4D\u8D2F\u4EE5\u6B64\u4E3A\u51C6\uFF0C\u4E0D\u8981\u6539\u5199\u6216\u5938\u5927\uFF09", p.interview_highlights?.trim().replace(/\s*\n+\s*/g, "\uFF1B"), 600);
      if (facts) parts.push(facts, "");
      if (module2 === "freeChat") parts.push(mixContextLine(resolveMix(p)), "");
    }
    if (want.has("audience")) parts.push(describeAudience(p, "full"), "");
    if (want.has("tone")) {
      parts.push(join([
        line("\u8BF4\u8BDD\u8BED\u6C14", p.content_tone),
        line("\u5185\u5BB9\u98CE\u683C", p.content_style)
      ]), "");
    }
    if (want.has("selling")) {
      parts.push(join([
        line("\u6838\u5FC3\u5356\u70B9", p.unique_selling_point, 500),
        line("\u5185\u5BB9\u4EF7\u503C", p.content_value, 300),
        line("\u5DF2\u9A8C\u8BC1\u7684\u5F00\u573A\u94A9\u5B50", p.conversion_hooks, 500)
      ]), "");
    }
    if (want.has("shooting")) parts.push(describeShootingSetup(p), "");
    if (want.has("monetize")) {
      parts.push(join([
        line("\u53D8\u73B0\u65B9\u5F0F", p.monetization_model),
        line("\u4EF7\u683C\u533A\u95F4", p.price_range),
        line("\u6210\u4EA4\u8DEF\u5F84", p.conversion_path, 400),
        line("\u6210\u4EA4\u969C\u788D", p.conversion_barriers, 400)
      ]), "");
    }
    if (want.has("viral")) {
      parts.push(join([
        line("\u5DF2\u6709\u7684\u5185\u5BB9\u65B9\u5411", p.content_themes, 600),
        line("\u8FD9\u4E2A\u53F7\u7684\u7206\u6B3E\u57FA\u56E0", p.viral_content_pattern, 400),
        line("\u5DEE\u5F02\u5316\u4F18\u52BF", p.competitive_advantage, 400)
      ]), "");
    }
    if (want.has("restrictions")) parts.push(describeRestrictions(p), "");
    if (module2 === "review") {
      parts.push("**\u5BA1\u7A3F\u5148\u6309\u5F53\u524D\u7A3F\u4EF6\u4E0E\u672C\u8F6E\u8981\u6C42\u5224\u65AD**\uFF1A\u4FDD\u7559\u4F5C\u8005\u58F0\u97F3\uFF0C\u6838\u5BF9\u4E8B\u5B9E\u4E0E\u7981\u5FCC\uFF1B\u8D26\u53F7\u957F\u671F\u4EBA\u7FA4\u3001\u4E1A\u52A1\u4E0E\u98CE\u683C\u4EC5\u4F5C\u80CC\u666F\uFF0C\u4E0D\u80FD\u628A\u672C\u6761\u89C2\u5BDF\u8BB0\u5F55\u5F3A\u6539\u6210\u9762\u5411\u8001\u677F\u7684\u83B7\u5BA2\u5185\u5BB9\u3002", "");
    }
  }
  const brief = briefBlockFor(ctx2.brief, module2);
  if (brief) {
    parts.push("", brief);
    if (p) {
      parts.push("", briefOlderThanProfile(ctx2) ? "\u26A0\uFE0F \u8D26\u53F7\u6863\u6848\u5728\u8FD9\u4EFD\u7B80\u62A5\u751F\u6210\u4E4B\u540E\u6539\u8FC7\uFF1A\u7B80\u62A5\u91CC\u7684\u4EBA\u8BBE\u4E8B\u5B9E\uFF08\u5E74\u9650\u3001\u7ECF\u5386\u3001\u7C4D\u8D2F\u3001\u4EF7\u683C\u3001\u54C1\u7C7B\uFF09\u53EF\u80FD\u5DF2\u7ECF\u8FC7\u65F6\uFF0C**\u548C\u4E0A\u9762\u8D26\u53F7\u80CC\u666F\u5BF9\u4E0D\u4E0A\u7684\u4E00\u5F8B\u4EE5\u8D26\u53F7\u80CC\u666F\u4E3A\u51C6**\u3002" : "\u7B80\u62A5\u53EA\u63D0\u4F9B\u7B56\u7565\u4E0E\u8868\u8FBE\u53C2\u8003\uFF0C\u4E0D\u80FD\u65B0\u589E\u7ECF\u8425\u4E8B\u5B9E\u3002\u5E74\u9650\u3001\u7ECF\u5386\u3001\u7C4D\u8D2F\u3001\u4EF7\u683C\u3001\u54C1\u7C7B\u3001\u670D\u52A1\u548C\u62CD\u6444\u6761\u4EF6\u5FC5\u987B\u80FD\u5728\u8D26\u53F7\u6863\u6848\u6216\u672C\u8F6E\u7528\u6237\u6750\u6599\u4E2D\u627E\u5230\u4F9D\u636E\uFF1B\u4EC5\u5728\u7B80\u62A5\u4E2D\u51FA\u73B0\u7684\u4FE1\u606F\u4FDD\u6301\u5F85\u786E\u8BA4\u3002");
    }
  } else if (ctx2.positioning) {
    const body = module2 === "topic" ? ctx2.positioning.summary : ctx2.positioning.full;
    if (body) {
      parts.push(
        "",
        `## \u{1F3AF} \u8D26\u53F7\u5B9A\u4F4D\uFF08\u7B56\u7565\u53C2\u8003\uFF0C\u975E\u4E8B\u5B9E\u51ED\u8BC1\uFF09`,
        "",
        text2(body, 2e3),
        "",
        "\u26A0\uFE0F \u4EE5\u4E0A\u662F\u8FD9\u4E2A\u53F7\u5DF2\u7ECF\u5B9A\u597D\u7684\u65B9\u5411\uFF0C\u4EA7\u51FA\u5FC5\u987B\u4E0E\u5B83\u4E00\u81F4\uFF0C\u4E0D\u8981\u53E6\u8D77\u7089\u7076\u3002",
        "\u5176\u4E2D\u7684\u4EF7\u683C\u3001\u670D\u52A1\u3001\u7ECF\u5386\u3001\u5C3A\u5BF8\u548C\u8D44\u6E90\u82E5\u53EA\u51FA\u73B0\u5728\u65E7AI\u65B9\u6848\u91CC\uFF0C\u4E0D\u80FD\u5F53\u4F5C\u5DF2\u786E\u8BA4\u4E8B\u5B9E\uFF1B\u7F3A\u5C11\u7528\u6237\u6750\u6599\u4F9D\u636E\u7684\u4FDD\u6301\u5F85\u786E\u8BA4\u3002",
        "\uFF08\u8FD9\u4E00\u6BB5\u662F\u4ECE\u5B9A\u4F4D\u539F\u6587\u622A\u65AD\u6765\u7684\u3002\u751F\u6210\u4E00\u4EFD\u300C\u521B\u4F5C\u7B80\u62A5\u300D\u53EF\u4EE5\u8BA9\u5404\u677F\u5757\u62FF\u5230\u5B8C\u6574\u65B9\u5411\u3002\uFF09"
      );
    }
  }
  if (PERFORMANCE_BOARDS.has(module2)) {
    const perf = performancePromptBlock(ctx2.performance);
    if (perf) parts.push("", perf);
  }
  if (PRESET_BOARDS.has(module2)) {
    const style = presetPromptBlock(ctx2.preset);
    if (style) parts.push("", style);
  }
  if (PREFERENCE_BOARDS.has(module2)) {
    const pref = preferencePromptBlock(ctx2.preferences);
    if (pref) parts.push("", pref);
  }
  if (OUTPUT_RULE_BOARDS.has(module2)) parts.push("", outputRulesBlock());
  if (ctx2.dealReasons.length > 0 && manifestOf(module2)?.dealReasons) {
    parts.push(
      "",
      "## \u{1F4B0} \u8FD9\u4E2A\u8D26\u53F7\u7684\u6210\u4EA4\u7406\u7531",
      "",
      ctx2.dealReasons.map((r) => `- ${r}`).join("\n"),
      "",
      "\u8FD9\u4E9B\u7406\u7531\u662F\u8868\u8FBE\u53C2\u8003\u3002\u53EA\u6709\u6863\u6848\u6216\u672C\u8F6E\u6750\u6599\u786E\u8BA4\u7684\u4EA7\u54C1\u3001\u670D\u52A1\u3001\u7ECF\u5386\u4E0E\u6548\u679C\u624D\u80FD\u5199\u6210\u4E8B\u5B9E\uFF1B\u65E7AI\u7406\u7531\u4E0D\u80FD\u81EA\u884C\u8BC1\u660E\u7ECF\u8425\u80FD\u529B\u3002"
    );
  }
  return parts.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

// .tmp/content-audit-production_20261008/lib/context-manifest.ts
var BOARD_MANIFESTS2 = [
  {
    board: "topic",
    label: "\u9009\u9898\u7B56\u5212",
    job: '\u627E"\u5F80\u54EA\u4E2A\u65B9\u5411\u62CD"\u3002\u8981\u77E5\u9053\u8D5B\u9053\u3001\u8BF4\u7ED9\u8C01\u542C\u3001\u6709\u4EC0\u4E48\u53EF\u6316\u7684\u3001\u4EC0\u4E48\u4E0D\u80FD\u78B0',
    profile: ["account", "audience", "viral", "restrictions"],
    brief: ["oneline", "audience", "direction", "forbidden"],
    dealReasons: true
  },
  {
    board: "script",
    label: "\u811A\u672C\u751F\u6210",
    job: '\u51B3\u5B9A"\u600E\u4E48\u8BF4"\u3002\u53E3\u543B\u3001\u8BF4\u670D\u70B9\u3001\u8BB0\u5FC6\u70B9\uFF0C\u7F3A\u4E00\u6837\u90FD\u4F1A\u5199\u6210\u901A\u7A3F',
    profile: ["account", "audience", "tone", "selling", "restrictions"],
    brief: ["oneline", "persona", "audience", "direction", "trust", "memory", "forbidden"],
    dealReasons: true
  },
  {
    board: "storyboard",
    label: "\u5206\u955C\u811A\u672C",
    job: '\u51B3\u5B9A"\u600E\u4E48\u62CD"\u3002\u53EA\u5173\u5FC3\u771F\u5B9E\u62CD\u6444\u6761\u4EF6\u548C\u753B\u9762\uFF0C\u4E0D\u9700\u8981\u77E5\u9053\u53D8\u73B0\u8DEF\u5F84',
    // 分镜表里有台词一列，禁忌同样适用——这条是测试逮出来的，原来漏了
    profile: ["account", "shooting", "restrictions"],
    brief: ["oneline", "shooting", "memory", "forbidden"],
    dealReasons: false
  },
  {
    board: "review",
    label: "\u5BA1\u7A3F\u4F18\u5316",
    job: "\u5F53\u5224\u636E\u7528\u3002\u8BED\u6C14\u5BF9\u4E0D\u5BF9\u3001\u8BF4\u7684\u662F\u4E0D\u662F\u8FD9\u7FA4\u4EBA\u5173\u5FC3\u7684\u3001\u6709\u6CA1\u6709\u8E29\u7981\u5FCC",
    profile: ["account", "audience", "tone", "restrictions"],
    brief: ["oneline", "persona", "audience", "forbidden"],
    dealReasons: false
  },
  {
    board: "title",
    label: "\u6807\u9898\u5C01\u9762",
    job: "\u7ED9\u8C01\u770B\u3001\u51ED\u4EC0\u4E48\u70B9\u3002\u8981\u4EBA\u7FA4\u75DB\u70B9\u548C\u8BF4\u670D\u70B9\uFF0C\u4E0D\u9700\u8981\u62CD\u6444\u6761\u4EF6",
    profile: ["account", "audience", "selling", "restrictions"],
    brief: ["oneline", "audience", "trust", "forbidden"],
    dealReasons: true
  },
  {
    board: "dealReason",
    label: "\u6210\u4EA4\u7406\u7531",
    job: '\u627E"\u51ED\u4EC0\u4E48\u8BA9\u4EBA\u4E70"\u3002\u8981\u5356\u70B9\u3001\u53D8\u73B0\u8DEF\u5F84\u3001\u5BA2\u6237\u987E\u8651\u2014\u2014\u4E4B\u524D\u8FD9\u4E2A\u677F\u5757\u5B8C\u5168\u6CA1\u63A5\u4E0A\u4E0B\u6587',
    profile: ["account", "audience", "selling", "monetize", "restrictions"],
    brief: ["oneline", "audience", "trust", "forbidden"],
    dealReasons: false
    // 它本身就是产出成交理由的，不该拿旧的当输入
  },
  {
    board: "growth",
    label: "\u8D77\u53F7\u65B9\u6848",
    /*
     * 原来借用的是脚本那一套，没有拍摄条件、没有爆款基因——
     * 而起号的核心就是「按真实资源挑他拍得出来的打法」，
     * 提示词让模型对照团队、设备、场地去选，模型却一样都看不到。
     */
    job: '\u6311"\u4ED6\u62CD\u5F97\u51FA\u6765\u7684"\u6253\u6CD5\u3002\u8981\u771F\u5B9E\u62CD\u6444\u6761\u4EF6\u3001\u64C5\u957F\u4EC0\u4E48\u3001\u6570\u636E\u6700\u597D\u7684\u5185\u5BB9\u7C7B\u578B\u3001\u53D8\u73B0\u65B9\u5F0F',
    profile: ["account", "audience", "tone", "shooting", "monetize", "viral", "restrictions"],
    brief: ["oneline", "persona", "audience", "direction", "shooting", "forbidden"],
    dealReasons: false
  },
  {
    board: "freeChat",
    label: "\u9AD8\u9636\u81EA\u7531",
    job: "\u968F\u53E3\u95EE\u4EC0\u4E48\u90FD\u53EF\u80FD\u3002\u7ED9\u4E00\u4EFD\u8D26\u53F7\u5168\u8C8C\uFF0C\u8BA9\u5B83\u81F3\u5C11\u77E5\u9053\u4F60\u662F\u8C01\u3001\u505A\u4EC0\u4E48\u3001\u4E0D\u80FD\u8BF4\u4EC0\u4E48",
    profile: ["account", "audience", "tone", "selling", "shooting", "restrictions"],
    brief: ["oneline", "persona", "audience", "direction", "trust", "shooting", "forbidden"],
    dealReasons: false
  },
  /*
   * 下面三个是 2026-09-30 补接的（产品方："每个板块都要有记忆，互相关联互通"）。
   * 拆解和二创另外还传了整份档案摘要（lib/profile-summary，含经营品类、团队设备），
   * 所以档案这边只切禁忌，不重复塞。
   */
  {
    board: "breakdown",
    label: "\u62C6\u89E3\u7206\u6B3E",
    job: '\u62C6\u5B8C\u4E4B\u540E"\u5957\u5230\u8FD9\u4E2A\u8D26\u53F7\u4E0A"\u7ED9 3 \u4E2A\u9009\u9898\u3002\u8981\u77E5\u9053\u8D26\u53F7\u65B9\u5411\u548C\u8BF4\u7ED9\u8C01\u542C\uFF0C\u5957\u51FA\u6765\u7684\u9009\u9898\u624D\u4E0D\u8DD1\u504F',
    profile: ["restrictions"],
    brief: ["oneline", "audience", "direction", "forbidden"],
    dealReasons: false
  },
  {
    board: "remix",
    label: "\u8DE8\u884C\u4E1A\u4E8C\u521B",
    job: "\u628A\u522B\u7684\u884C\u4E1A\u7684\u7206\u6B3E\u6362\u6210\u8FD9\u4E2A\u8D26\u53F7\u7684\u8840\u8089\u3002\u8981\u4EBA\u8BBE\u53E3\u543B\u3001\u8BF4\u7ED9\u8C01\u542C\u3001\u51ED\u4EC0\u4E48\u4FE1\u4F60\u3001\u8BB0\u5FC6\u70B9\uFF0C\u5916\u52A0\u6210\u4EA4\u7406\u7531\u5F53\u7ED3\u5C3E\u7684\u8BF4\u670D\u70B9",
    profile: ["restrictions"],
    brief: ["oneline", "persona", "audience", "trust", "memory", "forbidden"],
    dealReasons: true
  },
  {
    board: "direction",
    label: "\u521B\u4F5C\u65B9\u5411",
    /*
     * 2026-10-02 新板块。档案摘要另传（含经营品类、团队设备），这里切的是方向判断要用的：
     * 已有的内容方向和爆款基因（别重复、接着长）、变现方式（目的要落到钱上）、拍摄条件（方向要拍得出来）
     */
    job: "\u5E26\u7740\u76EE\u7684\u627E\u65B9\u5411\uFF1A\u8981\u77E5\u9053\u8FD9\u4E2A\u53F7\u5B9A\u597D\u7684\u65B9\u5411\u3001\u8BF4\u7ED9\u8C01\u542C\u3001\u51ED\u4EC0\u4E48\u4FE1\u4F60\u3001\u80FD\u62CD\u4EC0\u4E48\u3001\u9760\u4EC0\u4E48\u8D5A\u94B1\uFF0C\u65B9\u5411\u624D\u80FD\u65E2\u8FBE\u5230\u76EE\u7684\u53C8\u62CD\u5F97\u51FA\u6765",
    profile: ["monetize", "viral", "restrictions"],
    brief: ["oneline", "persona", "audience", "direction", "trust", "shooting", "forbidden"],
    dealReasons: true
  },
  {
    board: "knowledge",
    label: "\u77E5\u8BC6\u5E93",
    job: "\u7B54\u65B9\u6CD5\u8BBA\u95EE\u9898\u3002\u77E5\u9053\u8FD9\u4E2A\u53F7\u662F\u505A\u4EC0\u4E48\u7684\u3001\u8BF4\u7ED9\u8C01\u542C\uFF0C\u4E3E\u4F8B\u65F6\u5C31\u80FD\u7528\u4ED6\u81EA\u5DF1\u7684\u884C\u4E1A\uFF0C\u800C\u4E0D\u662F\u6CDB\u6CDB\u800C\u8C08",
    profile: ["account", "restrictions"],
    brief: ["oneline", "audience", "forbidden"],
    dealReasons: false
  }
];
var BY_BOARD2 = new Map(BOARD_MANIFESTS2.map((m) => [m.board, m]));
function manifestOf2(board) {
  return BY_BOARD2.get(board);
}
var BOARD_LABEL2 = Object.fromEntries(
  BOARD_MANIFESTS2.map((m) => [m.board, m.label])
);

// .tmp/content-audit-production_20261008/lib/creative-brief.ts
var BRIEF_FIELDS2 = [
  {
    key: "oneline",
    label: "\u4E00\u53E5\u8BDD\u5B9A\u4F4D",
    spec: "\u4E0D\u8D85\u8FC730\u5B57\u3002[\u8EAB\u4EFD]+[\u7279\u70B9]+[\u4EF7\u503C]\uFF0C\u8981\u80FD\u8BA9\u964C\u751F\u4EBA\u7ACB\u523B\u77E5\u9053\u8FD9\u4E2A\u53F7\u662F\u5E72\u4EC0\u4E48\u7684\u3002",
    hint: "\u6240\u6709\u677F\u5757\u90FD\u4F1A\u8BFB\u5230\u8FD9\u53E5\uFF0C\u5199\u5F97\u8D8A\u51C6\uFF0C\u4EA7\u51FA\u8D8A\u4E0D\u8DD1\u504F"
  },
  {
    key: "persona",
    label: "\u4EBA\u8BBE\u4E0E\u53E3\u543B",
    spec: `\u5206\u56DB\u884C\u5199\uFF0C\u6BCF\u884C\u90FD\u8981\u80FD\u76F4\u63A5\u6307\u5BFC\u5199\u6587\u6848\uFF1A
- **\u6211\u662F\u8C01**\uFF1A\u4E00\u53E5\u80FD\u88AB\u89C2\u4F17\u590D\u8FF0\u7684\u4EBA\u8BBE\u6807\u7B7E
- **\u8BF4\u8BDD\u4EC0\u4E48\u8C03**\uFF1A\u5177\u4F53\u5230\u8BED\u6C14\u8BCD\u548C\u53E5\u5F0F\u4E60\u60EF\uFF0C\u4E0D\u8981\u5199"\u4EB2\u5207\u4E13\u4E1A"\u8FD9\u79CD
- **\u4F1A\u8BF4\u7684\u4E00\u53E5\u8BDD**\uFF1A\u4E3E\u4E00\u4E2A\u771F\u5B9E\u4F8B\u5B50
- **\u4E0D\u4F1A\u8BF4\u7684\u4E00\u53E5\u8BDD**\uFF1A\u4E3E\u4E00\u4E2A\u771F\u5B9E\u4F8B\u5B50\uFF08\u8FD9\u6761\u6BD4\u4E0A\u4E00\u6761\u66F4\u6709\u7528\uFF09`,
    hint: '\u811A\u672C\u548C\u5BA1\u7A3F\u9760\u8FD9\u6BB5\u5B9A\u53E3\u543B\u3002"\u4F1A\u8BF4/\u4E0D\u4F1A\u8BF4"\u5404\u4E3E\u4E00\u4F8B\uFF0C\u6BD4\u5F62\u5BB9\u8BCD\u7BA1\u7528\u5F97\u591A'
  },
  {
    key: "audience",
    label: "\u8BF4\u7ED9\u8C01\u542C",
    spec: `\u5206\u56DB\u884C\uFF1A
- **\u753B\u50CF**\uFF1A\u4E00\u53E5\u8BDD\uFF0C\u8981\u5177\u4F53\u5230\u80FD\u60F3\u8D77\u67D0\u4E2A\u771F\u5B9E\u7684\u4EBA
- **\u4ED6\u6700\u6015\u4EC0\u4E48**\uFF1A3\u6761\uFF0C\u6BCF\u6761\u90FD\u80FD\u76F4\u63A5\u62CD\u6210\u5185\u5BB9
- **\u4ED6\u6700\u60F3\u8981\u4EC0\u4E48**\uFF1A3\u6761
- **\u4ED6\u4F1A\u641C\u4EC0\u4E48\u8BCD**\uFF1A\u5199\u51FA\u4ED6\u771F\u4F1A\u6253\u51FA\u6765\u7684\u90A3\u51E0\u4E2A\u8BCD`,
    hint: "\u9009\u9898\u3001\u811A\u672C\u3001\u6807\u9898\u3001\u5BA1\u7A3F\u90FD\u8BFB\u8FD9\u6BB5\u3002\u75DB\u70B9\u5199\u5F97\u8D8A\u5177\u4F53\uFF0C\u9009\u9898\u8D8A\u597D\u51FA"
  },
  {
    key: "direction",
    label: "\u5185\u5BB9\u65B9\u5411",
    spec: `\u5206\u4E94\u884C\uFF1A
- **\u4E09\u79CD\u89C6\u9891\u7684\u914D\u6BD4**\uFF1A\u7167\u5B9A\u4F4D\u91CC\u5B9A\u7684\u6284\uFF0C\u5199\u6210"\u6D41\u91CF\u578BX%\uFF08\u4E3B\u6253\u4EC0\u4E48\uFF09+ \u4EBA\u8BBE\u578BX%\uFF08\u4E3B\u6253\u4EC0\u4E48\uFF09+ \u53D8\u73B0\u578BX%\uFF08\u4E3B\u6253\u4EC0\u4E48\uFF09"\u2014\u2014\u914D\u6BD4\u8BF4\u7684\u662F\u76EE\u7684\uFF0C\u4E0D\u662F\u811A\u672C\u7C7B\u578B
- **\u5404\u81EA\u7684\u7ED3\u5C3E\u6307\u4EE4**\uFF1A\u6D41\u91CF\u578B\u8981\u4EC0\u4E48\u3001\u4EBA\u8BBE\u578B\u8981\u4EC0\u4E48\u3001\u53D8\u73B0\u578B\u8981\u4EC0\u4E48\uFF0C\u6BCF\u79CD\u53EA\u4E00\u4E2A
- **\u4E24\u5957\u6253\u6CD5\u5404\u7528\u4EC0\u4E48**\uFF1A\u56DB\u5927\u811A\u672C\u4E3B\u6253\u54EA\u51E0\u79CD\u7ED3\u6784\uFF1B\u8D77\u53F736\u8BA1\u4E3B\u6253\u54EA\u51E0\u8BA1\uFF08\u5199\u8BA1\u540D\uFF0C\u7167\u5B9A\u4F4D\u91CC\u6311\u7684\u6765\uFF09
- **\u80FD\u957F\u671F\u6316\u7684\u9009\u9898\u6765\u6E90**\uFF1A4-5\u4E2A\uFF0C\u6BCF\u4E2A\u4E3E\u4E00\u4E2A\u5177\u4F53\u4F8B\u5B50
- **\u660E\u786E\u4E0D\u505A\u7684\u65B9\u5411**\uFF1A3\u6761\uFF0C\u8BF4\u660E\u4E3A\u4EC0\u4E48\u4E0D\u505A`,
    hint: '"\u4E0D\u505A\u4EC0\u4E48"\u548C"\u505A\u4EC0\u4E48"\u4E00\u6837\u91CD\u8981\u2014\u2014\u5B83\u80FD\u6321\u4F4F\u8DD1\u504F\u7684\u9009\u9898'
  },
  {
    key: "trust",
    label: "\u51ED\u4EC0\u4E48\u4FE1\u4F60",
    spec: `\u5206\u4E24\u884C\uFF1A
- **\u6838\u5FC3\u5356\u70B9**\uFF1A2-3\u6761\uFF0C\u6BCF\u6761\u4E00\u53E5\u8BDD
- **\u53EF\u4EE5\u62CD\u6210\u753B\u9762\u7684\u8BC1\u636E**\uFF1A4-6\u6761\uFF0C\u5FC5\u987B\u662F\u80FD\u771F\u5B9E\u62CD\u5230\u7684\u4E1C\u897F\uFF0C\u4E0D\u662F\u5F62\u5BB9\u8BCD`,
    hint: '\u811A\u672C\u548C\u6807\u9898\u9760\u8FD9\u6BB5\u627E\u8BF4\u670D\u70B9\u3002\u8BC1\u636E\u8981\u80FD\u62CD\u51FA\u6765\uFF0C\u4E0D\u80FD\u662F"\u54C1\u8D28\u597D"\u8FD9\u79CD'
  },
  {
    key: "shooting",
    label: "\u600E\u4E48\u62CD",
    spec: `\u5206\u4E09\u884C\uFF1A
- **\u5448\u73B0\u5F62\u5F0F**\uFF1A\u53E3\u64AD/\u63A2\u5E97/Vlog/\u60C5\u666F\u5267\u7B49\uFF0C\u4E00\u53E5\u8BDD\u8BF4\u660E\u4E3A\u4EC0\u4E48\u662F\u5B83
- **\u771F\u5B9E\u6761\u4EF6**\uFF1A\u8BBE\u5907\u3001\u573A\u5730\u3001\u4E00\u4E2A\u4EBA\u8FD8\u662F\u6709\u5E2E\u624B\u3001\u4E00\u5468\u80FD\u51FA\u51E0\u6761
- **\u89C6\u89C9\u8C03\u6027**\uFF1A\u5149\u7EBF\u3001\u8272\u5F69\u3001\u955C\u5934\u7A33\u4E0D\u7A33\uFF0C\u4E00\u53E5\u8BDD`,
    hint: "\u5206\u955C\u53EA\u8BFB\u8FD9\u4E00\u6BB5\u3002\u5199\u51C6\u4E86\uFF0C\u5206\u955C\u5C31\u4E0D\u4F1A\u7ED9\u51FA\u62CD\u4E0D\u51FA\u6765\u7684\u65B9\u6848"
  },
  {
    key: "memory",
    label: "\u8BB0\u5FC6\u70B9",
    spec: "2-3\u6761\u3002\u8BED\u8A00/\u52A8\u4F5C/\u9053\u5177/\u670D\u88C5/\u573A\u666F\u58F0\u97F3\u91CC\u6311\uFF0C\u6BCF\u6761\u8BF4\u660E\u600E\u4E48\u91CD\u590D\u3002\u6807\u660E\u54EA\u4E9B\u8FD8\u5F85\u9A8C\u8BC1\u3002",
    hint: "\u56FA\u5B9A\u7684\u53E3\u5934\u7985\u3001\u624B\u52BF\u3001\u9053\u5177\u2014\u2014\u8BA9\u89C2\u4F17\u80FD\u590D\u8FF0\u4F60"
  },
  {
    key: "forbidden",
    label: "\u7EDD\u5BF9\u4E0D\u80FD\u8BF4",
    spec: "\u9010\u6761\u5217\u51FA\u3002\u5305\u542B\u8D26\u53F7\u81EA\u5DF1\u7684\u7981\u5FCC\u548C\u901A\u7528\u7EA2\u7EBF\uFF08\u7EDD\u5BF9\u5316\u7528\u8BED\u3001\u627F\u8BFA\u7597\u6548\u7B49\uFF09\u3002",
    hint: "\u786C\u7EA6\u675F\uFF0C\u6240\u6709\u677F\u5757\u90FD\u4F1A\u5E26\u4E0A\u3002\u6F0F\u4E00\u6761\u53EF\u80FD\u76F4\u63A5\u8FDD\u89C4"
  }
];
var BY_KEY2 = new Map(BRIEF_FIELDS2.map((f) => [f.key, f]));
function buildBriefPrompt2(params) {
  const fields = BRIEF_FIELDS2.map(
    (f, i) => `### ${i + 1}. ${f.label}
${f.spec}`
  ).join("\n\n");
  return `\u4F60\u662F\u4E00\u4F4D\u77ED\u89C6\u9891\u4EE3\u8FD0\u8425\u7684\u4E3B\u7F16\u3002\u4E0B\u9762\u6709\u4E00\u4EFD\u5DF2\u7ECF\u5B9A\u597D\u7684\u8D26\u53F7\u5B9A\u4F4D\u65B9\u6848\uFF0C
\u73B0\u5728\u8981\u628A\u5B83**\u8F6C\u8BD1**\u6210\u4E00\u4EFD\u300C\u521B\u4F5C\u7B80\u62A5\u300D\u2014\u2014\u4F9B\u9009\u9898\u3001\u811A\u672C\u3001\u5206\u955C\u3001\u5BA1\u7A3F\u3001\u6807\u9898\u5404\u4E2A\u73AF\u8282\u76F4\u63A5\u4F7F\u7528\u3002

## \u26A0\uFE0F \u8FD9\u4E0D\u662F\u6458\u8981\uFF0C\u662F\u8F6C\u8BD1

\u5B9A\u4F4D\u65B9\u6848\u662F\u7ED9\u4EBA\u770B\u7684\uFF1A\u6709\u8BBA\u8BC1\u3001\u6709\u63A8\u5BFC\u3001\u6709\u53D6\u820D\u8FC7\u7A0B\u3002
\u7B80\u62A5\u662F\u7ED9\u521B\u4F5C\u73AF\u8282\u7528\u7684\uFF1A**\u6BCF\u4E00\u53E5\u90FD\u8981\u80FD\u76F4\u63A5\u6307\u5BFC\u751F\u6210\uFF0C\u4E0D\u8981\u8BBA\u8BC1\u8FC7\u7A0B**\u3002

\u4E3E\u4E2A\u4F8B\u5B50\uFF1A
- \u5B9A\u4F4D\u91CC\u5199\u7684\u662F\uFF1A\u300C\u540C\u884C\u4EBA\u8BBE\u5206\u5E03\uFF1A\u5927\u5E08\u578B/\u6570\u636E\u578B/\u6848\u4F8B\u578B \u2192 \u4F60\u662F\u719F\u4EBA\u578B\uFF0C\u5728\u53BF\u57DF\u4FE1\u4EFB\u58C1\u5792\u6700\u9AD8\u300D
- \u7B80\u62A5\u91CC\u5E94\u8BE5\u662F\uFF1A\u300C**\u4EBA\u8BBE**\uFF1A\u5357\u4E50\u672C\u5730\u3001\u63A5\u5355\u5148\u770B\u4EBA\u7684\u719F\u4EBA\u578B\u7F16\u5BFC\u3002\u5199\u6587\u6848\u7528\u5520\u55D1\u7684\u53E3\u6C14\uFF0C
  \u4E0D\u7528\u4E13\u4E1A\u672F\u8BED\uFF0C\u4E0D\u6446\u4E13\u5BB6\u67B6\u5B50\u300D

\u524D\u8005\u5728\u5206\u6790\uFF0C\u540E\u8005\u80FD\u7167\u7740\u5199\u3002**\u4F60\u8981\u4EA7\u51FA\u7684\u662F\u540E\u8005\u3002**

## \u{1F4C4} \u5DF2\u786E\u5B9A\u7684\u8D26\u53F7\u5B9A\u4F4D

${params.positioningFull.trim()}
${params.businessPositioning?.trim() ? `
## \u{1F4B0} \u5DF2\u505A\u8FC7\u7684\u5546\u4E1A\u5B9A\u4F4D\uFF08\u6DF1\u6316\uFF0C\u7ED3\u8BBA\u8981\u5438\u6536\u8FDB\u300C\u51ED\u4EC0\u4E48\u4FE1\u4F60\u300D\uFF09

${params.businessPositioning.trim()}
` : ""}${params.contentPositioning?.trim() ? `
## \u{1F48E} \u5DF2\u505A\u8FC7\u7684\u5185\u5BB9\u5B9A\u4F4D\uFF08\u6DF1\u6316\uFF0C\u7ED3\u8BBA\u8981\u5438\u6536\u8FDB\u300C\u5185\u5BB9\u65B9\u5411\u300D\uFF09

${params.contentPositioning.trim()}
` : ""}${params.profileSummary?.trim() ? `
## \u{1F4C7} \u8D26\u53F7\u6863\u6848\uFF08\u4E8B\u5B9E\u4EE5\u5B83\u4E3A\u51C6\uFF09

${params.profileSummary.trim()}

\u65B9\u5411\u3001\u53D6\u820D\u542C\u5B9A\u4F4D\u7684\uFF1B**\u4E8B\u5B9E**\uFF08\u51FA\u955C\u4EBA\u662F\u8C01\u3001\u5E72\u4E86\u51E0\u5E74\u3001\u4ECE\u54EA\u6765\u3001\u5728\u672C\u5730\u591A\u4E45\u3001\u4EF7\u683C\u3001\u54C1\u7C7B\uFF09\u4EE5\u8FD9\u4EFD\u6863\u6848\u4E3A\u51C6\u2014\u2014\u6863\u6848\u53EF\u80FD\u6BD4\u5B9A\u4F4D\u65B0\uFF0C\u4E24\u8FB9\u5BF9\u4E0D\u4E0A\u65F6\u6309\u6863\u6848\u5199\uFF0C\u6863\u6848\u6CA1\u5199\u7684\u5E74\u9650\u3001\u7ECF\u5386\u4E0D\u8981\u81EA\u5DF1\u8865\u3002
` : ""}${params.notes?.trim() ? `
## \u{1F4A1} \u8FD9\u6B21\u7684\u989D\u5916\u8981\u6C42

${params.notes.trim()}
` : ""}${params.mixBlock?.trim() ? `
${params.mixBlock.trim()}
- \u7B80\u62A5\u300C\u5185\u5BB9\u65B9\u5411\u300D\u91CC\u7684**\u4E09\u79CD\u89C6\u9891\u7684\u914D\u6BD4**\u7167\u8FD9\u4E2A\u6570\u5199\uFF0C\u4E0D\u7167\u4E0A\u9762\u5B9A\u4F4D\u91CC\u7684\u6284\uFF08\u5B9A\u4F4D\u53EF\u80FD\u662F\u6309\u65E7\u914D\u6BD4\u5199\u7684\uFF09
` : ""}${params.taboos?.trim() ? `
## \u26D4 \u8FD9\u4E2A\u884C\u4E1A\u7684\u7981\u5FCC

${params.taboos.trim()}
- \u7B80\u62A5\u7684\u300C\u7981\u5FCC\u300D\u90A3\u4E00\u8282\u8981\u628A**\u4E0D\u80FD\u62CD\u7684\u65B9\u5411**\u548C\u8FD9\u4E2A\u53F7\u6700\u5BB9\u6613\u8E29\u7684\u51E0\u53E5\u8BDD\u5199\u8FDB\u53BB\uFF1B\u300C\u5185\u5BB9\u65B9\u5411\u300D\u300C\u80FD\u957F\u671F\u6316\u7684\u9009\u9898\u6765\u6E90\u300D\u91CC\u4E0D\u80FD\u51FA\u73B0\u8FD9\u4E9B\u65B9\u5411
` : ""}
## \u{1F4E4} \u8F93\u51FA\u683C\u5F0F

\u4E25\u683C\u6309\u4E0B\u9762\u7684\u5C0F\u8282\u6807\u9898\u548C\u987A\u5E8F\u8F93\u51FA\uFF0C**\u6807\u9898\u4E00\u4E2A\u5B57\u90FD\u4E0D\u8981\u6539**\u2014\u2014
\u5404\u677F\u5757\u9760\u6807\u9898\u628A\u7B80\u62A5\u5207\u5F00\uFF0C\u6539\u4E86\u5C31\u8BFB\u4E0D\u5230\u4E86\u3002

${fields}

## \u270D\uFE0F \u5199\u4F5C\u8981\u6C42

- **\u6BCF\u53E5\u90FD\u662F\u6307\u4EE4**\uFF1A\u80FD\u76F4\u63A5\u62FF\u53BB\u6307\u5BFC\u5199\u6587\u6848\u3001\u8D77\u6807\u9898\u3001\u6392\u955C\u5934\u3002\u4E0D\u8981\u5199"\u8981\u6CE8\u91CD\u2026"\u8FD9\u7C7B\u7A7A\u8BDD
- **\u5177\u4F53\u5230\u80FD\u6267\u884C**\uFF1A\u4E0D\u8981\u5F62\u5BB9\u8BCD\uFF0C\u8981\u5177\u4F53\u7684\u8BCD\u3001\u53E5\u3001\u52A8\u4F5C\u3001\u753B\u9762
- **\u5FE0\u4E8E\u5B9A\u4F4D**\uFF1A\u7ED3\u8BBA\u5FC5\u987B\u6765\u81EA\u4E0A\u9762\u90A3\u4EFD\u5B9A\u4F4D\uFF0C\u4E0D\u8981\u81EA\u5DF1\u53E6\u8D77\u4E00\u5957\uFF08\u4E8B\u5B9E\u6027\u7684\u5E74\u9650\u3001\u7ECF\u5386\u4EE5\u8D26\u53F7\u6863\u6848\u4E3A\u51C6\uFF09
- **\u5168\u7BC7\u63A7\u5236\u5728 1500 \u5B57\u4EE5\u5185**\uFF1A\u8FD9\u662F\u8981\u585E\u8FDB\u6BCF\u4E00\u6B21\u751F\u6210\u7684\uFF0C\u957F\u4E86\u5C31\u662F\u7ED9\u6240\u6709\u677F\u5757\u52A0\u8D1F\u62C5
- \u4E0D\u8981\u5199\u524D\u8A00\u3001\u4E0D\u8981\u590D\u8FF0\u5B9A\u4F4D\u3001\u4E0D\u8981\u89E3\u91CA\u4F60\u5728\u505A\u4EC0\u4E48\uFF0C\u76F4\u63A5\u4ECE"### 1. \u4E00\u53E5\u8BDD\u5B9A\u4F4D"\u5F00\u59CB`;
}
function parseBrief2(markdown) {
  const out = {};
  if (!markdown?.trim()) return out;
  const lines = markdown.split("\n");
  let current = null;
  let buf = [];
  const flush = () => {
    if (current) out[current] = buf.join("\n").trim();
    buf = [];
  };
  for (const line3 of lines) {
    const m = line3.match(/^#{2,4}\s*(?:\d+[.、]\s*)?(.+?)\s*$/);
    if (m) {
      const hit = BRIEF_FIELDS2.find((f) => m[1].includes(f.label));
      if (hit) {
        flush();
        current = hit.key;
        continue;
      }
    }
    if (current) buf.push(line3);
  }
  flush();
  return out;
}
function briefBlockFor2(markdown, board) {
  const want = manifestOf2(board)?.brief ?? [];
  const values = parseBrief2(markdown);
  const picked = BRIEF_FIELDS2.filter((f) => want.includes(f.key) && values[f.key]?.trim());
  if (picked.length === 0) return "";
  const body = picked.map((f) => `### ${f.label}

${values[f.key].trim()}`).join("\n\n");
  return `## \u{1F9ED} \u521B\u4F5C\u7B80\u62A5\uFF08\u8FD9\u4E2A\u53F7\u5DF2\u7ECF\u5B9A\u597D\u7684\u65B9\u5411\uFF09

${body}

\u4EE5\u4E0A\u662F\u8D26\u53F7\u7684\u957F\u671F\u521B\u4F5C\u80CC\u666F\uFF0C\u7528\u4E8E\u8F85\u52A9\u7406\u89E3\u4EBA\u8BBE\u3001\u8BED\u6C14\u3001\u4E8B\u5B9E\u4E0E\u7981\u5FCC\u3002\u672C\u6761\u7684\u4E3B\u9898\u3001\u4EBA\u7FA4\u3001\u76EE\u7684\u548C\u8868\u8FBE\u4EE5\u5F53\u524D\u539F\u7A3F\u53CA\u7528\u6237\u660E\u786E\u8981\u6C42\u4E3A\u51C6\uFF1B\u4E0D\u80FD\u7528\u957F\u671F\u5546\u4E1A\u5B9A\u4F4D\u66FF\u6362\u672C\u6B21\u89C2\u5BDF\u3001\u8BA8\u8BBA\u6216\u5176\u4ED6\u5185\u5BB9\u76EE\u7684\u3002\u56F4\u7ED5\u7528\u6237\u5F53\u524D\u9009\u62E9\u6DF1\u5316\uFF0C\u4E0D\u8981\u53E6\u8D77\u7089\u7076\u3002`;
}
var BRIEF_FACT_FIELDS2 = [
  "profile_name",
  "account_platform",
  "account_track",
  "account_stage",
  "product_category",
  "price_range",
  "monetization_model",
  "target_gender",
  "target_age",
  "target_region",
  "target_occupation",
  "target_pain_points",
  "target_needs",
  "target_interests",
  "content_style",
  "content_format",
  "content_tone",
  "content_themes",
  "competitive_advantage",
  "unique_resources",
  "interview_highlights",
  // 人设事实卡改了，简报里的人设当然就旧了
  "persona_facts"
];
var BRIEF_FACTS_PREFIX2 = "profile-facts:";
function profileFactsFingerprint2(profile2) {
  const p = profile2 ?? {};
  const norm = (v) => Array.isArray(v) ? v.filter(Boolean).map(String).map((x) => x.trim()).join("\u3001") : v && typeof v === "object" ? JSON.stringify(Object.fromEntries(Object.entries(v).filter(([, x]) => x != null && x !== "").sort(([a], [b]) => a.localeCompare(b)))) : v == null ? "" : String(v).trim();
  const text5 = BRIEF_FACT_FIELDS2.filter((k) => k !== "persona_facts" || !["", "{}"].includes(norm(p[k]))).map((k) => `${k}=${norm(p[k])}`).join("\n");
  let h = 2166136261;
  for (let i = 0; i < text5.length; i++) {
    h ^= text5.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return BRIEF_FACTS_PREFIX2 + h.toString(16).padStart(8, "0");
}
function briefFactsChanged2(briefFacts, profile2) {
  if (!profile2 || !briefFacts || !briefFacts.startsWith(BRIEF_FACTS_PREFIX2)) return false;
  return briefFacts !== profileFactsFingerprint2(profile2);
}

// .tmp/content-audit-production_20261008/lib/profile-options.ts
var SELLING_POINTS2 = [
  { value: "\u8D28\u91CF\u597D", hint: "\u7528\u6599\u8DB3\u3001\u8D27\u771F\u4EF7\u5B9E" },
  { value: "\u6548\u679C\u597D", hint: "\u505A\u5B8C\u6539\u53D8\u660E\u663E" },
  { value: "\u6027\u4EF7\u6BD4\u9AD8", hint: "\u540C\u7B49\u4EF7\u683C\u7ED9\u5F97\u66F4\u591A" },
  { value: "\u597D\u8BC4\u591A", hint: "\u56DE\u5934\u5BA2\u591A\u3001\u53E3\u7891\u597D" },
  { value: "\u4E13\u4E1A\u5F3A", hint: "\u6709\u8D44\u8D28\u3001\u6709\u5E74\u5934\u3001\u6280\u672F\u8FC7\u786C" },
  { value: "\u8001\u677F\u597D", hint: "\u672C\u4EBA\u70ED\u60C5\u3001\u9760\u8C31\u3001\u6709\u6545\u4E8B" },
  { value: "\u670D\u52A1\u597D", hint: "\u8D34\u5FC3\u3001\u552E\u540E\u7701\u5FC3" },
  { value: "\u5B9E\u5728\u4E0D\u5751", hint: "\u660E\u7801\u6807\u4EF7\u3001\u4E0D\u5BB0\u5BA2" },
  { value: "\u6709\u7279\u8272", hint: "\u522B\u5BB6\u6CA1\u6709\u7684\u505A\u6CD5\u6216\u54C1\u7C7B" },
  { value: "\u9009\u62E9\u591A", hint: "\u54C1\u7C7B\u5168\u3001\u6B3E\u5F0F\u591A" },
  { value: "\u751F\u610F\u597D", hint: "\u6392\u961F\u3001\u706B\u7206\u3001\u5E38\u6EE1\u5EA7" },
  { value: "\u89C4\u6A21\u5927", hint: "\u8FDE\u9501\u3001\u5206\u5E97\u591A\u3001\u573A\u5730\u5927" },
  { value: "\u6848\u4F8B\u591A", hint: "\u505A\u8FC7\u7684\u5355\u5B50\u591A\u3001\u6709\u636E\u53EF\u67E5" },
  { value: "\u4FBF\u5229\u6027", hint: "\u4F4D\u7F6E\u597D\u3001\u79BB\u5F97\u8FD1\u3001\u6765\u53BB\u65B9\u4FBF" },
  { value: "\u989C\u503C\u9AD8", hint: "\u73AF\u5883\u6216\u51FA\u54C1\u597D\u770B\u3001\u9002\u5408\u62CD\u7167" },
  { value: "\u7A00\u7F3A\u552F\u4E00", hint: "\u9650\u91CF\u3001\u72EC\u5BB6\u3001\u522B\u5904\u4E70\u4E0D\u5230" },
  { value: "\u6709\u9762\u5B50", hint: "\u6863\u6B21\u3001\u54C1\u5473\u3001\u8BF7\u5BA2\u4E0D\u4E22\u4EFD" }
];
var PAIN_POINTS2 = [
  { value: "\u6015\u88AB\u5BB0 / \u4EF7\u683C\u4E0D\u900F\u660E", hint: "\u4E0D\u77E5\u9053\u8BE5\u82B1\u591A\u5C11\u94B1\u624D\u5408\u7406" },
  { value: "\u6015\u8D28\u91CF\u6709\u95EE\u9898", hint: "\u62C5\u5FC3\u4EE5\u6B21\u5145\u597D\u3001\u8D27\u4E0D\u5BF9\u677F" },
  { value: "\u6015\u6548\u679C\u8FBE\u4E0D\u5230\u9884\u671F", hint: "\u82B1\u4E86\u94B1\u6CA1\u7528" },
  { value: "\u4E0D\u77E5\u9053\u600E\u4E48\u6311 / \u5206\u8FA8\u4E0D\u51FA\u597D\u574F", hint: "\u7F3A\u5224\u65AD\u6807\u51C6" },
  { value: "\u88AB\u540C\u884C\u5751\u8FC7 / \u6709\u9634\u5F71", hint: "\u8E29\u8FC7\u5751\u6240\u4EE5\u8C28\u614E" },
  { value: "\u9009\u62E9\u592A\u591A / \u6311\u82B1\u773C", hint: "\u540C\u7C7B\u592A\u591A\u4E0D\u77E5\u9053\u9009\u8C01" },
  { value: "\u6015\u670D\u52A1\u6001\u5EA6\u5DEE", hint: "\u62C5\u5FC3\u88AB\u6577\u884D\u3001\u88AB\u51B7\u843D" },
  { value: "\u6015\u9EBB\u70E6 / \u6D41\u7A0B\u590D\u6742", hint: "\u4E0D\u60F3\u6298\u817E" },
  { value: "\u6015\u552E\u540E\u6CA1\u4EBA\u7BA1", hint: "\u51FA\u4E86\u95EE\u9898\u627E\u4E0D\u5230\u4EBA" },
  { value: "\u9884\u7B97\u6709\u9650\u4F46\u8981\u6C42\u4E0D\u4F4E", hint: "\u60F3\u82B1\u5C0F\u94B1\u529E\u597D\u4E8B" },
  { value: "\u65F6\u95F4\u7D27 / \u7B49\u4E0D\u8D77", hint: "\u9700\u8981\u5FEB" },
  { value: "\u4E0D\u597D\u610F\u601D\u95EE / \u6015\u663E\u5F97\u5916\u884C", hint: "\u6709\u987E\u8651\u4F46\u4E0D\u6562\u5F00\u53E3" }
];
var USER_NEEDS2 = [
  { value: "\u8981\u771F\u6750\u5B9E\u6599", hint: "\u770B\u5F97\u89C1\u7684\u5B9E\u5728" },
  { value: "\u8981\u660E\u786E\u7684\u6548\u679C", hint: "\u505A\u5B8C\u80FD\u770B\u5230\u53D8\u5316" },
  { value: "\u8981\u6709\u4EBA\u5E2E\u7740\u6311", hint: "\u5E0C\u671B\u6709\u61C2\u884C\u7684\u7ED9\u5EFA\u8BAE" },
  { value: "\u8981\u7701\u5FC3\u7701\u4E8B", hint: "\u4E00\u7AD9\u89E3\u51B3\u4E0D\u6298\u817E" },
  { value: "\u8981\u4EF7\u683C\u900F\u660E", hint: "\u4E8B\u5148\u77E5\u9053\u82B1\u591A\u5C11" },
  { value: "\u8981\u5FEB", hint: "\u65F6\u95F4\u5C31\u662F\u6210\u672C" },
  { value: "\u8981\u6709\u9762\u5B50", hint: "\u62FF\u5F97\u51FA\u624B\u3001\u80FD\u6652" },
  { value: "\u8981\u957F\u671F\u6709\u4EBA\u7BA1", hint: "\u552E\u540E\u548C\u56DE\u8BBF" }
];
var CONTENT_VALUE2 = [
  { value: "\u8BA9\u4EBA\u957F\u89C1\u8BC6\uFF08\u8BA4\u77E5\u53D8\u5316\uFF09", hint: "\u539F\u6765\u5982\u6B64\u3001\u6DA8\u77E5\u8BC6 \u2192 \u6536\u85CF\u5173\u6CE8" },
  { value: "\u8BA9\u4EBA\u6709\u60C5\u7EEA\uFF08\u60C5\u7EEA\u53D8\u5316\uFF09", hint: "\u723D\u3001\u7B11\u3001\u611F\u52A8\u3001\u6C14\u6124 \u2192 \u8BC4\u8BBA\u8F6C\u53D1" },
  { value: "\u8BA9\u4EBA\u80FD\u7167\u505A\uFF08\u884C\u52A8\u53D8\u5316\uFF09", hint: "\u6211\u73B0\u5728\u5C31\u80FD\u8BD5 \u2192 \u4FDD\u5B58\u5C1D\u8BD5" },
  { value: "\u8BA9\u4EBA\u5BF9\u53F7\u5165\u5EA7\uFF08\u8EAB\u4EFD\u786E\u8BA4\uFF09", hint: "\u8FD9\u8BF4\u7684\u4E0D\u5C31\u662F\u6211 \u2192 \u4E92\u52A8\u5173\u6CE8" },
  { value: "\u8BA9\u4EBA\u4EA7\u751F\u4FE1\u4EFB\uFF08\u4FE1\u4EFB\u53D8\u5316\uFF09", hint: "\u8FD9\u4EBA\u61C2\u884C\u4E14\u505A\u5F97\u5230 \u2192 \u54A8\u8BE2\u8D2D\u4E70" }
];
var FAN_QUESTIONS2 = [
  { value: "\u591A\u5C11\u94B1 / \u600E\u4E48\u6536\u8D39", hint: "\u4EF7\u683C\u7C7B" },
  { value: "\u771F\u7684\u5047\u7684 / \u662F\u4E0D\u662F\u771F\u6750\u5B9E\u6599", hint: "\u771F\u4F2A\u8D28\u7591\u7C7B" },
  { value: "\u6548\u679C\u80FD\u4FDD\u6301\u591A\u4E45", hint: "\u6548\u679C\u7C7B" },
  { value: "\u9002\u4E0D\u9002\u5408\u6211\u8FD9\u79CD\u60C5\u51B5", hint: "\u9002\u914D\u7C7B" },
  { value: "\u5728\u54EA\u91CC / \u600E\u4E48\u53BB / \u8425\u4E1A\u65F6\u95F4", hint: "\u5230\u5E97\u7C7B" },
  { value: "\u8981\u7B49\u591A\u4E45 / \u8981\u4E0D\u8981\u9884\u7EA6", hint: "\u6D41\u7A0B\u7C7B" },
  { value: "\u548C\u67D0\u67D0\u5BB6\u6BD4\u600E\u4E48\u6837", hint: "\u6BD4\u4EF7\u7C7B" },
  { value: "\u81EA\u5DF1\u5728\u5BB6\u80FD\u4E0D\u80FD\u505A", hint: "\u66FF\u4EE3\u65B9\u6848\u7C7B" },
  { value: "\u51FA\u95EE\u9898\u4E86\u600E\u4E48\u529E", hint: "\u552E\u540E\u7C7B" }
];
var CONVERSION_BARRIERS2 = [
  { value: "\u89C9\u5F97\u8D35 / \u8D85\u9884\u7B97", hint: "\u4EF7\u683C\u95E8\u69DB" },
  { value: "\u4E0D\u76F8\u4FE1\u662F\u771F\u7684", hint: "\u4FE1\u4EFB\u95E8\u69DB" },
  { value: "\u4E0D\u7740\u6025 / \u518D\u770B\u770B", hint: "\u9700\u6C42\u4E0D\u8FEB\u5207" },
  { value: "\u6015\u8E29\u5751 / \u60F3\u5148\u89C2\u671B", hint: "\u98CE\u9669\u987E\u8651" },
  { value: "\u8DDD\u79BB\u8FDC / \u6765\u4E00\u8D9F\u9EBB\u70E6", hint: "\u4FBF\u5229\u6027\u95E8\u69DB" },
  { value: "\u4E0D\u77E5\u9053\u6548\u679C\u597D\u4E0D\u597D", hint: "\u7F3A\u8BC1\u636E" },
  { value: "\u8981\u548C\u5BB6\u4EBA\u5546\u91CF", hint: "\u51B3\u7B56\u94FE\u957F" },
  { value: "\u540C\u884C\u5728\u6253\u4EF7\u683C\u6218", hint: "\u5916\u90E8\u7ADE\u4E89" }
];
var CONVERSION_PATHS2 = [
  { value: "\u770B\u89C6\u9891 \u2192 \u8BC4\u8BBA\u533A\u95EE \u2192 \u79C1\u4FE1 \u2192 \u5230\u5E97", hint: "\u672C\u5730\u751F\u610F\u6700\u5E38\u89C1" },
  { value: "\u770B\u89C6\u9891 \u2192 \u70B9\u4E3B\u9875 \u2192 \u52A0\u5FAE\u4FE1 \u2192 \u6210\u4EA4", hint: "\u9700\u8981\u6C9F\u901A\u7684\u670D\u52A1" },
  { value: "\u770B\u89C6\u9891 \u2192 \u56E2\u8D2D\u94FE\u63A5\u4E0B\u5355 \u2192 \u5230\u5E97\u6838\u9500", hint: "\u6807\u51C6\u5316\u5957\u9910" },
  { value: "\u770B\u89C6\u9891 \u2192 \u8FDB\u76F4\u64AD\u95F4 \u2192 \u4E0B\u5355", hint: "\u6709\u76F4\u64AD\u80FD\u529B" },
  { value: "\u770B\u89C6\u9891 \u2192 \u5C0F\u7A0B\u5E8F/\u5546\u57CE\u4E0B\u5355 \u2192 \u53D1\u8D27", hint: "\u5B9E\u7269\u7535\u5546" },
  { value: "\u770B\u89C6\u9891 \u2192 \u7535\u8BDD\u54A8\u8BE2 \u2192 \u4E0A\u95E8/\u5230\u5E97", hint: "\u9AD8\u5BA2\u5355\u670D\u52A1" }
];
var RESTRICTIONS2 = [
  { value: "\u7EDD\u5BF9\u5316\u7528\u8BED\uFF08\u6700\u597D / \u7B2C\u4E00 / \u5168\u7F51\u6700\u4FBF\u5B9C\uFF09", hint: "\u5E7F\u544A\u6CD5\u7EA2\u7EBF\uFF0C\u5EFA\u8BAE\u90FD\u52FE\u4E0A" },
  { value: "\u4E0D\u80FD\u627F\u8BFA\u7597\u6548\u6216\u6548\u679C", hint: "\u533B\u7F8E\u3001\u5065\u5EB7\u3001\u6559\u80B2\u7C7B\u5C24\u5176\u8981\u6CE8\u610F" },
  { value: "\u4E0D\u80FD\u63D0\u7ADE\u4E89\u5BF9\u624B\u540D\u5B57", hint: "\u907F\u514D\u7EA0\u7EB7" },
  { value: "\u4E0D\u80FD\u51FA\u73B0\u5177\u4F53\u4EF7\u683C\u6570\u5B57", hint: "\u4EF7\u683C\u5E38\u53D8\u6216\u5E73\u53F0\u9650\u6D41\u65F6" },
  { value: "\u4E0D\u80FD\u900F\u9732\u4F9B\u5E94\u5546 / \u8FDB\u8D27\u6E20\u9053", hint: "\u5546\u4E1A\u673A\u5BC6" },
  { value: "\u4E0D\u80FD\u62CD\u5230\u987E\u5BA2\u6B63\u8138", hint: "\u9690\u79C1\u987E\u8651" },
  { value: '\u4E0D\u80FD\u7528"\u63ED\u79D8"\u4E8C\u5B57', hint: "\u5BB9\u6613\u62DB\u540C\u884C\u4E3E\u62A5" },
  { value: "\u4E0D\u78B0\u65F6\u653F / \u5B97\u6559 / \u5730\u57DF\u4E89\u8BAE", hint: "\u901A\u7528\u7EA2\u7EBF" }
];
var RESOURCES2 = [
  { value: "\u81EA\u6709\u95E8\u5E97 / \u573A\u5730", hint: "\u80FD\u5F53\u62CD\u6444\u73B0\u573A" },
  { value: "\u7A33\u5B9A\u7684\u4F9B\u5E94\u94FE\u6216\u8D27\u6E90", hint: "\u80FD\u62CD\u8FDB\u8D27\u3001\u6EAF\u6E90" },
  { value: "\u8001\u5BA2\u6237\u613F\u610F\u51FA\u955C", hint: "\u771F\u5B9E\u6848\u4F8B\u7D20\u6750" },
  { value: "\u540C\u884C\u4EBA\u8109 / \u884C\u4E1A\u8D44\u6E90", hint: "\u80FD\u505A\u8054\u52A8\u548C\u5185\u5E55" },
  { value: "\u6709\u8D44\u8D28\u8BC1\u4E66 / \u83B7\u5956", hint: "\u4E13\u4E1A\u80CC\u4E66" },
  { value: "\u505A\u4E86\u5F88\u591A\u5E74 / \u6709\u79EF\u7D2F", hint: "\u6545\u4E8B\u548C\u6848\u4F8B\u591A" },
  { value: "\u6709\u4F1A\u62CD\u4F1A\u526A\u7684\u4EBA", hint: "\u751F\u4EA7\u80FD\u529B" },
  { value: "\u6709\u5458\u5DE5/\u5BB6\u4EBA\u80FD\u914D\u5408\u51FA\u955C", hint: "\u80FD\u505A\u5173\u7CFB\u7C7B\u3001\u5267\u60C5\u7C7B" }
];
var WEAKNESSES2 = [
  { value: "\u4E0D\u4F1A\u8BB2 / \u955C\u5934\u524D\u7D27\u5F20", hint: "\u53E3\u64AD\u7C7B\u8981\u8C28\u614E" },
  { value: "\u6CA1\u65F6\u95F4 / \u53EA\u80FD\u6324\u7A7A\u6863\u62CD", hint: "\u4EA7\u80FD\u53D7\u9650" },
  { value: "\u4F4D\u7F6E\u504F / \u4E0D\u597D\u627E", hint: "\u8981\u9760\u5185\u5BB9\u8865\u4FBF\u5229\u6027" },
  { value: "\u4EF7\u683C\u6BD4\u540C\u884C\u9AD8", hint: "\u5FC5\u987B\u8BB2\u6E05\u51ED\u4EC0\u4E48\u8D35" },
  { value: "\u521A\u5F00\u4E0D\u4E45 / \u6CA1\u4EC0\u4E48\u6848\u4F8B", hint: "\u5148\u6512\u8FC7\u7A0B\u548C\u8BC1\u636E" },
  { value: "\u5E97\u9762\u5C0F / \u73AF\u5883\u4E00\u822C", hint: "\u907F\u5F00\u5168\u666F\uFF0C\u591A\u7528\u7279\u5199" },
  { value: "\u540C\u884C\u592A\u591A / \u7ADE\u4E89\u6FC0\u70C8", hint: "\u5FC5\u987B\u505A\u5DEE\u5F02\u5316" },
  { value: "\u4E0D\u61C2\u5E73\u53F0\u89C4\u5219\u548C\u73A9\u6CD5", hint: "\u9700\u8981\u5148\u8DD1\u901A\u57FA\u7840" }
];
var BEST_PERFORMING2 = [
  { value: "\u8FD8\u6CA1\u53D1\u8FC7 / \u8FD8\u770B\u4E0D\u51FA\u6765", hint: "\u65B0\u53F7\u9009\u8FD9\u4E2A\u5C31\u884C" },
  { value: "\u8BB2\u77E5\u8BC6 / \u6559\u65B9\u6CD5\u7684", hint: "" },
  { value: "\u62CD\u5DE5\u4F5C\u8FC7\u7A0B\u7684", hint: "" },
  { value: "\u8BB2\u89C2\u70B9 / \u5410\u69FD\u7684", hint: "" },
  { value: "\u8BB2\u6545\u4E8B / \u8BB2\u7ECF\u5386\u7684", hint: "" },
  { value: "\u63A2\u5E97 / \u5E26\u770B\u73AF\u5883\u7684", hint: "" },
  { value: "\u5BF9\u6BD4\u6D4B\u8BC4\u7C7B", hint: "" },
  { value: "\u641E\u7B11 / \u6BB5\u5B50\u7C7B", hint: "" },
  { value: "\u987E\u5BA2\u771F\u5B9E\u53CD\u9988\u7C7B", hint: "" }
];
var OPTION_GROUPS2 = [
  {
    field: "target_pain_points",
    label: "\u4F60\u7684\u5BA2\u4EBA\u6700\u62C5\u5FC3\u4EC0\u4E48",
    why: "\u8FD9\u662F\u5185\u5BB9\u6700\u597D\u7528\u7684\u5207\u5165\u70B9\u2014\u2014\u5199\u811A\u672C\u3001\u8D77\u6807\u9898\u3001\u60F3\u9009\u9898\u90FD\u4ECE\u8FD9\u91CC\u6765",
    options: PAIN_POINTS2,
    allowOther: true,
    maxHint: 4
  },
  {
    field: "target_needs",
    label: "\u4ED6\u4EEC\u771F\u6B63\u60F3\u8981\u4EC0\u4E48",
    why: '\u75DB\u70B9\u662F"\u6015\u4EC0\u4E48"\uFF0C\u9700\u6C42\u662F"\u8981\u4EC0\u4E48"\uFF0C\u4E24\u4E2A\u90FD\u6709\u5185\u5BB9\u624D\u6709\u6B63\u53CD\u4E24\u9762',
    options: USER_NEEDS2,
    allowOther: true,
    maxHint: 3
  },
  {
    field: "unique_selling_point",
    label: "\u4F60\u51ED\u4EC0\u4E48\u8BA9\u4EBA\u9009\u4F60",
    why: "\u8FD9\u51B3\u5B9A\u4E86\u89C6\u9891\u91CC\u8981\u53CD\u590D\u8BC1\u660E\u4EC0\u4E48\u3002\u52FE\u592A\u591A\u7B49\u4E8E\u6CA1\u91CD\u70B9\uFF0C\u6311\u6700\u786C\u7684 2-3 \u4E2A",
    options: SELLING_POINTS2,
    allowOther: true,
    maxHint: 3
  },
  {
    field: "content_value",
    label: "\u4F60\u60F3\u8BA9\u89C2\u4F17\u770B\u5B8C\u6709\u4EC0\u4E48\u53D8\u5316",
    why: '\u53EA\u6709"\u4EA7\u751F\u4FE1\u4EFB"\u8FD9\u4E00\u9879\u76F4\u63A5\u5E26\u6765\u6210\u4EA4\uFF0C\u5176\u4F59\u662F\u6DA8\u7C89\u548C\u4F20\u64AD',
    options: CONTENT_VALUE2,
    allowOther: false,
    maxHint: 2
  },
  {
    field: "fan_common_questions",
    label: "\u5BA2\u4EBA\u6700\u5E38\u95EE\u4F60\u4EC0\u4E48",
    why: "\u6BCF\u4E00\u4E2A\u9AD8\u9891\u95EE\u9898\u90FD\u662F\u4E00\u6761\u73B0\u6210\u7684\u9009\u9898\uFF0C\u8FD9\u4E00\u680F\u586B\u4E86\u9009\u9898\u5C31\u4E0D\u6101",
    options: FAN_QUESTIONS2,
    allowOther: true
  },
  {
    field: "conversion_barriers",
    label: "\u4ED6\u4EEC\u4E3A\u4EC0\u4E48\u72B9\u8C6B\u3001\u6CA1\u4E0B\u5355",
    why: "\u5185\u5BB9\u8981\u4E00\u6761\u6761\u628A\u8FD9\u4E9B\u987E\u8651\u62C6\u6389\uFF0C\u4E0D\u7136\u6D41\u91CF\u518D\u5927\u4E5F\u4E0D\u6210\u4EA4",
    options: CONVERSION_BARRIERS2,
    allowOther: true,
    maxHint: 3
  },
  {
    field: "conversion_path",
    label: "\u5BA2\u4EBA\u4E00\u822C\u600E\u4E48\u627E\u5230\u4F60\u3001\u600E\u4E48\u6210\u4EA4",
    why: "\u51B3\u5B9A\u89C6\u9891\u7ED3\u5C3E\u628A\u4EBA\u5F80\u54EA\u513F\u5F15",
    options: CONVERSION_PATHS2,
    allowOther: true,
    maxHint: 2
  },
  {
    field: "content_restrictions",
    label: "\u7EDD\u5BF9\u4E0D\u80FD\u8BF4\u7684\u8BDD",
    why: "\u786C\u7EA6\u675F\u3002\u52FE\u4E0A\u4E4B\u540E\u6240\u6709\u4EA7\u51FA\u90FD\u4F1A\u907F\u5F00\uFF0C\u6F0F\u6389\u53EF\u80FD\u76F4\u63A5\u8FDD\u89C4",
    options: RESTRICTIONS2,
    allowOther: true
  },
  {
    field: "unique_resources",
    label: "\u4F60\u624B\u4E0A\u6709\u4EC0\u4E48\u522B\u4EBA\u6CA1\u6709\u7684",
    why: "\u8FD9\u4E9B\u662F\u80FD\u62CD\u3001\u80FD\u5F53\u8BC1\u636E\u7684\u4E1C\u897F\uFF0C\u51B3\u5B9A\u4E86\u5185\u5BB9\u80FD\u505A\u591A\u6DF1",
    options: RESOURCES2,
    allowOther: true
  },
  {
    field: "competitive_weakness",
    label: "\u73B0\u5728\u6700\u5927\u7684\u77ED\u677F",
    why: "\u8BF4\u5B9E\u8BDD\u53CD\u800C\u6709\u7528\u2014\u2014AI \u4F1A\u7ED5\u5F00\u4F60\u505A\u4E0D\u5230\u7684\uFF0C\u4E0D\u7ED9\u4F60\u62CD\u4E0D\u51FA\u6765\u7684\u65B9\u6848",
    options: WEAKNESSES2,
    allowOther: true,
    maxHint: 3
  },
  {
    field: "viral_content_pattern",
    label: "\u5DF2\u7ECF\u53D1\u8FC7\u7684\u5185\u5BB9\u91CC\uFF0C\u54EA\u7C7B\u6570\u636E\u6700\u597D",
    why: "\u6709\u9A8C\u8BC1\u8FC7\u7684\u65B9\u5411\u5C31\u987A\u7740\u505A\uFF0C\u522B\u63A8\u5012\u91CD\u6765",
    options: BEST_PERFORMING2,
    allowOther: true,
    maxHint: 2
  }
];

// .tmp/content-audit-production_20261008/lib/content-roles.ts
var CONTENT_ROLE_LIST2 = ["\u6D41\u91CF\u578B", "\u4EBA\u8BBE\u578B", "\u53D8\u73B0\u578B"];

// .tmp/content-audit-production_20261008/lib/content-mix.ts
var PRESETS2 = [
  { id: "auto", label: "\u7CFB\u7EDF\u63A8\u8350", hint: "\u6309\u8D26\u53F7\u9636\u6BB5\u548C\u53D8\u73B0\u65B9\u5F0F\u81EA\u52A8\u5B9A" },
  { id: "traffic", label: "\u5F15\u6D41\u4F18\u5148", hint: "\u5148\u628A\u64AD\u653E\u548C\u7C89\u4E1D\u505A\u8D77\u6765", mix: { \u6D41\u91CF\u578B: 70, \u4EBA\u8BBE\u578B: 20, \u53D8\u73B0\u578B: 10 } },
  { id: "balanced", label: "\u5747\u8861", hint: "\u4E09\u79CD\u90FD\u8981\uFF0C\u6BD4\u8F83\u5E73\u5747", mix: { \u6D41\u91CF\u578B: 40, \u4EBA\u8BBE\u578B: 30, \u53D8\u73B0\u578B: 30 } },
  { id: "convert", label: "\u6210\u4EA4\u4F18\u5148", hint: "\u591A\u62CD\u80FD\u5E26\u6765\u54A8\u8BE2\u548C\u8BA2\u5355\u7684", mix: { \u6D41\u91CF\u578B: 25, \u4EBA\u8BBE\u578B: 20, \u53D8\u73B0\u578B: 55 } },
  { id: "custom", label: "\u81EA\u5B9A\u4E49", hint: "\u81EA\u5DF1\u62D6\u5230\u60F3\u8981\u7684\u6BD4\u4F8B" }
];
var STAGE_MIX2 = [
  { stage: "\u521A\u8D77\u53F7\uFF0C\u5B9A\u4F4D\u672A\u786E\u5B9A", mix: { \u6D41\u91CF\u578B: 60, \u4EBA\u8BBE\u578B: 25, \u53D8\u73B0\u578B: 15 }, why: "\u521A\u8D77\u53F7\u5148\u62FF\u7A33\u5B9A\u6D41\u91CF\u548C\u6B63\u53CD\u9988\uFF0C\u6D41\u91CF\u578B\u6700\u5927\uFF1B\u53D8\u73B0\u578B\u7B2C\u4E00\u5468\u5C31\u6709\uFF0C\u4F46\u53EA\u5360\u5C0F\u5934\uFF0C\u514D\u5F97\u50CF\u5E7F\u544A\u53F7" },
  { stage: "\u6709\u5B9A\u4F4D\uFF0C\u9700\u8981\u5185\u5BB9\u65B9\u5411", mix: { \u6D41\u91CF\u578B: 45, \u4EBA\u8BBE\u578B: 25, \u53D8\u73B0\u578B: 30 }, why: "\u6D41\u91CF\u5F00\u59CB\u7A33\u4E86\uFF0C\u53D8\u73B0\u578B\u6162\u6162\u957F\u4E0A\u6765\uFF0C\u6D41\u91CF\u578B\u4ECD\u7136\u662F\u4E3B\u529B" },
  { stage: "\u7A33\u5B9A\u8FD0\u8425\uFF0C\u9700\u8981\u65B0\u9009\u9898", mix: { \u6D41\u91CF\u578B: 30, \u4EBA\u8BBE\u578B: 20, \u53D8\u73B0\u578B: 50 }, why: "\u6D41\u91CF\u5DF2\u7ECF\u7A33\u5B9A\uFF0C\u6309\u4EE3\u8FD0\u8425 SOP \u7684\u6807\u51C6\u914D\u6BD4\uFF0C\u53D8\u73B0\u578B\u5360\u4E00\u534A" },
  { stage: "\u6210\u719F\u671F\uFF0C\u9700\u8981\u7A81\u7834", mix: { \u6D41\u91CF\u578B: 40, \u4EBA\u8BBE\u578B: 30, \u53D8\u73B0\u578B: 30 }, why: "\u6210\u719F\u671F\u8981\u7A81\u7834\uFF0C\u5F97\u91CD\u65B0\u62C9\u65B0\u4EBA\u3001\u52A0\u6DF1\u4EBA\u8BBE\uFF0C\u6D41\u91CF\u578B\u548C\u4EBA\u8BBE\u578B\u5F80\u56DE\u52A0" }
];
var FALLBACK2 = STAGE_MIX2[1];
var asList3 = (v) => Array.isArray(v) ? v.filter((x) => typeof x === "string") : typeof v === "string" ? v.split(/[、,，]/).map((x) => x.trim()).filter(Boolean) : [];
function normalizeMix2(m) {
  const raw = CONTENT_ROLE_LIST2.map((r) => Math.max(0, Number(m[r]) || 0));
  const sum = raw.reduce((a, b) => a + b, 0);
  if (sum <= 0) return { ...FALLBACK2.mix };
  const scaled = raw.map((v) => Math.round(v / sum * 100 / 5) * 5);
  const diff = 100 - scaled.reduce((a, b) => a + b, 0);
  const top = scaled.indexOf(Math.max(...scaled));
  scaled[top] += diff;
  return Object.fromEntries(CONTENT_ROLE_LIST2.map((r, i) => [r, scaled[i]]));
}
function shift2(m, from, to, n, floor) {
  const move = Math.max(0, Math.min(n, m[from] - floor));
  return { ...m, [from]: m[from] - move, [to]: m[to] + move };
}
function recommendMix2(profile2, goal = "") {
  const p = profile2;
  const stage = typeof p?.account_stage === "string" ? p.account_stage : "";
  const base = STAGE_MIX2.find((s) => s.stage === stage) ?? FALLBACK2;
  let mix = { ...base.mix };
  const reasons = [stage ? `${stage}\uFF1A${base.why}` : `\u6863\u6848\u6CA1\u586B\u8D26\u53F7\u9636\u6BB5\uFF0C\u6309\u8FC7\u6E21\u671F\u7ED9\uFF1A${FALLBACK2.why}`];
  const money = asList3(p?.monetization_model);
  if (money.length > 0 && money.every((x) => x === "\u6682\u4E0D\u8003\u8651")) {
    mix = shift2(mix, "\u53D8\u73B0\u578B", "\u6D41\u91CF\u578B", 100, 10);
    reasons.push("\u53D8\u73B0\u65B9\u5F0F\u5199\u7684\u662F\u300C\u6682\u4E0D\u8003\u8651\u300D\uFF0C\u53D8\u73B0\u578B\u538B\u5230 10%");
  }
  if (/大流量|涨粉|曝光|影响力|做博主|上热门/.test(goal)) {
    mix = shift2(mix, "\u53D8\u73B0\u578B", "\u6D41\u91CF\u578B", 10, 10);
    reasons.push("\u4F60\u8981\u7684\u662F\u6D41\u91CF\u548C\u66DD\u5149\uFF0C\u6D41\u91CF\u578B\u518D\u52A0 10%");
  } else if (/精准客户|只要成交|不在乎播放|多卖|带货|转化/.test(goal)) {
    mix = shift2(mix, "\u6D41\u91CF\u578B", "\u53D8\u73B0\u578B", 10, 20);
    reasons.push("\u4F60\u8981\u7684\u662F\u6210\u4EA4\uFF0C\u53D8\u73B0\u578B\u518D\u52A0 10%");
  }
  return { mix: normalizeMix2(mix), reason: reasons.join("\uFF1B") };
}
function readSetting2(v) {
  if (!v || typeof v !== "object") return null;
  const s = v;
  if (!PRESETS2.some((x) => x.id === s.preset)) return null;
  if (s.preset === "custom") return s.custom ? { preset: "custom", custom: normalizeMix2(s.custom) } : null;
  return { preset: s.preset };
}
function mixOfSetting2(s, p, goal) {
  if (s.preset === "custom" && s.custom) return { mix: normalizeMix2(s.custom) };
  const preset = PRESETS2.find((x) => x.id === s.preset);
  if (preset?.mix) return { mix: { ...preset.mix } };
  return recommendMix2(p, goal);
}
var presetLabel2 = (s) => PRESETS2.find((x) => x.id === s.preset)?.label ?? "\u7CFB\u7EDF\u63A8\u8350";
function resolveMix2(profile2, override, goal = "") {
  const p = profile2;
  if (override) {
    const { mix: mix2, reason: reason2 } = mixOfSetting2(override, p, goal);
    return { mix: mix2, source: "override", label: `\u8FD9\u6B21\u4E34\u65F6\u6539\u7684\xB7${presetLabel2(override)}`, reason: reason2 };
  }
  const saved = readSetting2(p?.content_mix);
  if (saved && saved.preset !== "auto") {
    return { mix: mixOfSetting2(saved, p, goal).mix, source: "profile", label: `\u6863\u6848\u8BBE\u7F6E\xB7${presetLabel2(saved)}` };
  }
  const { mix, reason } = recommendMix2(p, goal);
  const stage = typeof p?.account_stage === "string" && p.account_stage ? p.account_stage.split("\uFF0C")[0] : "";
  return { mix, source: "auto", label: stage ? `\u7CFB\u7EDF\u63A8\u8350\uFF08${stage}\uFF09` : "\u7CFB\u7EDF\u63A8\u8350", reason };
}
var formatMix2 = (m) => CONTENT_ROLE_LIST2.map((r) => `${r} ${m[r]}%`).join(" / ");
function mixContextLine2(r) {
  return `- **\u5185\u5BB9\u914D\u6BD4**\uFF1A${formatMix2(r.mix)}\uFF08${r.label}\uFF09\u3002\u51FA\u9009\u9898\u3001\u6392\u8BA1\u5212\u65F6\u6309\u8FD9\u4E2A\u6BD4\u4F8B\u5206`;
}

// .tmp/content-audit-production_20261008/lib/taboos.ts
var ANALYSIS2 = "(?!\u7684?(?:\u4F18\u52BF|\u77ED\u677F|\u95EE\u9898|\u96BE\u70B9|\u98CE\u9669|\u533A\u522B|\u597D\u5904|\u7279\u70B9|\u5356\u70B9|\u4EAE\u70B9|\u539F\u56E0|\u6311\u6218|\u969C\u788D|\u963B\u529B|\u53D8\u5316|\u6536\u83B7|\u611F\u53D7|\u56F0\u96BE|\u75DB\u70B9|\u673A\u4F1A|\u5DEE\u8DDD|\u4E0D\u540C|\u6559\u8BAD))";
var MEASURE2 = "(?!\u7684?(?:\u89D2\u5EA6|\u5C3A\u5BF8|\u627F\u91CD|\u529F\u7387|\u5BB9\u91CF|\u9650\u5EA6|\u7A0B\u5EA6|\u8303\u56F4|\u503C|\u901F\u5EA6|\u6E29\u5EA6|\u5F00\u53E3|\u5E45\u5EA6|\u957F\u5EA6|\u5BBD\u5EA6|\u9AD8\u5EA6|\u6DF1\u5EA6|\u91CD\u91CF|\u9762\u79EF|\u6863|\u706B|\u53F7|\u7801|\u97F3\u91CF|\u4EAE\u5EA6|\u529B\u5EA6|\u538B\u529B))";
var ABSOLUTE2 = `(?:\u5168\u7F51|\u5168\u57CE|\u5168\u56FD|\u5168\u5E02|\u53F2\u4E0A)?\u6700(?:\u6B63\u5B97|\u597D\u5403|\u597D(?![\u5148\u662F\u522B\u4E0D\u80FD\u7528\u5728\u8FD8\u6BCF\u627E\u628A\u8BA9\u7ED9\u4ECE\u518D\u591A\u5C11\u8D81\u63D0\u65E9\u8DDF])${ANALYSIS2}|\u4FBF\u5B9C|\u4F4E\u4EF7|\u5B9E\u60E0|\u5212\u7B97|\u4E13\u4E1A|\u5730\u9053|\u5F3A|\u4F73|\u5927${ANALYSIS2}${MEASURE2}|\u5168|\u706B|\u9AD8\u7AEF|\u5B89\u5168|\u9760\u8C31)|\u5168\u7F51\u6700|\u5168\u57CE\u6700|\u7B2C\u4E00(?:\u5BB6|\u540D|\u54C1\u724C)|(?:\u5168\u56FD|\u5168\u5E02|\u5168\u57CE|\u5357\u4E50|\u53BF\u57CE)\u7B2C\u4E00|\u9876\u7EA7|\u6781\u81F4|\u56FD\u5BB6\u7EA7|\u72EC\u5BB6|\u552F\u4E00|\u53F2\u4E0A\u6700`;
var PLATFORM_TABOOS2 = [
  { id: "p-absolute", kind: "say", text: "\u7EDD\u5BF9\u5316\u7528\u8BED\uFF1A\u6700\u3001\u7B2C\u4E00\u3001\u9876\u7EA7\u3001\u6781\u81F4\u3001\u5168\u7F51\u6700\u4F4E\u3001\u56FD\u5BB6\u7EA7\u3001\u72EC\u5BB6\u3001\u552F\u4E00", why: "\u5E7F\u544A\u6CD5\u7EA2\u7EBF", instead: '\u8BF4\u5177\u4F53\u4E8B\u5B9E\uFF1A"\u5F00\u4E86 9 \u5E74""\u4E00\u5929\u5356 300 \u4E32"', words: ABSOLUTE2 },
  { id: "p-promise", kind: "say", text: "100% \u6709\u6548\u3001\u4FDD\u8BC1\u3001\u7EDD\u5BF9\u3001\u6C38\u4E45\u3001\u65E0\u526F\u4F5C\u7528", why: "\u865A\u5047\u627F\u8BFA", instead: '"\u5927\u591A\u6570\u5BA2\u4EBA\u53CD\u9988\u2026\u2026""\u6211\u4EEC\u7684\u505A\u6CD5\u662F\u2026\u2026"', words: "100%(?:\u6709\u6548|\u597D\u8BC4|\u6EE1\u610F)|\u4FDD\u8BC1(?:\u6709\u6548|\u6548\u679C|\u597D\u5403)|\u7EDD\u5BF9(?:\u6709\u6548|\u6B63\u5B97|\u4E0D)|\u6C38\u4E45(?:\u6709\u6548|\u4FDD\u6301)|\u65E0\u526F\u4F5C\u7528|\u96F6\u98CE\u9669" },
  { id: "p-lure", kind: "say", text: "\u70B9\u8D5E\u62BD\u5956\u3001\u8F6C\u53D1\u9001\u3001\u8BC4\u8BBA\u533A\u6263 1 \u9886\u798F\u5229\uFF08\u62FF\u5956\u52B1\u6362\u4E92\u52A8\uFF09", why: "\u8BF1\u5BFC\u4E92\u52A8\uFF0C\u5BB9\u6613\u9650\u6D41", instead: '\u7528\u5185\u5BB9\u672C\u8EAB\u5F15\u8BC4\u8BBA\uFF1A"\u4F60\u4EEC\u90A3\u8FB9\u4E5F\u8FD9\u6837\u5417\uFF1F"', words: "\u70B9\u8D5E(?:\u62BD\u5956|\u9001)|\u8F6C\u53D1(?:\u62BD\u5956|\u9001|\u6709\u793C)|(?:\u6263|\u6253)1(?:\u9886|\u9001|\u62BD)|\u8BC4\u8BBA(?:\u62BD\u5956|\u9001)" },
  { id: "p-offsite", kind: "say", text: "\u52A0\u5FAE\u4FE1\u3001\u52A0 V\u3001\u79C1\u4FE1\u53D1\u4F60\u4EF7\u683C\u3001\u4E3B\u9875\u6709\u8054\u7CFB\u65B9\u5F0F\uFF08\u53E3\u64AD\u6216\u5B57\u5E55\uFF09", why: "\u7AD9\u5916\u5BFC\u6D41\uFF0C\u6296\u97F3\u4E0A\u5BB9\u6613\u9650\u6D41", instead: "\u5F15\u5230\u5E73\u53F0\u5185\uFF1A\u56E2\u8D2D\u94FE\u63A5\u3001\u5230\u5E97\u5730\u5740\u3001\u8BC4\u8BBA\u533A\u56DE\u590D", words: "\u52A0(?:\u6211)?(?:\u5FAE\u4FE1|V\u4FE1|vx|VX|v\u4FE1|\u5A01\u4FE1)|\u79C1\u4FE1(?:\u53D1|\u7ED9)\u4F60(?:\u4EF7\u683C|\u62A5\u4EF7)|\u4E3B\u9875\u6709(?:\u8054\u7CFB\u65B9\u5F0F|\u5FAE\u4FE1)", closable: true },
  { id: "p-rival", kind: "say", text: '\u8D2C\u4F4E\u540C\u884C\u3001\u70B9\u540D\u7ADE\u54C1\uFF1A"\u9694\u58C1\u90A3\u5BB6\u90FD\u662F\u2026\u2026"', why: "\u4E0D\u6B63\u5F53\u7ADE\u4E89\uFF0C\u5BB9\u6613\u88AB\u4E3E\u62A5", instead: "\u53EA\u8BB2\u81EA\u5DF1\u600E\u4E48\u505A", words: "\u9694\u58C1(?:\u90A3\u5BB6|\u5E97)(?:\u90FD\u662F|\u5168\u662F|\u7528\u7684)|\u522B\u5BB6\u90FD\u662F|\u540C\u884C\u90FD\u662F(?:\u9A97|\u5751)" },
  { id: "p-authority", kind: "say", text: "\u5192\u7528\u6743\u5A01\uFF1A\u592E\u89C6\u63A8\u8350\u3001\u4E13\u5BB6\u8BA4\u8BC1\u3001\u653F\u5E9C\u6307\u5B9A\uFF08\u6CA1\u6709\u5C31\u4E0D\u8BF4\uFF09", why: "\u865A\u5047\u5BA3\u4F20", words: "\u592E\u89C6(?:\u63A8\u8350|\u62A5\u9053)|\u4E13\u5BB6(?:\u8BA4\u8BC1|\u63A8\u8350)|\u653F\u5E9C\u6307\u5B9A|\u5B98\u65B9\u6307\u5B9A" },
  { id: "p-privacy", kind: "shoot", text: "\u672A\u7ECF\u540C\u610F\u62CD\u987E\u5BA2\u3001\u8DEF\u4EBA\u6B63\u8138\uFF1B\u62CD\u672A\u6210\u5E74\u4EBA", why: "\u9690\u79C1\u548C\u672A\u6210\u5E74\u4EBA\u4FDD\u62A4", instead: "\u80CC\u5F71\u3001\u624B\u90E8\u3001\u6253\u7801" },
  { id: "p-politics", kind: "direction", text: "\u65F6\u653F\u3001\u5B97\u6559\u3001\u6C11\u65CF\u3001\u5730\u57DF\u6B67\u89C6\u7684\u8BDD\u9898", why: "\u901A\u7528\u7EA2\u7EBF" },
  { id: "p-fake", kind: "direction", text: "\u865A\u6784\u7ECF\u5386\u3001\u7F16\u9020\u6570\u636E\uFF08\u9500\u91CF\u3001\u64AD\u653E\u91CF\u3001\u5BA2\u6237\u6570\uFF09", why: "\u865A\u5047\u5BA3\u4F20", instead: "\u6CA1\u6709\u4F9D\u636E\u5199\u6210 X \u6216\u3010\u6362\u6210\u4F60\u7684\uFF1A\u2026\u2026\u3011" }
];
var INDUSTRIES2 = [
  {
    id: "food",
    name: "\u9910\u996E",
    values: ["\u7F8E\u98DF\u70F9\u996A", "\u9910\u996E", "\u98DF\u54C1\u996E\u6599"],
    keywords: /餐饮|餐厅|饭店|饭馆|面馆|火锅|烧烤|串串|小吃|奶茶|咖啡|烘焙|蛋糕|饮品|食堂|川菜|湘菜|粤菜|快餐/,
    items: [
      { id: "food-health", kind: "direction", text: "\u5403\u4E86\u80FD\u6CBB\u75C5\u3001\u517B\u751F\u3001\u51CF\u80A5\u3001\u58EE\u9633\u8FD9\u7C7B\u529F\u6548\u5411\u5185\u5BB9", why: "\u666E\u901A\u98DF\u54C1\u4E0D\u80FD\u5BA3\u4F20\u7597\u6548", instead: "\u53EA\u8BB2\u5473\u9053\u3001\u53E3\u611F\u3001\u5206\u91CF", words: "\u6CBB(?:\u75C5|\u80C3\u75C5|\u5931\u7720)|\u517B\u80C3|\u964D(?:\u4E09\u9AD8|\u8840\u538B|\u8840\u7CD6|\u8840\u8102)|\u6392\u6BD2|\u58EE\u9633|\u8865\u80BE|\u51CF\u80A5(?:\u795E\u5668|\u9910)" },
      { id: "food-dirty", kind: "direction", text: '\u66B4\u9732\u540E\u53A8\u536B\u751F\u95EE\u9898\u7684"\u771F\u5B9E\u63ED\u5E95"\uFF1A\u751F\u719F\u6DF7\u653E\u3001\u5458\u5DE5\u4E0D\u6234\u5E3D\u5B50\u3001\u5F92\u624B\u6293\u719F\u98DF', why: "\u4E00\u62CD\u5C31\u662F\u98DF\u5B89\u6295\u8BC9\u7D20\u6750", instead: "\u62CD\u4E4B\u524D\u5148\u6536\u62FE\uFF0C\u62CD\u5E72\u51C0\u7684\u64CD\u4F5C\u53F0" },
      { id: "food-wild", kind: "direction", text: "\u91CE\u751F\u52A8\u7269\u3001\u4FDD\u62A4\u52A8\u7269\u505A\u83DC", why: "\u8FDD\u6CD5" },
      { id: "food-drink", kind: "direction", text: "\u529D\u9152\u3001\u62FC\u9152\u3001\u559D\u9189\u7684\u753B\u9762\u548C\u8BDD\u9898", why: "\u5E73\u53F0\u9650\u5236\u996E\u9152\u5185\u5BB9", instead: "\u62CD\u6C1B\u56F4\u4E0D\u62CD\u559D" },
      { id: "food-natural", kind: "say", text: "\u96F6\u6DFB\u52A0\u3001\u7EAF\u5929\u7136\u3001\u65E0\u9632\u8150\u5242\uFF08\u6CA1\u6709\u68C0\u6D4B\u4F9D\u636E\uFF09", why: "\u865A\u5047\u5BA3\u4F20", instead: '\u8BF4\u770B\u5F97\u89C1\u7684\uFF1A"\u73B0\u5207\u73B0\u7A7F""\u5F53\u5929\u8FDB\u8D27"', words: "\u96F6\u6DFB\u52A0|\u7EAF\u5929\u7136|\u65E0\u9632\u8150\u5242|\u65E0\u4EFB\u4F55\u6DFB\u52A0" },
      { id: "food-price", kind: "say", text: "\u53E3\u64AD\u4EF7\u683C\u548C\u56E2\u8D2D\u9875\u5BF9\u4E0D\u4E0A", why: "\u4EF7\u683C\u6B3A\u8BC8\u6295\u8BC9", instead: "\u4EE5\u56E2\u8D2D\u9875\u4E3A\u51C6\uFF0C\u6216\u4E0D\u8BF4\u5177\u4F53\u4EF7" }
    ]
  },
  {
    id: "beauty",
    name: "\u7F8E\u5986\u62A4\u80A4",
    values: ["\u7F8E\u5986\u62A4\u80A4"],
    keywords: /美妆|护肤|化妆品|美容|美甲|美睫|皮肤管理/,
    items: [
      { id: "beauty-cure", kind: "direction", text: '\u6CBB\u7597\u76AE\u80A4\u75C5\u3001\u795B\u6591\u795B\u75D8\u7684"\u7597\u6548"\u5411\u5185\u5BB9\uFF08\u666E\u901A\u5316\u5986\u54C1\uFF09', why: "\u529F\u6548\u5BA3\u79F0\u8981\u5907\u6848\uFF0C\u666E\u901A\u5316\u5986\u54C1\u4E0D\u80FD\u8BF4", words: "\u795B\u6591|\u795B\u75D8|\u7F8E\u767D(?:\u6DE1\u6591)?|\u6297\u654F|\u4FEE\u590D(?:\u5C4F\u969C|\u53D7\u635F)|\u6CBB(?:\u75D8|\u6591|\u76AE\u80A4)" },
      { id: "beauty-medical", kind: "say", text: "\u533B\u5B66\u7EA7\u3001\u836F\u5986\u3001\u68B0\u5B57\u53F7\u5F53\u5316\u5986\u54C1\u5356", why: "\u6DF7\u6DC6\u6982\u5FF5", words: "\u533B\u5B66\u7EA7|\u836F\u5986|\u68B0\u5B57\u53F7" },
      { id: "beauty-compare", kind: "shoot", text: "\u5938\u5927\u7684\u524D\u540E\u5BF9\u6BD4\uFF08\u4FEE\u56FE\u3001\u4E0D\u540C\u5149\u7EBF\u89D2\u5EA6\uFF09", why: "\u865A\u5047\u5BA3\u4F20", instead: '\u540C\u5149\u540C\u89D2\u5EA6\uFF0C\u6807\u660E"\u4E2A\u4EBA\u6548\u679C"' },
      { id: "beauty-fast", kind: "say", text: "\u51E0\u5929\u89C1\u6548\u3001\u6C38\u4E45\u3001\u7ACB\u523B\u53D8\u767D", why: "\u865A\u5047\u627F\u8BFA", words: "[\u4E00\u4E8C\u4E09\u56DB\u4E94\u516D\u4E031-7]\u5929(?:\u89C1\u6548|\u53D8\u767D|\u795B)|\u7ACB\u523B\u53D8\u767D|\u4E00\u6B21\u89C1\u6548" }
    ]
  },
  {
    id: "medical",
    name: "\u533B\u7F8E / \u533B\u7597",
    values: [],
    keywords: /医美|整形|整容|诊所|医院|口腔|牙科|中医|理疗|针灸|推拿|植发/,
    items: [
      { id: "med-promise", kind: "direction", text: "\u4FDD\u8BC1\u6548\u679C\u3001\u65E0\u75DB\u3001\u96F6\u98CE\u9669\u3001\u5305\u6CBB\u7684\u627F\u8BFA\u5411\u5185\u5BB9", why: "\u533B\u7597\u5E7F\u544A\u7EA2\u7EBF", words: "\u65E0\u75DB|\u96F6\u98CE\u9669|\u5305\u6CBB|\u6839\u6CBB|\u5305\u6548\u679C|\u4FDD\u8BC1\u6548\u679C" },
      { id: "med-case", kind: "direction", text: "\u7528\u60A3\u8005\u672F\u524D\u672F\u540E\u5BF9\u6BD4\u3001\u60A3\u8005\u540D\u4E49\u505A\u8BC1\u660E", why: "\u533B\u7597\u5E7F\u544A\u4E0D\u80FD\u7528\u60A3\u8005\u540D\u4E49\u8BC1\u660E", instead: "\u8BB2\u6D41\u7A0B\u3001\u6CE8\u610F\u4E8B\u9879\u3001\u533B\u751F\u600E\u4E48\u5224\u65AD" },
      { id: "med-price", kind: "direction", text: '\u4F4E\u4EF7\u5F15\u6D41\u3001"9.9 \u5143\u505A\u2026\u2026"\u8FD9\u7C7B\u533B\u7597\u9879\u76EE\u4FC3\u9500', why: "\u533B\u7597\u670D\u52A1\u4F4E\u4EF7\u8BF1\u5BFC\u6613\u8FDD\u89C4" }
    ]
  },
  {
    id: "fitness",
    name: "\u5065\u8EAB\u8FD0\u52A8",
    values: ["\u5065\u8EAB\u8FD0\u52A8"],
    keywords: /健身|瑜伽|普拉提|减脂|私教|运动馆/,
    items: [
      { id: "fit-fast", kind: "direction", text: "X \u5929\u7626 X \u65A4\u3001\u8EBA\u7740\u7626\u3001\u4E0D\u8282\u98DF\u4E0D\u8FD0\u52A8\u4E5F\u80FD\u7626", why: "\u865A\u5047\u627F\u8BFA", instead: "\u8BB2\u65B9\u6CD5\u548C\u575A\u6301\u591A\u4E45\u7684\u771F\u5B9E\u8BB0\u5F55", words: "\\d+\u5929\u7626\\d*\u65A4?|\u8EBA\u7740(?:\u5C31)?\u7626|\u4E0D\u8282\u98DF(?:\u4E0D\u8FD0\u52A8)?(?:\u4E5F\u80FD|\u5C31\u80FD)?\u7626|\u6708\u7626\\d+" },
      { id: "fit-drug", kind: "direction", text: "\u63A8\u8350\u51CF\u80A5\u836F\u3001\u4EE3\u9910\u66FF\u4EE3\u6B63\u9910\u3001\u5904\u65B9\u836F", why: "\u533B\u7597\u98CE\u9669" },
      { id: "fit-cure", kind: "say", text: "\u6CBB\u7597\u8170\u690E\u3001\u6CBB\u9888\u690E\u75C5\uFF08\u975E\u533B\u7597\u673A\u6784\uFF09", why: "\u533B\u7597\u7528\u8BED", instead: '"\u7F13\u89E3\u4E45\u5750\u7684\u50F5\u786C\u611F"', words: "\u6CBB(?:\u7597)?(?:\u8170\u690E|\u9888\u690E|\u8170\u95F4\u76D8)" },
      { id: "fit-danger", kind: "shoot", text: "\u5371\u9669\u52A8\u4F5C\u4E0D\u52A0\u63D0\u793A", why: "\u5B89\u5168", instead: '\u52A0"\u91CF\u529B\u800C\u884C"\u63D0\u793A' }
    ]
  },
  {
    id: "edu",
    name: "\u6559\u80B2\u57F9\u8BAD",
    values: ["\u77E5\u8BC6\u6559\u80B2", "\u804C\u573A\u6210\u957F"],
    keywords: /教育|培训|辅导|课程|考研|考证|留学|编程|英语|托管/,
    items: [
      { id: "edu-promise", kind: "say", text: "\u4FDD\u8FC7\u3001\u5305\u5C31\u4E1A\u3001\u5305\u62FF\u8BC1\u3001100% \u63D0\u5206", why: "\u5E7F\u544A\u6CD5\u660E\u4EE4\u7981\u6B62\u7684\u6559\u80B2\u627F\u8BFA", instead: "\u8BF4\u5B66\u5458\u771F\u5B9E\u6848\u4F8B\uFF08\u5F81\u5F97\u540C\u610F\uFF09", words: "\u4FDD\u8FC7|\u5305(?:\u5C31\u4E1A|\u8FC7|\u62FF\u8BC1|\u5206\u914D)|(?:100%|\u767E\u5206\u767E)(?:\u63D0\u5206|\u901A\u8FC7|\u4E0A\u5CB8)|\u4E0D\u8FC7\u9000\u6B3E" },
      { id: "edu-rich", kind: "direction", text: "\u6708\u5165\u8FC7\u4E07\u3001\u8EBA\u8D5A\u3001\u526F\u4E1A\u66B4\u5BCC\u8FD9\u7C7B\u6536\u76CA\u627F\u8BFA\u5411\u5185\u5BB9", why: "\u5938\u5927\u6536\u76CA", words: "\u6708\u5165(?:\u8FC7\u4E07|\u5341\u4E07|\\d+\u4E07)|\u8EBA\u8D5A|\u66B4\u5BCC" },
      { id: "edu-anxiety", kind: "direction", text: '\u8D29\u5356\u7126\u8651\uFF1A"\u4E0D\u5B66\u5C31\u88AB\u6DD8\u6C70""\u5B69\u5B50\u8F93\u5728\u8D77\u8DD1\u7EBF"', why: "\u5E73\u53F0\u9650\u6D41", instead: "\u8BB2\u5177\u4F53\u95EE\u9898\u600E\u4E48\u89E3\u51B3", words: "\u8F93\u5728\u8D77\u8DD1\u7EBF|\u4E0D\u5B66\u5C31(?:\u88AB)?\u6DD8\u6C70" },
      { id: "edu-teacher", kind: "say", text: "\u540D\u5E08\u3001\u6E05\u5317\u540D\u5E08\uFF08\u6CA1\u6709\u4F9D\u636E\uFF09", why: "\u865A\u5047\u5BA3\u4F20", words: "\u6E05\u5317\u540D\u5E08|\u9876\u7EA7\u540D\u5E08|\u91D1\u724C\u540D\u5E08" }
    ]
  },
  {
    id: "baby",
    name: "\u6BCD\u5A74\u80B2\u513F",
    values: ["\u6BCD\u5A74\u80B2\u513F"],
    keywords: /母婴|育儿|奶粉|早教|月子|童装|婴/,
    items: [
      { id: "baby-effect", kind: "say", text: "\u589E\u5F3A\u514D\u75AB\u529B\u3001\u4FC3\u8FDB\u5927\u8111\u53D1\u80B2\uFF08\u666E\u901A\u98DF\u54C1\u3001\u7528\u54C1\uFF09", why: "\u529F\u6548\u5BA3\u79F0", words: "\u589E\u5F3A\u514D\u75AB(?:\u529B)?|\u4FC3\u8FDB(?:\u5927\u8111|\u667A\u529B)\u53D1\u80B2|\u957F\u9AD8\u795E\u5668" },
      { id: "baby-milk", kind: "say", text: "\u66FF\u4EE3\u6BCD\u4E73\u3001\u6BD4\u6BCD\u4E73\u597D", why: "\u8FDD\u89C4", words: "\u66FF\u4EE3\u6BCD\u4E73|\u6BD4\u6BCD\u4E73(?:\u8FD8)?\u597D|\u5AB2\u7F8E\u6BCD\u4E73" },
      { id: "baby-danger", kind: "shoot", text: "\u5B9D\u5B9D\u5371\u9669\u52A8\u4F5C\u3001\u88F8\u9732\u753B\u9762", why: "\u672A\u6210\u5E74\u4EBA\u4FDD\u62A4" },
      { id: "baby-scare", kind: "direction", text: '\u5413\u552C\u5BB6\u957F\uFF1A"\u4E0D\u7528\u8FD9\u4E2A\u5B69\u5B50\u5C31\u4F1A\u2026\u2026"', why: "\u8D29\u5356\u7126\u8651" }
    ]
  },
  {
    id: "home",
    name: "\u5BB6\u5C45\u88C5\u4FEE",
    values: ["\u5BB6\u5C45\u88C5\u4FEE"],
    keywords: /装修|家居|家具|建材|全屋定制|瓷砖|门窗|软装/,
    items: [
      { id: "home-promise", kind: "say", text: "\u96F6\u7532\u919B\u3001\u65E0\u6C61\u67D3\u3001\u6C38\u4E0D\u5F00\u88C2\u3001\u7EC8\u8EAB\u8D28\u4FDD\uFF08\u6CA1\u6709\u4F9D\u636E\uFF09", why: "\u865A\u5047\u627F\u8BFA", instead: "\u8BF4\u68C0\u6D4B\u62A5\u544A\u3001\u5B9E\u9645\u8D28\u4FDD\u671F", words: "\u96F6\u7532\u919B|\u65E0\u6C61\u67D3|\u6C38\u4E0D(?:\u5F00\u88C2|\u53D8\u5F62|\u892A\u8272)|\u7EC8\u8EAB\u8D28\u4FDD" },
      { id: "home-privacy", kind: "shoot", text: "\u62CD\u5BA2\u6237\u5BB6\u95E8\u724C\u3001\u5C0F\u533A\u540D\u3001\u5BB6\u91CC\u5168\u8C8C\uFF08\u672A\u540C\u610F\uFF09", why: "\u9690\u79C1", instead: "\u6253\u7801\u3001\u5F81\u5F97\u540C\u610F" },
      { id: "home-scare", kind: "direction", text: '"\u88C5\u4FEE\u516C\u53F8\u90FD\u662F\u9A97\u5B50"\u8FD9\u7C7B\u5168\u884C\u4E1A\u62B9\u9ED1', why: "\u6613\u88AB\u4E3E\u62A5\uFF0C\u4E5F\u4F24\u81EA\u5DF1", instead: "\u8BB2\u600E\u4E48\u907F\u5751" }
    ]
  },
  {
    id: "fashion",
    name: "\u65F6\u5C1A\u7A7F\u642D",
    values: ["\u65F6\u5C1A\u7A7F\u642D", "\u670D\u88C5\u914D\u9970"],
    keywords: /服装|女装|男装|穿搭|饰品|鞋包/,
    items: [
      { id: "fashion-fake", kind: "say", text: "\u5927\u724C\u540C\u6B3E\u3001\u539F\u5355\u3001\u5C3E\u5355\uFF08\u6D89\u5ACC\u4EFF\u5192\uFF09", why: "\u77E5\u8BC6\u4EA7\u6743", words: "\u5927\u724C\u540C\u6B3E|\u539F\u5355|\u5C3E\u5355|\u9AD8\u4EFF|1:1" },
      { id: "fashion-exaggerate", kind: "say", text: "\u663E\u7626 20 \u65A4\u3001\u7A7F\u4E0A\u79D2\u53D8\u2026\u2026\uFF08\u5938\u5927\uFF09", why: "\u5938\u5927\u5BA3\u4F20", instead: "\u8BF4\u7248\u578B\u548C\u9002\u5408\u7684\u8EAB\u6750", words: "\u663E\u7626\\d+\u65A4" },
      { id: "fashion-expose", kind: "direction", text: "\u64E6\u8FB9\u3001\u8FC7\u5EA6\u66B4\u9732\u7684\u7A7F\u642D\u65B9\u5411", why: "\u5E73\u53F0\u9650\u6D41" }
    ]
  },
  {
    id: "digital",
    name: "\u6570\u7801\u79D1\u6280",
    values: ["\u6570\u7801\u79D1\u6280", "\u6570\u7801\u5BB6\u7535"],
    keywords: /数码|手机|电脑|家电|维修/,
    items: [
      { id: "digital-rival", kind: "say", text: "\u79D2\u6740\u6240\u6709\u3001\u540A\u6253 XX\uFF08\u70B9\u540D\u54C1\u724C\uFF09", why: "\u8D2C\u4F4E\u7ADE\u54C1", instead: "\u8BB2\u53C2\u6570\u548C\u5B9E\u6D4B", words: "\u540A\u6253|\u79D2\u6740\u6240\u6709|\u5B8C\u7206" },
      { id: "digital-crack", kind: "direction", text: "\u7834\u89E3\u3001\u5237\u673A\u7ED5\u8FC7\u9650\u5236\u3001\u7FFB\u5899", why: "\u8FDD\u89C4" }
    ]
  },
  {
    id: "local",
    name: "\u672C\u5730\u670D\u52A1 / \u63A2\u5E97",
    values: ["\u65C5\u6E38\u63A2\u5E97", "\u672C\u5730\u670D\u52A1"],
    items: [
      { id: "local-ad", kind: "say", text: "\u5FC5\u5403\u3001\u5FC5\u53BB\u3001\u4E0D\u53BB\u540E\u6094\uFF08\u5546\u4E1A\u5408\u4F5C\u6CA1\u6807\u6CE8\uFF09", why: "\u5E7F\u544A\u672A\u6807\u8BC6", instead: "\u5408\u4F5C\u5185\u5BB9\u8981\u6807\u6CE8", words: "\u5FC5\u5403|\u5FC5\u53BB|\u4E0D\u53BB\u540E\u6094|\u4E0D\u6765\u540E\u6094" },
      { id: "local-staff", kind: "shoot", text: "\u672A\u7ECF\u540C\u610F\u62CD\u5E97\u5458\u3001\u987E\u5BA2\u6B63\u8138", why: "\u9690\u79C1", instead: "\u6253\u7801\u3001\u5F81\u5F97\u540C\u610F" },
      { id: "local-fake", kind: "direction", text: "\u6536\u4E86\u94B1\u5305\u88C5\u6210\u300C\u81EA\u8D39\u771F\u5B9E\u63A2\u5E97\u300D\uFF0C\u6216\u8005\u62CD\u540C\u884C\u5E97\u94FA\u7684\u5DEE\u8BC4\u3001\u66DD\u5149", why: "\u865A\u5047\u5BA3\u4F20\u3001\u4E0D\u6B63\u5F53\u7ADE\u4E89" }
    ]
  },
  {
    id: "emotion",
    name: "\u60C5\u611F\u751F\u6D3B",
    values: ["\u60C5\u611F\u751F\u6D3B"],
    items: [
      { id: "emo-pua", kind: "direction", text: "\u6559\u4EBA\u51FA\u8F68\u3001PUA \u8BDD\u672F\u3001\u64CD\u63A7\u5BF9\u65B9", why: "\u8FDD\u80CC\u516C\u5E8F\u826F\u4FD7" },
      { id: "emo-sexy", kind: "direction", text: "\u6027\u6697\u793A\u3001\u64E6\u8FB9", why: "\u5E73\u53F0\u7EA2\u7EBF" }
    ]
  },
  {
    id: "health-food",
    name: "\u4FDD\u5065\u54C1",
    values: [],
    keywords: /保健品|营养品|滋补|燕窝|阿胶|蛋白粉|益生菌/,
    items: [
      { id: "hf-cure", kind: "direction", text: "\u4FDD\u5065\u54C1\u80FD\u6CBB\u75C5\u3001\u66FF\u4EE3\u836F\u7269", why: "\u4FDD\u5065\u98DF\u54C1\u4E0D\u80FD\u5BA3\u79F0\u7597\u6548", words: "\u6CBB\u7597|\u6CBB\u6108|\u66FF\u4EE3\u836F\u7269|\u836F\u5230\u75C5\u9664|\u5305\u597D" },
      { id: "hf-old", kind: "direction", text: '\u9488\u5BF9\u8001\u4EBA\u7684"\u5305\u6CBB\u767E\u75C5"\u3001\u4F1A\u8BAE\u8425\u9500\u5F0F\u8BDD\u672F', why: "\u91CD\u70B9\u6253\u51FB\u5BF9\u8C61" }
    ]
  },
  {
    id: "finance",
    name: "\u91D1\u878D\u7406\u8D22",
    values: [],
    keywords: /理财|保险|贷款|基金|股票|信用卡|投资/,
    items: [
      { id: "fin-promise", kind: "say", text: "\u4FDD\u672C\u3001\u7A33\u8D5A\u3001\u9AD8\u6536\u76CA\u65E0\u98CE\u9669\u3001\u5E74\u5316 X% \u4FDD\u8BC1", why: "\u91D1\u878D\u5E7F\u544A\u7EA2\u7EBF", words: "\u4FDD\u672C|\u7A33\u8D5A|\u7A33\u8D5A\u4E0D\u8D54|\u65E0\u98CE\u9669|\u4FDD\u8BC1\u6536\u76CA|\u96F6\u98CE\u9669" },
      { id: "fin-loan", kind: "direction", text: '\u8BF1\u5BFC\u501F\u8D37\u3001"\u79D2\u6279""\u4E0D\u770B\u5F81\u4FE1"', why: "\u8FDD\u89C4", words: "\u79D2\u6279|\u4E0D\u770B\u5F81\u4FE1|\u9ED1\u6237\u53EF\u8D37" }
    ]
  },
  {
    id: "alcohol",
    name: "\u9152\u7C7B",
    values: [],
    keywords: /白酒|啤酒|红酒|酒馆|酒吧|精酿|酒坊/,
    items: [
      { id: "alc-drink", kind: "direction", text: "\u529D\u9152\u3001\u62FC\u9152\u3001\u559D\u9189\u3001\u672A\u6210\u5E74\u4EBA\u559D\u9152", why: "\u5E73\u53F0\u9650\u5236\u996E\u9152\u5185\u5BB9" },
      { id: "alc-health", kind: "say", text: "\u559D\u9152\u517B\u751F\u3001\u89E3\u4E4F\u3001\u52A9\u7720", why: "\u9152\u7C7B\u4E0D\u80FD\u5BA3\u4F20\u5065\u5EB7\u529F\u6548", words: "\u559D\u9152\u517B\u751F|\u517B\u751F\u9152|(?:\u52A9\u7720|\u89E3\u4E4F)(?:\u795E\u5668)?" }
    ]
  },
  {
    id: "pet",
    name: "\u5BA0\u7269",
    values: [],
    keywords: /宠物|猫粮|狗粮|猫咖|萌宠|铲屎|宠物店|犬舍|猫舍/,
    items: [
      { id: "pet-abuse", kind: "direction", text: "\u6574\u86CA\u3001\u5413\u552C\u3001\u8650\u5F85\u5BA0\u7269\u6765\u535A\u6D41\u91CF", why: "\u5E73\u53F0\u7EA2\u7EBF" },
      { id: "pet-cure", kind: "say", text: "\u5BA0\u7269\u7528\u54C1\u3001\u98DF\u54C1\u8BF4\u80FD\u6CBB\u75C5", why: "\u529F\u6548\u5BA3\u79F0", words: "\u6CBB(?:\u597D|\u6108)(?:\u732B|\u72D7)?(?:\u7663|\u75C5)" }
    ]
  },
  {
    id: "car",
    name: "\u6C7D\u8F66",
    values: [],
    keywords: /汽车|汽修|4S|二手车|车行|洗车|改装/,
    items: [
      { id: "car-danger", kind: "shoot", text: "\u5371\u9669\u9A7E\u9A76\u3001\u8D85\u901F\u3001\u4E0D\u7CFB\u5B89\u5168\u5E26\u3001\u8FB9\u5F00\u8FB9\u62CD", why: "\u5B89\u5168\u3001\u8FDD\u6CD5" },
      { id: "car-mod", kind: "direction", text: "\u8FDD\u89C4\u6539\u88C5\u6559\u7A0B\uFF08\u62C6\u4E09\u5143\u3001\u6539\u6392\u6C14\u70B8\u8857\uFF09", why: "\u8FDD\u6CD5" },
      { id: "car-used", kind: "say", text: '\u4E8C\u624B\u8F66"\u65E0\u4E8B\u6545""\u51C6\u65B0\u8F66"\uFF08\u6CA1\u6709\u68C0\u6D4B\u4F9D\u636E\uFF09', why: "\u865A\u5047\u5BA3\u4F20", words: "\u65E0\u4E8B\u6545|\u96F6\u4E8B\u6545|\u51C6\u65B0\u8F66" }
    ]
  },
  {
    id: "house",
    name: "\u623F\u4EA7",
    values: [],
    keywords: /房产|楼盘|中介|租房|二手房|置业/,
    items: [
      { id: "house-promise", kind: "say", text: '\u5347\u503C\u4FDD\u8BC1\u3001\u5B66\u533A\u627F\u8BFA\u3001"\u4E70\u5230\u5C31\u662F\u8D5A\u5230"', why: "\u623F\u5730\u4EA7\u5E7F\u544A\u4E0D\u80FD\u627F\u8BFA\u5347\u503C\u3001\u5B66\u533A", words: "(?:\u4FDD\u8BC1|\u7A33)\u5347\u503C|\u4E70\u5230\u5C31\u662F\u8D5A\u5230|\u5B66\u533A(?:\u623F)?\u4FDD\u8BC1|\u5305\u5B66\u4F4D" },
      { id: "house-panic", kind: "direction", text: '\u5236\u9020\u6050\u614C\uFF1A"\u518D\u4E0D\u4E70\u5C31\u4E70\u4E0D\u8D77\u4E86"', why: "\u8FDD\u89C4\u7092\u4F5C", words: "\u518D\u4E0D\u4E70\u5C31(?:\u4E70\u4E0D\u8D77|\u6CA1\u4E86)" }
    ]
  }
];
function readTabooSettings2(v) {
  const o = v && typeof v === "object" ? v : {};
  const list = (x) => Array.isArray(x) ? x.filter((s) => typeof s === "string" && Boolean(s.trim())).map((s) => s.trim()) : [];
  return { disabled: list(o.disabled), extra: list(o.extra), added: list(o.added).filter((id) => INDUSTRIES2.some((i) => i.id === id)), excluded: list(o.excluded) };
}
var asList4 = (v) => Array.isArray(v) ? v.filter((x) => typeof x === "string") : typeof v === "string" ? v.split(/[、,，]/).map((x) => x.trim()).filter(Boolean) : [];
function industriesOf2(profile2) {
  const p = profile2 ?? {};
  const values = [...asList4(p.account_track), ...asList4(p.product_category)];
  const text5 = [p.profile_name, ...values, p.content_themes].filter((x) => typeof x === "string").join(" ");
  const added = readTabooSettings2(p.taboo_settings).added;
  return INDUSTRIES2.filter((ind) => added.includes(ind.id) || ind.values.some((v) => values.includes(v)) || (ind.keywords ? ind.keywords.test(text5) : false));
}
function activeTaboos2(profile2) {
  const s = readTabooSettings2(profile2?.taboo_settings);
  const off = new Set(s.disabled);
  return {
    platform: PLATFORM_TABOOS2.filter((t) => !(t.closable && off.has(t.id))),
    industries: industriesOf2(profile2).map((industry) => ({ industry, items: industry.items.filter((t) => !off.has(t.id)) })).filter((x) => x.items.length > 0),
    extra: s.extra
  };
}
function taboosPromptBlock2(profile2) {
  const a = activeTaboos2(profile2);
  const all = [...a.platform, ...a.industries.flatMap((x) => x.items)];
  const fmt = (t) => `- ${t.text}${t.instead ? `\uFF08\u6362\u6210\uFF1A${t.instead}\uFF09` : ""}`;
  const dirs = all.filter((t) => t.kind === "direction");
  const says = all.filter((t) => t.kind !== "direction");
  const names = a.industries.map((x) => x.industry.name).join("\u3001");
  const parts = [
    `#### \u{1F6AB} \u4E0D\u80FD\u62CD\u7684\u65B9\u5411${names ? `\uFF08\u5E73\u53F0\u7EA2\u7EBF + ${names}\u884C\u4E1A\uFF09` : "\uFF08\u5E73\u53F0\u7EA2\u7EBF\uFF09"}\u2014\u2014\u9009\u9898\u3001\u65B9\u5411\u3001\u793A\u4F8B\u4E00\u5F8B\u907F\u5F00`,
    ...dirs.map(fmt),
    "",
    "#### \u{1F6AB} \u4E0D\u80FD\u8BF4\u7684\u8BDD / \u4E0D\u80FD\u62CD\u7684\u753B\u9762",
    ...says.map(fmt)
  ];
  if (a.extra.length) parts.push("", "#### \u{1F6AB} \u8FD9\u4E2A\u53F7\u81EA\u5DF1\u8865\u5145\u7684", ...a.extra.map((x) => `- ${x}`));
  const excluded = readTabooSettings2(profile2?.taboo_settings).excluded;
  if (excluded.length) {
    parts.push(
      "",
      "#### \u{1F648} \u5EFA\u6863\u65F6\u7F16\u5BFC\u523B\u610F\u53BB\u6389\u7684\u4FE1\u606F\u2014\u2014\u5F53\u5B83\u4E0D\u5B58\u5728",
      ...excluded.map((x) => `- ${x}`),
      '\u8FD9\u4E9B\u662F\u524D\u91C7\u5F55\u97F3\u91CC\u6709\u3001\u4F46\u7F16\u5BFC\u5224\u65AD**\u6CA1\u7528\u6216\u4E0D\u60F3\u8981**\u7684\uFF1A\u4E0D\u5F15\u7528\u3001\u4E0D\u5F53\u4F9D\u636E\u3001\u4E0D\u636E\u6B64\u63A8\u65AD\u65B9\u5411\u548C\u4EBA\u8BBE\uFF0C\u4E5F\u4E0D\u8981\u63D0"\u867D\u7136\u4F60\u6709\xD7\xD7"\uFF1B',
      "\u6863\u6848\u5176\u4ED6\u680F\u3001\u5DF2\u6709\u7684\u5B9A\u4F4D\u6216\u7B80\u62A5\u91CC\u5982\u679C\u8FD8\u6B8B\u7559\u76F8\u5173\u8BF4\u6CD5\uFF0C**\u540C\u6837\u5FFD\u7565**\u3002"
    );
  }
  return parts.join("\n");
}

// .tmp/content-audit-production_20261008/lib/profile-fields.ts
var PROFILE_CHOICES2 = {
  account_platform: ["\u6296\u97F3", "\u5FEB\u624B", "\u89C6\u9891\u53F7", "\u5C0F\u7EA2\u4E66", "B\u7AD9"],
  account_track: ["\u7F8E\u98DF\u70F9\u996A", "\u65F6\u5C1A\u7A7F\u642D", "\u7F8E\u5986\u62A4\u80A4", "\u5065\u8EAB\u8FD0\u52A8", "\u77E5\u8BC6\u6559\u80B2", "\u804C\u573A\u6210\u957F", "\u60C5\u611F\u751F\u6D3B", "\u65C5\u6E38\u63A2\u5E97", "\u5BB6\u5C45\u88C5\u4FEE", "\u6BCD\u5A74\u80B2\u513F", "\u6570\u7801\u79D1\u6280", "\u672C\u5730\u670D\u52A1"],
  account_stage: ["\u521A\u8D77\u53F7\uFF0C\u5B9A\u4F4D\u672A\u786E\u5B9A", "\u6709\u5B9A\u4F4D\uFF0C\u9700\u8981\u5185\u5BB9\u65B9\u5411", "\u7A33\u5B9A\u8FD0\u8425\uFF0C\u9700\u8981\u65B0\u9009\u9898", "\u6210\u719F\u671F\uFF0C\u9700\u8981\u7A81\u7834"],
  fans_level: ["0-1\u4E07", "1-5\u4E07", "5-10\u4E07", "10-50\u4E07", "50\u4E07+"],
  target_gender: ["\u7537\u6027\u4E3A\u4E3B", "\u5973\u6027\u4E3A\u4E3B", "\u4E0D\u9650"],
  target_age: ["18-24\u5C81", "25-30\u5C81", "31-40\u5C81", "41\u5C81\u4EE5\u4E0A"],
  target_region: ["\u4E00\u4E8C\u7EBF\u57CE\u5E02", "\u4E09\u56DB\u7EBF\u57CE\u5E02", "\u5168\u56FD", "\u672C\u5730\u540C\u57CE"],
  target_occupation: ["\u767D\u9886", "\u5B66\u751F", "\u5B9D\u5988", "\u81EA\u7531\u804C\u4E1A", "\u4F01\u4E1A\u4E3B", "\u84DD\u9886\u6280\u5DE5"],
  content_style: ["\u4E13\u4E1A", "\u8F7B\u677E", "\u5E7D\u9ED8", "\u60C5\u611F", "\u52B1\u5FD7", "\u5B9E\u7528", "\u9AD8\u7EA7", "\u63A5\u5730\u6C14"],
  content_format: ["\u53E3\u64AD", "\u5267\u60C5", "\u6559\u7A0B", "Vlog", "\u6D4B\u8BC4", "\u91C7\u8BBF", "\u6DF7\u526A", "\u56FE\u6587"],
  content_tone: ["\u4EB2\u5207\u670B\u53CB\u5F0F", "\u4E13\u4E1A\u6743\u5A01\u5F0F", "\u5E7D\u9ED8\u641E\u7B11\u5F0F", "\u6E29\u6696\u6CBB\u6108\u5F0F", "\u76F4\u7387\u7280\u5229\u5F0F"],
  team_structure: ["\u4E00\u4EBA\u5168\u5305", "2-3\u4EBA\u5C0F\u56E2\u961F", "\u5B8C\u6574\u56E2\u961F(\u7F16\u5BFC/\u6444\u5F71/\u526A\u8F91)", "\u4E13\u4E1AMCN"],
  equipment: ["\u624B\u673A", "\u76F8\u673A", "\u4E13\u4E1A\u6444\u50CF\u673A", "\u706F\u5149", "\u6536\u97F3\u8BBE\u5907", "\u7A33\u5B9A\u5668"],
  shooting_location: ["\u5BB6", "\u5DE5\u4F5C\u5BA4", "\u5916\u666F", "\u5E97\u94FA", "\u529E\u516C\u5BA4"],
  editing_capability: ["\u57FA\u7840\u526A\u8F91", "\u4E2D\u7EA7\u7279\u6548", "\u4E13\u4E1A\u5236\u4F5C"],
  video_duration: ["15-30\u79D2", "30-60\u79D2", "1-3\u5206\u949F", "3-5\u5206\u949F", "5\u5206\u949F\u4EE5\u4E0A"],
  budget_per_video: ["0-500\u5143", "500-2000\u5143", "2000-5000\u5143", "5000\u5143\u4EE5\u4E0A"],
  monetization_model: ["\u5230\u5E97\u6D88\u8D39", "\u5E26\u8D27\u4F63\u91D1", "\u77E5\u8BC6\u4ED8\u8D39", "\u79C1\u57DF\u5F15\u6D41", "\u76F4\u64AD\u6253\u8D4F", "\u54C1\u724C\u5408\u4F5C", "\u7EBF\u4E0B\u670D\u52A1", "\u6682\u4E0D\u8003\u8651"],
  product_category: ["\u9910\u996E", "\u7F8E\u5986\u62A4\u80A4", "\u670D\u88C5\u914D\u9970", "\u751F\u6D3B\u7528\u54C1", "\u98DF\u54C1\u996E\u6599", "\u6570\u7801\u5BB6\u7535", "\u672C\u5730\u670D\u52A1"],
  price_range: ["50\u5143\u4EE5\u4E0B", "50-200\u5143", "200-500\u5143", "500\u5143\u4EE5\u4E0A"]
};
var pickField2 = (key) => {
  const g = OPTION_GROUPS2.find((x) => x.field === key);
  if (!g) throw new Error(`profile-options \u91CC\u6CA1\u6709 ${key}`);
  return { key, label: g.label, kind: "pick", options: g.options.map((o) => o.value), allowOther: g.allowOther !== false };
};
var multi2 = (key, label3) => ({ key, label: label3, kind: "multi", options: PROFILE_CHOICES2[key] });
var single2 = (key, label3) => ({ key, label: label3, kind: "single", options: PROFILE_CHOICES2[key] });
var text3 = (key, label3) => ({ key, label: label3, kind: "text" });
var PROFILE_SECTIONS2 = [
  {
    title: "\u8D26\u53F7\u57FA\u7840",
    fields: [
      multi2("account_platform", "\u8FD0\u8425\u5E73\u53F0"),
      multi2("account_track", "\u5185\u5BB9\u8D5B\u9053"),
      single2("account_stage", "\u8D26\u53F7\u9636\u6BB5"),
      single2("fans_level", "\u7C89\u4E1D\u91CF\u7EA7")
    ]
  },
  {
    title: "\u76EE\u6807\u53D7\u4F17",
    fields: [
      single2("target_gender", "\u4E3B\u8981\u6027\u522B"),
      multi2("target_age", "\u5E74\u9F84\u6BB5"),
      multi2("target_region", "\u5730\u57DF\u5206\u5E03"),
      multi2("target_occupation", "\u804C\u4E1A\u6807\u7B7E"),
      { key: "target_interests", label: "\u76EE\u6807\u4EBA\u7FA4\u7684\u5174\u8DA3", kind: "multi" },
      pickField2("target_pain_points"),
      pickField2("target_needs"),
      pickField2("fan_common_questions")
    ]
  },
  {
    title: "\u5185\u5BB9\u5B9A\u4F4D",
    fields: [
      multi2("content_style", "\u5185\u5BB9\u98CE\u683C"),
      multi2("content_format", "\u5185\u5BB9\u5F62\u5F0F"),
      single2("content_tone", "\u8BED\u8A00\u98CE\u683C"),
      text3("content_themes", "\u4E3B\u8981\u9009\u9898\u65B9\u5411"),
      pickField2("content_value"),
      pickField2("unique_selling_point"),
      pickField2("viral_content_pattern"),
      pickField2("content_restrictions")
    ]
  },
  {
    title: "\u7ADE\u4E89\u7B56\u7565",
    fields: [
      text3("reference_accounts", "\u5BF9\u6807\u8D26\u53F7"),
      text3("competitive_advantage", "\u7ADE\u4E89\u4F18\u52BF"),
      pickField2("competitive_weakness"),
      pickField2("unique_resources")
    ]
  },
  {
    title: "\u8D44\u6E90\u914D\u7F6E",
    fields: [
      single2("team_structure", "\u56E2\u961F\u914D\u7F6E"),
      multi2("equipment", "\u8BBE\u5907\u6761\u4EF6"),
      multi2("shooting_location", "\u62CD\u6444\u573A\u5730"),
      single2("editing_capability", "\u540E\u671F\u80FD\u529B"),
      multi2("video_duration", "\u89C6\u9891\u65F6\u957F\u504F\u597D"),
      single2("budget_per_video", "\u5355\u6761\u9884\u7B97")
    ]
  },
  {
    title: "\u53D8\u73B0\u8DEF\u5F84",
    fields: [
      multi2("monetization_model", "\u53D8\u73B0\u65B9\u5F0F"),
      multi2("product_category", "\u4EA7\u54C1\u54C1\u7C7B"),
      multi2("price_range", "\u4EF7\u683C\u533A\u95F4"),
      pickField2("conversion_path"),
      pickField2("conversion_barriers")
    ]
  }
];
var PROFILE_FIELDS2 = PROFILE_SECTIONS2.flatMap((s) => s.fields);

// .tmp/content-audit-production_20261008/lib/interview-exclusions.ts
var LABEL2 = new Map(PROFILE_FIELDS2.map((f) => [f.key, f.label]));
var LABELS2 = new Set(PROFILE_FIELDS2.map((f) => f.label));
var KIND2 = new Map(PROFILE_FIELDS2.map((f) => [f.key, f.kind]));
function segmentsOf2(text5) {
  const out = [];
  let depth = 0;
  let cur = "";
  for (const ch of text5) {
    if ("\uFF08(\u3010\u300C".includes(ch)) depth++;
    if ("\uFF09)\u3011\u300D".includes(ch)) depth = Math.max(0, depth - 1);
    if (depth === 0 && "\u3001\uFF0C,\uFF1B;\n".includes(ch)) {
      if (cur.trim()) out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
function grams2(text5, n = 3) {
  const s = /* @__PURE__ */ new Set();
  for (const run2 of text5.match(/[\p{Script=Han}A-Za-z0-9]+/gu) ?? []) {
    for (let i = 0; i + n <= run2.length; i++) {
      const g = run2.slice(i, i + n);
      if ((g.match(/\p{Script=Han}/gu) ?? []).length >= 2) s.add(g);
    }
  }
  return s;
}
function exclusionGrams2(excluded, stopText) {
  const stop = grams2(stopText);
  return excluded.map((e) => {
    const m = e.match(/^([^：]{1,16})：/);
    const body = m && (m[1].endsWith("\u91CC\u7684") || LABELS2.has(m[1])) ? e.slice(m[0].length) : e;
    const needles = /* @__PURE__ */ new Set();
    for (const piece of segmentsOf2(body)) {
      const core = piece.replace(/^(?:不要|不提|不做|不拍|不说|别提|别拍|别)/, "").replace(/(?:相关的事|相关的|相关|的事|内容|这类)$/, "").trim();
      const han = (core.match(/\p{Script=Han}/gu) ?? []).length;
      if (han >= 2 && core.length <= 6) needles.add(core);
      for (const g of grams2(core)) needles.add(g);
    }
    return [...needles].filter((x) => !stop.has(x));
  });
}
function hitsExclusion2(segment, ex) {
  for (const list of ex) {
    const hit = list.find((x) => segment.includes(x));
    if (hit) return hit;
  }
  return void 0;
}
var UNTOUCHED2 = /* @__PURE__ */ new Set(["id", "user_id", "profile_name", "taboo_settings", "content_mix", "persona_facts", "interview_notes", "created_at", "updated_at", "content_restrictions", "avoid_content"]);
function scrubProfile2(profile2, excluded) {
  if (!profile2 || excluded.length === 0) return profile2;
  const p = profile2;
  const ex = exclusionGrams2(excluded, String(p.profile_name ?? ""));
  const out = { ...p };
  for (const [k, v] of Object.entries(p)) {
    if (UNTOUCHED2.has(k)) continue;
    if (Array.isArray(v)) out[k] = v.filter((x) => typeof x !== "string" || !hitsExclusion2(x, ex));
    else if (typeof v === "string" && v.trim()) {
      const parts = k === "interview_highlights" ? v.split("\n") : segmentsOf2(v);
      const kept = parts.filter((s) => !hitsExclusion2(s, ex));
      if (kept.length !== parts.length) out[k] = kept.join(k === "interview_highlights" ? "\n" : "\u3001");
    }
  }
  return out;
}

// .tmp/content-audit-production_20261008/lib/persona-facts.ts
var PERSONA_FIELDS2 = [
  { key: "host", label: "\u51FA\u955C\u4EBA\u662F\u8C01", placeholder: "\u4F8B\u5982\uFF1A\u4E3B\u53A8\u8001\u738B\u3001\u8001\u677F\u5A18\u5C0F\u82B3" },
  { key: "role", label: "\u548C\u5E97\u7684\u5173\u7CFB", placeholder: "\u4F8B\u5982\uFF1A\u8001\u677F / \u4E3B\u53A8 / \u5E97\u5458 / \u7F16\u5BFC\u672C\u4EBA" },
  { key: "origin", label: "\u4ECE\u54EA\u6765", placeholder: "\u4F8B\u5982\uFF1A\u6210\u90FD\u4EBA" },
  { key: "yearsInTrade", label: "\u5E72\u8FD9\u884C\u51E0\u5E74", placeholder: "\u4F8B\u5982\uFF1A\u505A\u5DDD\u83DC 9 \u5E74" },
  { key: "yearsLocal", label: "\u5728\u672C\u5730\u591A\u4E45", placeholder: "\u4F8B\u5982\uFF1A\u6765\u5357\u4E50\u534A\u5E74" },
  { key: "mainProducts", label: "\u4E3B\u5356\u4EC0\u4E48", placeholder: "\u4F8B\u5982\uFF1A\u5DDD\u5473\u4E32\u4E32\u706B\u9505\u3001\u5DDD\u5473\u70E7\u70E4\u3001\u5DDD\u83DC" },
  { key: "signature", label: "\u62DB\u724C / \u7279\u8272", placeholder: "\u4F8B\u5982\uFF1A\u4E00\u5143\u706B\u9505" },
  { key: "story", label: "\u4E00\u53E5\u8BDD\u7ECF\u5386", placeholder: "\u4F8B\u5982\uFF1A\u5728\u6210\u90FD\u505A\u4E86 9 \u5E74\u5DDD\u83DC\uFF0C\u4ECA\u5E74\u6765\u5357\u4E50\u8DDF\u670B\u53CB\u5408\u4F19\u6446\u5730\u644A", multiline: true },
  { key: "others", label: "\u5176\u4ED6\u786C\u4E8B\u5B9E\uFF08\u4E00\u884C\u4E00\u6761\uFF09", placeholder: "\u4F8B\u5982\uFF1A\n\u6BCF\u5929\u4E0B\u5348 4 \u70B9\u51FA\u644A\n\u4EBA\u5747 30-50 \u5143", multiline: true }
];
var KEYS2 = PERSONA_FIELDS2.map((f) => f.key);
function readPersonaFacts2(v) {
  const o = v && typeof v === "object" ? v : {};
  const out = {};
  for (const k of KEYS2) {
    const s = typeof o[k] === "string" ? o[k].trim().slice(0, k === "others" || k === "story" ? 600 : 120) : "";
    if (s) out[k] = s;
  }
  return out;
}
function personaFactsBlock2(v) {
  const f = readPersonaFacts2(v);
  const rows = PERSONA_FIELDS2.filter((x) => f[x.key]).map((x) => {
    const val = f[x.key];
    return x.key === "others" ? `- **${x.label.replace(/（.*）/, "")}**\uFF1A
${val.split("\n").map((l) => `  - ${l.trim()}`).filter((l) => l.trim() !== "-").join("\n")}` : `- **${x.label}**\uFF1A${val}`;
  });
  if (rows.length === 0) return "";
  return [
    "### \u{1FAAA} \u4EBA\u8BBE\u4E8B\u5B9E\u5361\uFF08\u6700\u786C\u7684\u4E8B\u5B9E\uFF0C\u4EE5\u5B83\u4E3A\u51C6\uFF09",
    "",
    ...rows,
    "",
    "\u8FD9\u662F\u7F16\u5BFC\u786E\u8BA4\u8FC7\u7684\u4E8B\u5B9E\uFF1A**\u548C\u6863\u6848\u5176\u4ED6\u680F\u3001\u524D\u91C7\u8981\u70B9\u3001\u5DF2\u6709\u7684\u5B9A\u4F4D\u6216\u7B80\u62A5\u5BF9\u4E0D\u4E0A\u65F6\uFF0C\u4E00\u5F8B\u4EE5\u8FD9\u91CC\u4E3A\u51C6**\uFF1B",
    "\u5199\u4EBA\u8BBE\u3001\u7ECF\u5386\u3001\u5E74\u9650\u3001\u7C4D\u8D2F\u3001\u5728\u5356\u4EC0\u4E48\u65F6\u53EA\u7528\u8FD9\u91CC\u7684\u8BF4\u6CD5\uFF0C\u4E0D\u6539\u5199\u3001\u4E0D\u5938\u5927\uFF1B\u8FD9\u91CC\u6CA1\u5199\u7684\u7ECF\u5386\u548C\u6570\u5B57\u4E0D\u8981\u81EA\u5DF1\u7F16\uFF08\u7528 X \u6216\u3010\u6362\u6210\u4F60\u7684\uFF1A\u2026\u2026\u3011\uFF09\u3002"
  ].join("\n");
}

// .tmp/content-audit-production_20261008/lib/performance.ts
var METRIC_FIELDS2 = [
  { key: "views", label: "\u64AD\u653E", max: 1e9 },
  { key: "completion", label: "\u5B8C\u64AD\u7387", unit: "%", max: 100 },
  { key: "likes", label: "\u70B9\u8D5E", max: 1e8 },
  { key: "comments", label: "\u8BC4\u8BBA", max: 1e8 },
  { key: "shares", label: "\u8F6C\u53D1", max: 1e8 },
  { key: "follows", label: "\u6DA8\u7C89", max: 1e8 },
  { key: "inquiries", label: "\u54A8\u8BE2", max: 1e7 },
  { key: "deals", label: "\u6210\u4EA4", max: 1e7 },
  { key: "retention3s", label: "\u4E09\u79D2\u7559\u5B58\u7387", unit: "%", max: 100 },
  { key: "observationHours", label: "\u53D1\u5E03\u540E\u89C2\u5BDF\u65F6\u957F", unit: "\u5C0F\u65F6", max: 8760 }
];
function metricsLine2(m) {
  if (!m) return "";
  const fmt = (n) => n >= 1e4 ? `${(n / 1e4).toFixed(n >= 1e5 ? 1 : 2).replace(/\.?0+$/, "")}\u4E07` : String(n);
  return METRIC_FIELDS2.filter((f) => typeof m[f.key] === "number").map((f) => `${f.label} ${f.unit ? m[f.key] : fmt(m[f.key])}${f.unit ?? ""}`).join(" \xB7 ");
}
var MIN_SAMPLE2 = 3;
function performancePromptBlock2(s) {
  if (!s || s.count === 0) return "";
  const g = (x) => `- ${x.name}\uFF08${x.n} \u6761\uFF09\uFF1A\u5E73\u5747\u64AD\u653E ${x.avgViews === null ? "\u2014" : Math.round(x.avgViews)}${x.avgCompletion === null ? "" : `\u3001\u5B8C\u64AD ${Math.round(x.avgCompletion)}%`}${x.follows ? `\u3001\u6DA8\u7C89 ${x.follows}` : ""}${x.inquiries ? `\u3001\u54A8\u8BE2 ${x.inquiries}` : ""}${x.deals ? `\u3001\u6210\u4EA4 ${x.deals}` : ""}${x.rates?.inquiries === void 0 ? "" : `\u3001\u6BCF\u5343\u64AD\u653E\u54A8\u8BE2 ${x.rates.inquiries}`}${x.rates?.follows === void 0 ? "" : `\u3001\u6BCF\u5343\u64AD\u653E\u6DA8\u7C89 ${x.rates.follows}`}${x.rates?.deals === void 0 ? "" : `\u3001\u6BCF\u5343\u64AD\u653E\u6210\u4EA4 ${x.rates.deals}`}`;
  const parts = [`### \u{1F4C8} \u8FD9\u4E2A\u53F7\u53D1\u51FA\u53BB\u7684\u771F\u5B9E\u6570\u636E\uFF08${s.count} \u6761\u5F55\u4E86\u6570\u636E\uFF09`, ""];
  if (s.byPurpose.length) parts.push("\u6309\u4E09\u79CD\u89C6\u9891\uFF1A", ...s.byPurpose.map(g), "");
  if (s.byTactic.length) parts.push("\u6309\u62CD\u6CD5\uFF1A", ...s.byTactic.slice(0, 6).map(g), "");
  if (s.byCohort?.length) parts.push("\u540C\u76EE\u7684\u3001\u540C\u5E73\u53F0\u3001\u76F8\u8FD1\u89C2\u5BDF\u65F6\u95F4\u3001\u540C\u6295\u653E\u60C5\u51B5\uFF1A", ...s.byCohort.slice(0, 8).map(g), "\u542B\u6295\u653E\u7684\u7D20\u6750\u8FD8\u9700\u8003\u8651\u6295\u653E\u91D1\u989D\u548C\u4EBA\u7FA4\u5DEE\u5F02\u3002", "");
  if (s.comparisonScope) parts.push(`\u4EE5\u4E0B\u6392\u5E8F\u53EA\u53C2\u8003\u300C${s.comparisonScope}\u300D\uFF0C\u4E0D\u662F\u5168\u8D26\u53F7\u6392\u540D\uFF0C\u4E5F\u4E0D\u662F\u5DF2\u9A8C\u8BC1\u7ED3\u8BBA\u3002`);
  if (s.best.length) parts.push(`\u672C\u7EC4\u8F83\u9AD8\u53C2\u8003\u9879\uFF1A${s.best.map((r) => `\u300C${r.title}\u300D\uFF08${metricsLine2(r.metrics)}\uFF09`).join("\uFF1B")}`);
  if (s.worst.length) parts.push(`\u672C\u7EC4\u5F85\u590D\u76D8\u9879\uFF1A${s.worst.map((r) => `\u300C${r.title}\u300D\uFF08${metricsLine2(r.metrics)}\uFF09`).join("\uFF1B")}`);
  if (s.insights.length) parts.push("", ...s.insights.map((x) => `- ${x}`));
  parts.push(
    "",
    s.count < MIN_SAMPLE2 ? "\u26A0\uFE0F \u6837\u672C\u8FD8\u5C11\uFF0C\u4E0A\u9762\u53EA\u5F53\u53C2\u8003\uFF0C\u4E0D\u8981\u636E\u6B64\u4E0B\u7ED3\u8BBA\u6216\u63A8\u7FFB\u5B9A\u4F4D\u3002" : "\u6309\u521B\u4F5C\u76EE\u6807\u63D0\u51FA\u4E0B\u4E00\u8F6E\u5BF9\u7167\u8BD5\u9A8C\uFF0C\u4E0D\u56E0\u64AD\u653E\u4F4E\u5C31\u653E\u5F03\u6709\u54A8\u8BE2\u7684\u4F5C\u54C1\uFF0C\u4E0D\u628A\u76F8\u5173\u6027\u5199\u6210\u56E0\u679C\u6216\u5DF2\u9A8C\u8BC1\u6709\u6548\u3002\u6BCF\u5343\u64AD\u653E\u6307\u6807\u7528\u4E8E\u7EDF\u4E00\u5206\u6BCD\uFF0C\u7F3A\u5931\u9879\u4E0D\u7B49\u4E8E\u96F6\u3002\u6CA1\u6709\u4E09\u79D2\u7559\u5B58\u6570\u636E\uFF0C\u4E0D\u80FD\u65AD\u8A00\u5F00\u5934\u6CA1\u7559\u4F4F\u4EBA\u3002"
  );
  return parts.join("\n");
}

// .tmp/content-audit-production_20261008/lib/creator-presets.ts
var PRESET_BOARDS2 = /* @__PURE__ */ new Set(["script", "review", "title", "growth", "remix", "storyboard", "freeChat"]);
var EXAMPLE_IN_PROMPT2 = 600;
function presetPromptBlock2(p) {
  if (!p) return "";
  const lines = [`## \u270D\uFE0F \u8FD9\u4E2A\u8D26\u53F7\u8BA4\u53EF\u7684\u5199\u6CD5\uFF08\u98CE\u683C\u9884\u8BBE\uFF1A${p.name}\uFF09`, ""];
  if (p.style) lines.push(`- **\u8868\u8FBE\u98CE\u683C**\uFF1A${p.style}`);
  if (p.structure) lines.push(`- **\u7ED3\u6784**\uFF1A${p.structure}`);
  if (p.examples.length) {
    lines.push("", "\u4E0B\u9762\u662F\u7528\u6237\u8BA4\u53EF\u7684\u597D\u7A3F\uFF0C**\u53EA\u5B66\u8BED\u6C14\u3001\u8282\u594F\u548C\u7ED3\u6784**\uFF1A");
    p.examples.forEach((e, i) => {
      const body = e.content.length > EXAMPLE_IN_PROMPT2 ? `${e.content.slice(0, EXAMPLE_IN_PROMPT2)}\u2026` : e.content;
      lines.push("", `### \u793A\u4F8B${i + 1}\uFF1A${e.title}`, body);
    });
  }
  lines.push("", "\u26A0\uFE0F \u793A\u4F8B\u91CC\u7684\u5E97\u540D\u3001\u4EF7\u683C\u3001\u6570\u5B57\u3001\u7ECF\u5386\u3001\u5730\u70B9**\u4E0D\u80FD\u642C\u8FDB\u65B0\u7A3F**\uFF1B\u4E8B\u5B9E\u4EE5\u4E0A\u9762\u7684\u8D26\u53F7\u80CC\u666F\u548C\u8FD9\u6B21\u7684\u7D20\u6750\u4E3A\u51C6\u3002\u98CE\u683C\u9884\u8BBE\u548C\u672C\u6B21\u8981\u6C42\u51B2\u7A81\u65F6\uFF0C\u4EE5\u672C\u6B21\u8981\u6C42\u4E3A\u51C6\u3002");
  return lines.join("\n");
}

// .tmp/content-audit-production_20261008/lib/preferences.ts
var PREFERENCE_CATEGORIES2 = [
  { id: "tone", label: "\u53E3\u543B\u7528\u8BCD" },
  { id: "opening", label: "\u5F00\u5934\u4E60\u60EF" },
  { id: "structure", label: "\u7ED3\u6784\u4E0E\u957F\u5EA6" },
  { id: "content", label: "\u5185\u5BB9\u53D6\u5411" }
];
var CATEGORY_IDS2 = new Set(PREFERENCE_CATEGORIES2.map((c) => c.id));
var PROMPT_MAX2 = 600;
var PREFERENCE_BOARDS2 = /* @__PURE__ */ new Set(["topic", "script", "storyboard", "review", "title", "growth", "remix", "freeChat"]);
function preferencePromptBlock2(items) {
  const active = (items ?? []).filter((i) => i.status === "active");
  if (!active.length) return "";
  const lines = [];
  let len = 0;
  for (const c of PREFERENCE_CATEGORIES2) {
    for (const i of active.filter((x) => x.category === c.id)) {
      const line3 = `- ${c.label}\uFF1A${i.text}`;
      if (len + line3.length > PROMPT_MAX2) break;
      lines.push(line3);
      len += line3.length;
    }
  }
  return [
    `## \u{1F9E0} \u8FD9\u4E2A\u53F7\u7684\u521B\u4F5C\u504F\u597D\uFF08\u4ECE\u4ED6\u7684\u4FEE\u6539\u3001\u6536\u85CF\u548C\u53D1\u5E03\u91CC\u5B66\u5230\u7684\uFF0C\u4ED6\u770B\u8FC7\u3001\u53EF\u4EE5\u6539\uFF09`,
    "",
    ...lines,
    "",
    "\u26A0\uFE0F \u8FD9\u4E9B\u662F\u5199\u6CD5\u4E60\u60EF\uFF0C\u7167\u7740\u5199\uFF1B\u548C\u4E0A\u9762\u7684\u4EBA\u8BBE\u4E8B\u5B9E\u5361\u3001\u7981\u5FCC\u3001\u8D26\u53F7\u6863\u6848\u3001\u98CE\u683C\u9884\u8BBE\u6216\u8FD9\u6B21\u7684\u8981\u6C42\u51B2\u7A81\u65F6\uFF0C\u4EE5\u5B83\u4EEC\u4E3A\u51C6\u3002"
  ].join("\n");
}

// .tmp/content-audit-production_20261008/lib/output-rules.ts
var PRIORITY_ORDER2 = "\u4E8B\u5B9E\u4E0E\u5B89\u5168\u8FB9\u754C\uFF08\u4EBA\u8BBE\u4E8B\u5B9E\u5361\u3001\u7981\u5FCC\u3001\u5E73\u53F0\u89C4\u5219\uFF09 > \u7528\u6237\u8FD9\u6B21\u7684\u660E\u786E\u8981\u6C42 > \u8FD9\u6761\u5185\u5BB9\u7684\u521B\u4F5C\u76EE\u7684 > \u6A21\u677F\u548C\u6807\u51C6";
var OUTPUT_RULE_BOARDS2 = /* @__PURE__ */ new Set(["topic", "script", "storyboard", "review", "title", "growth", "remix", "freeChat", "direction"]);
var FACT_RULES2 = [
  "\u4EF7\u683C\u3001\u767E\u5206\u6BD4\u3001\u9500\u91CF\u3001\u5E74\u9650\u3001\u5206\u5E97\u6570\u3001\u83B7\u5956\u3001\u987E\u5BA2\u7ECF\u5386\u2014\u2014\u8D44\u6599\u91CC\u6CA1\u6709\u7684\u4E00\u5F8B\u4E0D\u5199\uFF1B\u9700\u8981\u5177\u4F53\u611F\u65F6\uFF0C\u7528\u4E0D\u5E26\u6570\u5B57\u7684\u8BF4\u6CD5\uFF08\u300C90% \u7684\u4EBA\u300D\u4E0D\u884C\uFF0C\u300C\u4E0D\u5C11\u4EBA\u300D\u53EF\u4EE5\uFF1B\u300C\u4EBA\u5747 68 \u5143\u300D\u4E0D\u884C\uFF0C\u300C\u4EF7\u683C\u5F88\u4EB2\u6C11\u300D\u53EF\u4EE5\uFF09\u3002",
  "\u53EF\u4EE5\u5199\u865A\u6784\u7684\u793A\u4F8B\u5E2E\u52A9\u7406\u89E3\uFF0C\u4F46\u5FC5\u987B\u6807\u3010\u793A\u4F8B\u3011\uFF0C\u4E0D\u80FD\u5199\u6210\u300C\u6709\u4F4D\u987E\u5BA2\u8BF4\u2026\u2026\u300D\u8FD9\u79CD\u771F\u5B9E\u89C1\u8BC1\u3002",
  "\u9001\u4EC0\u4E48\u3001\u5305\u4EC0\u4E48\u3001\u4FDD\u8BC1\u4EC0\u4E48\u3001\u6253\u51E0\u6298\u2014\u2014\u8001\u677F\u6CA1\u8BF4\u8FC7\u7684\u7ECF\u8425\u627F\u8BFA\u4E0D\u80FD\u66FF\u4ED6\u7B54\u5E94\u3002",
  "\u771F\u60F3\u5199\u4E00\u4E2A\u5177\u4F53\u6570\u5B57\u53C8\u6CA1\u6709\u8D44\u6599\uFF0C\u7528\u3010\u5F85\u786E\u8BA4\uFF1Axx\u3011\u5360\u4F4D\uFF0C\u8BA9\u7528\u6237\u81EA\u5DF1\u586B\u3002",
  "\u4E0D\u8981\u5199\u300C\u81EA\u68C0\u901A\u8FC7\u300D\u300C\u65E0\u7F16\u9020\u300D\u300C\u6570\u636E\u771F\u5B9E\u300D\u8FD9\u7C7B\u81EA\u6211\u8BA4\u8BC1\uFF0C\u7CFB\u7EDF\u4F1A\u5355\u72EC\u6838\u5BF9\u3002"
];
function outputRulesBlock2() {
  return ["## \u{1F9ED} \u5199\u4F5C\u5E95\u7EBF\uFF08\u6BCF\u6761\u90FD\u8981\u9075\u5B88\uFF09", "", `- **\u4F18\u5148\u7EA7**\uFF1A${PRIORITY_ORDER2}\u3002\u7528\u6237\u7684\u660E\u786E\u8981\u6C42\u54EA\u6015\u53EA\u6709\u4E00\u53E5\uFF08\u300C\u53EA\u6362\u5F00\u5934\u300D\u300C\u522B\u63D0\u4EF7\u683C\u300D\uFF09\uFF0C\u4E5F\u6392\u5728\u6A21\u677F\u524D\u9762\u3002`, ...FACT_RULES2.map((r) => `- ${r}`)].join("\n");
}

// .tmp/content-audit-production_20261008/lib/creator-context.ts
var PERFORMANCE_BOARDS2 = /* @__PURE__ */ new Set(["topic", "direction", "growth", "freeChat"]);
function briefOlderThanProfile2(ctx2) {
  return !!ctx2.brief && briefFactsChanged2(ctx2.briefFacts, ctx2.profile);
}
function text4(v, maxLen = 300) {
  if (v == null) return "";
  const s = Array.isArray(v) ? v.filter(Boolean).join("\u3001") : String(v);
  const t = s.trim();
  if (!t) return "";
  return t.length > maxLen ? t.slice(0, maxLen) + "\u2026" : t;
}
function line2(label3, value, maxLen = 300) {
  const t = text4(value, maxLen);
  return t ? `- **${label3}**\uFF1A${t}` : null;
}
var join2 = (lines) => lines.filter(Boolean).join("\n");
function describeShootingSetup2(p) {
  if (!p) return "";
  const rows = join2([
    line2("\u53EF\u7528\u8BBE\u5907", p.equipment),
    line2("\u56E2\u961F\u89C4\u6A21", p.team_structure),
    line2("\u5E38\u7528\u573A\u5730", p.shooting_location),
    line2("\u526A\u8F91\u80FD\u529B", p.editing_capability),
    line2("\u5355\u6761\u9884\u7B97", p.budget_per_video),
    line2("\u60EF\u7528\u65F6\u957F", p.video_duration)
  ]);
  if (!rows) return "";
  return `## \u{1F3A5} \u8FD9\u4E2A\u8D26\u53F7\u7684\u771F\u5B9E\u62CD\u6444\u6761\u4EF6

${rows}

**\u6309\u8FD9\u4E9B\u6761\u4EF6\u8BBE\u8BA1\u5206\u955C**\uFF1A\u6709\u7A33\u5B9A\u5668\u624D\u5B89\u6392\u8FD0\u52A8\u955C\u5934\uFF0C\u6709\u706F\u5149\u624D\u8BBE\u8BA1\u5149\u4F4D\uFF0C
\u56E2\u961F\u53EA\u6709\u4E00\u4E2A\u4EBA\u5C31\u4E0D\u8981\u51FA\u73B0\u9700\u8981\u7B2C\u4E8C\u673A\u4F4D\u540C\u65F6\u62CD\u7684\u955C\u5934\u3002
\u6761\u4EF6\u6CA1\u5199\u5230\u7684\u6309\u6700\u4FDD\u5B88\u7684\u60C5\u51B5\u5904\u7406\uFF08\u624B\u673A\u3001\u5355\u4EBA\u3001\u81EA\u7136\u5149\uFF09\u3002`;
}
function describeAudience2(p, detail) {
  const base = join2([
    line2("\u4EBA\u7FA4", [text4(p.target_age), text4(p.target_gender), text4(p.target_occupation)].filter(Boolean).join(" \xB7 ")),
    line2("\u5730\u57DF", p.target_region)
  ]);
  if (detail === "brief") return base;
  return join2([
    base,
    line2("\u771F\u5B9E\u75DB\u70B9", p.target_pain_points, 500),
    line2("\u771F\u6B63\u9700\u6C42", p.target_needs, 500),
    line2("\u7C89\u4E1D\u5E38\u95EE", p.fan_common_questions, 400)
  ]);
}
function describeRestrictions2(p) {
  const rows = join2([
    line2("\u7EDD\u5BF9\u4E0D\u80FD\u8BF4", p.content_restrictions, 500),
    line2("\u907F\u514D\u7684\u5185\u5BB9", p.avoid_content, 300)
  ]);
  return `### \u26D4 \u786C\u6027\u7981\u5FCC\uFF08\u8FDD\u53CD\u5373\u4E0D\u53EF\u7528\uFF09

${rows ? `${rows}

` : ""}${taboosPromptBlock2(p)}`;
}
function buildContextBlock2(ctx2, module2) {
  const p = ctx2.profile ? scrubProfile2(ctx2.profile, readTabooSettings2(ctx2.profile.taboo_settings).excluded) ?? null : null;
  if (!p && !ctx2.positioning && ctx2.dealReasons.length === 0) return "";
  const parts = [];
  const title = p?.profile_name ? `## \u{1F4C7} \u8D26\u53F7\u80CC\u666F\uFF1A${p.profile_name}` : "## \u{1F4C7} \u8D26\u53F7\u80CC\u666F";
  if (p) {
    const want = new Set(manifestOf2(module2)?.profile ?? []);
    parts.push(title, "");
    const persona = personaFactsBlock2(p.persona_facts);
    if (persona) parts.push(persona, "");
    if (want.has("account")) {
      parts.push(join2([
        line2("\u5E73\u53F0", p.account_platform),
        line2("\u8D5B\u9053", p.account_track),
        line2("\u8D26\u53F7\u9636\u6BB5", [text4(p.account_stage), text4(p.fans_level)].filter(Boolean).join(" \xB7 ")),
        line2("\u5185\u5BB9\u5F62\u5F0F", p.content_format)
      ]), "");
      const facts = line2("\u771F\u5B9E\u60C5\u51B5\uFF08\u5E74\u9650\u3001\u7ECF\u5386\u3001\u7C4D\u8D2F\u4EE5\u6B64\u4E3A\u51C6\uFF0C\u4E0D\u8981\u6539\u5199\u6216\u5938\u5927\uFF09", p.interview_highlights?.trim().replace(/\s*\n+\s*/g, "\uFF1B"), 600);
      if (facts) parts.push(facts, "");
      if (module2 === "freeChat") parts.push(mixContextLine2(resolveMix2(p)), "");
    }
    if (want.has("audience")) parts.push(describeAudience2(p, "full"), "");
    if (want.has("tone")) {
      parts.push(join2([
        line2("\u8BF4\u8BDD\u8BED\u6C14", p.content_tone),
        line2("\u5185\u5BB9\u98CE\u683C", p.content_style)
      ]), "");
    }
    if (want.has("selling")) {
      parts.push(join2([
        line2("\u6838\u5FC3\u5356\u70B9", p.unique_selling_point, 500),
        line2("\u5185\u5BB9\u4EF7\u503C", p.content_value, 300),
        line2("\u5DF2\u9A8C\u8BC1\u7684\u5F00\u573A\u94A9\u5B50", p.conversion_hooks, 500)
      ]), "");
    }
    if (want.has("shooting")) parts.push(describeShootingSetup2(p), "");
    if (want.has("monetize")) {
      parts.push(join2([
        line2("\u53D8\u73B0\u65B9\u5F0F", p.monetization_model),
        line2("\u4EF7\u683C\u533A\u95F4", p.price_range),
        line2("\u6210\u4EA4\u8DEF\u5F84", p.conversion_path, 400),
        line2("\u6210\u4EA4\u969C\u788D", p.conversion_barriers, 400)
      ]), "");
    }
    if (want.has("viral")) {
      parts.push(join2([
        line2("\u5DF2\u6709\u7684\u5185\u5BB9\u65B9\u5411", p.content_themes, 600),
        line2("\u8FD9\u4E2A\u53F7\u7684\u7206\u6B3E\u57FA\u56E0", p.viral_content_pattern, 400),
        line2("\u5DEE\u5F02\u5316\u4F18\u52BF", p.competitive_advantage, 400)
      ]), "");
    }
    if (want.has("restrictions")) parts.push(describeRestrictions2(p), "");
    if (module2 === "review") {
      parts.push("**\u5BA1\u7A3F\u5148\u6309\u5F53\u524D\u7A3F\u4EF6\u4E0E\u672C\u8F6E\u8981\u6C42\u5224\u65AD**\uFF1A\u4FDD\u7559\u4F5C\u8005\u58F0\u97F3\uFF0C\u6838\u5BF9\u4E8B\u5B9E\u4E0E\u7981\u5FCC\uFF1B\u8D26\u53F7\u957F\u671F\u4EBA\u7FA4\u3001\u4E1A\u52A1\u4E0E\u98CE\u683C\u4EC5\u4F5C\u80CC\u666F\uFF0C\u4E0D\u80FD\u628A\u672C\u6761\u89C2\u5BDF\u8BB0\u5F55\u5F3A\u6539\u6210\u9762\u5411\u8001\u677F\u7684\u83B7\u5BA2\u5185\u5BB9\u3002", "");
    }
  }
  const brief = briefBlockFor2(ctx2.brief, module2);
  if (brief) {
    parts.push("", brief);
    if (p) {
      parts.push("", briefOlderThanProfile2(ctx2) ? "\u26A0\uFE0F \u8D26\u53F7\u6863\u6848\u5728\u8FD9\u4EFD\u7B80\u62A5\u751F\u6210\u4E4B\u540E\u6539\u8FC7\uFF1A\u7B80\u62A5\u91CC\u7684\u4EBA\u8BBE\u4E8B\u5B9E\uFF08\u5E74\u9650\u3001\u7ECF\u5386\u3001\u7C4D\u8D2F\u3001\u4EF7\u683C\u3001\u54C1\u7C7B\uFF09\u53EF\u80FD\u5DF2\u7ECF\u8FC7\u65F6\uFF0C**\u548C\u4E0A\u9762\u8D26\u53F7\u80CC\u666F\u5BF9\u4E0D\u4E0A\u7684\u4E00\u5F8B\u4EE5\u8D26\u53F7\u80CC\u666F\u4E3A\u51C6**\u3002" : "\u7B80\u62A5\u91CC\u7684\u4E8B\u5B9E\uFF08\u5E74\u9650\u3001\u7ECF\u5386\u3001\u7C4D\u8D2F\u3001\u4EF7\u683C\u3001\u54C1\u7C7B\uFF09\u5982\u679C\u548C\u4E0A\u9762\u8D26\u53F7\u80CC\u666F\u5BF9\u4E0D\u4E0A\uFF0C\u4EE5\u8D26\u53F7\u80CC\u666F\u4E3A\u51C6\u3002");
    }
  } else if (ctx2.positioning) {
    const body = module2 === "topic" ? ctx2.positioning.summary : ctx2.positioning.full;
    if (body) {
      parts.push(
        "",
        `## \u{1F3AF} \u5DF2\u786E\u5B9A\u7684\u8D26\u53F7\u5B9A\u4F4D`,
        "",
        text4(body, 2e3),
        "",
        "\u26A0\uFE0F \u4EE5\u4E0A\u662F\u8FD9\u4E2A\u53F7\u5DF2\u7ECF\u5B9A\u597D\u7684\u65B9\u5411\uFF0C\u4EA7\u51FA\u5FC5\u987B\u4E0E\u5B83\u4E00\u81F4\uFF0C\u4E0D\u8981\u53E6\u8D77\u7089\u7076\u3002",
        "\uFF08\u8FD9\u4E00\u6BB5\u662F\u4ECE\u5B9A\u4F4D\u539F\u6587\u622A\u65AD\u6765\u7684\u3002\u751F\u6210\u4E00\u4EFD\u300C\u521B\u4F5C\u7B80\u62A5\u300D\u53EF\u4EE5\u8BA9\u5404\u677F\u5757\u62FF\u5230\u5B8C\u6574\u65B9\u5411\u3002\uFF09"
      );
    }
  }
  if (PERFORMANCE_BOARDS2.has(module2)) {
    const perf = performancePromptBlock2(ctx2.performance);
    if (perf) parts.push("", perf);
  }
  if (PRESET_BOARDS2.has(module2)) {
    const style = presetPromptBlock2(ctx2.preset);
    if (style) parts.push("", style);
  }
  if (PREFERENCE_BOARDS2.has(module2)) {
    const pref = preferencePromptBlock2(ctx2.preferences);
    if (pref) parts.push("", pref);
  }
  if (OUTPUT_RULE_BOARDS2.has(module2)) parts.push("", outputRulesBlock2());
  if (ctx2.dealReasons.length > 0 && manifestOf2(module2)?.dealReasons) {
    parts.push(
      "",
      "## \u{1F4B0} \u8FD9\u4E2A\u8D26\u53F7\u7684\u6210\u4EA4\u7406\u7531",
      "",
      ctx2.dealReasons.map((r) => `- ${r}`).join("\n"),
      "",
      "\u5185\u5BB9\u8981\u80FD\u4F53\u73B0\u8FD9\u4E9B\u7406\u7531\uFF0C\u4F46\u4E0D\u662F\u786C\u585E\u2014\u2014\u653E\u5728\u5177\u4F53\u573A\u666F\u91CC\u8BB2\u51FA\u6765\u3002"
    );
  }
  return parts.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

// lib/ai-recommend.ts
var AI_LENGTH_RULE = "\u5148\u4FDD\u8BC1\u5185\u5BB9\u8BB2\u900F\u3001\u8BB2\u7CBE\u5F69\u2014\u2014\u8BE5\u6709\u7684\u60C5\u8282\u3001\u7EC6\u8282\u3001\u5BF9\u8BDD\u3001\u60C5\u7EEA\u8F6C\u6298\u4E00\u4E2A\u4E0D\u5C11\uFF0C\u4E0D\u4E3A\u4E86\u77ED\u800C\u538B\u7F29\u6216\u5220\u51CF\uFF1B\u8BB2\u5B8C\u5C31\u6536\uFF0C\u4E0D\u6CE8\u6C34\u51D1\u957F\u3002\u6700\u540E\u504F\u957F\u6CA1\u5173\u7CFB\uFF0C\u7F16\u5BFC\u4F1A\u81EA\u5DF1\u53BB\u5BA1\u7A3F\u4F18\u5316\u91CC\u7F29";

// lib/remix.ts
var BORROW_LAYERS = [
  { id: "opening", label: "\u5F00\u7BC7\u53E5\u5F0F", hint: "\u524D 3 \u79D2\u600E\u4E48\u6293\u4EBA\uFF1A\u4FDD\u7559\u53E5\u5F0F\u7ED3\u6784\uFF0C\u6362\u6210\u4F60\u884C\u4E1A\u7684\u8BCD" },
  { id: "structure", label: "\u7ED3\u6784\u9AA8\u67B6", hint: "\u6BB5\u843D\u987A\u5E8F\uFF1A\u6BD4\u5982\u56F0\u5883\u2192\u8F6C\u673A\u3001\u7ED3\u679C\u524D\u7F6E\u2192\u8865\u539F\u56E0" },
  { id: "presentation", label: "\u5448\u73B0\u5F62\u5F0F", hint: "\u600E\u4E48\u62CD\uFF1A\u53E3\u64AD/vlog/\u5267\u60C5\u3001\u89C6\u89D2\u3001\u51FA\u955C\u4EBA\u7269\u3001\u9053\u5177" },
  { id: "rhythm", label: "\u955C\u5934\u8282\u594F", hint: "\u591A\u957F\u5207\u4E00\u5200\u3001\u666F\u522B\u600E\u4E48\u8DDF\u7740\u60C5\u7EEA\u53D8" },
  { id: "emotion", label: "\u60C5\u7EEA\u66F2\u7EBF", hint: "\u60C5\u7EEA\u5728\u54EA\u51E0\u79D2\u8D77\u4F0F\u3001\u9760\u4EC0\u4E48\u8D77\u4F0F" },
  { id: "suspense", label: "\u60AC\u5FF5\u548C\u5151\u73B0", hint: "\u94A9\u5B50\u57CB\u5728\u54EA\u3001\u7B2C\u51E0\u79D2\u5151\u73B0" },
  { id: "punchline", label: "\u91D1\u53E5", hint: "\u6536\u5C3E\u90A3\u53E5\u8BA9\u4EBA\u60F3\u8F6C\u53D1\u7684\u8BDD" },
  { id: "persona", label: "\u4EBA\u8BBE\u548C\u4EBA\u7269\u5173\u7CFB", hint: "\u8C01\u51FA\u955C\u3001\u8DDF\u8C01\u5BF9\u8BDD\u3001\u662F\u4EC0\u4E48\u8EAB\u4EFD" },
  { id: "conversion", label: "\u7ED3\u5C3E\u548C\u8F6C\u5316", hint: "\u884C\u52A8\u6307\u4EE4\u3001\u600E\u4E48\u5F15\u5230\u5E97/\u79C1\u4FE1/\u4E0B\u5355" },
  { id: "series", label: "\u7CFB\u5217\u5316", hint: '\u80FD\u4E0D\u80FD\u505A\u6210\u4E00\u4E2A\u7CFB\u5217\uFF08"\u5E2E\u7C89\u4E1D\u4E70\u8F66"\u2192"\u5E2E\u7C89\u4E1D\u505A\u8D26\u53F7"\uFF09' },
  { id: "topicAngle", label: "\u9009\u9898\u89D2\u5EA6", hint: "\u540C\u4E00\u4E2A\u8BDD\u9898\u6362\u4F60\u7684\u884C\u4E1A\u8BB2\u3002\u77E5\u8BC6\u5E93\u5EFA\u8BAE\u540C\u884C\u4E1A\u66F4\u8BE5\u5B66\u9009\u9898\uFF0C\u8DE8\u884C\u4E1A\u4E3B\u8981\u5B66\u8868\u8FBE" }
];
var DEFAULT_LAYERS = ["opening", "structure", "presentation"];
var DIFFERENTIATE = [
  { id: "auto", label: "AI \u81EA\u5DF1\u62C9\u5F00", hint: "\u6BCF\u4E2A\u65B9\u6848\u5C3D\u91CF\u4E0D\u4E00\u6837" },
  { id: "layer", label: "\u6BCF\u4E2A\u501F\u4E0D\u540C\u7684\u5C42", hint: "\u4E00\u4E2A\u501F\u5F00\u7BC7\u3001\u4E00\u4E2A\u501F\u7ED3\u6784\u3001\u4E00\u4E2A\u501F\u62CD\u6CD5\u2026\u2026" },
  { id: "topic", label: "\u501F\u6CD5\u4E00\u6837\uFF0C\u6362\u9009\u9898", hint: "\u540C\u4E00\u5957\u501F\u6CD5\uFF0C\u5957\u5230\u4F60\u5E97\u91CC\u4E0D\u540C\u7684\u4E8B\u4E0A" },
  { id: "form", label: "\u501F\u6CD5\u4E00\u6837\uFF0C\u6362\u62CD\u6CD5", hint: "\u540C\u4E00\u4E2A\u9009\u9898\uFF0C\u53E3\u64AD\u4E00\u7248\u3001vlog \u4E00\u7248\u3001\u5267\u60C5\u4E00\u7248" }
];
var DEPTHS = [
  { id: "quick", label: "\u5FEB\u901F", hint: "\u65B9\u5411 + \u5F00\u5934 + \u53E3\u64AD\u8981\u70B9\uFF0C\u5148\u6311\u4E00\u4E2A\u518D\u7EC6\u5316" },
  { id: "full", label: "\u5B8C\u6574", hint: "\u6309\u4F60\u52FE\u7684\u4EA7\u51FA\u5199\u5168" },
  { id: "deep", label: "\u6DF1\u5EA6", hint: "\u5206\u955C\u7EC6\u5230\u6BCF\u4E00\u955C\u7684\u53F0\u8BCD\u3001\u52A8\u4F5C\u3001\u65F6\u957F\uFF0C\u518D\u7ED9 3 \u4E2A\u5907\u9009\u5F00\u5934" }
];
var MAX_SOURCE_CHARS = 14e3;
function condenseBreakdown(report2) {
  const out = [];
  let skipping = false;
  for (const line3 of report2.split("\n")) {
    if (/^#{3,4}\s*镜头\s*\d/.test(line3)) {
      skipping = true;
      continue;
    }
    if (skipping && (/^#{1,4}\s/.test(line3) || /^\*\*[^*]+\*\*\s*$/.test(line3.trim()))) skipping = false;
    if (!skipping) out.push(line3);
  }
  const text5 = out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return text5.length > MAX_SOURCE_CHARS ? text5.slice(0, MAX_SOURCE_CHARS) + "\n\u2026\u2026\uFF08\u540E\u9762\u7701\u7565\uFF09" : text5;
}
var label = (list, id) => list.find((c) => c.id === id)?.label ?? id;
var LAYER_RULES = {
  opening: "\u5F00\u7BC7\uFF1A\u4FDD\u7559\u539F\u7247\u5F00\u5934\u7684**\u53E5\u5F0F\u7ED3\u6784**\u548C\u6293\u4EBA\u7684\u673A\u5236\uFF08\u60AC\u5FF5/\u53CD\u5E38\u8BC6/\u51B2\u7A81\u2026\u2026\uFF09\uFF0C\u628A\u884C\u4E1A\u8BCD\u3001\u4EBA\u7269\u3001\u4E8B\u4EF6\u6362\u6210\u8FD9\u4E2A\u8D26\u53F7\u7684",
  structure: "\u7ED3\u6784\uFF1A\u4FDD\u7559\u539F\u7247\u6BB5\u843D\u7684**\u987A\u5E8F\u548C\u6BCF\u6BB5\u7684\u4F5C\u7528**\uFF08\u6BD4\u5982\u7ED3\u679C\u524D\u7F6E\u2192\u8865\u539F\u56E0\u2192\u7EC6\u8282\u8BC1\u636E\u2192\u8F6C\u673A\uFF09\uFF0C\u6BCF\u6BB5\u7684\u5185\u5BB9\u5168\u90E8\u6362\u6210\u8FD9\u4E2A\u8D26\u53F7\u81EA\u5DF1\u7684\u4E8B",
  presentation: "\u5448\u73B0\u5F62\u5F0F\uFF1A\u501F\u539F\u7247**\u600E\u4E48\u62CD**\u2014\u2014\u5448\u73B0\u65B9\u5F0F\uFF08\u53E3\u64AD/vlog/\u5267\u60C5/\u91C7\u8BBF\uFF09\u3001\u89C6\u89D2\u3001\u51FA\u955C\u4EBA\u7269\u3001\u9053\u5177\u3001\u51FA\u573A\u65B9\u5F0F\uFF1B\u573A\u666F\u6362\u6210\u8FD9\u4E2A\u8D26\u53F7\u80FD\u62CD\u5230\u7684",
  rhythm: "\u955C\u5934\u8282\u594F\uFF1A\u501F\u539F\u7247\u7684**\u5207\u955C\u9891\u7387\u548C\u666F\u522B\u53D8\u5316**\uFF08\u591A\u957F\u5207\u4E00\u5200\u3001\u4EC0\u4E48\u65F6\u5019\u4E0A\u7279\u5199\uFF09",
  emotion: "\u60C5\u7EEA\u66F2\u7EBF\uFF1A\u501F\u539F\u7247**\u60C5\u7EEA\u8D77\u4F0F\u7684\u4F4D\u7F6E\u548C\u624B\u6CD5**\uFF08\u7B2C\u51E0\u79D2\u8DCC\u3001\u7B2C\u51E0\u79D2\u5347\u3001\u9760\u4EC0\u4E48\uFF09\uFF0C\u60C5\u7EEA\u70B9\u6362\u6210\u8FD9\u4E2A\u8D26\u53F7\u771F\u5B9E\u4F1A\u53D1\u751F\u7684\u4E8B",
  suspense: "\u60AC\u5FF5\u548C\u5151\u73B0\uFF1A\u501F\u539F\u7247**\u57CB\u94A9\u5B50\u548C\u5151\u73B0\u7684\u8282\u594F**\uFF08\u94A9\u5B50\u5728\u54EA\u3001\u9694\u591A\u4E45\u5151\u73B0\uFF09\uFF0C\u94A9\u5B50\u5185\u5BB9\u6362\u6210\u8FD9\u4E2A\u8D26\u53F7\u7684",
  punchline: "\u91D1\u53E5\uFF1A\u501F\u539F\u7247\u91D1\u53E5\u7684**\u53E5\u5F0F**\uFF08\u5BF9\u4ED7\u3001\u53CD\u8F6C\u3001\u6BD4\u55BB\uFF09\uFF0C\u5185\u5BB9\u6362\u6210\u8FD9\u4E2A\u884C\u4E1A\u7684\u9053\u7406",
  persona: "\u4EBA\u8BBE\u548C\u4EBA\u7269\u5173\u7CFB\uFF1A\u501F\u539F\u7247**\u8C01\u51FA\u955C\u3001\u8DDF\u8C01\u4E92\u52A8\u3001\u4EE5\u4EC0\u4E48\u8EAB\u4EFD\u8BF4\u8BDD**\uFF0C\u8EAB\u4EFD\u6362\u6210\u8FD9\u4E2A\u8D26\u53F7\u7684\u8001\u677F/\u5458\u5DE5/\u5BA2\u4EBA",
  conversion: "\u7ED3\u5C3E\u548C\u8F6C\u5316\uFF1A\u501F\u539F\u7247**\u7ED3\u5C3E\u7684\u884C\u52A8\u6307\u4EE4\u8BBE\u8BA1**\uFF0C\u6307\u5411\u8FD9\u4E2A\u8D26\u53F7\u7684\u8F6C\u5316\u8DEF\u5F84\uFF08\u5230\u5E97/\u79C1\u4FE1/\u56E2\u8D2D\uFF09",
  series: "\u7CFB\u5217\u5316\uFF1A\u770B\u539F\u7247\u80FD\u4E0D\u80FD\u62BD\u6210\u4E00\u4E2A**\u53EF\u4EE5\u8FDE\u7EED\u62CD\u7684\u7CFB\u5217**\uFF08\u4FDD\u7559\u7CFB\u5217\u7684\u683C\u5F0F\uFF0C\u6362\u6210\u8FD9\u4E2A\u884C\u4E1A\u80FD\u4E00\u96C6\u96C6\u62CD\u4E0B\u53BB\u7684\u4E3B\u9898\uFF09",
  topicAngle: "\u9009\u9898\u89D2\u5EA6\uFF1A\u501F\u539F\u7247**\u8BA8\u8BBA\u7684\u8BDD\u9898\u6216\u89D2\u5EA6**\uFF0C\u6362\u6210\u8FD9\u4E2A\u884C\u4E1A\u7684\u8BF4\u6CD5\uFF08\u540C\u4E00\u9009\u9898\u4E0D\u540C\u8868\u8FBE\uFF09"
};
function storeSection(store) {
  if (!store?.name.trim() && !store?.lines.length && !store?.track?.trim()) return "";
  const lines = store.lines.filter(Boolean);
  return [
    `## \u4E8C\u521B\u5230\u54EA\u5BB6\u5E97\uFF08\u4EE5\u8FD9\u4E2A\u6863\u6848\u4E3A\u51C6\uFF0C\u786C\u7EA6\u675F\uFF09`,
    `- **\u5E97 / \u8D26\u53F7**\uFF1A${store.name.trim() || "\u5F53\u524D\u6863\u6848"}`,
    store.track?.trim() ? `- **\u884C\u4E1A / \u8D5B\u9053**\uFF1A${store.track.trim()}` : "",
    lines.length ? `- **\u5728\u5356\u7684\u54C1\u7C7B**\uFF1A${lines.join("\u3001")}` : "",
    `- \u6BCF\u4E2A\u65B9\u6848\u91CC\u7684**\u4E8B\u4EF6\u3001\u573A\u666F\u3001\u4EA7\u54C1\u3001\u51FA\u955C\u7684\u4EBA**\u90FD\u5FC5\u987B\u662F\u8FD9\u5BB6\u5E97\u7684\uFF1A\u539F\u7247\u662F\u4EC0\u4E48\u884C\u4E1A\u4E0D\u91CD\u8981\uFF0C\u5199\u51FA\u6765\u7684\u4E00\u5F8B\u662F${lines.length ? `\u300C${lines.join("\u3001")}\u300D` : "\u8FD9\u5BB6\u5E97"}\u7684\u4E8B`,
    lines.length > 1 ? `- ${lines.length} \u4E2A\u54C1\u7C7B\u90FD\u5728\u5356\u3001\u4E00\u6837\u91CD\u8981\uFF1A\u65B9\u6848\u8981\u8986\u76D6\u5230\u5B83\u4EEC\uFF08\u53EF\u4EE5\u4E00\u4E2A\u65B9\u6848\u843D\u4E00\u4E2A\u54C1\u7C7B\uFF0C\u4E5F\u53EF\u4EE5\u4E00\u6761\u91CC\u5E26\u51FA\u51E0\u6837\uFF09\uFF0C\u4E0D\u8981\u53EA\u6311\u4E00\u4E2A\u5199` : "",
    `- \u4F8B\u5B50\u3001\u53F0\u8BCD\u91CC\u63D0\u5230\u7684\u83DC\u54C1/\u5546\u54C1/\u670D\u52A1\uFF0C\u53EA\u80FD\u4ECE\u4E0A\u9762\u7684\u54C1\u7C7B\u548C\u4E0B\u9762\u7684\u6863\u6848\u91CC\u53D6\uFF0C\u4E0D\u8981\u7F16\u8FD9\u5BB6\u5E97\u6CA1\u6709\u7684\u4E1C\u897F`
  ].filter(Boolean).join("\n");
}
function buildRemixPrompt(source, o) {
  const layers = o.layers.length ? o.layers : DEFAULT_LAYERS;
  const notBorrowed = BORROW_LAYERS.filter((l) => !layers.includes(l.id)).map((l) => l.label);
  const outputs = new Set(o.outputs);
  const quick = o.depth === "quick";
  const deep = o.depth === "deep";
  const sourceText = source.kind === "breakdown" ? condenseBreakdown(source.text) : source.text.trim().slice(0, MAX_SOURCE_CHARS);
  const sections = [
    `### \u65B9\u6848 1\uFF1A\u4E00\u4E2A\u8BA9\u4EBA\u4E00\u770B\u5C31\u61C2\u7684\u540D\u5B57`,
    `**\u4E00\u53E5\u8BDD**\uFF1A\u539F\u7247\u7684\u300C\u4EC0\u4E48\u300D\u2192 \u4F60\u5E97\u91CC\u7684\u300C\u4EC0\u4E48\u300D\uFF08\u4F8B\uFF1A\u539F\u7247"\u5E2E\u7C89\u4E1D\u4E70\u8F66" \u2192 \u4F60\u7684"\u5E2E\u5BA2\u4EBA\u6311\u4ECA\u5929\u6700\u65B0\u9C9C\u7684\u90A3\u5757\u8089"\uFF09`,
    `**\u501F\u4E86**\uFF1A\u2026\u2026 **\u6362\u6210\u81EA\u5DF1\u7684**\uFF1A\u2026\u2026`,
    "",
    `#### \u8FC1\u79FB\u5BF9\u7167`,
    `| \u5C42 | \u539F\u7247 | \u4F60\u7684\u7248\u672C |`,
    `\uFF08\u6BCF\u4E2A\u501F\u7684\u5C42\u4E00\u884C\uFF0C\u518D\u52A0\u4E00\u884C"\u4E8B\u4EF6/\u4E3B\u89D2"\u2014\u2014\u8BF4\u6E05\u539F\u7247\u8BB2\u7684\u662F\u8C01\u7684\u4EC0\u4E48\u4E8B\u3001\u4F60\u8BB2\u7684\u662F\u8C01\u7684\u4EC0\u4E48\u4E8B\uFF09`,
    "",
    `#### \u5F00\u5934\uFF08\u524D 3 \u79D2\uFF09`,
    `\u7B2C\u4E00\u53E5\u8BDD\u9010\u5B57\u5199\u51FA\u6765\uFF0C\u518D\u5199\u8FD9 3 \u79D2\u753B\u9762\u91CC\u6709\u4EC0\u4E48\uFF1B\u6309\u6BCF\u79D24\uFF5E5\u5B57\u4F30\u7B97\uFF0C\u5F00\u5934\u53F0\u8BCD\u4E0D\u8D85\u8FC715\u5B57\uFF0C\u52A8\u4F5C\u53E6\u8BA1`
  ];
  if (quick) {
    sections.push("", `#### \u53E3\u64AD\u8981\u70B9`, `\u6309\u7ED3\u6784\u5206\u6BB5\u5217\u8981\u70B9\uFF0C\u6BCF\u6BB5\u4E00\u4E24\u53E5\uFF0C\u4E0D\u5199\u5168\u6587`);
  } else {
    if (outputs.has("script")) sections.push("", `#### \u53E3\u64AD\u5168\u6587`, `\u6309\u7ED3\u6784\u5206\u6BB5\uFF0C\u6BCF\u6BB5\u524D\u9762\u7528\u3010\u3011\u6807\u51FA\u8FD9\u6BB5\u7684\u4F5C\u7528\uFF08\u5982\u3010\u5F00\u7BC7\u94A9\u5B50\u3011\u3010\u94FA\u57AB\u3011\u3010\u8BC1\u636E\u3011\u3010\u5151\u73B0\u3011\u3010\u884C\u52A8\u6307\u4EE4\u3011\uFF09\uFF0C\u603B\u957F\u5EA6\u7B26\u5408\u8981\u6C42\u7684\u65F6\u957F`);
    if (outputs.has("shots"))
      sections.push(
        "",
        `#### \u5206\u955C`,
        deep ? `\u6BCF\u4E00\u955C\u4E00\u884C\u5217\u8868\uFF1A**\u955C\u5934 N\uFF5C\u8D77\u6B62\u79D2\u6570**\uFF1A\u753B\u9762\uFF08\u8C01\u3001\u5728\u54EA\u3001\u505A\u4EC0\u4E48\u52A8\u4F5C\uFF09\uFF5C\u666F\u522B\u548C\u8FD0\u955C\uFF5C\u53F0\u8BCD\u6216\u5B57\u5E55\u539F\u6587\uFF5C\u8FD9\u4E00\u955C\u7684\u4F5C\u7528\u3002\u955C\u5934\u8981\u7EC6\u5230\u80FD\u76F4\u63A5\u7167\u7740\u62CD` : `\u6BCF\u4E00\u955C\u4E00\u884C\u5217\u8868\uFF1A**\u955C\u5934 N\uFF5C\u8D77\u6B62\u79D2\u6570**\uFF1A\u753B\u9762\uFF5C\u53F0\u8BCD\u6216\u5B57\u5E55\u30026\uFF5E10 \u955C`
      );
    if (outputs.has("shootPlan")) sections.push("", `#### \u7528\u4F60\u624B\u4E0A\u7684\u8D44\u6E90\u600E\u4E48\u62CD`, `\u51E0\u4E2A\u4EBA\u3001\u8C01\u51FA\u955C\u3001\u7528\u4EC0\u4E48\u8BBE\u5907\u3001\u5728\u54EA\u62CD\u3001\u8981\u51C6\u5907\u4EC0\u4E48\u9053\u5177\u3001\u5927\u6982\u62CD\u591A\u4E45\uFF1B\u6863\u6848\u91CC\u6CA1\u6709\u7684\u8D44\u6E90\u4E0D\u8981\u5B89\u6392`);
    if (outputs.has("titles")) sections.push("", `#### \u6807\u9898\u548C\u5C01\u9762`, `3 \u4E2A\u6807\u9898 + \u5C01\u9762\u4E0A\u7684\u5B57\uFF08\u5C01\u9762\u5B57 10 \u4E2A\u5B57\u4EE5\u5185\uFF09`);
    if (outputs.has("comment")) sections.push("", `#### \u8BC4\u8BBA\u533A\u7F6E\u9876`, `\u4E00\u6761\u5F15\u5BFC\u4E92\u52A8\u7684\u7F6E\u9876\u8BC4\u8BBA`);
    if (outputs.has("altOpenings") || deep) sections.push("", `#### \u5907\u9009\u5F00\u5934`, `\u518D\u7ED9 3 \u4E2A\u4E0D\u540C\u7C7B\u578B\u7684\u5F00\u5934\uFF0C\u4E00\u53E5\u8BDD\u4E00\u4E2A`);
  }
  sections.push("", `#### \u6CE8\u610F`, `\u539F\u7247\u5B66\u4E0D\u6765\u7684\u90E8\u5206\uFF08\u9760\u8EAB\u4EFD\u3001\u9AD8\u6210\u672C\u3001\u5076\u7136\uFF09\u8FD9\u4E2A\u65B9\u6848\u600E\u4E48\u7ED5\u5F00\uFF1B\u4EE5\u53CA"\u8FD9\u6761\u4E0D\u662F\u642C\u8FD0"\uFF1A\u53F0\u8BCD\u3001\u753B\u9762\u3001\u4E8B\u4EF6\u90FD\u662F\u81EA\u5DF1\u7684`);
  const target = o.profileSummary?.trim() ? [storeSection(o.store), `## \u8FD9\u4E2A\u8D26\u53F7\u7684\u6863\u6848\uFF08\u4E8C\u521B\u8981\u843D\u5230\u5B83\u8EAB\u4E0A\uFF09
${o.profileSummary.trim()}`].filter(Boolean).join("\n\n") : `## \u8FD9\u4E2A\u8D26\u53F7
${o.targetIndustry?.trim() ? `\u505A\u7684\u662F\uFF1A${o.targetIndustry.trim()}\u3002\u6240\u6709\u65B9\u6848\u90FD\u6362\u6210\u8FD9\u4E2A\u884C\u4E1A` : "\u7528\u6237\u6CA1\u8BF4\u81EA\u5DF1\u662F\u505A\u4EC0\u4E48\u7684\uFF1A\u6309\u539F\u7247\u6700\u5BB9\u6613\u8FC1\u79FB\u7684\u5B9E\u4F53\u5E97\u884C\u4E1A\u4E3E\u4F8B\uFF0C\u5E76\u63D0\u9192\u4ED6\u9009\u597D\u6863\u6848\u518D\u505A\u4E00\u6B21"}`;
  const context = o.contextBlock?.trim();
  return `\u3010\u4EFB\u52A1\uFF1A\u8DE8\u884C\u4E1A\u4E8C\u521B\u3011\u4F60\u662F\u5E26\u8FC7\u4E0A\u767E\u4E2A\u5B9E\u4F53\u5E97\u8D77\u53F7\u7684\u7F16\u5BFC\u3002\u4E0B\u9762\u662F\u522B\u7684\u884C\u4E1A\u4E00\u6761\u7206\u6B3E\u7684\u62C6\u89E3\uFF08\u6216\u6587\u6848\uFF09\uFF0C
\u5E2E\u8FD9\u4E2A\u8D26\u53F7\u628A\u5B83**\u4E8C\u521B**\u6210\u81EA\u5DF1\u80FD\u62CD\u7684\u5185\u5BB9\u3002\u76EE\u7684\u4E0D\u662F\u7167\u6284\uFF0C\u662F\u501F\u8D70\u5B83\u706B\u7684"\u673A\u5236"\uFF0C\u6362\u4E0A\u81EA\u5DF1\u7684\u8840\u8089\u3002

## \u65B9\u6CD5\uFF08\u77E5\u8BC6\u5E93\u539F\u5219\uFF0C\u5FC5\u987B\u5B88\u4F4F\uFF09
- **\u884C\u4E1A\u5185\u770B\u9009\u9898\uFF0C\u8DE8\u884C\u4E1A\u770B\u5F00\u7BC7\u3001\u91D1\u53E5\u3001\u5448\u73B0\u5F62\u5F0F**\u2014\u2014\u8FD9\u662F\u907F\u5F00\u540C\u884C\u5185\u5377\u7684\u529E\u6CD5
- \u501F\u7684\u662F**\u7ED3\u6784\u548C\u673A\u5236**\uFF08\u53E5\u5F0F\u3001\u6BB5\u843D\u987A\u5E8F\u3001\u62CD\u6CD5\u3001\u8282\u594F\uFF09\uFF0C**\u4E0D\u662F\u5177\u4F53\u5185\u5BB9**\uFF1A
  \u539F\u7247\u7684\u53F0\u8BCD\u3001\u753B\u9762\u3001\u4EBA\u7269\u7ECF\u5386\u3001\u6570\u5B57\u4E00\u5F8B\u4E0D\u642C\u3002"\u5E2E\u7C89\u4E1D\u4E70\u8F66"\u2192"\u5E2E\u7C89\u4E1D\u505A\u8D26\u53F7"\u662F\u4E8C\u521B\uFF1B\u628A\u539F\u7247\u53F0\u8BCD\u6362\u4E24\u4E2A\u8BCD\u5FF5\u4E00\u904D\u662F\u642C\u8FD0\uFF0C\u5E73\u53F0\u4F1A\u5224\u642C\u8FD0\u3001\u4E0D\u7ED9\u6D41\u91CF
- \u5F00\u7BC7\uFF1A\u4FDD\u7559\u53E5\u5F0F\u7ED3\u6784\uFF0C\u66FF\u6362\u884C\u4E1A\u5173\u952E\u8BCD\uFF08"\u4FE1\u4E0D\u4FE115\u79D2\u8BA9\u4F60\u653E\u5F03\u6446\u644A"\u6362\u4EFB\u4F55\u884C\u4E1A\u90FD\u80FD\u7528\uFF09
- \u7ED3\u6784\uFF1A\u56F0\u5883\u2192\u8F6C\u673A\u3001\u7ED3\u679C\u524D\u7F6E\u2192\u8865\u539F\u56E0\u8FD9\u7C7B\u9AA8\u67B6\u8DE8\u884C\u4E1A\u901A\u7528\uFF0C\u6BCF\u6BB5\u7684\u4E8B\u8981\u6362\u6210\u8FD9\u4E2A\u8D26\u53F7\u771F\u5B9E\u4F1A\u53D1\u751F\u7684\u4E8B
- \u5448\u73B0\u5F62\u5F0F\u6709\u4E94\u4E2A\u53EF\u53D8\u7EF4\u5EA6\uFF1A\u62CD\u6444\u89D2\u5EA6\u3001\u51FA\u955C\u4EBA\u7269\u3001\u51FA\u573A\u65B9\u5F0F\u3001\u9053\u5177\u3001\u526A\u8F91\u65B9\u5F0F

## \u539F\u7247${source.title ? `\uFF1A${source.title}` : ""}${source.industry ? `\uFF08${source.industry}\uFF09` : ""}
${source.kind === "breakdown" ? "\uFF08\u4E0B\u9762\u662F\u8FD9\u6761\u89C6\u9891\u7684\u62C6\u89E3\u62A5\u544A\uFF0C\u9010\u4E2A\u955C\u5934\u7684\u5361\u7247\u5DF2\u7701\u7565\uFF0C\u8282\u594F\u4E00\u89C8\u8FD8\u5728\uFF09" : "\uFF08\u4E0B\u9762\u662F\u7528\u6237\u8D34\u7684\u539F\u7247\u6587\u6848\u6216\u63CF\u8FF0\uFF09"}
${sourceText}

${target}
${context ? `
${context}
` : o.restrictions?.trim() ? `
## \u786C\u7981\u5FCC\uFF08\u6240\u6709\u65B9\u6848\u3001\u4F8B\u5B50\u3001\u53F0\u8BCD\u90FD\u4E0D\u80FD\u78B0\uFF09
${o.restrictions.trim()}
` : ""}
## \u7528\u6237\u7684\u9009\u62E9\uFF08\u6309\u4ED6\u9009\u7684\u6765\uFF09
- **\u501F\u8FD9\u51E0\u5C42**\uFF1A
${layers.map((l) => `  - ${LAYER_RULES[l]}`).join("\n")}
${notBorrowed.length ? `- **\u6CA1\u9009\u7684\u5C42**\uFF08${notBorrowed.join("\u3001")}\uFF09\uFF1A\u7528\u8FD9\u4E2A\u8D26\u53F7\u81EA\u5DF1\u7684\uFF0C\u4E0D\u8981\u7167\u642C\u539F\u7247` : ""}
- **\u6070\u597D\u51FA ${o.count} \u4E2A\u65B9\u6848**\uFF1A\u53EA\u5141\u8BB8${Array.from({ length: o.count }, (_, i) => `\u300C### \u65B9\u6848 ${i + 1}\uFF1A\u300D`).join("\u3001")}\u8FD9\u4E9B\u65B9\u6848\u6807\u9898\uFF0C\u4E0D\u8FFD\u52A0\u5907\u9009\u65B9\u6848${o.count > 1 ? `\uFF1B\u65B9\u6848\u4E4B\u95F4\uFF1A${label(DIFFERENTIATE, o.differentiate)}\uFF08${DIFFERENTIATE.find((d) => d.id === o.differentiate)?.hint}\uFF09` : ""}
- **\u6DF1\u5EA6**\uFF1A${label(DEPTHS, o.depth)}\uFF08${DEPTHS.find((d) => d.id === o.depth)?.hint}\uFF09
- **\u76EE\u7684**\uFF1A${o.role === "same" ? "\u8DDF\u539F\u7247\u4E00\u6837\uFF08\u5148\u5224\u65AD\u539F\u7247\u662F\u6D41\u91CF\u578B/\u4EBA\u8BBE\u578B/\u53D8\u73B0\u578B\uFF09" : o.role}\u2014\u2014\u7ED3\u5C3E\u7684\u884C\u52A8\u6307\u4EE4\u6309\u8FD9\u4E2A\u76EE\u7684\u53EA\u9009\u4E00\u4E2A
- **\u65F6\u957F**\uFF1A${o.duration === "\u8DDF\u539F\u7247" ? `\u53C2\u8003\u539F\u7247\u7684\u957F\u5EA6\uFF0C\u4F46\u4E0D\u5361\u6B7B\uFF1A${AI_LENGTH_RULE}` : o.duration}
${o.notes?.trim() ? `- **\u8865\u5145\u8981\u6C42**\uFF1A${o.notes.trim()}` : ""}

## \u8F93\u51FA\u683C\u5F0F\uFF08Markdown\uFF1B${o.count} \u4E2A\u65B9\u6848\uFF0C\u6BCF\u4E2A\u90FD\u6309\u4E0B\u9762\u8FD9\u4E2A\u6837\u5B50\uFF0C\u65B9\u6848\u4E4B\u95F4\u7528 --- \u9694\u5F00\uFF09
\u5148\u7528\u4E24\u4E09\u53E5\u8BDD\u8BF4\uFF1A\u539F\u7247\u6709\u54EA\u4E9B\u8868\u8FBE\u673A\u5236\u53EF\u4EE5\u501F\u3002\u6CA1\u6709\u4F20\u64AD\u6570\u636E\u65F6\u4E0D\u5F97\u65AD\u8A00\u5B83\u5DF2\u7ECF\u706B\u4E86\uFF0C\u4E5F\u4E0D\u5F97\u628A\u4F20\u64AD\u539F\u56E0\u5F53\u4F5C\u5DF2\u9A8C\u8BC1\u7ED3\u8BBA\u3002\u7136\u540E\uFF1A

${sections.join("\n")}

${o.count === 1 ? "\u6700\u540E\u4E00\u6BB5 **### \u6267\u884C\u5EFA\u8BAE**\uFF1A\u4EC5\u8BF4\u660E\u8FD9\u4E00\u4E2A\u65B9\u6848\u600E\u4E48\u5F00\u59CB\u62CD\uFF0C\u4E0D\u65B0\u589E\u7B2C\u4E8C\u65B9\u6848\u3002" : "\u6700\u540E\u4E00\u6BB5 **### \u6211\u63A8\u8350\u5148\u62CD\u54EA\u4E2A**\uFF1A\u4ECE\u5DF2\u7ED9\u65B9\u6848\u4E2D\u9009\u62E9\uFF0C\u4E0D\u65B0\u589E\u65B9\u6848\uFF1B\u8BF4\u660E\u4E0E\u73B0\u6709\u8D44\u6E90\u7684\u9002\u914D\u7406\u7531\u3002"}

## \u8981\u6C42
- \u6BCF\u4E2A\u65B9\u6848\u90FD\u5FC5\u987B\u662F**\u8FD9\u4E2A\u8D26\u53F7\u624B\u4E0A\u7684\u8D44\u6E90\u62CD\u5F97\u51FA\u6765\u7684**\uFF08\u770B\u6863\u6848\u91CC\u7684\u56E2\u961F\u3001\u8BBE\u5907\u3001\u573A\u5730\uFF09
- **\u4E0D\u8981\u66FF\u4ED6\u7F16\u7ECF\u5386**\uFF1A\u6863\u6848\u548C\u524D\u91C7\u8981\u70B9\u91CC\u6CA1\u6709\u7684\u4EBA\u751F\u7ECF\u5386\u3001\u8F6C\u6298\u4E8B\u4EF6\uFF08\u8F9E\u804C\u3001\u521B\u4E1A\u3001\u4E8F\u94B1\u3001\u5BB6\u91CC\u51FA\u4E8B\u2026\u2026\uFF09\uFF0C
  \u4E0D\u8BB8\u5199\u6210\u771F\u4E8B\u3002\u8981\u7528\u5230\u7684\u5730\u65B9\u5199\u6210\u300C\u3010\u6362\u6210\u4F60\u7684\uFF1A\u2026\u2026\u3011\u300D\u8BA9\u4ED6\u6362\u6210\u81EA\u5DF1\u7684\u771F\u5B9E\u7ECF\u5386\uFF0C\u91CC\u9762\u7ED9\u4E00\u4E2A\u53C2\u8003\u65B9\u5411\uFF0C\u6BD4\u5982
  \u300C\u3010\u6362\u6210\u4F60\u7684\uFF1A\u5F00\u5E97\u65F6\u771F\u5B9E\u9047\u5230\u8FC7\u7684\u4E00\u4E2A\u96BE\u5904\uFF0C\u6BD4\u5982\u7B2C\u4E00\u4E2A\u6708\u751F\u610F\u5F88\u5DEE\u3011\u300D\u3002
  \uFF08\u53E3\u64AD\u91CC\u6807\u6BB5\u843D\u4F5C\u7528\u7684\u3010\u5F00\u7BC7\u94A9\u5B50\u3011\u3010\u94FA\u57AB\u3011\u662F\u53E6\u4E00\u56DE\u4E8B\uFF0C\u8981\u586B\u7684\u5730\u65B9\u4E00\u5B9A\u4EE5"\u6362\u6210\u4F60\u7684\uFF1A"\u5F00\u5934\uFF0C\u4E00\u773C\u5206\u5F97\u6E05\uFF09
  \u5B9E\u6D4B\uFF1A\u539F\u7247\u662F\u771F\u4EBA\u771F\u4E8B\uFF0C\u6A21\u578B\u66FF\u8001\u677F\u7F16\u4E86"\u8F9E\u6389\u5927\u5382\u5DE5\u4F5C\u3001\u6495\u4E86 X \u4E07\u5E74\u85AA\u5DE5\u8D44\u6761"\u2014\u2014\u6863\u6848\u91CC\u6839\u672C\u6CA1\u6709\uFF0C\u7167\u7740\u62CD\u5C31\u662F\u5047\u6545\u4E8B\uFF0C
  \u800C\u8FD9\u7C7B\u5185\u5BB9\u7684\u6838\u5FC3\u6070\u6070\u662F\u771F\u5B9E
- \u4E0D\u8981\u66FF\u7528\u6237\u7F16\u6570\u5B57\uFF1A\u6863\u6848\u91CC\u6CA1\u6709\u7684\u4EBA\u6570\u3001\u91D1\u989D\u3001\u5E74\u9650\u3001\u64AD\u653E\u91CF\u5199\u6210 X
- \u4E0D\u8BF4"\u63ED\u79D8"\uFF0C\u4E0D\u7528\u7EDD\u5BF9\u5316\u7528\u8BED\uFF0C\u4E0D\u8BCB\u6BC1\u540C\u884C\u548C\u5BA2\u4EBA
- \u5927\u767D\u8BDD\uFF0C\u4E0D\u8981"\u8D4B\u80FD""\u6253\u9020""\u77E9\u9635"\u8FD9\u7C7B\u8BCD`;
}

// .tmp/content-audit-production_20261008/lib/ai-recommend.ts
var AI_LENGTH_RULE2 = "\u5148\u4FDD\u8BC1\u5185\u5BB9\u8BB2\u900F\u3001\u8BB2\u7CBE\u5F69\u2014\u2014\u8BE5\u6709\u7684\u60C5\u8282\u3001\u7EC6\u8282\u3001\u5BF9\u8BDD\u3001\u60C5\u7EEA\u8F6C\u6298\u4E00\u4E2A\u4E0D\u5C11\uFF0C\u4E0D\u4E3A\u4E86\u77ED\u800C\u538B\u7F29\u6216\u5220\u51CF\uFF1B\u8BB2\u5B8C\u5C31\u6536\uFF0C\u4E0D\u6CE8\u6C34\u51D1\u957F\u3002\u6700\u540E\u504F\u957F\u6CA1\u5173\u7CFB\uFF0C\u7F16\u5BFC\u4F1A\u81EA\u5DF1\u53BB\u5BA1\u7A3F\u4F18\u5316\u91CC\u7F29";

// .tmp/content-audit-production_20261008/lib/remix.ts
var BORROW_LAYERS2 = [
  { id: "opening", label: "\u5F00\u7BC7\u53E5\u5F0F", hint: "\u524D 3 \u79D2\u600E\u4E48\u6293\u4EBA\uFF1A\u4FDD\u7559\u53E5\u5F0F\u7ED3\u6784\uFF0C\u6362\u6210\u4F60\u884C\u4E1A\u7684\u8BCD" },
  { id: "structure", label: "\u7ED3\u6784\u9AA8\u67B6", hint: "\u6BB5\u843D\u987A\u5E8F\uFF1A\u6BD4\u5982\u56F0\u5883\u2192\u8F6C\u673A\u3001\u7ED3\u679C\u524D\u7F6E\u2192\u8865\u539F\u56E0" },
  { id: "presentation", label: "\u5448\u73B0\u5F62\u5F0F", hint: "\u600E\u4E48\u62CD\uFF1A\u53E3\u64AD/vlog/\u5267\u60C5\u3001\u89C6\u89D2\u3001\u51FA\u955C\u4EBA\u7269\u3001\u9053\u5177" },
  { id: "rhythm", label: "\u955C\u5934\u8282\u594F", hint: "\u591A\u957F\u5207\u4E00\u5200\u3001\u666F\u522B\u600E\u4E48\u8DDF\u7740\u60C5\u7EEA\u53D8" },
  { id: "emotion", label: "\u60C5\u7EEA\u66F2\u7EBF", hint: "\u60C5\u7EEA\u5728\u54EA\u51E0\u79D2\u8D77\u4F0F\u3001\u9760\u4EC0\u4E48\u8D77\u4F0F" },
  { id: "suspense", label: "\u60AC\u5FF5\u548C\u5151\u73B0", hint: "\u94A9\u5B50\u57CB\u5728\u54EA\u3001\u7B2C\u51E0\u79D2\u5151\u73B0" },
  { id: "punchline", label: "\u91D1\u53E5", hint: "\u6536\u5C3E\u90A3\u53E5\u8BA9\u4EBA\u60F3\u8F6C\u53D1\u7684\u8BDD" },
  { id: "persona", label: "\u4EBA\u8BBE\u548C\u4EBA\u7269\u5173\u7CFB", hint: "\u8C01\u51FA\u955C\u3001\u8DDF\u8C01\u5BF9\u8BDD\u3001\u662F\u4EC0\u4E48\u8EAB\u4EFD" },
  { id: "conversion", label: "\u7ED3\u5C3E\u548C\u8F6C\u5316", hint: "\u884C\u52A8\u6307\u4EE4\u3001\u600E\u4E48\u5F15\u5230\u5E97/\u79C1\u4FE1/\u4E0B\u5355" },
  { id: "series", label: "\u7CFB\u5217\u5316", hint: '\u80FD\u4E0D\u80FD\u505A\u6210\u4E00\u4E2A\u7CFB\u5217\uFF08"\u5E2E\u7C89\u4E1D\u4E70\u8F66"\u2192"\u5E2E\u7C89\u4E1D\u505A\u8D26\u53F7"\uFF09' },
  { id: "topicAngle", label: "\u9009\u9898\u89D2\u5EA6", hint: "\u540C\u4E00\u4E2A\u8BDD\u9898\u6362\u4F60\u7684\u884C\u4E1A\u8BB2\u3002\u77E5\u8BC6\u5E93\u5EFA\u8BAE\u540C\u884C\u4E1A\u66F4\u8BE5\u5B66\u9009\u9898\uFF0C\u8DE8\u884C\u4E1A\u4E3B\u8981\u5B66\u8868\u8FBE" }
];
var DEFAULT_LAYERS2 = ["opening", "structure", "presentation"];
var DIFFERENTIATE2 = [
  { id: "auto", label: "AI \u81EA\u5DF1\u62C9\u5F00", hint: "\u6BCF\u4E2A\u65B9\u6848\u5C3D\u91CF\u4E0D\u4E00\u6837" },
  { id: "layer", label: "\u6BCF\u4E2A\u501F\u4E0D\u540C\u7684\u5C42", hint: "\u4E00\u4E2A\u501F\u5F00\u7BC7\u3001\u4E00\u4E2A\u501F\u7ED3\u6784\u3001\u4E00\u4E2A\u501F\u62CD\u6CD5\u2026\u2026" },
  { id: "topic", label: "\u501F\u6CD5\u4E00\u6837\uFF0C\u6362\u9009\u9898", hint: "\u540C\u4E00\u5957\u501F\u6CD5\uFF0C\u5957\u5230\u4F60\u5E97\u91CC\u4E0D\u540C\u7684\u4E8B\u4E0A" },
  { id: "form", label: "\u501F\u6CD5\u4E00\u6837\uFF0C\u6362\u62CD\u6CD5", hint: "\u540C\u4E00\u4E2A\u9009\u9898\uFF0C\u53E3\u64AD\u4E00\u7248\u3001vlog \u4E00\u7248\u3001\u5267\u60C5\u4E00\u7248" }
];
var DEPTHS2 = [
  { id: "quick", label: "\u5FEB\u901F", hint: "\u65B9\u5411 + \u5F00\u5934 + \u53E3\u64AD\u8981\u70B9\uFF0C\u5148\u6311\u4E00\u4E2A\u518D\u7EC6\u5316" },
  { id: "full", label: "\u5B8C\u6574", hint: "\u6309\u4F60\u52FE\u7684\u4EA7\u51FA\u5199\u5168" },
  { id: "deep", label: "\u6DF1\u5EA6", hint: "\u5206\u955C\u7EC6\u5230\u6BCF\u4E00\u955C\u7684\u53F0\u8BCD\u3001\u52A8\u4F5C\u3001\u65F6\u957F\uFF0C\u518D\u7ED9 3 \u4E2A\u5907\u9009\u5F00\u5934" }
];
var MAX_SOURCE_CHARS2 = 14e3;
function condenseBreakdown2(report2) {
  const out = [];
  let skipping = false;
  for (const line3 of report2.split("\n")) {
    if (/^#{3,4}\s*镜头\s*\d/.test(line3)) {
      skipping = true;
      continue;
    }
    if (skipping && (/^#{1,4}\s/.test(line3) || /^\*\*[^*]+\*\*\s*$/.test(line3.trim()))) skipping = false;
    if (!skipping) out.push(line3);
  }
  const text5 = out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return text5.length > MAX_SOURCE_CHARS2 ? text5.slice(0, MAX_SOURCE_CHARS2) + "\n\u2026\u2026\uFF08\u540E\u9762\u7701\u7565\uFF09" : text5;
}
var label2 = (list, id) => list.find((c) => c.id === id)?.label ?? id;
var LAYER_RULES2 = {
  opening: "\u5F00\u7BC7\uFF1A\u4FDD\u7559\u539F\u7247\u5F00\u5934\u7684**\u53E5\u5F0F\u7ED3\u6784**\u548C\u6293\u4EBA\u7684\u673A\u5236\uFF08\u60AC\u5FF5/\u53CD\u5E38\u8BC6/\u51B2\u7A81\u2026\u2026\uFF09\uFF0C\u628A\u884C\u4E1A\u8BCD\u3001\u4EBA\u7269\u3001\u4E8B\u4EF6\u6362\u6210\u8FD9\u4E2A\u8D26\u53F7\u7684",
  structure: "\u7ED3\u6784\uFF1A\u4FDD\u7559\u539F\u7247\u6BB5\u843D\u7684**\u987A\u5E8F\u548C\u6BCF\u6BB5\u7684\u4F5C\u7528**\uFF08\u6BD4\u5982\u7ED3\u679C\u524D\u7F6E\u2192\u8865\u539F\u56E0\u2192\u7EC6\u8282\u8BC1\u636E\u2192\u8F6C\u673A\uFF09\uFF0C\u6BCF\u6BB5\u7684\u5185\u5BB9\u5168\u90E8\u6362\u6210\u8FD9\u4E2A\u8D26\u53F7\u81EA\u5DF1\u7684\u4E8B",
  presentation: "\u5448\u73B0\u5F62\u5F0F\uFF1A\u501F\u539F\u7247**\u600E\u4E48\u62CD**\u2014\u2014\u5448\u73B0\u65B9\u5F0F\uFF08\u53E3\u64AD/vlog/\u5267\u60C5/\u91C7\u8BBF\uFF09\u3001\u89C6\u89D2\u3001\u51FA\u955C\u4EBA\u7269\u3001\u9053\u5177\u3001\u51FA\u573A\u65B9\u5F0F\uFF1B\u573A\u666F\u6362\u6210\u8FD9\u4E2A\u8D26\u53F7\u80FD\u62CD\u5230\u7684",
  rhythm: "\u955C\u5934\u8282\u594F\uFF1A\u501F\u539F\u7247\u7684**\u5207\u955C\u9891\u7387\u548C\u666F\u522B\u53D8\u5316**\uFF08\u591A\u957F\u5207\u4E00\u5200\u3001\u4EC0\u4E48\u65F6\u5019\u4E0A\u7279\u5199\uFF09",
  emotion: "\u60C5\u7EEA\u66F2\u7EBF\uFF1A\u501F\u539F\u7247**\u60C5\u7EEA\u8D77\u4F0F\u7684\u4F4D\u7F6E\u548C\u624B\u6CD5**\uFF08\u7B2C\u51E0\u79D2\u8DCC\u3001\u7B2C\u51E0\u79D2\u5347\u3001\u9760\u4EC0\u4E48\uFF09\uFF0C\u60C5\u7EEA\u70B9\u6362\u6210\u8FD9\u4E2A\u8D26\u53F7\u771F\u5B9E\u4F1A\u53D1\u751F\u7684\u4E8B",
  suspense: "\u60AC\u5FF5\u548C\u5151\u73B0\uFF1A\u501F\u539F\u7247**\u57CB\u94A9\u5B50\u548C\u5151\u73B0\u7684\u8282\u594F**\uFF08\u94A9\u5B50\u5728\u54EA\u3001\u9694\u591A\u4E45\u5151\u73B0\uFF09\uFF0C\u94A9\u5B50\u5185\u5BB9\u6362\u6210\u8FD9\u4E2A\u8D26\u53F7\u7684",
  punchline: "\u91D1\u53E5\uFF1A\u501F\u539F\u7247\u91D1\u53E5\u7684**\u53E5\u5F0F**\uFF08\u5BF9\u4ED7\u3001\u53CD\u8F6C\u3001\u6BD4\u55BB\uFF09\uFF0C\u5185\u5BB9\u6362\u6210\u8FD9\u4E2A\u884C\u4E1A\u7684\u9053\u7406",
  persona: "\u4EBA\u8BBE\u548C\u4EBA\u7269\u5173\u7CFB\uFF1A\u501F\u539F\u7247**\u8C01\u51FA\u955C\u3001\u8DDF\u8C01\u4E92\u52A8\u3001\u4EE5\u4EC0\u4E48\u8EAB\u4EFD\u8BF4\u8BDD**\uFF0C\u8EAB\u4EFD\u6362\u6210\u8FD9\u4E2A\u8D26\u53F7\u7684\u8001\u677F/\u5458\u5DE5/\u5BA2\u4EBA",
  conversion: "\u7ED3\u5C3E\u548C\u8F6C\u5316\uFF1A\u501F\u539F\u7247**\u7ED3\u5C3E\u7684\u884C\u52A8\u6307\u4EE4\u8BBE\u8BA1**\uFF0C\u6307\u5411\u8FD9\u4E2A\u8D26\u53F7\u7684\u8F6C\u5316\u8DEF\u5F84\uFF08\u5230\u5E97/\u79C1\u4FE1/\u56E2\u8D2D\uFF09",
  series: "\u7CFB\u5217\u5316\uFF1A\u770B\u539F\u7247\u80FD\u4E0D\u80FD\u62BD\u6210\u4E00\u4E2A**\u53EF\u4EE5\u8FDE\u7EED\u62CD\u7684\u7CFB\u5217**\uFF08\u4FDD\u7559\u7CFB\u5217\u7684\u683C\u5F0F\uFF0C\u6362\u6210\u8FD9\u4E2A\u884C\u4E1A\u80FD\u4E00\u96C6\u96C6\u62CD\u4E0B\u53BB\u7684\u4E3B\u9898\uFF09",
  topicAngle: "\u9009\u9898\u89D2\u5EA6\uFF1A\u501F\u539F\u7247**\u8BA8\u8BBA\u7684\u8BDD\u9898\u6216\u89D2\u5EA6**\uFF0C\u6362\u6210\u8FD9\u4E2A\u884C\u4E1A\u7684\u8BF4\u6CD5\uFF08\u540C\u4E00\u9009\u9898\u4E0D\u540C\u8868\u8FBE\uFF09"
};
function storeSection2(store) {
  if (!store?.name.trim() && !store?.lines.length && !store?.track?.trim()) return "";
  const lines = store.lines.filter(Boolean);
  return [
    `## \u4E8C\u521B\u5230\u54EA\u5BB6\u5E97\uFF08\u4EE5\u8FD9\u4E2A\u6863\u6848\u4E3A\u51C6\uFF0C\u786C\u7EA6\u675F\uFF09`,
    `- **\u5E97 / \u8D26\u53F7**\uFF1A${store.name.trim() || "\u5F53\u524D\u6863\u6848"}`,
    store.track?.trim() ? `- **\u884C\u4E1A / \u8D5B\u9053**\uFF1A${store.track.trim()}` : "",
    lines.length ? `- **\u5728\u5356\u7684\u54C1\u7C7B**\uFF1A${lines.join("\u3001")}` : "",
    `- \u6BCF\u4E2A\u65B9\u6848\u91CC\u7684**\u4E8B\u4EF6\u3001\u573A\u666F\u3001\u4EA7\u54C1\u3001\u51FA\u955C\u7684\u4EBA**\u90FD\u5FC5\u987B\u662F\u8FD9\u5BB6\u5E97\u7684\uFF1A\u539F\u7247\u662F\u4EC0\u4E48\u884C\u4E1A\u4E0D\u91CD\u8981\uFF0C\u5199\u51FA\u6765\u7684\u4E00\u5F8B\u662F${lines.length ? `\u300C${lines.join("\u3001")}\u300D` : "\u8FD9\u5BB6\u5E97"}\u7684\u4E8B`,
    lines.length > 1 ? `- ${lines.length} \u4E2A\u54C1\u7C7B\u90FD\u5728\u5356\u3001\u4E00\u6837\u91CD\u8981\uFF1A\u65B9\u6848\u8981\u8986\u76D6\u5230\u5B83\u4EEC\uFF08\u53EF\u4EE5\u4E00\u4E2A\u65B9\u6848\u843D\u4E00\u4E2A\u54C1\u7C7B\uFF0C\u4E5F\u53EF\u4EE5\u4E00\u6761\u91CC\u5E26\u51FA\u51E0\u6837\uFF09\uFF0C\u4E0D\u8981\u53EA\u6311\u4E00\u4E2A\u5199` : "",
    `- \u4F8B\u5B50\u3001\u53F0\u8BCD\u91CC\u63D0\u5230\u7684\u83DC\u54C1/\u5546\u54C1/\u670D\u52A1\uFF0C\u53EA\u80FD\u4ECE\u4E0A\u9762\u7684\u54C1\u7C7B\u548C\u4E0B\u9762\u7684\u6863\u6848\u91CC\u53D6\uFF0C\u4E0D\u8981\u7F16\u8FD9\u5BB6\u5E97\u6CA1\u6709\u7684\u4E1C\u897F`
  ].filter(Boolean).join("\n");
}
function buildRemixPrompt2(source, o) {
  const layers = o.layers.length ? o.layers : DEFAULT_LAYERS2;
  const notBorrowed = BORROW_LAYERS2.filter((l) => !layers.includes(l.id)).map((l) => l.label);
  const outputs = new Set(o.outputs);
  const quick = o.depth === "quick";
  const deep = o.depth === "deep";
  const sourceText = source.kind === "breakdown" ? condenseBreakdown2(source.text) : source.text.trim().slice(0, MAX_SOURCE_CHARS2);
  const sections = [
    `### \u65B9\u6848 1\uFF1A\u4E00\u4E2A\u8BA9\u4EBA\u4E00\u770B\u5C31\u61C2\u7684\u540D\u5B57`,
    `**\u4E00\u53E5\u8BDD**\uFF1A\u539F\u7247\u7684\u300C\u4EC0\u4E48\u300D\u2192 \u4F60\u5E97\u91CC\u7684\u300C\u4EC0\u4E48\u300D\uFF08\u4F8B\uFF1A\u539F\u7247"\u5E2E\u7C89\u4E1D\u4E70\u8F66" \u2192 \u4F60\u7684"\u5E2E\u5BA2\u4EBA\u6311\u4ECA\u5929\u6700\u65B0\u9C9C\u7684\u90A3\u5757\u8089"\uFF09`,
    `**\u501F\u4E86**\uFF1A\u2026\u2026 **\u6362\u6210\u81EA\u5DF1\u7684**\uFF1A\u2026\u2026`,
    "",
    `#### \u8FC1\u79FB\u5BF9\u7167`,
    `| \u5C42 | \u539F\u7247 | \u4F60\u7684\u7248\u672C |`,
    `\uFF08\u6BCF\u4E2A\u501F\u7684\u5C42\u4E00\u884C\uFF0C\u518D\u52A0\u4E00\u884C"\u4E8B\u4EF6/\u4E3B\u89D2"\u2014\u2014\u8BF4\u6E05\u539F\u7247\u8BB2\u7684\u662F\u8C01\u7684\u4EC0\u4E48\u4E8B\u3001\u4F60\u8BB2\u7684\u662F\u8C01\u7684\u4EC0\u4E48\u4E8B\uFF09`,
    "",
    `#### \u5F00\u5934\uFF08\u524D 3 \u79D2\uFF09`,
    `\u7B2C\u4E00\u53E5\u8BDD\u9010\u5B57\u5199\u51FA\u6765\uFF0C\u518D\u5199\u8FD9 3 \u79D2\u753B\u9762\u91CC\u6709\u4EC0\u4E48`
  ];
  if (quick) {
    sections.push("", `#### \u53E3\u64AD\u8981\u70B9`, `\u6309\u7ED3\u6784\u5206\u6BB5\u5217\u8981\u70B9\uFF0C\u6BCF\u6BB5\u4E00\u4E24\u53E5\uFF0C\u4E0D\u5199\u5168\u6587`);
  } else {
    if (outputs.has("script")) sections.push("", `#### \u53E3\u64AD\u5168\u6587`, `\u6309\u7ED3\u6784\u5206\u6BB5\uFF0C\u6BCF\u6BB5\u524D\u9762\u7528\u3010\u3011\u6807\u51FA\u8FD9\u6BB5\u7684\u4F5C\u7528\uFF08\u5982\u3010\u5F00\u7BC7\u94A9\u5B50\u3011\u3010\u94FA\u57AB\u3011\u3010\u8BC1\u636E\u3011\u3010\u5151\u73B0\u3011\u3010\u884C\u52A8\u6307\u4EE4\u3011\uFF09\uFF0C\u603B\u957F\u5EA6\u7B26\u5408\u8981\u6C42\u7684\u65F6\u957F`);
    if (outputs.has("shots"))
      sections.push(
        "",
        `#### \u5206\u955C`,
        deep ? `\u6BCF\u4E00\u955C\u4E00\u884C\u5217\u8868\uFF1A**\u955C\u5934 N\uFF5C\u8D77\u6B62\u79D2\u6570**\uFF1A\u753B\u9762\uFF08\u8C01\u3001\u5728\u54EA\u3001\u505A\u4EC0\u4E48\u52A8\u4F5C\uFF09\uFF5C\u666F\u522B\u548C\u8FD0\u955C\uFF5C\u53F0\u8BCD\u6216\u5B57\u5E55\u539F\u6587\uFF5C\u8FD9\u4E00\u955C\u7684\u4F5C\u7528\u3002\u955C\u5934\u8981\u7EC6\u5230\u80FD\u76F4\u63A5\u7167\u7740\u62CD` : `\u6BCF\u4E00\u955C\u4E00\u884C\u5217\u8868\uFF1A**\u955C\u5934 N\uFF5C\u8D77\u6B62\u79D2\u6570**\uFF1A\u753B\u9762\uFF5C\u53F0\u8BCD\u6216\u5B57\u5E55\u30026\uFF5E10 \u955C`
      );
    if (outputs.has("shootPlan")) sections.push("", `#### \u7528\u4F60\u624B\u4E0A\u7684\u8D44\u6E90\u600E\u4E48\u62CD`, `\u51E0\u4E2A\u4EBA\u3001\u8C01\u51FA\u955C\u3001\u7528\u4EC0\u4E48\u8BBE\u5907\u3001\u5728\u54EA\u62CD\u3001\u8981\u51C6\u5907\u4EC0\u4E48\u9053\u5177\u3001\u5927\u6982\u62CD\u591A\u4E45\uFF1B\u6863\u6848\u91CC\u6CA1\u6709\u7684\u8D44\u6E90\u4E0D\u8981\u5B89\u6392`);
    if (outputs.has("titles")) sections.push("", `#### \u6807\u9898\u548C\u5C01\u9762`, `3 \u4E2A\u6807\u9898 + \u5C01\u9762\u4E0A\u7684\u5B57\uFF08\u5C01\u9762\u5B57 10 \u4E2A\u5B57\u4EE5\u5185\uFF09`);
    if (outputs.has("comment")) sections.push("", `#### \u8BC4\u8BBA\u533A\u7F6E\u9876`, `\u4E00\u6761\u5F15\u5BFC\u4E92\u52A8\u7684\u7F6E\u9876\u8BC4\u8BBA`);
    if (outputs.has("altOpenings") || deep) sections.push("", `#### \u5907\u9009\u5F00\u5934`, `\u518D\u7ED9 3 \u4E2A\u4E0D\u540C\u7C7B\u578B\u7684\u5F00\u5934\uFF0C\u4E00\u53E5\u8BDD\u4E00\u4E2A`);
  }
  sections.push("", `#### \u6CE8\u610F`, `\u539F\u7247\u5B66\u4E0D\u6765\u7684\u90E8\u5206\uFF08\u9760\u8EAB\u4EFD\u3001\u9AD8\u6210\u672C\u3001\u5076\u7136\uFF09\u8FD9\u4E2A\u65B9\u6848\u600E\u4E48\u7ED5\u5F00\uFF1B\u4EE5\u53CA"\u8FD9\u6761\u4E0D\u662F\u642C\u8FD0"\uFF1A\u53F0\u8BCD\u3001\u753B\u9762\u3001\u4E8B\u4EF6\u90FD\u662F\u81EA\u5DF1\u7684`);
  const target = o.profileSummary?.trim() ? [storeSection2(o.store), `## \u8FD9\u4E2A\u8D26\u53F7\u7684\u6863\u6848\uFF08\u4E8C\u521B\u8981\u843D\u5230\u5B83\u8EAB\u4E0A\uFF09
${o.profileSummary.trim()}`].filter(Boolean).join("\n\n") : `## \u8FD9\u4E2A\u8D26\u53F7
${o.targetIndustry?.trim() ? `\u505A\u7684\u662F\uFF1A${o.targetIndustry.trim()}\u3002\u6240\u6709\u65B9\u6848\u90FD\u6362\u6210\u8FD9\u4E2A\u884C\u4E1A` : "\u7528\u6237\u6CA1\u8BF4\u81EA\u5DF1\u662F\u505A\u4EC0\u4E48\u7684\uFF1A\u6309\u539F\u7247\u6700\u5BB9\u6613\u8FC1\u79FB\u7684\u5B9E\u4F53\u5E97\u884C\u4E1A\u4E3E\u4F8B\uFF0C\u5E76\u63D0\u9192\u4ED6\u9009\u597D\u6863\u6848\u518D\u505A\u4E00\u6B21"}`;
  const context = o.contextBlock?.trim();
  return `\u3010\u4EFB\u52A1\uFF1A\u8DE8\u884C\u4E1A\u4E8C\u521B\u3011\u4F60\u662F\u5E26\u8FC7\u4E0A\u767E\u4E2A\u5B9E\u4F53\u5E97\u8D77\u53F7\u7684\u7F16\u5BFC\u3002\u4E0B\u9762\u662F\u522B\u7684\u884C\u4E1A\u4E00\u6761\u7206\u6B3E\u7684\u62C6\u89E3\uFF08\u6216\u6587\u6848\uFF09\uFF0C
\u5E2E\u8FD9\u4E2A\u8D26\u53F7\u628A\u5B83**\u4E8C\u521B**\u6210\u81EA\u5DF1\u80FD\u62CD\u7684\u5185\u5BB9\u3002\u76EE\u7684\u4E0D\u662F\u7167\u6284\uFF0C\u662F\u501F\u8D70\u5B83\u706B\u7684"\u673A\u5236"\uFF0C\u6362\u4E0A\u81EA\u5DF1\u7684\u8840\u8089\u3002

## \u65B9\u6CD5\uFF08\u77E5\u8BC6\u5E93\u539F\u5219\uFF0C\u5FC5\u987B\u5B88\u4F4F\uFF09
- **\u884C\u4E1A\u5185\u770B\u9009\u9898\uFF0C\u8DE8\u884C\u4E1A\u770B\u5F00\u7BC7\u3001\u91D1\u53E5\u3001\u5448\u73B0\u5F62\u5F0F**\u2014\u2014\u8FD9\u662F\u907F\u5F00\u540C\u884C\u5185\u5377\u7684\u529E\u6CD5
- \u501F\u7684\u662F**\u7ED3\u6784\u548C\u673A\u5236**\uFF08\u53E5\u5F0F\u3001\u6BB5\u843D\u987A\u5E8F\u3001\u62CD\u6CD5\u3001\u8282\u594F\uFF09\uFF0C**\u4E0D\u662F\u5177\u4F53\u5185\u5BB9**\uFF1A
  \u539F\u7247\u7684\u53F0\u8BCD\u3001\u753B\u9762\u3001\u4EBA\u7269\u7ECF\u5386\u3001\u6570\u5B57\u4E00\u5F8B\u4E0D\u642C\u3002"\u5E2E\u7C89\u4E1D\u4E70\u8F66"\u2192"\u5E2E\u7C89\u4E1D\u505A\u8D26\u53F7"\u662F\u4E8C\u521B\uFF1B\u628A\u539F\u7247\u53F0\u8BCD\u6362\u4E24\u4E2A\u8BCD\u5FF5\u4E00\u904D\u662F\u642C\u8FD0\uFF0C\u5E73\u53F0\u4F1A\u5224\u642C\u8FD0\u3001\u4E0D\u7ED9\u6D41\u91CF
- \u5F00\u7BC7\uFF1A\u4FDD\u7559\u53E5\u5F0F\u7ED3\u6784\uFF0C\u66FF\u6362\u884C\u4E1A\u5173\u952E\u8BCD\uFF08"\u4FE1\u4E0D\u4FE115\u79D2\u8BA9\u4F60\u653E\u5F03\u6446\u644A"\u6362\u4EFB\u4F55\u884C\u4E1A\u90FD\u80FD\u7528\uFF09
- \u7ED3\u6784\uFF1A\u56F0\u5883\u2192\u8F6C\u673A\u3001\u7ED3\u679C\u524D\u7F6E\u2192\u8865\u539F\u56E0\u8FD9\u7C7B\u9AA8\u67B6\u8DE8\u884C\u4E1A\u901A\u7528\uFF0C\u6BCF\u6BB5\u7684\u4E8B\u8981\u6362\u6210\u8FD9\u4E2A\u8D26\u53F7\u771F\u5B9E\u4F1A\u53D1\u751F\u7684\u4E8B
- \u5448\u73B0\u5F62\u5F0F\u6709\u4E94\u4E2A\u53EF\u53D8\u7EF4\u5EA6\uFF1A\u62CD\u6444\u89D2\u5EA6\u3001\u51FA\u955C\u4EBA\u7269\u3001\u51FA\u573A\u65B9\u5F0F\u3001\u9053\u5177\u3001\u526A\u8F91\u65B9\u5F0F

## \u539F\u7247${source.title ? `\uFF1A${source.title}` : ""}${source.industry ? `\uFF08${source.industry}\uFF09` : ""}
${source.kind === "breakdown" ? "\uFF08\u4E0B\u9762\u662F\u8FD9\u6761\u89C6\u9891\u7684\u62C6\u89E3\u62A5\u544A\uFF0C\u9010\u4E2A\u955C\u5934\u7684\u5361\u7247\u5DF2\u7701\u7565\uFF0C\u8282\u594F\u4E00\u89C8\u8FD8\u5728\uFF09" : "\uFF08\u4E0B\u9762\u662F\u7528\u6237\u8D34\u7684\u539F\u7247\u6587\u6848\u6216\u63CF\u8FF0\uFF09"}
${sourceText}

${target}
${context ? `
${context}
` : o.restrictions?.trim() ? `
## \u786C\u7981\u5FCC\uFF08\u6240\u6709\u65B9\u6848\u3001\u4F8B\u5B50\u3001\u53F0\u8BCD\u90FD\u4E0D\u80FD\u78B0\uFF09
${o.restrictions.trim()}
` : ""}
## \u7528\u6237\u7684\u9009\u62E9\uFF08\u6309\u4ED6\u9009\u7684\u6765\uFF09
- **\u501F\u8FD9\u51E0\u5C42**\uFF1A
${layers.map((l) => `  - ${LAYER_RULES2[l]}`).join("\n")}
${notBorrowed.length ? `- **\u6CA1\u9009\u7684\u5C42**\uFF08${notBorrowed.join("\u3001")}\uFF09\uFF1A\u7528\u8FD9\u4E2A\u8D26\u53F7\u81EA\u5DF1\u7684\uFF0C\u4E0D\u8981\u7167\u642C\u539F\u7247` : ""}
- **\u51FA ${o.count} \u4E2A\u65B9\u6848**${o.count > 1 ? `\uFF0C\u65B9\u6848\u4E4B\u95F4\uFF1A${label2(DIFFERENTIATE2, o.differentiate)}\uFF08${DIFFERENTIATE2.find((d) => d.id === o.differentiate)?.hint}\uFF09` : ""}
- **\u6DF1\u5EA6**\uFF1A${label2(DEPTHS2, o.depth)}\uFF08${DEPTHS2.find((d) => d.id === o.depth)?.hint}\uFF09
- **\u76EE\u7684**\uFF1A${o.role === "same" ? "\u8DDF\u539F\u7247\u4E00\u6837\uFF08\u5148\u5224\u65AD\u539F\u7247\u662F\u6D41\u91CF\u578B/\u4EBA\u8BBE\u578B/\u53D8\u73B0\u578B\uFF09" : o.role}\u2014\u2014\u7ED3\u5C3E\u7684\u884C\u52A8\u6307\u4EE4\u6309\u8FD9\u4E2A\u76EE\u7684\u53EA\u9009\u4E00\u4E2A
- **\u65F6\u957F**\uFF1A${o.duration === "\u8DDF\u539F\u7247" ? `\u53C2\u8003\u539F\u7247\u7684\u957F\u5EA6\uFF0C\u4F46\u4E0D\u5361\u6B7B\uFF1A${AI_LENGTH_RULE2}` : o.duration}
${o.notes?.trim() ? `- **\u8865\u5145\u8981\u6C42**\uFF1A${o.notes.trim()}` : ""}

## \u8F93\u51FA\u683C\u5F0F\uFF08Markdown\uFF1B${o.count} \u4E2A\u65B9\u6848\uFF0C\u6BCF\u4E2A\u90FD\u6309\u4E0B\u9762\u8FD9\u4E2A\u6837\u5B50\uFF0C\u65B9\u6848\u4E4B\u95F4\u7528 --- \u9694\u5F00\uFF09
\u5148\u7528\u4E24\u4E09\u53E5\u8BDD\u8BF4\uFF1A\u539F\u7247\u706B\u7684\u6838\u5FC3\u673A\u5236\u662F\u4EC0\u4E48\u3001\u4E3A\u4EC0\u4E48\u80FD\u8DE8\u884C\u4E1A\u501F\u3002\u7136\u540E\uFF1A

${sections.join("\n")}

\u6700\u540E\u4E00\u6BB5 **### \u6211\u63A8\u8350\u5148\u62CD\u54EA\u4E2A**\uFF1A\u8BF4\u6E05\u4E3A\u4EC0\u4E48\uFF08\u6700\u597D\u62CD\u3001\u6700\u8D34\u8FD9\u4E2A\u8D26\u53F7\u3001\u6700\u5BB9\u6613\u51FA\u6548\u679C\uFF09\u3002

## \u8981\u6C42
- \u6BCF\u4E2A\u65B9\u6848\u90FD\u5FC5\u987B\u662F**\u8FD9\u4E2A\u8D26\u53F7\u624B\u4E0A\u7684\u8D44\u6E90\u62CD\u5F97\u51FA\u6765\u7684**\uFF08\u770B\u6863\u6848\u91CC\u7684\u56E2\u961F\u3001\u8BBE\u5907\u3001\u573A\u5730\uFF09
- **\u4E0D\u8981\u66FF\u4ED6\u7F16\u7ECF\u5386**\uFF1A\u6863\u6848\u548C\u524D\u91C7\u8981\u70B9\u91CC\u6CA1\u6709\u7684\u4EBA\u751F\u7ECF\u5386\u3001\u8F6C\u6298\u4E8B\u4EF6\uFF08\u8F9E\u804C\u3001\u521B\u4E1A\u3001\u4E8F\u94B1\u3001\u5BB6\u91CC\u51FA\u4E8B\u2026\u2026\uFF09\uFF0C
  \u4E0D\u8BB8\u5199\u6210\u771F\u4E8B\u3002\u8981\u7528\u5230\u7684\u5730\u65B9\u5199\u6210\u300C\u3010\u6362\u6210\u4F60\u7684\uFF1A\u2026\u2026\u3011\u300D\u8BA9\u4ED6\u6362\u6210\u81EA\u5DF1\u7684\u771F\u5B9E\u7ECF\u5386\uFF0C\u91CC\u9762\u7ED9\u4E00\u4E2A\u53C2\u8003\u65B9\u5411\uFF0C\u6BD4\u5982
  \u300C\u3010\u6362\u6210\u4F60\u7684\uFF1A\u5F00\u5E97\u65F6\u771F\u5B9E\u9047\u5230\u8FC7\u7684\u4E00\u4E2A\u96BE\u5904\uFF0C\u6BD4\u5982\u7B2C\u4E00\u4E2A\u6708\u751F\u610F\u5F88\u5DEE\u3011\u300D\u3002
  \uFF08\u53E3\u64AD\u91CC\u6807\u6BB5\u843D\u4F5C\u7528\u7684\u3010\u5F00\u7BC7\u94A9\u5B50\u3011\u3010\u94FA\u57AB\u3011\u662F\u53E6\u4E00\u56DE\u4E8B\uFF0C\u8981\u586B\u7684\u5730\u65B9\u4E00\u5B9A\u4EE5"\u6362\u6210\u4F60\u7684\uFF1A"\u5F00\u5934\uFF0C\u4E00\u773C\u5206\u5F97\u6E05\uFF09
  \u5B9E\u6D4B\uFF1A\u539F\u7247\u662F\u771F\u4EBA\u771F\u4E8B\uFF0C\u6A21\u578B\u66FF\u8001\u677F\u7F16\u4E86"\u8F9E\u6389\u5927\u5382\u5DE5\u4F5C\u3001\u6495\u4E86 X \u4E07\u5E74\u85AA\u5DE5\u8D44\u6761"\u2014\u2014\u6863\u6848\u91CC\u6839\u672C\u6CA1\u6709\uFF0C\u7167\u7740\u62CD\u5C31\u662F\u5047\u6545\u4E8B\uFF0C
  \u800C\u8FD9\u7C7B\u5185\u5BB9\u7684\u6838\u5FC3\u6070\u6070\u662F\u771F\u5B9E
- \u4E0D\u8981\u66FF\u7528\u6237\u7F16\u6570\u5B57\uFF1A\u6863\u6848\u91CC\u6CA1\u6709\u7684\u4EBA\u6570\u3001\u91D1\u989D\u3001\u5E74\u9650\u3001\u64AD\u653E\u91CF\u5199\u6210 X
- \u4E0D\u8BF4"\u63ED\u79D8"\uFF0C\u4E0D\u7528\u7EDD\u5BF9\u5316\u7528\u8BED\uFF0C\u4E0D\u8BCB\u6BC1\u540C\u884C\u548C\u5BA2\u4EBA
- \u5927\u767D\u8BDD\uFF0C\u4E0D\u8981"\u8D4B\u80FD""\u6253\u9020""\u77E9\u9635"\u8FD9\u7C7B\u8BCD`;
}

// lib/profile-summary.ts
var asText = (v, fallback = "") => {
  if (v == null) return fallback;
  const s = Array.isArray(v) ? v.filter(Boolean).join("\u3001") : String(v);
  return s.trim() || fallback;
};
var PROFILE_SUMMARY_FIELDS = [
  ["account_platform", "\u5E73\u53F0"],
  ["account_track", "\u8D5B\u9053"],
  ["account_stage", "\u8D26\u53F7\u9636\u6BB5"],
  ["fans_level", "\u7C89\u4E1D\u91CF\u7EA7"],
  ["viral_content_pattern", "\u6570\u636E\u6700\u597D\u7684\u5185\u5BB9\u7C7B\u578B\uFF08\u5B9A\u4E3B\u6253\u5185\u5BB9\u7684\u9996\u8981\u4F9D\u636E\uFF09"],
  ["target_region", "\u5730\u57DF"],
  ["target_age", "\u76EE\u6807\u5E74\u9F84"],
  ["target_gender", "\u76EE\u6807\u6027\u522B"],
  ["target_occupation", "\u76EE\u6807\u804C\u4E1A"],
  ["target_interests", "\u76EE\u6807\u4EBA\u7FA4\u7684\u5174\u8DA3"],
  ["target_pain_points", "\u5BA2\u4EBA\u6700\u62C5\u5FC3"],
  ["target_needs", "\u4ED6\u4EEC\u771F\u6B63\u60F3\u8981"],
  ["fan_common_questions", "\u5BA2\u4EBA\u5E38\u95EE"],
  ["content_category", "\u5185\u5BB9\u7C7B\u522B"],
  ["content_themes", "\u5DF2\u6709\u7684\u5185\u5BB9\u65B9\u5411"],
  ["content_value", "\u60F3\u8BA9\u89C2\u4F17\u53D1\u751F\u7684\u53D8\u5316"],
  ["unique_selling_point", "\u6838\u5FC3\u5356\u70B9"],
  ["competitive_advantage", "\u7ADE\u4E89\u4F18\u52BF"],
  ["competitive_weakness", "\u76EE\u524D\u7684\u77ED\u677F"],
  ["unique_resources", "\u624B\u4E0A\u7684\u8D44\u6E90"],
  ["reference_accounts", "\u53C2\u8003\u8D26\u53F7"],
  ["content_style", "\u5185\u5BB9\u98CE\u683C"],
  ["content_tone", "\u8BED\u8A00\u98CE\u683C"],
  ["content_format", "\u5185\u5BB9\u5F62\u5F0F"],
  ["video_duration", "\u89C6\u9891\u65F6\u957F"],
  ["team_structure", "\u56E2\u961F"],
  ["equipment", "\u8BBE\u5907"],
  ["shooting_location", "\u573A\u5730"],
  ["editing_capability", "\u540E\u671F\u80FD\u529B"],
  ["budget_per_video", "\u5355\u6761\u9884\u7B97"],
  ["monetization_model", "\u53D8\u73B0\u65B9\u5F0F"],
  ["product_category", "\u5356\u7684\u4EA7\u54C1/\u670D\u52A1"],
  ["price_range", "\u4EF7\u683C\u533A\u95F4"],
  ["conversion_path", "\u6210\u4EA4\u8DEF\u5F84"],
  ["conversion_hooks", "\u8F6C\u5316\u94A9\u5B50"],
  ["conversion_barriers", "\u6210\u4EA4\u969C\u788D"],
  ["avoid_content", "\u4E0D\u60F3\u62CD\u7684\u5185\u5BB9"],
  // 前采建档提取出来、档案字段装不下的：老板经历、招牌产品、真实数据、客户原话。
  // 放最后：前面的字段是"是什么"，这里是"凭什么信"的素材
  ["interview_highlights", "\u524D\u91C7\u8981\u70B9\uFF08\u5BA2\u6237\u539F\u8BDD\u548C\u771F\u5B9E\u7EC6\u8282\uFF0C\u5199\u5185\u5BB9\u65F6\u4F18\u5148\u7528\uFF09"]
];
var listOf = (v) => Array.isArray(v) ? v.filter((x) => typeof x === "string").flatMap((x) => x.split(/[、,，]/)).map((x) => x.trim()).filter(Boolean) : typeof v === "string" ? v.split(/[、,，]/).map((x) => x.trim()).filter(Boolean) : [];
var BUSINESS_LINES_LABEL = "- \u7ECF\u8425\u54C1\u7C7B\uFF08\u6BCF\u4E00\u4E2A\u90FD\u5728\u5356\uFF0C\u5B9A\u4F4D\u91CC\u90FD\u8981\u4F53\u73B0\uFF09\uFF1A";
function businessLines(p) {
  const generic = /* @__PURE__ */ new Set([...PROFILE_CHOICES.product_category, ...PROFILE_CHOICES.account_track]);
  const products = listOf(p.product_category).filter((x) => !generic.has(x));
  const all = products.length ? products : listOf(p.account_track).filter((x) => !generic.has(x));
  return Array.from(new Set(all));
}
function buildProfileSummary(profile2) {
  const p = scrubProfile(profile2, readTabooSettings(profile2.taboo_settings).excluded) ?? profile2;
  const lines = [`- \u6863\u6848\u540D\u79F0\uFF1A${asText(p.profile_name, "\u672A\u547D\u540D")}`];
  const persona = personaFactsBlock(profile2.persona_facts);
  if (persona) lines.push("", persona, "");
  const products = businessLines(p);
  if (products.length) lines.push(`${BUSINESS_LINES_LABEL}${products.join("\u3001")}`);
  for (const [key, label3] of PROFILE_SUMMARY_FIELDS) {
    const t = asText(p[key]);
    if (t) lines.push(`- ${label3}\uFF1A${t}`);
  }
  return lines.join("\n");
}

// .tmp/content-repair-probe_20261008.ts
for (const line3 of import_node_fs.default.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line3.match(/^([A-Z_][A-Z_0-9]*)=(.*)$/);
  if (m) process.env[m[1]] = m[2].trim().replace(/^(['"])(.*)\1$/, "$2");
}
var root = "docs/\u5168\u677F\u5757\u8D28\u91CF\u4FEE\u590D_20261008";
import_node_fs.default.mkdirSync(root + "/\u6B63\u5F0F\u6A21\u578B\u5BF9\u7167", { recursive: true });
var audit = JSON.parse(import_node_fs.default.readFileSync("docs/\u5168\u521B\u4F5C\u677F\u5757\u5B9E\u6D4B_20261008/\u6B63\u5F0F\u6A21\u578B\u5B9E\u6D4B.json", "utf8"));
var profile = audit.profile;
var ctx = { profile, positioning: null, dealReasons: [], brief: null };
var oldInput = (id) => import_node_fs.default.readFileSync(`docs/\u5168\u521B\u4F5C\u677F\u5757\u5B9E\u6D4B_20261008/\u6A21\u578B\u539F\u59CB\u8BB0\u5F55/${id}_\u8F93\u5165.txt`, "utf8");
var summary = buildProfileSummary(profile);
var src = { kind: "paste", industry: "\u9910\u996E", title: "\u865A\u6784\u6D4B\u8BD5\uFF1A\u70B9\u83DC\u5148\u770B\u4EBA\u6570", text: "\u70B9\u83DC\u524D\uFF0C\u5148\u522B\u6025\u7740\u770B\u62DB\u724C\u3002\u4ECA\u5929\u62FF\u5E97\u91CC\u8FD9\u5957\u9910\u5177\u770B\u4E00\u773C\uFF1A\u4E24\u4E2A\u4EBA\u5403\uFF0C\u684C\u4E0A\u80FD\u6446\u591A\u5C11\u76D8\uFF1B\u518D\u591A\u70B9\u4E00\u9053\uFF0C\u4F4D\u7F6E\u8FD8\u591F\u4E0D\u591F\u3002\u628A\u81EA\u5DF1\u6765\u51E0\u4E2A\u4EBA\u3001\u60F3\u5403\u4EC0\u4E48\u8BB0\u4E0B\u6765\u3002\u83DC\u559C\u6B22\uFF0C\u4E5F\u5F97\u5403\u5F97\u5B8C\u3002" };
var opts = { layers: ["opening", "structure", "presentation"], count: 1, differentiate: "auto", depth: "quick", role: "\u6D41\u91CF\u578B", duration: "30 \u79D2", outputs: ["script", "shots", "shootPlan"], profileSummary: summary, store: { name: profile.profile_name, lines: ["\u6C99\u53D1", "\u5E8A", "\u8863\u67DC"], track: "\u5BB6\u5C45\u5BB6\u88C5" }, restrictions: profile.content_restrictions, notes: "\u53EA\u501F\u8868\u8FBE\u673A\u5236\uFF0C\u4E0D\u642C\u8FD0\u539F\u884C\u4E1A\u7ECF\u5386\uFF1B\u8001\u677F\u4E00\u4EBA\u624B\u673A\uFF0C\u53EA\u7528\u73B0\u6709\u6837\u67DC\u505A\u6F14\u793A\uFF0C\u4E0D\u7F16\u5C3A\u5BF8\u6570\u5B57\u6216\u987E\u5BA2\u7ECF\u5386\u3002" };
var getAnswer = (id) => audit.results.find((x) => x.id === id)?.answer || "";
var bp = { positioningFull: getAnswer("02_positioning") || JSON.parse(import_node_fs.default.readFileSync("docs/\u5168\u521B\u4F5C\u677F\u5757\u5B9E\u6D4B_20261008/\u8D26\u53F7\u5B9A\u4F4D\u9ED8\u8BA4\u5FEB\u901F\u7248\u5B9E\u6D4B.json", "utf8")).answer, profileSummary: summary, businessPositioning: getAnswer("07_business"), contentPositioning: getAnswer("08_content"), notes: "\u7F3A\u5C11\u8BC1\u636E\u7684\u7ECF\u8425\u4E8B\u5B9E\u548C\u670D\u52A1\u627F\u8BFA\u5FC5\u987B\u4FDD\u6301\u5F85\u786E\u8BA4\uFF0C\u4E0D\u8981\u628A\u65B9\u6848\u5EFA\u8BAE\u5199\u6210\u5E97\u94FA\u5DF2\u7ECF\u5177\u5907\u7684\u4E8B\u5B9E\u3002" };
var cases = [
  { id: "future_title_1", board: "\u6807\u9898\u5C01\u9762", before: oldInput("21_interview_titles"), after: oldInput("21_interview_titles") + "\n\n" + outputRulesBlock() },
  { id: "future_title_2", board: "\u6807\u9898\u5C01\u9762", before: oldInput("21_interview_titles"), after: oldInput("21_interview_titles") + "\n\n" + outputRulesBlock() },
  { id: "knowledge", board: "\u77E5\u8BC6\u5E93\u67E5\u8BE2", before: oldInput("06_knowledge"), after: oldInput("06_knowledge").replace(buildContextBlock2(ctx, "knowledge"), buildContextBlock(ctx, "knowledge")) },
  { id: "remix_one", board: "\u8DE8\u884C\u4E1A\u4E8C\u521B", before: buildRemixPrompt2(src, { ...opts, contextBlock: buildContextBlock2(ctx, "remix") }), after: buildRemixPrompt(src, { ...opts, contextBlock: buildContextBlock(ctx, "remix") }) },
  { id: "brief", board: "\u521B\u4F5C\u7B80\u62A5", before: buildBriefPrompt2(bp), after: buildBriefPrompt(bp) + "\n\n" + outputRulesBlock() }
];
var file = root + "/\u6B63\u5F0F\u6A21\u578B\u5BF9\u7167.json";
var report = import_node_fs.default.existsSync(file) ? JSON.parse(import_node_fs.default.readFileSync(file, "utf8")) : { startedAt: (/* @__PURE__ */ new Date()).toISOString(), scope: "\u76F8\u540C\u6B63\u5F0FDify\u5E94\u7528\u3001\u76F8\u540C\u5408\u6210\u6750\u6599\u3001\u524D\u540E\u63D0\u793A\u8BCD\u914D\u5BF9\uFF1B\u72EC\u7ACB\u8BCA\u65AD\u4F1A\u8BDD\uFF0C\u4E0D\u5199\u5BA2\u6237\u5386\u53F2\u6216\u989D\u5EA6\u8D26\u672C\uFF1B\u5E76\u53D1\u6700\u591A2\uFF0C\u4E0D\u4F5C\u4E3A\u5355\u7528\u6237\u5EF6\u8FDF\u57FA\u51C6", cases: [] };
async function run(c, variant) {
  if (report.cases.some((r) => r.id === c.id && r.variant === variant)) return;
  const query = c[variant];
  const start = Date.now();
  const stem = `${root}/\u6B63\u5F0F\u6A21\u578B\u5BF9\u7167/${c.id}_${variant}`;
  import_node_fs.default.writeFileSync(stem + "_\u8F93\u5165.txt", query);
  console.log(JSON.stringify({ start: c.id, variant, promptChars: query.length }));
  try {
    const r = await askDify(query, `kaiwu-repair-synthetic-20261008-${c.id}-${variant}`, "\u5185\u5BB9\u4E8B\u5B9E\u8FB9\u754C \u521B\u4F5C\u65B9\u6CD5", { signal: AbortSignal.timeout(36e4) });
    if (!r.ok) throw Error(r.message);
    const final = c.board === "\u6807\u9898\u5C01\u9762" && variant === "after" ? reconcileTitleCounts(r.text) : r.text;
    import_node_fs.default.writeFileSync(stem + "_\u539F\u59CB\u8F93\u51FA.md", r.text);
    import_node_fs.default.writeFileSync(stem + "_\u4EA4\u4ED8\u8F93\u51FA.md", final);
    report.cases.push({ id: c.id, board: c.board, variant, ok: true, elapsedMs: Date.now() - start, queryChars: query.length, answer: final, rawAnswer: r.text, completion: r.completion });
  } catch (e) {
    report.cases.push({ id: c.id, board: c.board, variant, ok: false, elapsedMs: Date.now() - start, error: e.message });
  }
  import_node_fs.default.writeFileSync(file, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ done: c.id, variant, ok: report.cases.at(-1).ok, elapsedMs: Date.now() - start }));
}
async function main() {
  for (const c of cases) await Promise.allSettled([run(c, "before"), run(c, "after")]);
  report.finishedAt = (/* @__PURE__ */ new Date()).toISOString();
  import_node_fs.default.writeFileSync(file, JSON.stringify(report, null, 2));
  console.log("FINISHED");
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
