"use client";

import { Field } from "@/components/form/Field";
import { CollapsibleSection } from "@/components/form/CollapsibleSection";
import { INPUT_CLS, SELECT_CLS, TEXTAREA_CLS, PRIMARY_BTN, SECONDARY_BTN, chipCls } from "@/components/form/controls";
import { WorkspaceLayout } from "@/components/workspace/WorkspaceLayout";
import { PageHeader } from "@/components/workspace/PageHeader";
import { ResultPanel } from "@/components/workspace/ResultPanel";
import { HistoryPanel } from "@/components/workspace/HistoryPanel";
import { useState, useEffect } from "react";
import { BookOpen, Search, Loader2, Lightbulb } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { notify } from '@/components/ui/feedback';
import { saveGenerationHistory } from '@/lib/history';

import { readDifyStream } from '@/lib/sse-stream';

// 历史里用它区分本页记录。与发给 Dify 的 taskType 无关——成交理由页发的
// 也是「知识库查询」，两页若共用同一个 task_type，历史会互相串。
const HISTORY_TASK_TYPE = "知识库查询";
const KNOWLEDGE_CATEGORIES = [
  { id: "structure", label: "脚本结构", desc: "教知识、晒过程、聊话题、讲故事" },
  { id: "boom", label: "爆款元素", desc: "冲突点、情绪波点、反转设计" },
  { id: "shooting", label: "拍摄技巧", desc: "镜头语言、场景选择、剪辑节奏" },
  { id: "topic", label: "选题方法", desc: "如何找热点、判断选题质量" },
  { id: "positioning", label: "账号定位", desc: "人设打造、内容边界、涨粉策略" },
  { id: "writing", label: "文案写作", desc: "开头设计、情绪递进、结尾引导" },
];

const QUICK_QUESTIONS = [
"如何设计开头3秒的强冲突？",
"教知识类脚本的基本结构是什么？",
"什么是情绪波点？如何设计？",
"如何判断一个选题是否值得做？",
"新账号如何快速找到定位？",
"分镜脚本怎么写才专业？",
];

export default function KnowledgePage() {
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState("");

  // 切换页面或刷新后，把云端最近一条查询结果取回来显示。
  // 本页原先既不保存也不恢复，结果只活在组件 state 里，一离开就没了。
  useEffect(() => {
    let cancelled = false;
    const restore = async () => {
      try {
        const res = await fetch('/api/script-history');
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || !Array.isArray(data)) return;
        const latest = data.find((x: any) => x.task_type === HISTORY_TASK_TYPE);
        if (latest?.result) setResult((current) => current || latest.result);
      } catch (error) {
        console.error('恢复上次查询失败:', error);
      }
    };
    restore();
    return () => { cancelled = true; };
  }, []);

  const handleSearch = async () => {
    if (!query.trim()) {
      notify("请输入要查询的问题");
      return;
    }

    setIsSearching(true);
    setResult("");

    try {
      const response = await fetch("/api/dify/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskType: "知识库查询",
          topic: `请从编导知识库中查询并回答：

【问题】
${query}

${selectedCategory ? `【重点查询分类】\n${KNOWLEDGE_CATEGORIES.find(c => c.id === selectedCategory)?.label}` : ''}

要求：
1. 从知识库中找到相关理论和方法
2. 给出具体可执行的建议
3. 如果有案例，请举例说明
4. 如果知识库没有，请明确说明`,
          platform: "抖音",
          duration: "60秒",
          style: "专业"
        }),
      });

      if (!response.ok) throw new Error("查询失败");

      // 响应是 SSE（data: {"answer":"..."}），需解析后取 answer，
      // 否则页面上显示的会是满屏 data: {...} 而不是检索结果正文
      const full = await readDifyStream(response, {
        onChunk: (_piece, text) => setResult(text),
      });

      // 存一份到云端，换页面或刷新后才能取回来
      if (full.trim()) {
        await saveGenerationHistory(HISTORY_TASK_TYPE, { query, category: selectedCategory }, full);
      }
    } catch (error: any) {
      notify(error.message || "查询失败");
    } finally {
      setIsSearching(false);
    }
  };

  const handleQuickQuestion = (question: string) => {
    setQuery(question);
    // Auto search after a short delay
    setTimeout(() => {
      const button = document.querySelector('[data-search-button]') as HTMLButtonElement;
      button?.click();
    }, 100);
  };

  return (
    <WorkspaceLayout
      sidebar={
        <>
          <PageHeader title="知识库" subtitle="查询编导专业知识与方法" />

          <CollapsibleSection title="提问" defaultOpen>
            <Field label="你的问题" required stacked hint="按 Enter 搜索，Shift + Enter 换行">
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="例如：如何设计开头的强冲突？"
                className={TEXTAREA_CLS}
                rows={4}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSearch();
                  }
                }}
              />
            </Field>

            <button
              onClick={handleSearch}
              disabled={isSearching || !query.trim()}
              className={PRIMARY_BTN}
            >
              {isSearching ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  查询中…
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" />
                  查询知识库
                </>
              )}
            </button>
          </CollapsibleSection>

          <CollapsibleSection title="缩小范围" defaultOpen>
            <Field label="知识分类" optional stacked>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => setSelectedCategory("")}
                  aria-pressed={selectedCategory === ""}
                  className={`glass-interactive rounded-xl border px-3 py-2 text-left text-[12px] ${
                    selectedCategory === "" ? "glass-selected text-foreground" : "glass-panel text-muted-foreground"
                  }`}
                >
                  全部分类
                </button>
                {KNOWLEDGE_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    aria-pressed={selectedCategory === cat.id}
                    className={`glass-interactive rounded-xl border px-3 py-2 text-left ${
                      selectedCategory === cat.id ? "glass-selected" : "glass-panel"
                    }`}
                  >
                    <div className="text-[12px] font-medium leading-5 text-foreground">{cat.label}</div>
                    <div className="mt-0.5 text-[10px] leading-snug text-muted-foreground">{cat.desc}</div>
                  </button>
                ))}
              </div>
            </Field>
          </CollapsibleSection>

          <CollapsibleSection title="常见问题" defaultOpen={false}>
            <div className="space-y-1.5">
              {QUICK_QUESTIONS.map((question, index) => (
                <button
                  key={index}
                  onClick={() => handleQuickQuestion(question)}
                  className="glass-panel glass-interactive w-full rounded-xl px-3 py-2.5 text-left text-[12px] leading-relaxed text-muted-foreground"
                >
                  {question}
                </button>
              ))}
            </div>
          </CollapsibleSection>
        </>
      }
    >
      <ResultPanel
        result={result}
        isGenerating={isSearching}
        title="查询结果"
        showStats={false}
        emptyIcon={BookOpen}
        emptyTitle="输入问题，查询编导知识库"
        emptyHint="涵盖脚本结构、爆款元素、拍摄技巧等专业知识"
        emptyTips={[
          "问题越具体，答案越精准",
          "可以先选分类缩小范围",
          "试试左侧的常见问题快速入门",
        ]}
        generatingHint="正在检索知识库…"
        onCopy={(text) => {
          navigator.clipboard.writeText(text);
          notify("已复制到剪贴板");
        }}
      />
    </WorkspaceLayout>
  );
}
