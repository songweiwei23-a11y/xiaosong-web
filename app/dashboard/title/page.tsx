"use client";

import { takeHandoff } from "@/lib/handoff";
import { Field } from "@/components/form/Field";
import { CollapsibleSection } from "@/components/form/CollapsibleSection";
import { INPUT_CLS, SELECT_CLS, TEXTAREA_CLS, PRIMARY_BTN, SECONDARY_BTN, chipCls } from "@/components/form/controls";
import { WorkspaceLayout } from "@/components/workspace/WorkspaceLayout";
import { PageHeader } from "@/components/workspace/PageHeader";
import { ResultPanel } from "@/components/workspace/ResultPanel";
import { HistoryPanel } from "@/components/workspace/HistoryPanel";
import { useState, useEffect } from "react";
import { saveGenerationHistory, checkQuota } from '@/lib/history';
import { readDifyStream } from '@/lib/sse-stream';
import { Sparkles, Loader2, Target, Users, Zap, TrendingUp, History, MessageCircle, Trash2, Tag } from "lucide-react";
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

  // 接收从脚本页带来的主题
  useEffect(() => {
    const data = takeHandoff();
    if (data?.topic) setTopic(data.topic);
  }, []);

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

        // 切换页面或刷新后把最近一条取回来显示。只在结果区为空时回填，
        // 且生成结束后的刷新不会覆盖用户刚拿到的内容。
        const latest = data[0]?.result || data[0]?.content || '';
        if (latest) setResult((current) => current || latest);
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

      // 统一走 readDifyStream：原手写解析未开 stream 解码模式，中文被拆在
      // 数据块边界时会变成乱码；且缺少行缓冲，半行 JSON 会被整行丢弃。
      fullResult += await readDifyStream(response, {
        onChunk: (_piece, full) => setResult(full),
      });

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
    <WorkspaceLayout
      sidebar={
        <>
          <PageHeader title="标题封面" subtitle="生成高点击率的爆款标题，一次给出多个方案做对比" />

          <CollapsibleSection title="基础信息" defaultOpen>
            <Field label="视频主题" required stacked>
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="例如：教你3招拍出电影感视频"
                rows={3}
                className={TEXTAREA_CLS}
              />
            </Field>

            <Field label="目标平台" required>
              <div className="glass-panel inline-flex flex-wrap gap-0.5 rounded-xl p-1">
                {["抖音", "小红书", "快手", "B站", "视频号"].map((p) => (
                  <button
                    key={p}
                    onClick={() => setPlatform(p)}
                    aria-pressed={platform === p}
                    className={`rounded-lg px-3 py-1.5 text-[12px] transition-colors ${
                      platform === p
                        ? "bg-primary/20 font-medium text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="目标人群" optional>
              <input
                type="text"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                placeholder="例如：25-35 岁职场女性"
                className={INPUT_CLS}
              />
            </Field>
          </CollapsibleSection>

          <CollapsibleSection title="标题风格" defaultOpen>
            <Field label="标题类型" optional stacked>
              <div className="grid grid-cols-3 gap-1.5">
                {TITLE_TYPES.slice(0, 6).map((type) => (
                  <button
                    key={type.value}
                    onClick={() => setTitleType(type.value)}
                    aria-pressed={titleType === type.value}
                    title={type.example}
                    className={`glass-interactive rounded-xl border p-2 text-center ${
                      titleType === type.value ? "glass-selected" : "glass-panel"
                    }`}
                  >
                    <div className="text-base leading-none">{type.icon}</div>
                    <div
                      className={`mt-1 text-[11px] font-medium leading-none ${
                        titleType === type.value ? "text-primary" : "text-muted-foreground"
                      }`}
                    >
                      {type.label}
                    </div>
                  </button>
                ))}
              </div>
            </Field>

            <Field label="生成数量" optional stacked>
              <div className="grid grid-cols-4 gap-1.5">
                {AB_TEST_COUNTS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setAbTestCount(option.value)}
                    aria-pressed={abTestCount === option.value}
                    className={`glass-interactive rounded-xl border px-2 py-2 text-center ${
                      abTestCount === option.value ? "glass-selected" : "glass-panel"
                    }`}
                  >
                    <div
                      className={`text-[13px] font-medium leading-none ${
                        abTestCount === option.value ? "text-primary" : "text-foreground"
                      }`}
                    >
                      {option.label}
                    </div>
                    <div className="mt-0.5 text-[10px] leading-none text-muted-foreground">
                      {option.desc}
                    </div>
                  </button>
                ))}
              </div>
            </Field>
          </CollapsibleSection>

          <button
            onClick={handleGenerate}
            disabled={isGenerating || !topic.trim()}
            className={PRIMARY_BTN}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                生成中…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                生成标题
              </>
            )}
          </button>
        </>
      }
    >
      <ResultPanel
        result={result}
        isGenerating={isGenerating}
        title="标题方案"
        showStats={false}
        emptyIcon={Tag}
        emptyTitle="填写主题后生成标题"
        emptyHint="一次给出多个方案，方便横向对比挑选"
        emptyTips={[
          "主题写得越具体，标题越有针对性",
          "同一主题可以换不同类型多试几轮",
          "生成数量选多一些便于 A/B 对比",
        ]}
        generatingHint="正在构思标题…"
        onCopy={(text) => {
          navigator.clipboard.writeText(text);
          notify("已复制到剪贴板");
        }}
      />

      <HistoryPanel
        items={titleHistory}
        title="历史标题"
        showStats={false}
        activeId={selectedHistory?.id ?? null}
        onLoad={(item) => viewTitle(item)}
        onDelete={(id) => deleteTitle(id)}
      />
    </WorkspaceLayout>
  );
}
