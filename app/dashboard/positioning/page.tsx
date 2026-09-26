"use client";

import { formatRelativeTime } from "@/lib/script-result-utils";
import { Field } from "@/components/form/Field";
import { CollapsibleSection } from "@/components/form/CollapsibleSection";
import { INPUT_CLS, SELECT_CLS, TEXTAREA_CLS, PRIMARY_BTN, GENERATE_BTN, SECONDARY_BTN, chipCls } from "@/components/form/controls";
import { WorkspaceLayout } from "@/components/workspace/WorkspaceLayout";
import { PageHeader } from "@/components/workspace/PageHeader";
import { ResultPanel } from "@/components/workspace/ResultPanel";
import { HistoryPanel } from "@/components/workspace/HistoryPanel";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { putHandoff } from "@/lib/handoff";
import { saveGenerationHistory, checkQuota } from '@/lib/history';
import { readDifyStream } from '@/lib/sse-stream';
import { Target, Loader2, Sparkles, Lightbulb, Wand2, User, CheckCircle, History, Plus, Trash2, MessageCircle, FileText } from "lucide-react";
import { extractStrategySummary } from '@/lib/positioning-utils';
import { buildPositioningPrompt } from '@/lib/positioning-standards';
import { buildProfileSummary as summarizeProfile, profileSearchHints } from '@/lib/profile-summary';
import {
  SECTIONS,
  QUICK_SECTION_KEYS,
  buildQuickOutputSpec,
  parsePositioning,
} from '@/lib/positioning-sections';
import { SectionEditor } from '@/components/positioning/SectionEditor';
import { invalidateCreatorContext } from '@/hooks/useCreatorContext';
import { throwApiError } from "@/lib/api-error";
import ContinuousDialog from '@/components/ContinuousDialog';
import { notify, confirmDialog } from '@/components/ui/feedback';

import { getActiveProfileId } from '@/lib/active-profile';
interface Profile {
  id: string
  profile_name: string
  account_platform: string[]
  account_track: string[]
  fans_level: string
  target_age: string[]
  target_gender: string
  target_occupation: string[]
  content_category: string[]
  monetization_model: string[]
  equipment: string[]
  team_structure: string
  unique_selling_point: string
  /** 「绝对不能说」。是硬约束，显式声明出来，别靠下面那行索引签名蒙混过去 */
  content_restrictions?: string
  [key: string]: any
}

interface Positioning {
  id: string
  positioning_name: string
  positioning_description: string
  full_content: string
  created_at: string
  is_active: boolean
  strategy_summary?: string
}

export default function PositioningPage() {
  // 档案相关
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null)
  const [loadingProfile, setLoadingProfile] = useState(true)
  
  // 定位历史
  const [positionings, setPositionings] = useState<Positioning[]>([])
  const [selectedPositioning, setSelectedPositioning] = useState<Positioning | null>(null)
  
  // 表单字段
  const router = useRouter();
  const [additionalNotes, setAdditionalNotes] = useState("");
  
  const [isGenerating, setIsGenerating] = useState(false)
  /**
   * 生成深度。默认快速版——第一次做定位的人最需要的是"尽快看到东西"，
   * 而不是一份五分钟才出完的完整方案。
   */
  const [depth, setDepth] = useState<"quick" | "full">("quick")

  /*
   * 已经跑了多少秒。提示词一万多字、产出也上万字，Dify 还要先跑 5 个检索节点，
   * 首字返回前有很长一段静默——按钮不动，用户会以为"点击没反应"再点一次
   */
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [viewMode, setViewMode] = useState<'full' | 'summary'>('full'); // 查看模式：完整版或选题摘要

  /**
   * 这一轮预计会写哪几节，以及已经写完了哪几节。
   *
   * 流式输出时整屏字往下滚，看不出"还要多久"。把小节列出来打勾，
   * 等待就有了尽头——这是最难熬的部分。
   *
   * 最后一节可能只写了一半，所以不算"已完成"：解析出来的节里
   * 去掉末尾那个，才是真正写完的。
   */
  const expectedSections =
    depth === 'quick'
      ? SECTIONS.filter((s) => (QUICK_SECTION_KEYS as readonly string[]).includes(s.key))
      : SECTIONS;

  const doneSections = (() => {
    if (!isGenerating || !result) return [];
    const keys = Object.keys(parsePositioning(result));
    return keys.slice(0, Math.max(0, keys.length - 1));
  })();
  const [dialogConversationId, setDialogConversationId] = useState<string>();

  // 加载当前档案
  useEffect(() => {
    loadActiveProfile()
    
    // 监听档案切换事件
    const handleProfileChange = () => {
      loadActiveProfile()
    }
    window.addEventListener('profileChanged', handleProfileChange)
    return () => window.removeEventListener('profileChanged', handleProfileChange)
  }, [])

  // 当档案加载后，加载该档案的定位历史
  useEffect(() => {
    if (activeProfile) {
      loadPositionings()
    }
  }, [activeProfile])

  // 生成计时，让用户看得见进度
  useEffect(() => {
    if (!isGenerating) return
    setElapsed(0)
    const t = setInterval(() => setElapsed((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [isGenerating])

  const loadActiveProfile = async () => {
    setLoadingProfile(true)
    try {
      const activeId = getActiveProfileId()
      if (!activeId) {
        console.log('⚠️ 未找到激活的档案')
        setLoadingProfile(false)
        return
      }

      const res = await fetch('/api/profiles')
      if (res.ok) {
        const profiles = await res.json()
        const active = profiles.find((p: Profile) => p.id === activeId)
        if (active) {
          setActiveProfile(active)
        }
      }
    } catch (error) {
      console.error('❌ 加载档案失败:', error)
    } finally {
      setLoadingProfile(false)
    }
  }

  const loadPositionings = async () => {
    if (!activeProfile) return
    
    try {
      // 只列六维地基。商业定位和内容定位有各自的页面，混在这里会让人以为生成重复了
      const res = await fetch(
        `/api/positioning?profileId=${activeProfile.id}&type=${encodeURIComponent('账号定位')}`
      )
      if (res.ok) {
        const data = await res.json()
        setPositionings(data)
        console.log(`✅ 加载了 ${data.length} 个定位`)

        // 切换页面或刷新后把最近一条取回来显示。只在结果区为空时回填，
        // 生成结束后的刷新不会覆盖用户刚拿到的内容。
        const latest = data[0]?.full_content || ''
        if (latest) setResult((current) => current || latest)
      }
    } catch (error) {
      console.error('❌ 加载定位历史失败:', error)
    }
  }

  /**
   * 逐节修改要改的是哪一行。
   *
   * 选中了就用选中的；没选中（刷新页面后、或结果是恢复来的）
   * 就在列表里找内容对得上的那一行。
   * **必须内容对得上才认**——否则会把改动 PATCH 到不相干的另一份定位上，
   * 那是静默改坏数据，比不给改严重得多。
   */
  const editTarget =
    selectedPositioning ??
    (result ? positionings.find((p) => p.full_content?.trim() === result.trim()) ?? null : null)

  /**
   * 档案摘要。整份生成和单节重生成都用它，不要各拼一份；
   * 和商业定位、内容定位也是同一份（见 lib/profile-summary.ts 为什么要收成一份）
   */
  const buildProfileSummary = () => (activeProfile ? summarizeProfile(activeProfile) : '')
  const handleGenerate = async () => {
    if (!activeProfile) {
      notify("❌ 请先创建并选择一个用户档案")
      return
    }

    // 检查配额
    const remainingQuota = await checkQuota("positioning");
    if (remainingQuota !== null && remainingQuota <= 0) {
      notify("账号定位的额度已用完，请升级会员或等待下月重置");
      return;
    }

    setIsGenerating(true);
    setResult("");
    let fullResult = "";
    let conversationId = "";

    const profileSummary = buildProfileSummary();

    // 提示词在这里拼完整的。旧版只把档案丢给服务端，服务端那套只规定
    // 「输出哪些小节」、没给任何判断依据，产出自然是格式对但不专业。
    /*
     * 快速版只出核心五节。
     *
     * 完整版 15 节实测 287 秒，而线上漏斗是：100% 建了档案 →
     * 40% 做完定位 → 10% 做到创作简报。新用户第二步就对着五分钟不动的
     * 等待，走掉是必然的。剩下十节等他需要时用「补全」再要。
     */
    const query = buildPositioningPrompt({
      profileSummary,
      additionalNotes,
      platform: Array.isArray(activeProfile.account_platform)
        ? activeProfile.account_platform[0]
        : activeProfile.account_platform || undefined,
      restrictions: activeProfile.content_restrictions || undefined,
      focus: "full",
      outputSpec: depth === "quick" ? buildQuickOutputSpec() : undefined,
    });

    try {
      const response = await fetch("/api/dify/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskType: "账号定位",
          // 记忆按档案隔离：定位是"这个号该做什么"的判断，绝不能串到别的号上。
          profileId: activeProfile?.id || null,
          query,
          // 结构化字段仍然带上：知识库检索的短查询由它们拼出来
          profileInfo: profileSummary,
          // 赛道、地域进检索词：联网搜索才能搜到这个号相关的行情，不是通用文章
          ...profileSearchHints(activeProfile),
          additionalNotes: additionalNotes || "无补充说明",
        }),
      });

      // 带出服务端文案，额度类错误才不会被显示成「生成失败」
      if (!response.ok) {
        await throwApiError(response);
      }

      // 统一走 readDifyStream：原手写解析未开 stream 解码模式，中文被拆在
      // 数据块边界时会变成乱码；且缺少行缓冲，半行 JSON 会被整行丢弃。
      fullResult += await readDifyStream(response, {
        onChunk: (_piece, full) => setResult(full),
        onConversationId: (id) => { conversationId = id; },
        onRecovering: () => notify("网络断了一下，AI 那边还在写，写完会自动取回，请别关页面"),
      });

      // 保存到数据库
      if (fullResult) {
        await savePositioning(fullResult)
        
        // 保存生成历史
        await saveGenerationHistory("账号定位", { profileSummary, additionalNotes }, fullResult);

        // 增加配额使用
        // 打开持续对话，传递 conversation_id
        setDialogConversationId(conversationId || undefined);
        setShowDialog(true);
      }
    } catch (error: any) {
      console.error("❌ 生成失败:", error);
      notify(error?.message || "生成失败，请重试");
    } finally {
      setIsGenerating(false);
    }
  };

  const savePositioning = async (content: string) => {
    if (!activeProfile) return

    try {
      // 从内容中提取定位名称（第一行或前50字符）
      const firstLine = content.split('\n')[0].replace(/^#+\s*/, '').trim()
      const positioningName = firstLine.substring(0, 50) || `${activeProfile.profile_name}的账号定位`

      const res = await fetch('/api/positioning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile_id: activeProfile.id,
          // 显式写明类型。三种定位同表存放，不写就得靠列默认值兜着，
          // 哪天默认值改了这里会静默归错类
          positioning_type: '账号定位',
          positioning_name: positioningName,
          full_content: content,
          strategy_summary: extractStrategySummary(content),  // 自动生成选题摘要
          is_active: true
        })
      })

      if (res.ok) {
        const newPositioning = await res.json()
        /*
         * 把刚生成的这份设为当前选中。
         *
         * 原来只刷新了列表没设选中，结果「逐节调整」那块被条件挡住——
         * 生成完看不到修改入口，得先去左边历史里点一下才出来。
         * 逐节修改要 PATCH 到具体某一行，所以必须知道是哪一行。
         */
        setSelectedPositioning(newPositioning)
        loadPositionings()
      }
    } catch (error) {
      console.error('❌ 保存定位失败:', error)
    }
  }

  const deletePositioning = async (id: string) => {
    if (!await confirmDialog('确定要删除这个定位方案吗？', { tone: 'danger', confirmText: '删除', title: '确认删除' })) return

    try {
      const res = await fetch(`/api/positioning?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        loadPositionings()
        if (selectedPositioning?.id === id) {
          setSelectedPositioning(null)
          setResult('')
        }
      }
    } catch (error) {
      console.error('❌ 删除定位失败:', error)
    }
  }

  // 查看选题摘要
  const viewSummary = (positioning: Positioning, e: React.MouseEvent) => {
    e.stopPropagation()
    if (positioning.strategy_summary) {
      setResult(positioning.strategy_summary)
      setViewMode('summary')
    } else {
      // 如果没有strategy_summary，实时生成
      const summary = extractStrategySummary(positioning.full_content)
      setResult(summary)
      setViewMode('summary')
    }
    setSelectedPositioning(positioning)
  }

  const viewPositioning = (positioning: Positioning) => {
    setSelectedPositioning(positioning)
    setViewMode('full')  // 默认显示完整版
    setResult(positioning.full_content)
  }

  // ✅ 新增：打开历史定位的持续对话
  const openHistoryDialog = (positioning: Positioning, e: React.MouseEvent) => {
    e.stopPropagation() // 防止触发 viewPositioning
    setResult(positioning.full_content)
    setSelectedPositioning(positioning)
    setDialogConversationId(undefined) // 历史记录没有 conversationId
    setShowDialog(true)
  }

  if (loadingProfile) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-accent mx-auto mb-4" />
          <p className="text-muted-foreground">加载档案中...</p>
        </div>
      </div>
    )
  }

  if (!activeProfile) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center max-w-md bg-card rounded-2xl shadow-xl p-6 sm:p-8">
          <User className="w-20 h-20 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-foreground mb-2">还没有用户档案</h2>
          <p className="text-muted-foreground mb-6">
            账号定位需要基于您的档案信息生成。<br/>
            请先创建一个用户档案。
          </p>
          <button
            onClick={() => window.location.href = '/dashboard/profiles/new'}
            className="px-6 py-3 brand-gradient text-white rounded-xl font-medium transition-all flex items-center gap-2 mx-auto"
          >
            <Plus className="w-5 h-5" />
            创建用户档案
          </button>
        </div>
      </div>
    )
  }

  return (
    <WorkspaceLayout
      sidebar={
        <>
          <PageHeader title="账号定位" subtitle="基于账号档案，生成一份可执行的定位方案" />

          {activeProfile ? (
            <div className="glass-panel rounded-2xl p-4">
              <div className="mb-1 flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/12">
                  <User className="h-4 w-4 text-primary" />
                </span>
                <span className="truncate text-[13px] font-medium text-foreground">
                  {activeProfile.profile_name || "未命名档案"}
                </span>
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                {[activeProfile.account_platform, activeProfile.fans_level]
                  .filter(Boolean)
                  .join(" · ") || "档案信息不完整，补全后定位会更准"}
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3">
              <p className="text-[13px] font-medium text-amber-500">还没有激活的账号档案</p>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                先去「个人档案」建一个并激活，定位会基于档案信息生成
              </p>
            </div>
          )}

          <CollapsibleSection title="补充信息" defaultOpen>
            <Field label="补充说明" optional stacked hint="特殊要求、顾虑或期望，写了会一并纳入分析">
              <textarea
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
                placeholder="例如：希望突出本地属性，不想做泛流量…"
                rows={4}
                className={TEXTAREA_CLS}
              />
            </Field>
          </CollapsibleSection>

          {/*
            生成深度。默认快速版：完整版 15 节要跑 5 分钟，
            而第一次做定位的人最需要的是尽快看到东西。
            剩下十节做完之后可以用「补全」单独再要。
          */}
          <div className="mb-3">
            <div className="glass-panel grid grid-cols-2 gap-1 rounded-xl p-1">
              {([
                ["quick", "快速版", "核心 5 节 · 约 1 分半"],
                ["full", "完整版", "全部 15 节 · 约 5 分钟"],
              ] as const).map(([k, label, hint]) => (
                <button
                  key={k}
                  onClick={() => setDepth(k)}
                  disabled={isGenerating}
                  aria-pressed={depth === k}
                  className={`rounded-lg px-3 py-2 text-center transition-colors disabled:opacity-60 ${
                    depth === k ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <div className="text-[12.5px] font-medium">{label}</div>
                  <div className="mt-0.5 text-[10.5px] opacity-80">{hint}</div>
                </button>
              ))}
            </div>
            {depth === "quick" && (
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                先把人设、用户、内容这三维说透，其余十节生成完可以单独补
              </p>
            )}
          </div>

          <button
            onClick={handleGenerate}
            disabled={isGenerating || !activeProfile}
            className={GENERATE_BTN}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                生成中 {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}
              </>
            ) : (
              <>
                <Target className="h-4 w-4" />
                {depth === "quick" ? "生成定位（快速版）" : "生成完整定位"}
              </>
            )}
          </button>

          {/*
            生成过程中的进度。定位是流式输出的，但整屏字往下滚看不出
            「还要多久」——把已经写完的小节列出来，等待就有了尽头。
          */}
          {isGenerating && doneSections.length > 0 && (
            <div className="mt-3 rounded-xl border border-border bg-foreground/[0.03] p-3">
              <p className="mb-2 text-[11.5px] text-muted-foreground">
                已写完 {doneSections.length} / {expectedSections.length} 节
              </p>
              <div className="flex flex-wrap gap-1.5">
                {expectedSections.map((s) => {
                  const done = doneSections.includes(s.key);
                  return (
                    <span
                      key={s.key}
                      className={`rounded-md px-2 py-1 text-[11px] ${
                        done
                          ? "bg-primary/12 text-primary"
                          : "bg-foreground/[0.05] text-muted-foreground/60"
                      }`}
                    >
                      {done ? "✓ " : ""}
                      {s.label}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {positionings.length > 0 && (
            <CollapsibleSection title="历史定位" defaultOpen>
              <div className="space-y-1.5">
                {positionings.map((item) => {
                  const active = selectedPositioning?.id === item.id;
                  return (
                    <div
                      key={item.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => viewPositioning(item)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          viewPositioning(item);
                        }
                      }}
                      className={`group cursor-pointer rounded-xl border p-3 transition-colors ${
                        active
                          ? "border-primary/50 bg-primary/[0.08]"
                          : "border-transparent hover:border-border hover:bg-foreground/[0.04]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium text-foreground">
                            {item.positioning_name || "未命名定位"}
                          </p>
                          <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                            <span suppressHydrationWarning>
                              {formatRelativeTime(item.created_at)}
                            </span>
                            {item.is_active && (
                              <span className="rounded-full bg-emerald-500/15 px-1.5 py-px text-[10px] text-emerald-500">
                                当前激活
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                          <button
                            type="button"
                            aria-label="查看选题摘要"
                            title="查看选题摘要"
                            onClick={(e) => viewSummary(item, e)}
                            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                          >
                            <FileText className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label="删除"
                            title="删除"
                            onClick={(e) => {
                              e.stopPropagation();
                              deletePositioning(item.id);
                            }}
                            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CollapsibleSection>
          )}
        </>
      }
    >
      <ResultPanel
        result={result}
        isGenerating={isGenerating}
        title={viewMode === "summary" ? "选题摘要" : "定位方案"}
        showStats={false}
        emptyIcon={Target}
        emptyTitle="基于档案生成定位方案"
        emptyHint="AI 会分析赛道、人群、差异化与变现路径"
        emptyTips={[
          "档案填得越全，定位越贴合实际",
          "生成后可继续追问某一部分",
          "定位会被脚本与选题自动引用",
        ]}
        generatingHint="正在分析账号定位…"
        onCopy={(text) => {
          navigator.clipboard.writeText(text);
          notify("已复制到剪贴板");
        }}
        onContinue={result ? () => setShowDialog(true) : undefined}
      />

      {/*
        定位做完之后最要紧的下一步。
        线上漏斗：40% 的人做完账号定位，只有 10% 做到创作简报——
        中间这一步全靠用户自己想起来去侧边栏找。而简报正是让选题、脚本、
        分镜真正用上账号信息的那一环；不做它，生成出来的东西是通用的，
        和直接问 AI 没区别。所以把它放在定位结果的正下方，一点就走。
      */}
      {result && !isGenerating && (
        <div className="mt-4 rounded-2xl border border-primary/30 bg-primary/[0.06] p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[14px] font-medium text-foreground">
                下一步：生成创作简报
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                定位是「这个号该做什么」，简报是「每次生成时照着做什么」。
                做完这一步，选题、脚本、分镜才会真的用上你的账号信息。
              </p>
            </div>
            <button
              onClick={() => {
                putHandoff({ from: '账号定位' });
                router.push('/dashboard/creative-brief');
              }}
              className="shrink-0 rounded-xl bg-primary px-4 py-2.5 text-[13px] font-medium text-primary-foreground"
            >
              一键生成创作简报
            </button>
          </div>
        </div>
      )}

      {/*
        快速版生成完之后，把"还能补什么"说清楚。
        不说的话用户不知道这是删减版，会以为定位就这么点内容。
      */}
      {result && !isGenerating && depth === 'quick' && (
        <p className="mt-3 text-center text-[11.5px] text-muted-foreground">
          这是快速版（核心 {QUICK_SECTION_KEYS.length} 节）。
          需要变现路径、记忆点、差异化这些深化内容时，把上面切到「完整版」再生成一次。
        </p>
      )}

      {/*
        逐节调整。原来只有"整份重生成"一条路——为改一句话要等 5 分钟，
        而且其他九成对的内容也会跟着变，结果是用户不敢点重新生成。
      */}
      {result && editTarget && viewMode !== 'summary' && (
        <SectionEditor
          content={result}
          profileId={activeProfile?.id ?? null}
          profileSummary={buildProfileSummary() || undefined}
          userDirection={additionalNotes || undefined}
          onSave={async (next) => {
            const res = await fetch('/api/positioning', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: editTarget.id,
                full_content: next,
                strategy_summary: extractStrategySummary(next),
              }),
            })
            if (!res.ok) return false
            setResult(next)
            setSelectedPositioning((cur) => (cur ? { ...cur, full_content: next } : cur))
            // 简报和各板块缓存的上下文要作废，否则接着生成用的还是旧的
            invalidateCreatorContext()
            loadPositionings()
            return true
          }}
        />
      )}

      {/* 结果是从历史文本恢复来的、对不上库里任何一行时，说清楚为什么不能逐节改 */}
      {result && !editTarget && viewMode !== 'summary' && positionings.length > 0 && (
        <p className="mt-4 text-[12px] text-muted-foreground">
          这段内容和已保存的定位对不上（多半是从历史记录恢复的）。
          从左边「历史定位」里点开一份，就能逐节修改。
        </p>
      )}

      <ContinuousDialog
        isOpen={showDialog}
        onClose={() => setShowDialog(false)}
        initialContent={result}
        conversationId={dialogConversationId}
        taskType="账号定位"
      />
    </WorkspaceLayout>
  );
}