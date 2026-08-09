"use client";

import { useState, useEffect } from "react";
import { saveGenerationHistory, checkQuota } from '@/lib/history';
import { Sparkles, Loader2, Target, Users, Zap, TrendingUp, History, MessageCircle, Trash2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import ContinuousDialog from '@/components/ContinuousDialog';
import { notify, confirmDialog } from '@/components/ui/feedback';

// 标题风格选项
const TITLE_STYLES = [
  { id: "pain", label: "痛点型", desc: "直击用户痛点", example: "还在为...发愁？" },
  { id: "counter", label: "反常识", desc: "打破固有认知", example: "你以为...其实..." },
  { id: "result", label: "结果型", desc: "展示惊人效果", example: "30天后的变化" },
];

// ===== 专业版配置 =====
const TITLE_TYPES = [
  { value: "suspense", label: "悬念式", desc: "留下悬念", example: "为什么90%的人...", icon: "🔮" },
  { value: "number", label: "数字式", desc: "具体数字", example: "3个方法让你...", icon: "🔢" },
  { value: "contrast", label: "对比式", desc: "前后对比", example: "穷人vs富人...", icon: "⚖️" },
  { value: "question", label: "疑问式", desc: "提出问题", example: "你真的了解...", icon: "❓" },
  { value: "exclamation", label: "惊叹式", desc: "表达惊讶", example: "太绝了！...", icon: "❗" },
  { value: "pain", label: "痛点式", desc: "直击痛点", example: "还在为...发愁？", icon: "💢" },
  { value: "benefit", label: "利益式", desc: "承诺好处", example: "让你月入...", icon: "💰" },
  { value: "authority", label: "权威式", desc: "专家背书", example: "10年老司机...", icon: "👨‍🏫" },
  { value: "hotspot", label: "热点式", desc: "蹭热点", example: "最近火爆的...", icon: "🔥" },
  { value: "story", label: "故事式", desc: "讲故事", example: "一个真实的...", icon: "📖" },
  { value: "emotion", label: "情感式", desc: "情绪共鸣", example: "看哭了...", icon: "😢" },
  { value: "command", label: "指令式", desc: "行动指令", example: "马上收藏...", icon: "👉" },
];

const TITLE_FORMULAS = [
  { value: "number-action", label: "数字+动词+结果", example: "3个方法让你月入过万", icon: "📊" },
  { value: "time-twist", label: "时间+人物+反转", example: "35岁失业，如今...", icon: "⏰" },
  { value: "pain-solution", label: "痛点+解决方案", example: "牙疼？试试这个...", icon: "💊" },
  { value: "negative-positive", label: "负面+转折+正面", example: "工资很低，但我很快乐", icon: "🔄" },
  { value: "why-reason", label: "为什么+意外原因", example: "为什么他们都...", icon: "🤔" },
  { value: "before-after", label: "前后对比", example: "用前vs用后，差距惊人", icon: "📸" },
  { value: "secret-reveal", label: "秘密+揭露", example: "行业内幕：原来...", icon: "🔓" },
  { value: "warning-tip", label: "警告+提示", example: "千万别...否则...", icon: "⚠️" },
];

const KEYWORD_STRATEGIES = [
  { value: "search", label: "搜索词", desc: "高搜索量", example: "减肥、赚钱", icon: "🔍" },
  { value: "long-tail", label: "长尾词", desc: "精准细分", example: "30天减肥10斤", icon: "🎯" },
  { value: "brand", label: "品牌词", desc: "个人IP", example: "小宋编导", icon: "🏷️" },
  { value: "hot", label: "热点词", desc: "当下热门", example: "AI、ChatGPT", icon: "🔥" },
];

const AB_TEST_COUNTS = [
  { value: 3, label: "3个", desc: "快速测试" },
  { value: 5, label: "5个", desc: "标准版" },
  { value: 8, label: "8个", desc: "充分选择" },
  { value: 10, label: "10个", desc: "全面对比" },
];

export default function TitlePage() {
  const [topic, setTopic] = useState("");
  const [scriptContent, setScriptContent] = useState("");
  const [videoTopic, setVideoTopic] = useState("");
  const [platform, setPlatform] = useState("抖音");
  const [titleStyles, setTitleStyles] = useState<string[]>(["pain", "counter", "result"]);
  const [targetAudience, setTargetAudience] = useState("");
  const [additionalInfo, setAdditionalInfo] = useState("");
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState("");

  // 专业版状态
  const [titleType, setTitleType] = useState("suspense");
  const [titleFormula, setTitleFormula] = useState("number-action");
  const [keywordStrategy, setKeywordStrategy] = useState("search");
  const [abTestCount, setAbTestCount] = useState(5);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isRecommending, setIsRecommending] = useState(false);

  // 历史记录相关
  const [titleHistory, setTitleHistory] = useState<any[]>([]);
  const [selectedHistory, setSelectedHistory] = useState<any>(null);
  const [showDialog, setShowDialog] = useState(false);

  // 加载历史记录
  useEffect(() => {
    loadTitleHistory();
  }, []);

  const loadTitleHistory = async () => {
    try {
      const res = await fetch('/api/titles');
      if (res.ok) {
        const data = await res.json();
        setTitleHistory(data);
        console.log(`✅ 加载了 ${data.length} 个标题`);
      }
    } catch (error) {
      console.error('❌ 加载标题历史失败:', error);
    }
  };

  const deleteTitle = async (id: string) => {
    if (!await confirmDialog('确定要删除这个标题吗？', { tone: 'danger', confirmText: '删除', title: '确认删除' })) return;
    
    try {
      const res = await fetch(`/api/titles?id=${id}`, { method: 'DELETE' });
      if (res.ok) {        loadTitleHistory();
        if (selectedHistory?.id === id) {
          setSelectedHistory(null);
          setResult('');
        }
      }
    } catch (error) {
      console.error('❌ 删除标题失败:', error);
    }
  };

  const viewTitle = (title: any) => {
    setSelectedHistory(title);
    setResult(title.result);
  };

  const openHistoryDialog = (title: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setResult(title.result);
    setSelectedHistory(title);
    setShowDialog(true);
  };

  const toggleStyle = (id: string) => {
    setTitleStyles(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleGenerate = async () => {
    if (!topic.trim()) {
      notify("请输入视频主题");
      return;
    }

    const remainingQuota = await checkQuota();
    if (remainingQuota !== null && remainingQuota <= 0) {
      notify("❌ 您的配额已用完，请联系管理员或升级会员");
      return;
    }

    setIsGenerating(true);
    setResult("");
    let fullResult = "";

    const inputData = {
      topic,
      titleType,
      titleFormula,
      keywordStrategy,
      abTestCount,
      targetAudience,
      platform
    };

    const prompt = `# 短视频标题生成

## 视频主题
${topic}

## 配置要求
- 标题类型：${TITLE_TYPES.find(t => t.value === titleType)?.label}
- 标题公式：${TITLE_FORMULAS.find(f => f.value === titleFormula)?.label}
- 关键词策略：${KEYWORD_STRATEGIES.find(k => k.value === keywordStrategy)?.label}
- 目标平台：${platform}
${targetAudience ? `- 目标人群：${targetAudience}` : ''}
- 生成数量：${abTestCount}个

请生成${abTestCount}个爆款标题，每个标题要：
1. 符合${platform}平台特点
2. 使用${TITLE_TYPES.find(t => t.value === titleType)?.label}技巧
3. 包含情绪钩子
4. 控制在15-25字
5. 标注核心卖点`;

    try {
      const response = await fetch("/api/dify/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskType: "标题封面",
          query: prompt,
        }),
      });

      if (!response.ok) throw new Error("生成失败");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.answer) {
                  fullResult += data.answer;
                  setResult(fullResult);
                }
              } catch (e) {
                console.error("解析失败:", e);
              }
            }
          }
        }
      }

      if (fullResult) {
        await saveGenerationHistory("标题封面", inputData, fullResult);
        await loadTitleHistory();
        setShowDialog(true);
      }
    } catch (error) {
      console.error("❌ 生成失败:", error);
      notify("生成失败，请重试");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex h-screen bg-muted">
      {/* 左侧输入区域 */}
      <div className="w-[400px] border-r bg-card overflow-y-auto p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <TrendingUp className="w-7 h-7 text-purple-600" />
            标题封面
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            AI生成高点击率的爆款标题
          </p>
        </div>

        {/* 视频主题 */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            视频主题 <span className="text-red-500">*</span>
          </label>
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="例如：教你3招拍出电影感视频"
            rows={3}
            className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
          />
        </div>

        {/* 目标平台 */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            目标平台
          </label>
          <div className="flex gap-2">
            {['抖音', '小红书', '快手', 'B站', '视频号'].map((p) => (
              <button
                key={p}
                onClick={() => setPlatform(p)}
                className={`flex-1 py-2 rounded-lg border-2 text-sm transition-all ${
                  platform === p
                    ? 'border-purple-500 bg-purple-50 text-purple-700'
                    : 'border-border hover:border-border'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* 标题类型 */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            标题类型
          </label>
          <div className="grid grid-cols-3 gap-2">
            {TITLE_TYPES.slice(0, 6).map((type) => (
              <button
                key={type.value}
                onClick={() => setTitleType(type.value)}
                className={`p-2 rounded-lg border-2 text-left transition-all ${
                  titleType === type.value
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-border hover:border-border'
                }`}
              >
                <div className="text-xl mb-1">{type.icon}</div>
                <div className="text-xs font-medium">{type.label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 生成数量 */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            生成数量：{abTestCount}个
          </label>
          <div className="flex gap-2">
            {AB_TEST_COUNTS.map((option) => (
              <button
                key={option.value}
                onClick={() => setAbTestCount(option.value)}
                className={`flex-1 py-2 rounded-lg border-2 transition-all ${
                  abTestCount === option.value
                    ? 'border-purple-500 bg-purple-50 text-purple-700'
                    : 'border-border hover:border-border'
                }`}
              >
                <div className="font-bold">{option.label}</div>
                <div className="text-xs text-muted-foreground">{option.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 目标人群（选填） */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            目标人群 <span className="text-xs text-muted-foreground">(选填)</span>
          </label>
          <input
            type="text"
            value={targetAudience}
            onChange={(e) => setTargetAudience(e.target.value)}
            placeholder="例如：25-35岁职场女性"
            className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-purple-500"
          />
        </div>

        {/* 生成按钮 */}
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-4 rounded-xl font-bold text-lg hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 transition-all shadow-lg flex items-center justify-center gap-2"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              AI生成中...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              生成标题
            </>
          )}
        </button>

        {/* 历史记录 */}
        {titleHistory.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <History className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">历史标题</h3>
              <span className="text-xs text-muted-foreground">({titleHistory.length})</span>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {titleHistory.map((item) => (
                <div
                  key={item.id}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    selectedHistory?.id === item.id
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-border hover:border-border bg-card'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div 
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => viewTitle(item)}
                    >
                      <div className="font-medium text-sm text-foreground truncate">
                        {item.input_data?.topic || '标题生成'}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {new Date(item.created_at).toLocaleDateString('zh-CN')}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => openHistoryDialog(item, e)}
                        className="p-1.5 text-purple-600 hover:bg-purple-100 rounded-lg transition-colors"
                        title="继续对话"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteTitle(item.id)
                        }}
                        className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 右侧结果区域 */}
      <div className="flex-1 overflow-y-auto p-8">
        {result ? (
          <div className="max-w-4xl mx-auto">
            <div className="bg-card rounded-xl shadow-sm p-8">
              <div className="prose prose-slate max-w-none">
                <ReactMarkdown>{result}</ReactMarkdown>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-muted-foreground">
              <TrendingUp className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg">输入主题后，点击生成标题</p>
              <p className="text-sm mt-2">AI将生成{abTestCount}个爆款标题供你选择</p>
            </div>
          </div>
        )}
      </div>

      {/* 持续对话 */}
      <ContinuousDialog
        isOpen={showDialog}
        onClose={() => setShowDialog(false)}
        initialContent={result}
        taskType="标题封面"
        contextData={{}}
      />
    </div>
  );
}
