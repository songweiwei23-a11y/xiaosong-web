"use client";
import type { HandoffPayload } from '@/lib/handoff';
import { useAutoCreationSetup } from '@/hooks/useAutoCreationSetup';
import { CreationSetupNotice } from '@/components/workspace/CreationSetupNotice';
import { resolveCreationSettings, mergeCreationSettings, settingsForResult, REVIEW_SCRIPT_TYPES, creationSettingsBlock, durationSeconds } from '@/lib/creation-settings';


import { takeHandoff } from "@/lib/handoff";
import { creationReference, originForResult } from '@/lib/creation-continuation';
import { useWorkResume } from "@/hooks/useWorkResume";
import { latestOf, workScriptBody, workIdFromUrl } from "@/lib/resume";
import { recordStage } from "@/lib/works";
import { throwApiError, fetchGeneration } from "@/lib/api-error";
import { openUpgrade } from "@/lib/upgrade";
import { buildTitlePrompt } from "@/lib/title-standards";
import { useGenerationPage } from '@/hooks/useGenerationPage';
import { useRestoreLastResult } from '@/hooks/useRestoreLastResult';
import { useCreatorContext } from "@/hooks/useCreatorContext";
import { useProfileRequestGuard } from '@/hooks/useProfileRequestGuard';
import { buildContextBlock } from "@/lib/creator-context";
import { Field } from "@/components/form/Field";
import { CollapsibleSection } from "@/components/form/CollapsibleSection";
import { INPUT_CLS, SELECT_CLS, TEXTAREA_CLS, PRIMARY_BTN, GENERATE_BTN, SECONDARY_BTN, chipCls } from "@/components/form/controls";
import { WorkspaceLayout } from "@/components/workspace/WorkspaceLayout";
import { PageHeader } from "@/components/workspace/PageHeader";
import { ResultPanel } from "@/components/workspace/ResultPanel";
import { ContextBadge } from '@/components/workspace/ContextBadge';
import { HistoryPanel } from "@/components/workspace/HistoryPanel";
import { useState, useEffect } from "react";
import { saveGenerationHistory, checkQuota } from '@/lib/history';
import { readDifyStream } from '@/lib/sse-stream';
import { Sparkles, Loader2, Target, Users, Zap, TrendingUp, History, MessageCircle, Trash2, Tag } from "lucide-react";
import ContinuousDialog from '@/components/ContinuousDialog';
import { notify, confirmDialog } from '@/components/ui/feedback';
import { postSafely } from '@/lib/safe-post';

// 标题风格选项
const TITLE_STYLES = [
  { id: "pain", label: "痛点型", desc: "直击用户痛点", example: "还在为...发愁？" },
  { id: "counter", label: "反常识", desc: "打破固有认知", example: "你以为...其实..." },
  { id: "result", label: "结果型", desc: "展示惊人效果", example: "30天后的变化" },
];

// ===== 专业版配置 =====
const TITLE_TYPES = [
  { value: "auto", label: "AI推荐", desc: "按原稿选择", example: "沿原意选择最合适的标题", icon: "✨" },
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
  { value: "auto", label: "AI推荐", example: "按内容和证据选择公式", icon: "✨" },
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
  { value: "auto", label: "AI推荐", desc: "按内容与平台", example: "不强塞热点词", icon: "✨" },
  { value: "search", label: "搜索词", desc: "高搜索量", example: "减肥、赚钱", icon: "🔍" },
  { value: "long-tail", label: "长尾词", desc: "精准细分", example: "30天减肥10斤", icon: "🎯" },
  { value: "brand", label: "品牌词", desc: "个人IP", example: "不一编导", icon: "🏷️" },
  { value: "hot", label: "热点词", desc: "当下热门", example: "AI、ChatGPT", icon: "🔥" },
];

const AB_TEST_COUNTS = [
  { value: 3, label: "3个", desc: "快速测试" },
  { value: 5, label: "5个", desc: "标准版" },
  { value: 8, label: "8个", desc: "充分选择" },
  { value: 10, label: "10个", desc: "全面对比" },
];

export default function TitlePage() {
  const beginProfileRequest = useProfileRequestGuard();
  const [incomingSetup, setIncomingSetup] = useState<HandoffPayload | null>(null);
  // 账号档案 + 定位 + 成交理由。以侧边栏选中的档案为准，切换时自动跟着变
  const { context: creatorContext, loading: contextLoading } = useCreatorContext();

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
  const [titleType, setTitleType] = useState("auto");
  const [titleFormula, setTitleFormula] = useState("auto");
  const [keywordStrategy, setKeywordStrategy] = useState("auto");
  const [abTestCount, setAbTestCount] = useState(5);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isRecommending, setIsRecommending] = useState(false);

  // 历史记录相关
  const { history: titleHistory, loadHistory: loadTitleHistory, lastResult, resultScope } = useGenerationPage({ taskType: '标题封面', historyApiPath: '/api/titles' });
  useRestoreLastResult(lastResult, setResult, resultScope, () => { setWorkId(null); setOriginContent(''); setOpeningCards([]); setSelectedHistory(null); setShowDialog(false); });
  const [selectedHistory, setSelectedHistory] = useState<any>(null);
  const [showDialog, setShowDialog] = useState(false);
  // 所属作品：由脚本页带过来，保存时挂到同一条内容下
  const [workId, setWorkId] = useState<string | null>(null);
  const [originContent, setOriginContent] = useState('');
  // 开篇钩子页带过来的卡名。为空时让模型从 36 张里自己挑
  const [openingCards, setOpeningCards] = useState<string[]>([]);


  const autoSetup = useAutoCreationSetup(incomingSetup, creatorContext, contextLoading, s => {
    setTopic(s.topic ?? ''); setVideoTopic(s.direction || s.topic || ''); setPlatform(s.platform!); setTargetAudience(s.audience ?? '');
    setTitleType(TITLE_TYPES.some(x => x.value === s.titleType) ? s.titleType! : 'auto');
    setTitleFormula(TITLE_FORMULAS.some(x => x.value === s.titleFormula) ? s.titleFormula! : 'auto');
    setKeywordStrategy(KEYWORD_STRATEGIES.some(x => x.value === s.keywordStrategy) ? s.keywordStrategy! : 'auto');
    setAbTestCount(AB_TEST_COUNTS.some(x => x.value === s.titleCount) ? s.titleCount! : 3);
    setOpeningCards(s.openingCards || []);
  });
  const currentSettings = resolveCreationSettings({ from: '标题封面', sourceContent: scriptContent || topic, settings: mergeCreationSettings(autoSetup.settings, { topic, platform, audience: targetAudience, titleType, titleFormula, keywordStrategy, titleCount: abTestCount, openingCards }) }, creatorContext);

  // 接收从脚本页带来的主题
  useEffect(() => {
    const data = takeHandoff();
    if (data) setIncomingSetup(data);
    if (data) setOriginContent(data.originContent || data.sourceContent || '');
    if (data?.workId) setWorkId(data.workId);
    if (data?.topic) setTopic(data.topic);
    else if (data?.sourceTitle) setTopic(data.sourceTitle);
    if (data?.scriptContent || data?.sourceContent) setScriptContent(creationReference(data) || data.scriptContent || '');
    // 从开篇钩子页带过来的卡：标题跟着用同一套钩子机制
    if (data?.openingCards?.length) setOpeningCards(data.openingCards);
  }, []);

  /*
   * 打开某个作品（地址带 ?work=）：选题填进主题、脚本正文填进来，
   * 做过开篇的沿用那几张开篇卡（标题和开头赌同一个钩子），
   * 起过标题的把最新一版调出来。
   */
  useWorkResume((work, setup) => {
    setIncomingSetup(setup);
    setOriginContent(setup.originContent || '');
    setAdditionalInfo(creationReference(setup));
    setWorkId(work.id);
    setTopic(work.title);
    const script = workScriptBody(work);
    if (script) setScriptContent(script);
    const opening = latestOf(work, "开篇钩子");
    const picked = opening?.input_data?.picked;
    if (Array.isArray(picked) && picked.length) {
      setOpeningCards(picked.filter((x): x is string => typeof x === "string"));
    }
    const last = latestOf(work, "标题封面");
    if (last) setResult(last.result);
  });

  const deleteTitle = async (id: string) => {
    if (!await confirmDialog('确定要删除这个标题吗？', { tone: 'danger', confirmText: '删除', title: '确认删除' })) return;
    
    try {
      const res = await postSafely(`/api/titles?id=${id}`, { method: 'DELETE' });
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
    // 连它属于哪个作品一起接上
    if (title.work_id !== undefined) setWorkId(title.work_id ?? null);
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
    if (isGenerating) return;
    if (autoSetup.preparing || contextLoading) { notify("正在承接原方案，请稍候"); return; }
    if (!resultScope) { notify("档案正在加载，请稍后再试"); return; }
    const isCurrent = beginProfileRequest();
    if (!topic.trim()) {
      notify("请输入视频主题");
      return;
    }

    // 必须传功能名。不传的话 checkQuota 一律回答「脚本生成还剩几次」，
    // 于是本页额度明明是 0 也会放行，等服务端拒绝后用户只看到一句失败。
    setIsGenerating(true);
    const remainingQuota = await checkQuota("title");
    if (!isCurrent()) { setIsGenerating(false); return; }
    if (remainingQuota !== null && remainingQuota <= 0) {
      openUpgrade("title");
      setIsGenerating(false);
      return;
    }

    setIsGenerating(true);
    setResult("");
    let fullResult = "";

    const inputData = {
      creationSettings: currentSettings,
      profileId: creatorContext.profile?.id || null,
      topic,
      titleType,
      titleFormula,
      keywordStrategy,
      abTestCount,
      targetAudience,
      platform,
      openingCards,
      sourceContent: scriptContent,
      originContent: originContent || scriptContent,
    };

    // 页面上这些选项本来就带着示例和公式结构，原提示词只取了标签文字，
    // 等于让模型自己猜「数字+动词+结果」是什么意思。现在把公式拆解、
    // 平台规则、风险词、自查项一并交给 lib/title-standards 拼。
    const keywordStrategyOption = KEYWORD_STRATEGIES.find(k => k.value === keywordStrategy);
    const prompt = buildTitlePrompt({
        // 账号背景随每次生成带上，不用用户在这一页重填一遍
        contextBlock: buildContextBlock(creatorContext, "title") + creationSettingsBlock(currentSettings),
      topic,
      titleTypeLabel: TITLE_TYPES.find(t => t.value === titleType)?.label || "AI推荐",
      titleFormulaValue: titleFormula,
      titleFormulaLabel: TITLE_FORMULAS.find(f => f.value === titleFormula)?.label || "",
      keywordStrategyLabel: keywordStrategyOption?.label || "",
      keywordStrategyDesc: keywordStrategyOption?.desc || "",
      platform,
      targetAudience,
      count: abTestCount,
      openingCards,
      sourceContent: scriptContent,
    });

    try {
      const response = await fetchGeneration("/api/dify/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskType: "标题封面",
          creationSettings: currentSettings,
          query: prompt,
          // 记忆按档案隔离，与脚本、选题两页一致；不传的话代运营多个账号时
          // 会把 A 号起过的标题串到 B 号的生成里
          profileId: creatorContext.profile?.id || null,
          // 结构化字段带上，供知识库检索的短查询使用
          platform,
          titleType,
        }),
      });

      // 把服务端的话带出来。额度用完时它说的是「额度已用完，请升级会员」，
      // 统一写成「生成失败」会让用户以为是故障，于是一直重试。
      if (!response.ok) await throwApiError(response);

      // 统一走 readDifyStream：原手写解析未开 stream 解码模式，中文被拆在
      // 数据块边界时会变成乱码；且缺少行缓冲，半行 JSON 会被整行丢弃。
      fullResult += await readDifyStream(response, {
        onChunk: (_piece, full) => { if (isCurrent()) setResult(full); },
      });

      if (fullResult) {
        await saveGenerationHistory("标题封面", inputData, fullResult, workId);
            // 登记到作品：刷新排序；五个环节都齐了就自动标记完成
            await recordStage(workId, "标题封面");
        await loadTitleHistory();
        if (isCurrent()) setShowDialog(true);
      }
    } catch (error: any) {
      console.error("❌ 生成失败:", error);
      notify(error?.message || "生成失败，请重试");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <WorkspaceLayout
      sidebar={
        <>
          <PageHeader title="标题封面" subtitle="生成高点击率的爆款标题，一次给出多个方案做对比" />

          {/* 档案和创作简报自动带上，这里只告诉用户带了什么 */}
          <ContextBadge board="title" className="mb-4" />
          <CreationSetupNotice settings={autoSetup.settings} preparing={autoSetup.preparing} />
          <CollapsibleSection title="脚本 / 创作参考" defaultOpen>
            <textarea aria-label="脚本或创作参考" value={scriptContent} onChange={e => setScriptContent(e.target.value)} placeholder="可粘贴脚本；从其他板块跳转时自动带入内容" rows={4} className={TEXTAREA_CLS} />
          </CollapsibleSection>

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

          {/* 从开篇页带过来时才出现。不提示的话用户不知道这次的标题被约束了 */}
          {openingCards.length > 0 && (
            <div className="glass-panel mb-4 rounded-xl border border-primary/30 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[12px] font-medium text-primary">跟随开篇钩子</div>
                  <div className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    标题会用和开头同一套机制：{openingCards.join('、')}
                  </div>
                </div>
                <button
                  onClick={() => setOpeningCards([])}
                  className="shrink-0 text-[11px] text-muted-foreground hover:text-foreground"
                >
                  取消
                </button>
              </div>
            </div>
          )}

          <CollapsibleSection title="标题风格" defaultOpen>
            <Field label="标题类型" optional stacked>
              <button type="button" onClick={() => setTitleType('auto')} aria-pressed={titleType === 'auto'} className={`${SECONDARY_BTN} mb-2 w-full`}>
                {titleType === 'auto' ? '已按原稿自动选择标题类型' : '按原稿自动选择标题类型'}
              </button>
              <div className="grid grid-cols-3 gap-1.5">
                {TITLE_TYPES.filter(type => type.value !== 'auto').slice(0, 6).map((type) => (
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
            disabled={autoSetup.preparing || contextLoading || isGenerating || !topic.trim()}
            className={GENERATE_BTN}
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
        flowContext={{ settings: settingsForResult(result, titleHistory, currentSettings), workId: workId ?? undefined, topic, originContent: originForResult(result, titleHistory, originContent || scriptContent) }}
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
