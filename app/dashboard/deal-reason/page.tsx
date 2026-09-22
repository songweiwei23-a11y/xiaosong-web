"use client";

import { Field } from "@/components/form/Field";
import { CollapsibleSection } from "@/components/form/CollapsibleSection";
import { INPUT_CLS, SELECT_CLS, TEXTAREA_CLS, PRIMARY_BTN, SECONDARY_BTN } from "@/components/form/controls";
import { WorkspaceLayout } from "@/components/workspace/WorkspaceLayout";
import { PageHeader } from "@/components/workspace/PageHeader";
import { ResultPanel } from "@/components/workspace/ResultPanel";
import { useState, useEffect } from "react";
import { throwApiError } from "@/lib/api-error";
import { Award, Loader2, Sparkles, Save, Check } from "lucide-react";
import { supabase, dealReasonService } from "@/lib/supabase";
import { notify } from '@/components/ui/feedback';
import { saveGenerationHistory } from '@/lib/history';

import { readDifyStream } from '@/lib/sse-stream';

// 历史里用它区分本页记录。发给 Dify 的 taskType 是「知识库查询」，
// 与知识库页相同，若历史也共用同一个值，两页的记录会互相串。
const HISTORY_TASK_TYPE = "成交理由";
// 17个核心成交理由
const ALL_DEAL_REASONS = [
  { id: "looks", label: "颜值高", icon: "🌟", desc: "好看出片上镜" },
  { id: "effect", label: "效果好", icon: "✨", desc: "改变明显" },
  { id: "choice", label: "选择多", icon: "📋", desc: "品类全款式多" },
  { id: "unique", label: "有特色", icon: "🎨", desc: "独家唯一" },
  { id: "convenient", label: "便利性", icon: "📍", desc: "近快方便" },
  { id: "boss", label: "老板好", icon: "👨‍🍳", desc: "热情专业" },
  { id: "service", label: "服务好", icon: "💎", desc: "贴心细致" },
  { id: "cases", label: "案例多", icon: "📊", desc: "经验丰富" },
  { id: "prestige", label: "有面子", icon: "🎩", desc: "档次品味" },
  { id: "value", label: "性价比", icon: "💰", desc: "实惠划算" },
  { id: "quality", label: "质量好", icon: "✅", desc: "用料足" },
  { id: "popular", label: "生意好", icon: "🔥", desc: "火爆排队" },
  { id: "reputation", label: "好评多", icon: "⭐", desc: "复购率高" },
  { id: "professional", label: "专业强", icon: "🎓", desc: "有资质" },
  { id: "scale", label: "规模大", icon: "🏢", desc: "连锁分店多" },
  { id: "rare", label: "稀缺唯一", icon: "🦄", desc: "限量独家" },
  { id: "honest", label: "实在不坑", icon: "🤝", desc: "透明不宰客" }
];

const STORE_TYPES = [
"餐饮美食", "美容美发", "休闲娱乐", "运动健身",
"亲子教育", "生活服务", "医疗健康", "宠物服务",
"汽车服务", "其他"
];

export default function DealReasonPage() {
  // 用户ID
  const [userId, setUserId] = useState<string | null>(null);
  
  // 输入信息
  const [storeName, setStoreName] = useState("");
  const [storeType, setStoreType] = useState("餐饮美食");
  const [storeFeatures, setStoreFeatures] = useState("");
  const [targetCustomer, setTargetCustomer] = useState("");
  
  // AI分析结果
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState("");

  // 切换页面或刷新后，把云端最近一条分析结果取回来显示。
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
        if (latest?.result) setAnalysisResult((current) => current || latest.result);
      } catch (error) {
        console.error('恢复上次分析失败:', error);
      }
    };
    restore();
    return () => { cancelled = true; };
  }, []);

  // 格式化分析结果，将<br>转换为换行
  const formatAnalysisResult = (text: string) => {
    return text
      .replace(/<br\s*\/?>/gi, '\n\n')  // 将<br>转为双换行
      .replace(/\|\|/g, '\n\n**')        // 将||转为段落分隔
      .replace(/\*\*([^*]+)\*\*:/g, '\n\n### $1\n')  // 将加粗标题转为h3
      .trim();
  };
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  
  // 已保存的成交理由
  const [savedData, setSavedData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 获取当前用户
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        // 加载已保存的成交理由
        const saved = await dealReasonService.get(user.id);
        if (saved) {
          setSavedData(saved);
          setStoreName(saved.store_name);
          setStoreType(saved.store_type);
          setStoreFeatures(saved.store_features || "");
          setTargetCustomer(saved.target_customer || "");
          setAnalysisResult(formatAnalysisResult(saved.analysis_result || ""));
          setSelectedReasons(saved.selected_reasons || []);
        }
      }
      setIsLoading(false);
    };
    getUser();
  }, []);

  // AI分析成交理由
  const handleAnalyze = async () => {
    // 临时移除登录检查,允许游客使用
    // if (!userId) {
    //   notify("请先登录");
    //   return;
    // }
    
    if (!storeName.trim() || !storeFeatures.trim()) {
      notify("请填写店铺名称和特色描述");
      return;
    }

    setIsAnalyzing(true);
    setAnalysisResult("");
    setSelectedReasons([]);

    try {
      const query = `请作为短视频编导专家，全面分析以下店铺的成交理由：

店铺名称：${storeName}
店铺类型：${storeType}
店铺特色：${storeFeatures}
${targetCustomer ? `目标客户：${targetCustomer}` : ''}

请对以下17个成交理由逐一分析评分（0-10分）：
颜值高、效果好、选择多、有特色、便利性、老板好、服务好、案例多、有面子、性价比、质量好、生意好、好评多、专业强、规模大、稀缺唯一、实在不坑

要求：
1. 每个成交理由都要分析并打分
2. 解释该成交理由是否适合这个店铺
3. 给出如何在短视频中体现的建议
4. 最后标注出得分最高的TOP3核心成交理由
5. 用表格或清晰的格式展示所有17个成交理由的评分`;

      const response = await fetch("/api/dify/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // 按自己的名字发。此前发 '知识库查询'，用量被记进「知识库」
          // （无限额度），这个功能等于从来没计过费。
          taskType: "成交理由",
          category: "成交理由",
          topic: query
        }),
      });

      if (!response.ok) await throwApiError(response, "分析失败");
      // 响应是 SSE（data: {"answer":"..."}），需解析后取 answer
      const full = await readDifyStream(response, {
        onChunk: (_piece, text) => setAnalysisResult(formatAnalysisResult(text)),
      });

      // 存一份到云端，换页面或刷新后才能取回来
      if (full.trim()) {
        await saveGenerationHistory(
          HISTORY_TASK_TYPE,
          { storeName, storeType, storeFeatures, targetCustomer },
          formatAnalysisResult(full)
        );
      }

      // 分析完成后,自动选中所有17个成交理由
      setSelectedReasons(ALL_DEAL_REASONS.map(r => r.id));

    } catch (error: any) {
      notify(error.message || "分析失败");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 手动选择成交理由
  const toggleReason = (id: string) => {
    setSelectedReasons(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // 保存成交理由到Supabase
  const handleSave = async () => {
    if (!userId) {
      notify("请先登录");
      return;
    }
    
    if (selectedReasons.length < 15) {
      notify(`请至少选择15个成交理由（当前已选${selectedReasons.length}个）`);
      return;
    }

    try {
      const saved = await dealReasonService.save({
        userId,
        storeName,
        storeType,
        storeFeatures,
        targetCustomer,
        analysisResult,
        selectedReasons
      });

      setSavedData(saved);
      notify(`✅ 成功保存${selectedReasons.length}个成交理由!\n在脚本创作和选题策划中可灵活选择2-3个重点使用`);
    } catch (error: any) {
      notify("保存失败: " + error.message);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(analysisResult);
    notify("已复制到剪贴板");
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-yellow-500" />
      </div>
    );
  }

  return (
    <WorkspaceLayout
      sidebar={
        <>
          <PageHeader
            title="成交理由"
            subtitle="AI 逐条分析 17 个成交理由并打分，保存后可在脚本与选题里直接调用"
          />

          {savedData && (
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3">
              <p className="text-[13px] font-medium text-emerald-500">
                已保存 {savedData.selected_reasons?.length || 0} 个成交理由
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                {savedData.store_name}（{savedData.store_type}）· 在脚本或选题中挑 2–3 个重点使用
              </p>
            </div>
          )}

          <CollapsibleSection title="店铺信息" defaultOpen>
            <Field label="店铺名称" required>
              <input
                type="text"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="例如：老李烧烤、美美美容院"
                className={INPUT_CLS}
              />
            </Field>

            <Field label="店铺类型" optional>
              <select
                value={storeType}
                onChange={(e) => setStoreType(e.target.value)}
                className={SELECT_CLS}
              >
                {STORE_TYPES.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </Field>

            <Field label="店铺特色" required hint="写得越具体，分析越准" stacked>
              <textarea
                value={storeFeatures}
                onChange={(e) => setStoreFeatures(e.target.value)}
                placeholder={"开了 10 年的老店\n秘制配方，味道独特\n环境装修有特色\n人均 50 元"}
                rows={5}
                className={TEXTAREA_CLS}
              />
            </Field>

            <Field label="目标客户" optional>
              <input
                type="text"
                value={targetCustomer}
                onChange={(e) => setTargetCustomer(e.target.value)}
                placeholder="例如：周边 3 公里上班族"
                className={INPUT_CLS}
              />
            </Field>
          </CollapsibleSection>

          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing || !storeName.trim() || !storeFeatures.trim()}
            className={PRIMARY_BTN}
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                分析中…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                分析 17 个成交理由
              </>
            )}
          </button>

          {selectedReasons.length > 0 && (
            <CollapsibleSection title="选择成交理由" defaultOpen>
              <Field
                label="成交理由"
                stacked
                hint={
                  selectedReasons.length < 15
                    ? `已选 ${selectedReasons.length}/17，还需 ${15 - selectedReasons.length} 个才能保存`
                    : `已选 ${selectedReasons.length}/17，可以保存了`
                }
              >
                <div className="grid max-h-80 grid-cols-3 gap-1.5 overflow-y-auto pr-1">
                  {ALL_DEAL_REASONS.map((reason) => {
                    const picked = selectedReasons.includes(reason.id);
                    return (
                      <button
                        key={reason.id}
                        onClick={() => toggleReason(reason.id)}
                        aria-pressed={picked}
                        className={`glass-interactive relative rounded-xl border p-2 text-center ${
                          picked ? "glass-selected" : "glass-panel"
                        }`}
                      >
                        <div className="text-base leading-none">{reason.icon}</div>
                        <div
                          className={`mt-1 text-[11px] font-medium leading-none ${
                            picked ? "text-primary" : "text-muted-foreground"
                          }`}
                        >
                          {reason.label}
                        </div>
                        {picked && (
                          <Check className="absolute right-1 top-1 h-3 w-3 text-primary" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </Field>

              <button
                onClick={handleSave}
                disabled={selectedReasons.length < 15}
                className={`${SECONDARY_BTN} w-full disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <Save className="h-4 w-4" />
                保存到云端（{selectedReasons.length}/17）
              </button>
            </CollapsibleSection>
          )}
        </>
      }
    >
      <ResultPanel
        result={analysisResult}
        isGenerating={isAnalyzing}
        title="分析结果"
        showStats={false}
        emptyIcon={Award}
        emptyTitle="填好店铺信息就能开始"
        emptyHint="AI 会逐条分析 17 个成交理由并打分"
        emptyTips={[
          "特色写得越具体，打分越贴合实际",
          "分析完可以手动调整选中的理由",
          "保存后在脚本、选题里都能直接调用",
        ]}
        generatingHint="正在逐条分析 17 个成交理由…"
        onCopy={handleCopy}
      />
    </WorkspaceLayout>
  );
}
