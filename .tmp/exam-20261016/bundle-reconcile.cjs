"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// lib/result-reconciliation.ts
var result_reconciliation_exports = {};
__export(result_reconciliation_exports, {
  hasObviousCutoff: () => hasObviousCutoff,
  reconcileReviewScores: () => reconcileReviewScores,
  reconcileTitleCounts: () => reconcileTitleCounts,
  softenPlatformBannedWords: () => softenPlatformBannedWords,
  titleCharacterCount: () => titleCharacterCount
});
module.exports = __toCommonJS(result_reconciliation_exports);
function reconcileReviewScores(markdown) {
  const rows = [...markdown.matchAll(/^\s*\|([^\n|]+)\|\s*\*{0,2}(\d+(?:\.\d+)?)\s*\/\s*(\d+)\*{0,2}\s*\|/gm)].filter((m) => /核心目的|信息递进|事实与证据|表达与人设|拍摄执行|收束与目的/.test(m[1]));
  const expected = [20, 20, 20, 15, 15, 10];
  if (rows.length !== 6 || rows.some((m, i) => Number(m[3]) !== expected[i] || Number(m[2]) > expected[i])) return markdown;
  const sum = Math.round(rows.reduce((n, m) => n + Number(m[2]), 0) * 10) / 10;
  const score = Number((sum / 10).toFixed(2));
  return markdown.split("\n").map((line) => {
    const plain = line.replace(/\*/g, "").trim();
    if (/^(?:[-+]\s*)?(?:综合得分|综合评分|总评分|最终得分)\s*[：:]/.test(plain)) return `\u7EFC\u5408\u5F97\u5206\uFF1A${score} / 10\uFF08\u6309\u516D\u9879\u5F97\u5206\u5408\u8BA1\uFF09`;
    if (/^(?:[-+]\s*)?百分制合计\s*[：:]/.test(plain)) return `\u767E\u5206\u5236\u5408\u8BA1\uFF1A${sum} / 100 \u2192 \u6700\u7EC8\u5F97\u5206 ${score} / 10`;
    if (/^(?:[-+]\s*)?合计\s*[：:]\s*\d+(?:\.\d+)?\s*\/\s*100\s*→/.test(plain)) return `\u5408\u8BA1\uFF1A${sum} / 100 \u2192 ${score} / 10\uFF08\u6309\u516D\u9879\u5F97\u5206\u5408\u8BA1\uFF09`;
    if (/^(?:[-+]\s*)?总评补充说明\s*[：:]/.test(plain) && /六维评分|六项评分/.test(plain)) {
      return line.replace(/按实际表现调整为\s*\d+(?:\.\d+)?\s*分/g, `\u6700\u7EC8\u5408\u8BA1\u4E3A${score}\u5206`);
    }
    return line;
  }).join("\n");
}
function titleCharacterCount(title) {
  return (title.match(/[\p{L}\p{N}]/gu) ?? []).length;
}
function reconcileTitleCounts(markdown) {
  let title = "";
  let fenced = false;
  return markdown.split("\n").map((line) => {
    if (/^\s*(```|~~~)/.test(line)) {
      fenced = !fenced;
      title = "";
      return line;
    }
    if (fenced) return line;
    const heading = line.replace(/\*\*/g, "").match(/^\s*(?:#{1,4}\s*)?(?:标题\s*)?\d{1,2}[.、．:：)）]\s*(.+?)\s*$/);
    if (heading) title = heading[1];
    else if (/^\s*#{1,4}\s/.test(line)) title = "";
    if (title && /^\s*(?:[-*+]\s*)?\*{0,2}字数\*{0,2}\s*[：:]\s*\*{0,2}\d+/.test(line)) {
      return `- **\u5B57\u6570**\uFF1A${titleCharacterCount(title)} \u5B57\uFF08\u4E0D\u542B\u6807\u70B9\u548C\u7A7A\u683C\uFF09`;
    }
    return line;
  }).join("\n");
}
var PLATFORM_BANNED = [[/揭秘/g, "\u62C6\u89E3"]];
var NEGATED_LINE = /不说|不用|不能|禁止|别用|别说|避免|不要|不许|没有出现|未出现|删掉|去掉|不写|不得/;
function softenPlatformBannedWords(text) {
  return text.split("\n").map((line) => NEGATED_LINE.test(line) ? line : PLATFORM_BANNED.reduce((l, [re, to]) => l.replace(re, to), line)).join("\n");
}
function hasObviousCutoff(text) {
  return /【(?:画面|口播|台词|镜头|字幕|动作|第\d+步)?[^】\n]{0,10}$/.test(text.trimEnd()) || /(?:^|\n)\*\*(?:画|画面|台|台词|口|口播|字|字幕|动|动作|镜|镜头)$/.test(text.trimEnd());
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  hasObviousCutoff,
  reconcileReviewScores,
  reconcileTitleCounts,
  softenPlatformBannedWords,
  titleCharacterCount
});
