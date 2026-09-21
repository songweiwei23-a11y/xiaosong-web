"use client";

/**
 * 结果区与历史区的预览页（免登录），用于确认观感与交互。
 * 数据是构造的示例，组件与线上完全是同一份。确认后本页删除。
 */

import { useState } from "react";
import { ResultPanel } from "../dashboard/script/ResultPanel";
import { HistoryPanel, type HistoryItem } from "../dashboard/script/HistoryPanel";

const SAMPLE_BODY = `# 普通人做短视频最容易踩的3个坑

## 开篇钩子（0-3秒）

你有没有发现，同样是拍探店视频，有人一条涨粉两万，有人拍了三十条还是个位数播放。差别真不在设备，在这三个地方。

## 中段干货（3-45秒）

**第一个坑：定位模糊。**

很多人开号就是一通乱拍，今天美食明天穿搭，算法根本不知道该把你推给谁。定位要窄到一句话说得清，前十条内容必须同一个方向。

**第二个坑：开场废话太多。**

"大家好我是某某，今天给大家带来"——说完这句，一半人已经划走了。前三秒必须直接给结论或者给冲突。

**第三个坑：自嗨式输出。**

你觉得专业的东西，观众可能压根听不懂。判断标准很简单：这句话我妈能不能听明白。

## 结尾引导（45-60秒）

如果你正在做号，对照这三条看一遍。觉得有用的话，点个赞让更多人看到；有具体问题，评论区告诉我你的赛道。`;

const SAMPLE_REPORT = `## 🟢 脚本质量评分

**得分**：9.0 / 10.0 分
**等级**：MCN级
**状态**：✅ 达标

### 发现的问题
- 结尾引导略显常规，可以更有记忆点

### 改进建议
- 中段第三个坑可以补一个具体案例，说服力会更强
- 结尾可以设计一个专属互动钩子，比如让观众留言自己的赛道`;

const FULL = `${SAMPLE_BODY}\n\n---\n\n${SAMPLE_REPORT}`;

// 时间戳写成固定值，不用 Date.now() 推算：模块在服务端与客户端各求值一次，
// 两次的 now 不同，生成的 created_at 就不同，会直接造成 hydration 不一致。
// 真实数据来自数据库，是固定值，不存在这个问题。
const BASE = Date.parse("2026-09-21T14:00:00.000Z");
const HISTORY: HistoryItem[] = [
  { id: "1", result: FULL, created_at: new Date(BASE - 3 * 60_000).toISOString() },
  {
    id: "2",
    result: `# 实体店老板自己拍视频的三个误区\n\n很多老板拍店，第一反应是把店里拍一圈…`,
    created_at: new Date(BASE - 4 * 3600_000).toISOString(),
  },
  {
    id: "3",
    result: `# 为什么你的探店视频没人看\n\n拍得好看不等于有人看…\n\n---\n\n## 🟡 脚本质量评分\n\n**得分**：8.2 / 10.0 分\n**等级**：合格\n**状态**：✅ 达标`,
    created_at: new Date(BASE - 26 * 3600_000).toISOString(),
  },
  {
    id: "4",
    result: `# 开一家店之前，先想明白这件事\n\n选址比装修重要十倍…`,
    created_at: new Date(BASE - 3 * 24 * 3600_000).toISOString(),
  },
  {
    id: "5",
    result: `# 短视频的黄金三秒到底怎么设计\n\n三秒不是时间单位，是决策单位…`,
    created_at: new Date(BASE - 10 * 24 * 3600_000).toISOString(),
  },
];

export default function ResultPreviewPage() {
  const [result, setResult] = useState(FULL);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeId, setActiveId] = useState<string | null>("1");
  const [items, setItems] = useState(HISTORY);
  const [note, setNote] = useState("");

  // 模拟流式生成，用来看"创作中"的样子
  const simulate = () => {
    setIsGenerating(true);
    setResult("");
    setActiveId(null);
    let i = 0;
    const timer = setInterval(() => {
      i += 12;
      setResult(SAMPLE_BODY.slice(0, i));
      if (i >= SAMPLE_BODY.length) {
        clearInterval(timer);
        setResult(FULL);
        setIsGenerating(false);
      }
    }, 30);
  };

  return (
    <div className="min-h-screen px-8 py-7">
      <div className="mx-auto max-w-4xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">结果区 / 历史区预览</h1>
            <p className="mt-1 text-[13px] text-muted-foreground">
              组件与线上同一份，数据是示例。右下角可切换配色与明暗
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={simulate} className="btn-brand rounded-xl px-4 py-2 text-[13px] font-medium">
              模拟生成
            </button>
            <button
              onClick={() => { setResult(""); setIsGenerating(false); setActiveId(null); }}
              className="glass-panel glass-interactive rounded-xl px-4 py-2 text-[13px] font-medium"
            >
              看空状态
            </button>
          </div>
        </div>

        {note && (
          <div className="rounded-xl bg-primary/10 px-4 py-2.5 text-[12px] text-primary">{note}</div>
        )}

        <ResultPanel
          result={result}
          isGenerating={isGenerating}
          onCopy={() => setNote("已复制正文（不含质量报告）")}
          onDownload={() => setNote("已下载正文（不含质量报告）")}
          onContinue={result ? () => setNote("打开继续对话弹窗") : undefined}
        />

        <HistoryPanel
          items={items}
          activeId={activeId}
          onLoad={(item) => {
            setResult(item.result);
            setActiveId(item.id);
            setNote("已载入这条历史到结果区");
          }}
          onContinue={() => setNote("打开继续对话弹窗")}
          onDelete={(id) => {
            setItems((p) => p.filter((x) => x.id !== id));
            setNote("已删除该条");
          }}
        />
      </div>
    </div>
  );
}
