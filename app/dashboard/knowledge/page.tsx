"use client";

import { useState } from "react";
import { BookOpen, Search, Loader2, Lightbulb } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { notify } from '@/components/ui/feedback';

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

      const reader = response.body?.getReader();
      if (!reader) throw new Error("无法读取响应");

      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        accumulated += chunk;
        setResult(accumulated);
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
    <div className="flex h-screen">
      {/* Left Panel */}
      <div className="w-96 overflow-y-auto border-r bg-muted p-6">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-foreground">知识库</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            查询编导专业知识和方法
          </p>
        </div>

        <div className="space-y-6">
          {/* Search Input */}
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">
              输入你的问题
            </label>
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="例如：如何设计开头的强冲突？"
              className="w-full rounded-lg border border-border p-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              rows={4}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSearch();
                }
              }}
            />
            <div className="mt-1 text-xs text-muted-foreground">
              按 Enter 搜索，Shift+Enter 换行
            </div>
          </div>

          {/* Category Filter */}
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">
              知识分类（可选）
            </label>
            <div className="space-y-2">
              <button
                onClick={() => setSelectedCategory("")}
                className={`w-full rounded-lg border p-2 text-left text-sm transition-all ${
                  selectedCategory === ""
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-border hover:border-border"
                }`}
              >
                全部分类
              </button>
              {KNOWLEDGE_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`w-full rounded-lg border p-2 text-left transition-all ${
                    selectedCategory === cat.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-border hover:border-border"
                  }`}
                >
                  <div className="text-sm font-medium text-foreground">
                    {cat.label}
                  </div>
                  <div className="text-xs text-muted-foreground">{cat.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Quick Questions */}
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">
              常见问题
            </label>
            <div className="space-y-2">
              {QUICK_QUESTIONS.map((question, index) => (
                <button
                  key={index}
                  onClick={() => handleQuickQuestion(question)}
                  className="w-full rounded-lg border border-border bg-card p-2 text-left text-sm hover:border-blue-300 hover:bg-blue-50 transition-all"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>

          {/* Search Button */}
          <button
            data-search-button
            onClick={handleSearch}
            disabled={isSearching || !query.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 font-medium text-white hover:bg-blue-700 disabled:bg-muted"
          >
            {isSearching ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                搜索中...
              </>
            ) : (
              <>
                <Search className="h-5 w-5" />
                搜索知识库
              </>
            )}
          </button>
        </div>
      </div>

      {/* Right Panel - Result */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto max-w-4xl">
          {!result && !isSearching && (
            <div className="flex h-full items-center justify-center text-center">
              <div>
                <BookOpen className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-4 text-muted-foreground">
                  输入问题查询编导知识库
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  涵盖脚本结构、爆款元素、拍摄技巧等专业知识
                </p>
                <div className="mt-6 rounded-lg border border-purple-100 bg-purple-50 p-4 text-left">
                  <div className="flex items-start gap-2">
                    <Lightbulb className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-purple-900">
                      <div className="font-medium mb-1">💡 使用技巧</div>
                      <ul className="space-y-1 text-purple-700">
                        <li>• 问题越具体，答案越精准</li>
                        <li>• 可以选择分类缩小范围</li>
                        <li>• 试试常见问题快速入门</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {isSearching && !result && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600" />
                <p className="mt-4 text-sm text-muted-foreground">
                  正在搜索知识库...
                </p>
              </div>
            </div>
          )}

          {result && (
            <div>
              <div className="mb-6">
                <h2 className="text-xl font-bold text-foreground">搜索结果</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  来自编导知识库的专业解答
                </p>
              </div>

              <div className="prose prose-slate max-w-none">
                <ReactMarkdown>{result}</ReactMarkdown>
              </div>

              <div className="mt-6 rounded-lg border border-border bg-muted p-4">
                <div className="text-sm text-muted-foreground">
                  💡 如果答案不够详细，可以：
                  <ul className="mt-2 space-y-1">
                    <li>• 换一个更具体的问法</li>
                    <li>• 选择相关的知识分类</li>
                    <li>• 在脚本生成等功能中实践应用</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
