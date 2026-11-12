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

// .tmp/content-repair-metrics_20261008.ts
var import_node_fs = __toESM(require("node:fs"));

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
var multi = (key, label) => ({ key, label, kind: "multi", options: PROFILE_CHOICES[key] });
var single = (key, label) => ({ key, label, kind: "single", options: PROFILE_CHOICES[key] });
var text = (key, label) => ({ key, label, kind: "text" });
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

// lib/taboos.ts
var ANALYSIS = "(?!\u7684?(?:\u4F18\u52BF|\u77ED\u677F|\u95EE\u9898|\u96BE\u70B9|\u98CE\u9669|\u533A\u522B|\u597D\u5904|\u7279\u70B9|\u5356\u70B9|\u4EAE\u70B9|\u539F\u56E0|\u6311\u6218|\u969C\u788D|\u963B\u529B|\u53D8\u5316|\u6536\u83B7|\u611F\u53D7|\u56F0\u96BE|\u75DB\u70B9|\u673A\u4F1A|\u5DEE\u8DDD|\u4E0D\u540C|\u6559\u8BAD))";
var MEASURE = "(?!\u7684?(?:\u89D2\u5EA6|\u5C3A\u5BF8|\u627F\u91CD|\u529F\u7387|\u5BB9\u91CF|\u9650\u5EA6|\u7A0B\u5EA6|\u8303\u56F4|\u503C|\u901F\u5EA6|\u6E29\u5EA6|\u5F00\u53E3|\u5E45\u5EA6|\u957F\u5EA6|\u5BBD\u5EA6|\u9AD8\u5EA6|\u6DF1\u5EA6|\u91CD\u91CF|\u9762\u79EF|\u6863|\u706B|\u53F7|\u7801|\u97F3\u91CF|\u4EAE\u5EA6|\u529B\u5EA6|\u538B\u529B))";
var ABSOLUTE = `(?:\u5168\u7F51|\u5168\u57CE|\u5168\u56FD|\u5168\u5E02|\u53F2\u4E0A)?\u6700(?:\u6B63\u5B97|\u597D\u5403|\u597D(?![\u5148\u662F\u522B\u4E0D\u80FD\u7528\u5728\u8FD8\u6BCF\u627E\u628A\u8BA9\u7ED9\u4ECE\u518D\u591A\u5C11\u8D81\u63D0\u65E9\u8DDF])${ANALYSIS}|\u4FBF\u5B9C|\u4F4E\u4EF7|\u5B9E\u60E0|\u5212\u7B97|\u4E13\u4E1A|\u5730\u9053|\u5F3A|\u4F73|\u5927${ANALYSIS}${MEASURE}|\u5168|\u706B|\u9AD8\u7AEF|\u5B89\u5168|\u9760\u8C31)|\u5168\u7F51\u6700|\u5168\u57CE\u6700|\u7B2C\u4E00(?:\u5BB6|\u540D|\u54C1\u724C)|(?:\u5168\u56FD|\u5168\u5E02|\u5168\u57CE|\u5357\u4E50|\u53BF\u57CE)\u7B2C\u4E00|\u9876\u7EA7|\u6781\u81F4|\u56FD\u5BB6\u7EA7|\u72EC\u5BB6|\u552F\u4E00|\u53F2\u4E0A\u6700`;

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

// lib/profile-summary.ts
var listOf = (v) => Array.isArray(v) ? v.filter((x) => typeof x === "string").flatMap((x) => x.split(/[、,，]/)).map((x) => x.trim()).filter(Boolean) : typeof v === "string" ? v.split(/[、,，]/).map((x) => x.trim()).filter(Boolean) : [];
function businessLines(p) {
  const generic = /* @__PURE__ */ new Set([...PROFILE_CHOICES.product_category, ...PROFILE_CHOICES.account_track]);
  const products = listOf(p.product_category).filter((x) => !generic.has(x));
  const all = products.length ? products : listOf(p.account_track).filter((x) => !generic.has(x));
  return Array.from(new Set(all));
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
var multi2 = (key, label) => ({ key, label, kind: "multi", options: PROFILE_CHOICES2[key] });
var single2 = (key, label) => ({ key, label, kind: "single", options: PROFILE_CHOICES2[key] });
var text2 = (key, label) => ({ key, label, kind: "text" });
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
      text2("content_themes", "\u4E3B\u8981\u9009\u9898\u65B9\u5411"),
      pickField2("content_value"),
      pickField2("unique_selling_point"),
      pickField2("viral_content_pattern"),
      pickField2("content_restrictions")
    ]
  },
  {
    title: "\u7ADE\u4E89\u7B56\u7565",
    fields: [
      text2("reference_accounts", "\u5BF9\u6807\u8D26\u53F7"),
      text2("competitive_advantage", "\u7ADE\u4E89\u4F18\u52BF"),
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

// .tmp/content-audit-production_20261008/lib/taboos.ts
var ANALYSIS2 = "(?!\u7684?(?:\u4F18\u52BF|\u77ED\u677F|\u95EE\u9898|\u96BE\u70B9|\u98CE\u9669|\u533A\u522B|\u597D\u5904|\u7279\u70B9|\u5356\u70B9|\u4EAE\u70B9|\u539F\u56E0|\u6311\u6218|\u969C\u788D|\u963B\u529B|\u53D8\u5316|\u6536\u83B7|\u611F\u53D7|\u56F0\u96BE|\u75DB\u70B9|\u673A\u4F1A|\u5DEE\u8DDD|\u4E0D\u540C|\u6559\u8BAD))";
var MEASURE2 = "(?!\u7684?(?:\u89D2\u5EA6|\u5C3A\u5BF8|\u627F\u91CD|\u529F\u7387|\u5BB9\u91CF|\u9650\u5EA6|\u7A0B\u5EA6|\u8303\u56F4|\u503C|\u901F\u5EA6|\u6E29\u5EA6|\u5F00\u53E3|\u5E45\u5EA6|\u957F\u5EA6|\u5BBD\u5EA6|\u9AD8\u5EA6|\u6DF1\u5EA6|\u91CD\u91CF|\u9762\u79EF|\u6863|\u706B|\u53F7|\u7801|\u97F3\u91CF|\u4EAE\u5EA6|\u529B\u5EA6|\u538B\u529B))";
var ABSOLUTE2 = `(?:\u5168\u7F51|\u5168\u57CE|\u5168\u56FD|\u5168\u5E02|\u53F2\u4E0A)?\u6700(?:\u6B63\u5B97|\u597D\u5403|\u597D(?![\u5148\u662F\u522B\u4E0D\u80FD\u7528\u5728\u8FD8\u6BCF\u627E\u628A\u8BA9\u7ED9\u4ECE\u518D\u591A\u5C11\u8D81\u63D0\u65E9\u8DDF])${ANALYSIS2}|\u4FBF\u5B9C|\u4F4E\u4EF7|\u5B9E\u60E0|\u5212\u7B97|\u4E13\u4E1A|\u5730\u9053|\u5F3A|\u4F73|\u5927${ANALYSIS2}${MEASURE2}|\u5168|\u706B|\u9AD8\u7AEF|\u5B89\u5168|\u9760\u8C31)|\u5168\u7F51\u6700|\u5168\u57CE\u6700|\u7B2C\u4E00(?:\u5BB6|\u540D|\u54C1\u724C)|(?:\u5168\u56FD|\u5168\u5E02|\u5168\u57CE|\u5357\u4E50|\u53BF\u57CE)\u7B2C\u4E00|\u9876\u7EA7|\u6781\u81F4|\u56FD\u5BB6\u7EA7|\u72EC\u5BB6|\u552F\u4E00|\u53F2\u4E0A\u6700`;

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

// .tmp/content-audit-production_20261008/lib/profile-summary.ts
var listOf2 = (v) => Array.isArray(v) ? v.filter((x) => typeof x === "string").map((x) => x.trim()).filter(Boolean) : typeof v === "string" ? v.split(/[、,，]/).map((x) => x.trim()).filter(Boolean) : [];
function businessLines2(p) {
  const generic = /* @__PURE__ */ new Set([...PROFILE_CHOICES2.product_category, ...PROFILE_CHOICES2.account_track]);
  const all = [...listOf2(p.product_category), ...listOf2(p.account_track)].filter((x) => !generic.has(x));
  return Array.from(new Set(all));
}

// lib/creation-items.ts
var KIND_WORDS = {
  topic: ["\u9009\u9898", "\u4E3B\u9898", "\u9898\u76EE"],
  // 「Vlog 1」「视频2」：一次策划几条视频（线上真实写法）
  script: ["\u811A\u672C", "\u6587\u6848", "\u53E3\u64AD\u7A3F", "\u89C6\u9891", "Vlog", "vlog", "VLOG"],
  direction: ["\u8D26\u53F7\u65B9\u5411", "\u5185\u5BB9\u65B9\u5411", "\u521B\u4F5C\u65B9\u5411", "\u5207\u5165\u89D2\u5EA6", "\u5207\u5165\u70B9", "\u65B9\u5411", "\u89D2\u5EA6", "\u601D\u8DEF", "\u7075\u611F", "\u60F3\u6CD5", "\u70B9\u5B50", "\u521B\u610F", "\u7CFB\u5217", "\u680F\u76EE", "\u4EBA\u8BBE"],
  plan: ["\u6267\u884C\u5EFA\u8BAE", "\u64CD\u4F5C\u5EFA\u8BAE", "\u843D\u5730\u5EFA\u8BAE", "\u884C\u52A8\u5EFA\u8BAE", "\u65B9\u6848", "\u7B56\u5212", "\u8BA1\u5212", "\u9009\u62E9", "\u5EFA\u8BAE", "\u73A9\u6CD5", "\u6253\u6CD5", "\u505A\u6CD5", "\u62CD\u6CD5", "\u5F62\u5F0F", "\u7B56\u7565", "\u65B9\u6CD5", "\u6280\u5DE7"],
  title: ["\u6807\u9898", "\u5F00\u5934", "\u5F00\u7BC7", "\u94A9\u5B50"]
};
var KEYWORD = [...Object.values(KIND_WORDS).flat(), "\u7248\u672C"].sort((a, b) => b.length - a.length).join("|");
var CN_NUM = "[\u4E00\u4E8C\u4E09\u56DB\u4E94\u516D\u4E03\u516B\u4E5D\u5341]{1,3}";
var KEYWORD_ITEM = new RegExp(`^(?:\\p{Script=Han}{0,2}?(?:${KEYWORD})\\s*(?:\\d{1,2}|${CN_NUM}|[A-Ha-h])|\u7B2C\\s*(?:\\d{1,2}|${CN_NUM})\\s*(?:\u6761|\u4E2A|\u7248|\u7BC7|\u79CD|\u5957|\u671F))(?=\\s|[\uFF1A:\u3001.\uFF0E|\uFF5C\uFF08(\u3010\\-\u2014]|$)`, "u");
var NUMBER_ITEM = /^\d{1,2}\s*[.、．)）]\s*\S/;
var STRUCTURAL = /分析|拆解|核查|核验|评估|开场|开篇钩子(?!\d)|正文|中段|结尾|收尾|铺垫|高潮|转折|镜头\s*\d|分镜|总评|逐维度打分|问题清单|优化后的完整脚本|纯文字文案|节奏自检|拍摄顺序|拍摄清单|注意事项|总结|\d+\s*[-–~～]\s*\d+\s*秒|^\d{1,2}\s*[.、．)）]\s*(?:为什么|原因)/;
var TOPIC_LINE = /^\s*[-*>]?\s*\**\s*(?:选题|标题|题目|主题)\s*\**\s*[：:]\s*\**\s*(.+?)\s*\**\s*$/;
function headingText(line) {
  const h = line.match(/^\s*(#{1,4})\s+(.+?)\s*#*\s*$/);
  const bold = h ? null : line.match(/^\s*\*\*(.+?)\*\*\s*[：:]?\s*$/);
  if (!h && !bold) return null;
  const text3 = keycap((h?.[2] ?? bold[1]).replace(/\*\*/g, "")).replace(/^[^\p{L}\p{N}【《]+/u, "").replace(new RegExp(`^${CN_NUM}[\u3001.\uFF0E]\\s*(?=\u7B2C\\s*\\d|(?:${KEYWORD})\\s*(?:\\d|${CN_NUM}))`), "").replace(/\s{2,}/g, " ").trim();
  return { level: h ? h[1].length : 5, text: text3 };
}
function keycap(s) {
  return s.replace(/^(\s*[^\p{L}\p{N}]*?)(\d{1,2})️?⃣\s*/u, "$1$2. ").replace(/^(\s*)([①-⑳])\s*/u, (_m, sp, c) => `${sp}${c.charCodeAt(0) - 9312 + 1}. `).replace(/(\d{1,2})️?⃣/gu, "$1 ");
}
var cleanTopic = (s) => s.replace(/\*\*/g, "").replace(/^[《「"“]+|[》」"”]+$/g, "").replace(/\s*[（(][^）)]*[）)]\s*$/, "").trim();
function labelOf(text3) {
  return text3.replace(/^\d{1,2}\s*[.、．)）]\s*/, "").replace(/\*\*/g, "").trim().slice(0, 80) || text3.slice(0, 80);
}
var kindOfWord = (w) => Object.entries(KIND_WORDS).find(([, ws]) => ws.includes(w))?.[0];
function kindOf(text3, body) {
  const k = text3.match(new RegExp(`^(${KEYWORD})`))?.[1] ?? text3.match(new RegExp(`^\\p{Script=Han}{1,2}?(${KEYWORD})\\s*(?:\\d|${CN_NUM}|[A-Ha-h])`, "u"))?.[1];
  const byWord = k ? kindOfWord(k) : void 0;
  if (byWord) return byWord;
  if (/(?:^|\n)\s*[-*>]?\s*\**\s*(?:选题|标题|题目)\s*\**\s*[：:]/.test(body) || /《[^》]{4,}》/.test(text3)) return "topic";
  if (/口播|台词|分镜|镜头\s*\d|【镜头/.test(body)) return "script";
  const head = text3.replace(/^\d{1,2}\s*[.、．)）]\s*/, "");
  if (/方向|思路|角度|切入|人设|内容线|系列|栏目|灵感|想法|创意|定位/.test(head)) return "direction";
  if (/建议|做法|怎么做|怎么拍|执行|落地|策略|打法|玩法|拍法|技巧|方法|计划|先|再|每天|每周|固定/.test(head)) return "plan";
  return "item";
}
function topicOf(text3, body, kind) {
  for (const line of body.split("\n").slice(1, 12)) {
    const m = line.match(TOPIC_LINE);
    if (m && cleanTopic(m[1]).length >= 4) return cleanTopic(m[1]).slice(0, 120);
  }
  if (kind !== "topic" && kind !== "title") return void 0;
  const t = cleanTopic(text3.replace(new RegExp(`^(?:${KEYWORD})?\\s*(?:\\d{1,2}|${CN_NUM}|[A-Ha-h])?\\s*[\uFF1A:\u3001.\uFF0E|\uFF5C\\-\u2014]?\\s*`), "").replace(/^【[^】]*】\s*/, ""));
  return t.length >= 4 ? t.slice(0, 120) : void 0;
}
function splitCreationItems(markdown) {
  const text3 = String(markdown ?? "");
  const lines = text3.split("\n");
  const empty = { intro: text3.trim(), items: [], footer: "" };
  const cands = [];
  const parents = [];
  let fenced = false;
  lines.forEach((line, index) => {
    if (/^\s*(```|~~~)/.test(line)) {
      fenced = !fenced;
      return;
    }
    if (fenced) return;
    const h = headingText(line);
    if (!h) return;
    while (parents.length && parents[parents.length - 1].level >= h.level) parents.pop();
    const keyword = KEYWORD_ITEM.test(h.text);
    const analysisSection = parents.some((parent) => parent.level >= 2 && /(?:结构|逐项|逐句).*(?:拆解|分析)|(?:拆解|分析).*(?:结构|逐项|逐句)/.test(parent.text));
    if (keyword || NUMBER_ITEM.test(h.text) && !analysisSection) cands.push({ index, level: h.level, text: h.text, keyword });
    parents.push(h);
  });
  const levels = [...new Set(cands.map((c) => c.level))].sort((a, b) => a - b);
  let starts = [];
  for (const lv of levels) {
    const at = cands.filter((c) => c.level === lv);
    if (at.length >= 2) {
      starts = at;
      break;
    }
  }
  let ranges = [];
  if (starts.length >= 2) {
    const level = starts[0].level;
    ranges = starts.map((s, i) => {
      let end = starts[i + 1]?.index ?? lines.length;
      if (i === starts.length - 1) {
        fenced = false;
        for (let j = s.index + 1; j < lines.length; j++) {
          if (/^\s*(```|~~~)/.test(lines[j])) {
            fenced = !fenced;
            continue;
          }
          const h = !fenced && headingText(lines[j]);
          if (h && h.level <= level) {
            end = j;
            break;
          }
        }
      }
      return { start: s.index, end, text: s.text, keyword: s.keyword };
    });
  } else if (!lines.some((l) => /^\s*#{1,4}\s+/.test(l))) {
    const listStarts = lines.map((l, i) => ({ i, m: keycap(l).match(/^(\d{1,2})[.、．)）]\s+(.+)$/) })).filter((x) => x.m);
    if (listStarts.length >= 2) {
      ranges = listStarts.map((x, k) => {
        let end = listStarts[k + 1]?.i ?? lines.length;
        if (k === listStarts.length - 1) {
          for (let j = x.i + 1; j < lines.length; j++) {
            if (lines[j].trim() === "" && j + 1 < lines.length && lines[j + 1].trim() && !/^\s{2,}|^\s*[-*]/.test(lines[j + 1])) {
              end = j;
              break;
            }
          }
        }
        return { start: x.i, end, text: x.m[0].replace(/\*\*/g, "").trim(), keyword: false };
      });
    }
  }
  if (ranges.length < 2) return empty;
  const plain = ranges.filter((r) => !r.keyword);
  if (plain.length && plain.filter((r) => STRUCTURAL.test(r.text)).length * 2 >= plain.length) return empty;
  const above = lines.slice(Math.max(0, ranges[0].start - 6), ranges[0].start).join("\n").slice(-300);
  const parentKind = /脚本|文案|口播/.test(above) ? "script" : /选题/.test(above) ? "topic" : /方向|思路|灵感|角度|创意|点子/.test(above) ? "direction" : /建议|技巧|方法|要点|做法|怎么拍|怎么做|策略|打法|玩法|拍法|执行|经验/.test(above) ? "plan" : void 0;
  const items = ranges.map((r, i) => {
    const body = lines.slice(r.start, r.end).join("\n").replace(/\n\s*-{3,}\s*$/, "").trim();
    const own = kindOf(r.text, body);
    const kind = own === "item" && parentKind ? parentKind : own;
    return { id: `item-${i + 1}`, label: labelOf(r.text), topic: topicOf(r.text, body, kind), kind, body };
  });
  return {
    intro: lines.slice(0, ranges[0].start).join("\n").trim(),
    items,
    footer: lines.slice(ranges[ranges.length - 1].end).join("\n").trim()
  };
}

// .tmp/content-audit-production_20261008/lib/creation-items.ts
var KIND_WORDS2 = {
  topic: ["\u9009\u9898", "\u4E3B\u9898", "\u9898\u76EE"],
  // 「Vlog 1」「视频2」：一次策划几条视频（线上真实写法）
  script: ["\u811A\u672C", "\u6587\u6848", "\u53E3\u64AD\u7A3F", "\u89C6\u9891", "Vlog", "vlog", "VLOG"],
  direction: ["\u8D26\u53F7\u65B9\u5411", "\u5185\u5BB9\u65B9\u5411", "\u521B\u4F5C\u65B9\u5411", "\u5207\u5165\u89D2\u5EA6", "\u5207\u5165\u70B9", "\u65B9\u5411", "\u89D2\u5EA6", "\u601D\u8DEF", "\u7075\u611F", "\u60F3\u6CD5", "\u70B9\u5B50", "\u521B\u610F", "\u7CFB\u5217", "\u680F\u76EE", "\u4EBA\u8BBE"],
  plan: ["\u6267\u884C\u5EFA\u8BAE", "\u64CD\u4F5C\u5EFA\u8BAE", "\u843D\u5730\u5EFA\u8BAE", "\u884C\u52A8\u5EFA\u8BAE", "\u65B9\u6848", "\u7B56\u5212", "\u8BA1\u5212", "\u9009\u62E9", "\u5EFA\u8BAE", "\u73A9\u6CD5", "\u6253\u6CD5", "\u505A\u6CD5", "\u62CD\u6CD5", "\u5F62\u5F0F", "\u7B56\u7565", "\u65B9\u6CD5", "\u6280\u5DE7"],
  title: ["\u6807\u9898", "\u5F00\u5934", "\u5F00\u7BC7", "\u94A9\u5B50"]
};
var KEYWORD2 = [...Object.values(KIND_WORDS2).flat(), "\u7248\u672C"].sort((a, b) => b.length - a.length).join("|");
var CN_NUM2 = "[\u4E00\u4E8C\u4E09\u56DB\u4E94\u516D\u4E03\u516B\u4E5D\u5341]{1,3}";
var KEYWORD_ITEM2 = new RegExp(`^(?:\\p{Script=Han}{0,2}?(?:${KEYWORD2})\\s*(?:\\d{1,2}|${CN_NUM2}|[A-Ha-h])|\u7B2C\\s*(?:\\d{1,2}|${CN_NUM2})\\s*(?:\u6761|\u4E2A|\u7248|\u7BC7|\u79CD|\u5957|\u671F))(?=\\s|[\uFF1A:\u3001.\uFF0E|\uFF5C\uFF08(\u3010\\-\u2014]|$)`, "u");
var NUMBER_ITEM2 = /^\d{1,2}\s*[.、．)）]\s*\S/;
var STRUCTURAL2 = /开场|开篇钩子(?!\d)|正文|中段|结尾|收尾|铺垫|高潮|转折|镜头\s*\d|分镜|总评|逐维度打分|问题清单|优化后的完整脚本|纯文字文案|节奏自检|拍摄顺序|拍摄清单|注意事项|总结|\d+\s*[-–~～]\s*\d+\s*秒|^\d{1,2}\s*[.、．)）]\s*(?:为什么|原因)/;
var TOPIC_LINE2 = /^\s*[-*>]?\s*\**\s*(?:选题|标题|题目|主题)\s*\**\s*[：:]\s*\**\s*(.+?)\s*\**\s*$/;
function headingText2(line) {
  const h = line.match(/^\s*(#{1,4})\s+(.+?)\s*#*\s*$/);
  const bold = h ? null : line.match(/^\s*\*\*(.+?)\*\*\s*[：:]?\s*$/);
  if (!h && !bold) return null;
  const text3 = keycap2((h?.[2] ?? bold[1]).replace(/\*\*/g, "")).replace(/^[^\p{L}\p{N}【《]+/u, "").replace(new RegExp(`^${CN_NUM2}[\u3001.\uFF0E]\\s*(?=\u7B2C\\s*\\d|(?:${KEYWORD2})\\s*(?:\\d|${CN_NUM2}))`), "").replace(/\s{2,}/g, " ").trim();
  return { level: h ? h[1].length : 5, text: text3 };
}
function keycap2(s) {
  return s.replace(/^(\s*[^\p{L}\p{N}]*?)(\d{1,2})️?⃣\s*/u, "$1$2. ").replace(/^(\s*)([①-⑳])\s*/u, (_m, sp, c) => `${sp}${c.charCodeAt(0) - 9312 + 1}. `).replace(/(\d{1,2})️?⃣/gu, "$1 ");
}
var cleanTopic2 = (s) => s.replace(/\*\*/g, "").replace(/^[《「"“]+|[》」"”]+$/g, "").replace(/\s*[（(][^）)]*[）)]\s*$/, "").trim();
function labelOf2(text3) {
  return text3.replace(/^\d{1,2}\s*[.、．)）]\s*/, "").replace(/\*\*/g, "").trim().slice(0, 80) || text3.slice(0, 80);
}
var kindOfWord2 = (w) => Object.entries(KIND_WORDS2).find(([, ws]) => ws.includes(w))?.[0];
function kindOf2(text3, body) {
  const k = text3.match(new RegExp(`^(${KEYWORD2})`))?.[1] ?? text3.match(new RegExp(`^\\p{Script=Han}{1,2}?(${KEYWORD2})\\s*(?:\\d|${CN_NUM2}|[A-Ha-h])`, "u"))?.[1];
  const byWord = k ? kindOfWord2(k) : void 0;
  if (byWord) return byWord;
  if (/(?:^|\n)\s*[-*>]?\s*\**\s*(?:选题|标题|题目)\s*\**\s*[：:]/.test(body) || /《[^》]{4,}》/.test(text3)) return "topic";
  if (/口播|台词|分镜|镜头\s*\d|【镜头/.test(body)) return "script";
  const head = text3.replace(/^\d{1,2}\s*[.、．)）]\s*/, "");
  if (/方向|思路|角度|切入|人设|内容线|系列|栏目|灵感|想法|创意|定位/.test(head)) return "direction";
  if (/建议|做法|怎么做|怎么拍|执行|落地|策略|打法|玩法|拍法|技巧|方法|计划|先|再|每天|每周|固定/.test(head)) return "plan";
  return "item";
}
function topicOf2(text3, body, kind) {
  for (const line of body.split("\n").slice(1, 12)) {
    const m = line.match(TOPIC_LINE2);
    if (m && cleanTopic2(m[1]).length >= 4) return cleanTopic2(m[1]).slice(0, 120);
  }
  if (kind !== "topic" && kind !== "title") return void 0;
  const t = cleanTopic2(text3.replace(new RegExp(`^(?:${KEYWORD2})?\\s*(?:\\d{1,2}|${CN_NUM2}|[A-Ha-h])?\\s*[\uFF1A:\u3001.\uFF0E|\uFF5C\\-\u2014]?\\s*`), "").replace(/^【[^】]*】\s*/, ""));
  return t.length >= 4 ? t.slice(0, 120) : void 0;
}
function splitCreationItems2(markdown) {
  const text3 = String(markdown ?? "");
  const lines = text3.split("\n");
  const empty = { intro: text3.trim(), items: [], footer: "" };
  const cands = [];
  let fenced = false;
  lines.forEach((line, index) => {
    if (/^\s*(```|~~~)/.test(line)) {
      fenced = !fenced;
      return;
    }
    if (fenced) return;
    const h = headingText2(line);
    if (!h) return;
    const keyword = KEYWORD_ITEM2.test(h.text);
    if (keyword || NUMBER_ITEM2.test(h.text)) cands.push({ index, level: h.level, text: h.text, keyword });
  });
  const levels = [...new Set(cands.map((c) => c.level))].sort((a, b) => a - b);
  let starts = [];
  for (const lv of levels) {
    const at = cands.filter((c) => c.level === lv);
    if (at.length >= 2) {
      starts = at;
      break;
    }
  }
  let ranges = [];
  if (starts.length >= 2) {
    const level = starts[0].level;
    ranges = starts.map((s, i) => {
      let end = starts[i + 1]?.index ?? lines.length;
      if (i === starts.length - 1) {
        fenced = false;
        for (let j = s.index + 1; j < lines.length; j++) {
          if (/^\s*(```|~~~)/.test(lines[j])) {
            fenced = !fenced;
            continue;
          }
          const h = !fenced && headingText2(lines[j]);
          if (h && h.level <= level) {
            end = j;
            break;
          }
        }
      }
      return { start: s.index, end, text: s.text, keyword: s.keyword };
    });
  } else if (!lines.some((l) => /^\s*#{1,4}\s+/.test(l))) {
    const listStarts = lines.map((l, i) => ({ i, m: keycap2(l).match(/^(\d{1,2})[.、．)）]\s+(.+)$/) })).filter((x) => x.m);
    if (listStarts.length >= 2) {
      ranges = listStarts.map((x, k) => {
        let end = listStarts[k + 1]?.i ?? lines.length;
        if (k === listStarts.length - 1) {
          for (let j = x.i + 1; j < lines.length; j++) {
            if (lines[j].trim() === "" && j + 1 < lines.length && lines[j + 1].trim() && !/^\s{2,}|^\s*[-*]/.test(lines[j + 1])) {
              end = j;
              break;
            }
          }
        }
        return { start: x.i, end, text: x.m[0].replace(/\*\*/g, "").trim(), keyword: false };
      });
    }
  }
  if (ranges.length < 2) return empty;
  const plain = ranges.filter((r) => !r.keyword);
  if (plain.length && plain.filter((r) => STRUCTURAL2.test(r.text)).length * 2 >= plain.length) return empty;
  const above = lines.slice(Math.max(0, ranges[0].start - 6), ranges[0].start).join("\n").slice(-300);
  const parentKind = /脚本|文案|口播/.test(above) ? "script" : /选题/.test(above) ? "topic" : /方向|思路|灵感|角度|创意|点子/.test(above) ? "direction" : /建议|技巧|方法|要点|做法|怎么拍|怎么做|策略|打法|玩法|拍法|执行|经验/.test(above) ? "plan" : void 0;
  const items = ranges.map((r, i) => {
    const body = lines.slice(r.start, r.end).join("\n").replace(/\n\s*-{3,}\s*$/, "").trim();
    const own = kindOf2(r.text, body);
    const kind = own === "item" && parentKind ? parentKind : own;
    return { id: `item-${i + 1}`, label: labelOf2(r.text), topic: topicOf2(r.text, body, kind), kind, body };
  });
  return {
    intro: lines.slice(0, ranges[0].start).join("\n").trim(),
    items,
    footer: lines.slice(ranges[ranges.length - 1].end).join("\n").trim()
  };
}

// lib/result-reconciliation.ts
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
    return line;
  }).join("\n");
}
function titleCharacterCount(title2) {
  return (title2.match(/[\p{L}\p{N}]/gu) ?? []).length;
}
function reconcileTitleCounts(markdown) {
  let title2 = "";
  let fenced = false;
  return markdown.split("\n").map((line) => {
    if (/^\s*(```|~~~)/.test(line)) {
      fenced = !fenced;
      title2 = "";
      return line;
    }
    if (fenced) return line;
    const heading = line.replace(/\*\*/g, "").match(/^\s*(?:#{1,4}\s*)?(?:标题\s*)?\d{1,2}[.、．:：)）]\s*(.+?)\s*$/);
    if (heading) title2 = heading[1];
    else if (/^\s*#{1,4}\s/.test(line)) title2 = "";
    if (title2 && /^\s*(?:[-*+]\s*)?\*{0,2}字数\*{0,2}\s*[：:]\s*\*{0,2}\d+/.test(line)) {
      return `- **\u5B57\u6570**\uFF1A${titleCharacterCount(title2)} \u5B57\uFF08\u4E0D\u542B\u6807\u70B9\u548C\u7A7A\u683C\uFF09`;
    }
    return line;
  }).join("\n");
}
function hasObviousCutoff(text3) {
  return /【(?:画面|口播|台词|镜头|字幕|动作|第\d+步)?[^】\n]{0,10}$/.test(text3.trimEnd()) || /(?:^|\n)\*\*(?:画|画面|台|台词|口|口播|字|字幕|动|动作|镜|镜头)$/.test(text3.trimEnd());
}

// .tmp/content-repair-metrics_20261008.ts
var root = "docs/\u5168\u677F\u5757\u8D28\u91CF\u4FEE\u590D_20261008";
var prior = "docs/\u5168\u521B\u4F5C\u677F\u5757\u5B9E\u6D4B_20261008";
var read = (name) => import_node_fs.default.readFileSync(`${prior}/${name}`, "utf8");
var review = read("\u7F51\u9875\u5B9E\u6D4B/\u5BA1\u7A3F_\u53EF\u89C1\u6B63\u6587.md").split("\n").map((line) => line.includes("	") ? `|${line.replace(/\t/g, "|")}|` : line).join("\n");
var title = read("\u7F51\u9875\u5B9E\u6D4B/\u6807\u9898_\u53EF\u89C1\u6B63\u6587.md");
import_node_fs.default.writeFileSync(root + "/\u539F\u5931\u8D25\u6837\u672C_\u5BA1\u7A3F\u7EDF\u8BA1\u4FEE\u6B63.md", reconcileReviewScores(review));
import_node_fs.default.writeFileSync(root + "/\u539F\u5931\u8D25\u6837\u672C_\u6807\u9898\u7EDF\u8BA1\u4FEE\u6B63.md", reconcileTitleCounts(title));
var profile = { product_category: ["\u6C99\u53D1", "\u5E8A", "\u8863\u67DC", "\u6C99\u53D1\u3001\u5E8A\u3001\u8863\u67DC"], account_track: ["\u5BB6\u5C45\u5BB6\u88C5"] };
var breakdown = read("\u7F51\u9875\u5B9E\u6D4B/\u62C6\u6587\u6848_\u53EF\u89C1\u6B63\u6587.md");
for (const h of read("\u7F51\u9875\u5B9E\u6D4B/\u62C6\u6587\u6848_\u5B8C\u6210.txt").matchAll(/- heading "(.+)" \[level=(\d)\]/g)) breakdown = breakdown.split("\n").map((line) => line.trim() === h[1] ? `${"#".repeat(Number(h[2]))} ${line}` : line).join("\n");
import_node_fs.default.writeFileSync(root + "/\u7F51\u9875\u62C6\u89E3_\u6309\u5B9E\u9645DOM\u6807\u9898\u6062\u590D.md", breakdown);
var regression = JSON.parse(import_node_fs.default.readFileSync(".tmp/content-repair-tests-release_20261008.json", "utf8"));
var metrics = {
  scope: "\u9488\u5BF9\u5DF2\u5B9A\u4F4D\u7F3A\u9677\u7684\u56DE\u653E\u4E0E\u6B63\u5F0F\u6A21\u578B\u6821\u5BF9\uFF0C\u4E0D\u80FD\u4EE3\u8868\u5168\u5E73\u53F0\u6587\u6848\u8D28\u91CF\u3001\u521B\u610F\u3001\u6D41\u91CF\u6216\u957F\u671F\u7A33\u5B9A\u6027\u63D0\u5347\u767E\u5206\u6BD4",
  review: { sampleCount: 1, before: { dimensionsSum: 92, reportedTotal: 82 }, after: { dimensionsSum: 92, reportedTotal: 92 }, note: "\u53EA\u4FEE\u6B63\u7B97\u672F\uFF0C\u5206\u9879\u8BC4\u4EF7\u4E0D\u53D8\uFF0C\u4E0D\u628A8.2\u53D89.2\u89E3\u91CA\u6210\u539F\u7A3F\u8D28\u91CF\u63D0\u5347" },
  titleCounts: { sampleCount: 3, before: [22, 23, 23], after: [19, 19, 20], correctBefore: 0, correctAfter: 3, unit: "\u4E0D\u542B\u6807\u70B9\u548C\u7A7A\u683C\u7684Unicode\u5B57\u6BCD\u4E0E\u6570\u5B57" },
  businessLines: { fixture: profile, before: businessLines2(profile), after: businessLines(profile) },
  analysisSelection: { sampleCount: 1, before: splitCreationItems2(breakdown).items.map((x) => ({ label: x.label, kind: x.kind })), after: splitCreationItems(breakdown).items },
  cutoff: { sampleCount: 1, observedHasEndEvent: true, beforeAccepted: true, afterRejected: hasObviousCutoff(read("\u6A21\u578B\u539F\u59CB\u8BB0\u5F55/14_script_interview_\u8F93\u51FA.md")), scope: "\u6781\u7A84\u7684\u672A\u5199\u5B8C\u7ED3\u6784\u6807\u7B7E\u8BC6\u522B\uFF0C\u4E0D\u662F\u901A\u7528\u5B8C\u6574\u6027\u9A8C\u8BC1" },
  pendingInterviewTitles: { batches: 2, titleCount: 6, beforeStateCompatible: 2, afterStateCompatible: 6, deltaPercentagePoints: 66.7, scope: "\u4E24\u4EFD\u5DF2\u751F\u6210\u5931\u8D25\u4EA7\u7269\u8FDB\u884C\u72EC\u7ACB\u6821\u5BF9\u56DE\u653E\uFF1B\u53EA\u8BC4\u4EF7\u5C1A\u672A\u91C7\u8BBF\u72B6\u6001\u517C\u5BB9\uFF0C\u4E0D\u4EE3\u8868\u6807\u9898\u7EFC\u5408\u8D28\u91CF\u6216\u70B9\u51FB\u7387" },
  remixCount: { sampleCount: 1, requested: 1, before: 2, after: 1, scope: "\u4EC5\u6570\u91CF\u901A\u8FC7\uFF1B\u672A\u4EE5\u6B64\u8BA4\u5B9A\u5176\u5185\u5BB9\u4E8B\u5B9E\u548C\u955C\u5934\u8D44\u6E90\u5168\u90E8\u5408\u683C" },
  unitTests: { files: regression.testResults.length, passed: regression.numPassedTests, total: regression.numTotalTests, failed: regression.numFailedTests },
  release: { candidateBuild: "KyCYVFkk4yvdId7v-iFqM", observedCurrentBuild: "VF2jcy8WLgiU0KsNJIvez", candidateSourceFiles: 10, status: "awaiting_explicit_production_cutover_approval", reason: "\u81EA\u52A8\u5BA1\u6279\u62D2\u7EDD\u751F\u4EA7\u5207\u6362\uFF1B\u5DF2\u901A\u8FC7\u5019\u9009\u6784\u5EFA\u4E0E\u8FD0\u884C\u5065\u5EB7\u68C0\u67E5\uFF1B\u672A\u8FD0\u884C\u5207\u6362\u811A\u672C\uFF0CDify\u672A\u53D8\u66F4" }
};
import_node_fs.default.writeFileSync(root + "/\u91CF\u5316\u9A8C\u6536.json", JSON.stringify(metrics, null, 2));
console.log(JSON.stringify(metrics, null, 2));
