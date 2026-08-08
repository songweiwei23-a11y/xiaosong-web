// app/generate/page.tsx
"use client";

import { useState, useRef, useCallback } from "react";
import { Sparkles, Copy, Download, Loader2, History, Trash2, ChevronLeft } from "lucide-react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { useStore } from "@/lib/store";
import type { TaskType, Platform, Duration, Style, GenerateResult } from "@/types";
import { format } from "date-fns";

const TASK_TYPES: TaskType[] = ["脚本生成", "选题策划", "分镜脚本", "审稿优化"];
const PLATFORMS: Platform[] = ["抖音", "小红书", "视频号", "B站"];
const DURATIONS: Duration[] = ["15秒", "30秒", "60秒", "90秒"];
const STYLES: Style[] = ["犀利", "温暖", "专业", "幽默"];

export default function GeneratePage() {
  const { results, currentResult, isGenerating, addResult, setCurrentResult, setIsGenerating, clearResults } = useStore();

  const [taskType, setTaskType] = useState<TaskType>("脚本生成");
  const [topic, setTopic] = useState("");
  const [platform, setPlatform] = useState<Platform>("抖音");
  const [duration, setDuration] = useState<Duration>("60秒");
  const [style, setStyle] = useState<Style>("犀利");
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"generate" | "history">("generate");
  const [copied, setCopied] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  const handleGenerate = useCallback(async () => {
    if (!topic.trim()) {
      setError("请输入视频主题");
      return;
    }
    setError(null);
    setIsGenerating(true);
    setCurrentResult("");

    abortRef.current = new AbortController();

    try {
      const response = await fetch("/api/dify/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskType, topic, platform, duration, style }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "生成失败");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("无法读取响应");

      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        accumulated += chunk;
        setCurrentResult(accumulated);
      }

      if (accumulated) {
        addResult({
          id: Date.now().toString(),
          content: accumulated,
          taskType,
          topic,
          platform,
          duration,
          style,
          createdAt: new Date(),
        });
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setError(err.message || "生成失败，请检查API密钥配置");
      }
    } finally {
      setIsGenerating(false);
    }
  }, [taskType, topic, platform, duration, style, addResult, setCurrentResult, setIsGenerating]);

  const handleStop = () => {
    abortRef.current?.abort();
    setIsGenerating(false);
  };

  const handleCopy = async () => {
    if (!currentResult) return;
    await navigator.clipboard.writeText(currentResult);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!currentResult) return;
    const blob = new Blob([currentResult], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `脚本_${topic}_${format(new Date(), "yyyyMMdd_HHmm")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLoadHistory = (result: GenerateResult) => {
    setCurrentResult(result.content);
    setTaskType(result.taskType);
    setTopic(result.topic);
    setPlatform(result.platform);
    setDuration(result.duration);
    setStyle(result.style);
    setActiveTab("generate");
  };

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      {/* Header */}
      <header className="border-b bg-background">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
              <ChevronLeft className="w-4 h-4" />
              返回
            </Link>
            <div className="w-px h-5 bg-border" />
            <div className="flex items-center gap-2 font-bold">
              <Sparkles className="w-5 h-5 text-primary" />
              小宋编导工作台
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("generate")}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === "generate" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
            >
              创作
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === "history" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
            >
              <History className="w-4 h-4" />
              历史({results.length})
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-8">
        {activeTab === "generate" ? (
          <div className="grid lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
            {/* Left: Form */}
            <div className="bg-background border rounded-xl p-6 space-y-6 h-fit">
              <h2 className="text-xl font-bold">创作设置</h2>

              {/* Task Type */}
              <div className="space-y-2">
                <label className="text-sm font-medium">任务类型</label>
                <div className="grid grid-cols-2 gap-2">
                  {TASK_TYPES.map((t) => (
                    <button
                      key={t}
                      onClick={() => setTaskType(t)}
                      className={`py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                        taskType === t
                          ? "bg-primary text-primary-foreground border-primary"
                          : "hover:border-primary hover:text-primary"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Topic */}
              <div className="space-y-2">
                <label className="text-sm font-medium">视频主题 *</label>
                <textarea
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="例如：如何在30天内学会钢琴"
                  className="w-full h-24 px-3 py-2 rounded-lg border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Platform */}
              <div className="space-y-2">
                <label className="text-sm font-medium">发布平台</label>
                <div className="grid grid-cols-4 gap-2">
                  {PLATFORMS.map((p) => (
                    <button
                      key={p}
                      onClick={() => setPlatform(p)}
                      className={`py-2 px-2 rounded-lg border text-sm font-medium transition-colors ${
                        platform === p
                          ? "bg-primary text-primary-foreground border-primary"
                          : "hover:border-primary hover:text-primary"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Duration */}
              <div className="space-y-2">
                <label className="text-sm font-medium">视频时长</label>
                <div className="grid grid-cols-4 gap-2">
                  {DURATIONS.map((d) => (
                    <button
                      key={d}
                      onClick={() => setDuration(d)}
                      className={`py-2 px-2 rounded-lg border text-sm font-medium transition-colors ${
                        duration === d
                          ? "bg-primary text-primary-foreground border-primary"
                          : "hover:border-primary hover:text-primary"
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              {/* Style */}
              <div className="space-y-2">
                <label className="text-sm font-medium">内容风格</label>
                <div className="grid grid-cols-4 gap-2">
                  {STYLES.map((s) => (
                    <button
                      key={s}
                      onClick={() => setStyle(s)}
                      className={`py-2 px-2 rounded-lg border text-sm font-medium transition-colors ${
                        style === s
                          ? "bg-primary text-primary-foreground border-primary"
                          : "hover:border-primary hover:text-primary"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="text-destructive text-sm bg-destructive/10 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={isGenerating ? handleStop : handleGenerate}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition-colors ${
                    isGenerating
                      ? "bg-destructive text-destructive-foreground hover:opacity-90"
                      : "bg-primary text-primary-foreground hover:opacity-90"
                  }`}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      停止生成
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      生成脚本
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Right: Result */}
            <div className="bg-background border rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">生成结果</h2>
                {currentResult && (
                  <div className="flex gap-2">
                    <button
                      onClick={handleCopy}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm hover:bg-muted transition-colors"
                    >
                      <Copy className="w-4 h-4" />
                      {copied ? "已复制" : "复制"}
                    </button>
                    <button
                      onClick={handleDownload}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm hover:bg-muted transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      下载
                    </button>
                  </div>
                )}
              </div>

              <div className="min-h-[500px] overflow-y-auto">
                {isGenerating && !currentResult && (
                  <div className="flex flex-col items-center justify-center h-[500px] gap-3 text-muted-foreground">
                    <Loader2 className="w-10 h-10 animate-spin text-primary" />
                    <p className="text-sm">AI正在生成脚本...</p>
                  </div>
                )}

                {currentResult && (
                  <div className="prose prose-slate max-w-none text-sm leading-relaxed">
                    <ReactMarkdown>{currentResult}</ReactMarkdown>
                  </div>
                )}

                {!isGenerating && !currentResult && (
                  <div className="flex flex-col items-center justify-center h-[500px] gap-3 text-muted-foreground">
                    <Sparkles className="w-12 h-12 opacity-20" />
                    <p className="text-sm">填写左侧设置后点击「生成脚本」</p>
                    <p className="text-xs opacity-60">支持抖音、小红书、视频号、B站</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* History Tab */
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">历史记录</h2>
              {results.length > 0 && (
                <button
                  onClick={clearResults}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  清空记录
                </button>
              )}
            </div>

            {results.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">
                <History className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>暂无历史记录</p>
                <p className="text-xs mt-1">生成脚本后会自动保存在这里</p>
              </div>
            ) : (
              <div className="space-y-4">
                {results.map((result) => (
                  <div
                    key={result.id}
                    className="bg-background border rounded-xl p-5 cursor-pointer hover:border-primary transition-colors"
                    onClick={() => handleLoadHistory(result)}
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <span className="font-medium">{result.topic}</span>
                        <div className="flex gap-2 mt-1">
                          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                            {result.taskType}
                          </span>
                          <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                            {result.platform}
                          </span>
                          <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                            {result.duration}
                          </span>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(result.createdAt), "MM-dd HH:mm")}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {result.content.slice(0, 200)}...
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
