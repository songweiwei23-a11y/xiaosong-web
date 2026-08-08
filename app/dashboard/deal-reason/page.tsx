"use client";

import { useState, useEffect } from "react";
import { Award, Loader2, Sparkles, Copy, Save, Check } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { supabase, dealReasonService } from "@/lib/supabase";
import { notify } from '@/components/ui/feedback';

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
          taskType: "知识库查询",
          category: "成交理由",
          topic: query
        }),
      });

      if (!response.ok) throw new Error("分析失败");
      const reader = response.body?.getReader();
      if (!reader) throw new Error("无法读取响应");
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        accumulated += chunk;
        setAnalysisResult(formatAnalysisResult(accumulated));
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
      <div className="flex h-full items-center justify-center bg-gradient-to-br from-yellow-50 via-amber-50 to-orange-50">
        <Loader2 className="h-12 w-12 animate-spin text-yellow-500" />
      </div>
    );
  }

  return (
    <div className="flex h-full bg-gradient-to-br from-yellow-50 via-amber-50 to-orange-50">
      {/* 左侧输入表单 */}
      <div className="w-[420px] border-r border-yellow-200/50 backdrop-blur-xl bg-card/40 p-6 overflow-y-auto shadow-2xl">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-3 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-2xl shadow-lg">
              <Award className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-yellow-600 to-orange-600 bg-clip-text text-transparent">
                成交理由分析
              </h1>
              <p className="text-sm text-yellow-600/70 mt-1">AI分析17个成交理由</p>
            </div>
          </div>
        </div>

        {/* 已保存的成交理由提示 */}
        {savedData && (
          <div className="mb-6 p-4 rounded-xl bg-green-50 border-2 border-green-200">
            <div className="text-sm font-semibold text-green-700 mb-2">
              ✅ 已保存 {savedData.selected_reasons?.length || 0} 个成交理由
            </div>
            <div className="text-xs text-green-600 mb-2">
              店铺: {savedData.store_name} ({savedData.store_type})
            </div>
            <div className="text-xs text-green-500">
              在脚本/选题中可选2-3个重点使用
            </div>
          </div>
        )}
        
        <div className="space-y-6">
          {/* 店铺名称 */}
          <div>
            <label className="mb-3 block text-sm font-semibold text-yellow-700">
              店铺名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              placeholder="例如:老李烧烤、美美美容院"
              className="w-full rounded-2xl border-2 border-yellow-200/50 backdrop-blur-xl bg-card/80 px-5 py-3 focus:border-yellow-400 focus:outline-none focus:ring-4 focus:ring-yellow-100 transition-all shadow-lg"
            />
          </div>

          {/* 店铺类型 */}
          <div>
            <label className="mb-3 block text-sm font-semibold text-yellow-700">店铺类型</label>
            <select
              value={storeType}
              onChange={(e) => setStoreType(e.target.value)}
              className="w-full rounded-2xl border-2 border-yellow-200/50 backdrop-blur-xl bg-card/80 px-5 py-3 focus:border-yellow-400 focus:outline-none"
            >
              {STORE_TYPES.map(type => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </div>

          {/* 店铺特色 */}
          <div>
            <label className="mb-3 block text-sm font-semibold text-yellow-700">
              店铺特色描述 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={storeFeatures}
              onChange={(e) => setStoreFeatures(e.target.value)}
              placeholder="描述你的店铺特色,例如:&#10;- 开了10年的老店&#10;- 秘制配方,味道独特&#10;- 环境装修很有特色&#10;- 价格实惠,人均50元"
              rows={6}
              className="w-full rounded-2xl border-2 border-yellow-200/50 backdrop-blur-xl bg-card/80 px-5 py-4 focus:border-yellow-400 focus:outline-none focus:ring-4 focus:ring-yellow-100 transition-all resize-none shadow-lg"
            />
          </div>

          {/* 目标客户 */}
          <div>
            <label className="mb-3 block text-sm font-semibold text-yellow-700">
              目标客户 <span className="text-xs text-yellow-500">(可选)</span>
            </label>
            <input
              type="text"
              value={targetCustomer}
              onChange={(e) => setTargetCustomer(e.target.value)}
              placeholder="例如:周边3公里上班族"
              className="w-full rounded-2xl border-2 border-yellow-200/50 backdrop-blur-xl bg-card/80 px-5 py-3 focus:border-yellow-400 focus:outline-none focus:ring-4 focus:ring-yellow-100 transition-all shadow-lg"
            />
          </div>

          {/* 分析按钮 */}
          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing || !storeName.trim() || !storeFeatures.trim()}
            className="w-full rounded-2xl bg-gradient-to-r from-yellow-500 to-orange-600 px-6 py-4 font-bold text-white hover:from-yellow-600 hover:to-orange-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 active:scale-95"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>AI分析中...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5" />
                <span>AI全面分析17个成交理由</span>
              </>
            )}
          </button>

          {/* 手动选择成交理由 */}
          {selectedReasons.length > 0 && (
            <div className="pt-6 border-t-2 border-yellow-200">
              <label className="mb-3 block text-sm font-semibold text-yellow-700">
                选择成交理由 (至少15个，当前: {selectedReasons.length}/17)
              </label>
              <div className="grid grid-cols-3 gap-2 mb-4 max-h-80 overflow-y-auto pr-2">
                {ALL_DEAL_REASONS.map((reason) => (
                  <button
                    key={reason.id}
                    onClick={() => toggleReason(reason.id)}
                    className={`rounded-xl border-2 p-2.5 text-center transition-all duration-300 hover:shadow-md ${
                      selectedReasons.includes(reason.id)
                        ? 'border-yellow-500 bg-gradient-to-br from-yellow-100 to-orange-100 shadow-md scale-105'
                        : 'border-border bg-muted opacity-40'
                    }`}
                  >
                    <div className="text-xl mb-1">{reason.icon}</div>
                    <div className="text-[10px] font-bold text-yellow-900">{reason.label}</div>
                    {selectedReasons.includes(reason.id) && (
                      <Check className="w-3 h-3 text-yellow-600 mx-auto mt-1" />
                    )}
                  </button>
                ))}
              </div>

              {/* 保存按钮 */}
              <button
                onClick={handleSave}
                disabled={selectedReasons.length < 15}
                className="w-full rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 px-6 py-4 font-bold text-white hover:from-green-600 hover:to-emerald-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105"
              >
                <Save className="h-5 w-5" />
                <span>保存到云端 ({selectedReasons.length}/17)</span>
              </button>
              {selectedReasons.length < 15 && (
                <p className="text-xs text-red-500 text-center mt-2">还需选择 {15 - selectedReasons.length} 个</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 右侧分析结果 */}
      <div className="flex-1 overflow-y-auto p-8">
        {!analysisResult && !isAnalyzing && (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <div className="mb-6 inline-flex p-8 bg-gradient-to-br from-yellow-100 to-orange-100 rounded-3xl shadow-2xl">
                <Award className="w-20 h-20 text-yellow-600" />
              </div>
              <h3 className="text-3xl font-bold bg-gradient-to-r from-yellow-600 to-orange-600 bg-clip-text text-transparent mb-3">
                成交理由全面分析
              </h3>
              <p className="text-yellow-600/70 text-lg mb-2">
                AI分析17个成交理由并打分
              </p>
              <p className="text-sm text-yellow-500/60 mb-4">
                保存后可在脚本/选题中灵活选择2-3个重点使用
              </p>
            </div>
          </div>
        )}

        {(analysisResult || isAnalyzing) && (
          <div className="max-w-4xl mx-auto">
            <div className="backdrop-blur-xl bg-card/60 rounded-3xl shadow-2xl p-8 border-2 border-yellow-200/50">
              <div className="mb-6 flex items-center justify-between pb-6 border-b-2 border-yellow-100">
                <h2 className="text-3xl font-bold bg-gradient-to-r from-yellow-600 to-orange-600 bg-clip-text text-transparent flex items-center gap-3">
                  <Sparkles className="w-7 h-7 text-yellow-500" />
                  分析结果
                </h2>
                {analysisResult && !isAnalyzing && (
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-2 rounded-xl backdrop-blur-xl bg-card/80 border-2 border-yellow-300 px-5 py-2.5 text-sm font-semibold text-yellow-700 hover:border-yellow-500 hover:bg-yellow-50 transition-all shadow-lg hover:shadow-xl"
                  >
                    <Copy className="h-4 w-4" />
                    复制
                  </button>
                )}
              </div>

              {isAnalyzing && !analysisResult && (
                <div className="flex flex-col items-center justify-center py-20">
                  <Loader2 className="h-16 w-16 animate-spin text-yellow-500 mb-6" />
                  <p className="text-yellow-600 font-semibold text-lg">AI正在全面分析17个成交理由...</p>
                  <p className="text-yellow-500/60 text-sm mt-2">请稍候</p>
                </div>
              )}

              {analysisResult && (
                  <div className="max-w-none bg-gradient-to-br from-yellow-50 to-orange-50 rounded-2xl p-8 shadow-inner">'
                  <ReactMarkdown
                      components={{
                        h1: ({node, ...props}) => <h1 className="text-3xl font-bold text-yellow-800 mb-4 mt-6" {...props} />,
                        h2: ({node, ...props}) => <h2 className="text-2xl font-bold text-yellow-700 mb-3 mt-5" {...props} />,
                        h3: ({node, ...props}) => <h3 className="text-xl font-semibold text-yellow-600 mb-2 mt-4" {...props} />,
                        p: ({node, ...props}) => <p className="text-foreground leading-relaxed mb-4" {...props} />,
                        strong: ({node, ...props}) => <strong className="text-yellow-700 font-bold" {...props} />,
                        ul: ({node, ...props}) => <ul className="list-disc pl-6 mb-4 space-y-2" {...props} />,
                        ol: ({node, ...props}) => <ol className="list-decimal pl-6 mb-4 space-y-2" {...props} />,
                        li: ({node, ...props}) => <li className="text-foreground" {...props} />,
                        br: () => <br className="my-1" />,
                      }}
                    >{analysisResult}</ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


