"use client";

import { formatRelativeTime } from "@/lib/script-result-utils";
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
import { Target, Loader2, Sparkles, Lightbulb, Wand2, User, CheckCircle, History, Plus, Trash2, MessageCircle, FileText } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { extractStrategySummary } from '@/lib/positioning-utils';
import ContinuousDialog from '@/components/ContinuousDialog';
import { notify, confirmDialog } from '@/components/ui/feedback';

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
  const [additionalNotes, setAdditionalNotes] = useState("");
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [viewMode, setViewMode] = useState<'full' | 'summary'>('full'); // 查看模式：完整版或选题摘要
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

  const loadActiveProfile = async () => {
    setLoadingProfile(true)
    try {
      const activeId = localStorage.getItem('activeProfileId')
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
      const res = await fetch(`/api/positioning?profileId=${activeProfile.id}`)
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

  const handleGenerate = async () => {
    if (!activeProfile) {
      notify("❌ 请先创建并选择一个用户档案")
      return
    }

    // 检查配额
    const remainingQuota = await checkQuota();
    if (remainingQuota !== null && remainingQuota <= 0) {
      notify("❌ 您的配额已用完，请联系管理员或升级会员");
      return;
    }

    setIsGenerating(true);
    setResult("");
    let fullResult = "";
    let conversationId = "";

    // 构建基于档案的详细信息
    const profileSummary = `
我的基本信息：
- 档案名称：${activeProfile.profile_name}
- 平台：${activeProfile.account_platform?.join('、') || '未设置'}
- 赛道：${activeProfile.account_track?.join('、') || '未设置'}
- 账号阶段：${activeProfile.account_stage || '未设置'}
- 粉丝量级：${activeProfile.fans_level || '未设置'}

目标用户画像：
- 年龄段：${activeProfile.target_age?.join('、') || '未设置'}
- 性别：${activeProfile.target_gender || '未设置'}
- 职业：${activeProfile.target_occupation?.join('、') || '未设置'}
- 痛点：${activeProfile.target_pain_points || '未设置'}
- 需求：${activeProfile.target_needs || '未设置'}

内容方向：
- 内容类别：${activeProfile.content_category?.join('、') || '未设置'}
- 内容风格：${activeProfile.content_style?.join('、') || '未设置'}
- 内容形式：${activeProfile.content_format?.join('、') || '未设置'}
- 内容价值：${activeProfile.content_value || '未设置'}
- 独特卖点：${activeProfile.unique_selling_point || '未设置'}

现有资源：
- 团队配置：${activeProfile.team_structure || '未设置'}
- 设备资源：${activeProfile.equipment?.join('、') || '未设置'}
- 拍摄场地：${activeProfile.shooting_location?.join('、') || '未设置'}
- 独特资源：${activeProfile.unique_resources || '未设置'}

变现规划：
- 变现模式：${activeProfile.monetization_model?.join('、') || '未设置'}
- 产品类别：${activeProfile.product_category?.join('、') || '未设置'}
- 价格区间：${activeProfile.price_range?.join('、') || '未设置'}
- 转化路径：${activeProfile.conversion_path || '未设置'}
- 转化钩子：${activeProfile.conversion_hooks || '未设置'}

竞争分析：
- 参考账号：${activeProfile.reference_accounts || '未设置'}
- 竞争优势：${activeProfile.competitive_advantage || '未设置'}
- 竞争劣势：${activeProfile.competitive_weakness || '未设置'}
`.trim()

    try {
      const response = await fetch("/api/dify/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskType: "账号定位",
          // 记忆按档案隔离：定位是"这个号该做什么"的判断，绝不能串到别的号上。
          profileId: activeProfile?.id || null,
          profileInfo: profileSummary,
          additionalNotes: additionalNotes || "无补充说明",
        }),
      });

      if (!response.ok) {
        throw new Error("生成失败");
      }

      // 统一走 readDifyStream：原手写解析未开 stream 解码模式，中文被拆在
      // 数据块边界时会变成乱码；且缺少行缓冲，半行 JSON 会被整行丢弃。
      fullResult += await readDifyStream(response, {
        onChunk: (_piece, full) => setResult(full),
        onConversationId: (id) => { conversationId = id; },
      });

      // 保存到数据库
      if (fullResult) {
        await savePositioning(fullResult)
        
        // 保存生成历史
        await saveGenerationHistory("账号定位", { profileSummary, additionalNotes }, fullResult);

        // 增加配额使用        // 打开持续对话，传递 conversation_id
        setDialogConversationId(conversationId || undefined);
        setShowDialog(true);
      }
    } catch (error) {
      console.error("❌ 生成失败:", error);
      notify("生成失败，请重试");
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
          positioning_name: positioningName,
          full_content: content,
          strategy_summary: extractStrategySummary(content),  // 自动生成选题摘要
          is_active: true
        })
      })

      if (res.ok) {
        const newPositioning = await res.json()
        // 重新加载定位列表
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
        <div className="text-center max-w-md bg-card rounded-2xl shadow-xl p-8">
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

          <button
            onClick={handleGenerate}
            disabled={isGenerating || !activeProfile}
            className={PRIMARY_BTN}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                生成中…
              </>
            ) : (
              <>
                <Target className="h-4 w-4" />
                基于档案生成定位
              </>
            )}
          </button>

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
