"use client";

import { useState, useEffect } from "react";
import { saveGenerationHistory, checkQuota } from '@/lib/history';
import { Target, Loader2, Sparkles, Lightbulb, Wand2, User, CheckCircle, History, Plus, Trash2, MessageCircle } from "lucide-react";
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
          console.log('✅ 已加载档案:', active.profile_name)
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

    console.log('📋 档案信息:', profileSummary)

    try {
      const response = await fetch("/api/dify/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskType: "账号定位",
          profileInfo: profileSummary,
          additionalNotes: additionalNotes || "无补充说明",
        }),
      });

      if (!response.ok) {
        throw new Error("生成失败");
      }

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
                // 捕获 conversation_id
                if (data.conversation_id) {
                  conversationId = data.conversation_id;
                  console.log('✅ 捕获到 Conversation ID:', conversationId);
                }
              } catch (e) {
                console.error("解析失败:", e);
              }
            }
          }
        }
      }

      // 保存到数据库
      if (fullResult) {
        await savePositioning(fullResult)
        
        // 保存生成历史
        await saveGenerationHistory("账号定位", { profileSummary, additionalNotes }, fullResult);

        // 增加配额使用        // 打开持续对话，传递 conversation_id
        console.log('🎯 打开对话框，Conversation ID:', conversationId || '无');
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
        console.log('✅ 定位已保存:', newPositioning.id)
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
        console.log('✅ 定位已删除')
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
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-muted-foreground">加载档案中...</p>
        </div>
      </div>
    )
  }

  if (!activeProfile) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center max-w-md bg-card rounded-2xl shadow-xl p-8">
          <User className="w-20 h-20 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-foreground mb-2">还没有用户档案</h2>
          <p className="text-muted-foreground mb-6">
            账号定位需要基于您的档案信息生成。<br/>
            请先创建一个用户档案。
          </p>
          <button
            onClick={() => window.location.href = '/dashboard/profiles/new'}
            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-blue-700 transition-all flex items-center gap-2 mx-auto"
          >
            <Plus className="w-5 h-5" />
            创建用户档案
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-muted">
      {/* 左侧输入区 */}
      <div className="w-[400px] border-r bg-card overflow-y-auto p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Target className="w-7 h-7 text-blue-600" />
            账号定位
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            基于档案智能生成专业定位方案
          </p>
        </div>

        {/* 当前档案卡片 */}
        <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-4 border-2 border-purple-200">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
              <User className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <div className="font-bold text-foreground">{activeProfile.profile_name}</div>
              <div className="text-xs text-muted-foreground">
                {activeProfile.account_platform?.[0]} • {activeProfile.fans_level}
              </div>
            </div>
            <CheckCircle className="w-5 h-5 text-green-600" />
          </div>
          <div className="text-xs text-muted-foreground space-y-1">
            {activeProfile.account_track && activeProfile.account_track.length > 0 && (
              <div>🎯 {activeProfile.account_track.join('、')}</div>
            )}
            {activeProfile.monetization_model && activeProfile.monetization_model.length > 0 && (
              <div>💰 {activeProfile.monetization_model.join('、')}</div>
            )}
          </div>
        </div>

        {/* 补充说明 */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            补充说明 <span className="text-xs text-muted-foreground">(选填)</span>
          </label>
          <textarea
            value={additionalNotes}
            onChange={(e) => setAdditionalNotes(e.target.value)}
            placeholder="有其他补充信息可以在这里说明，比如特殊要求、顾虑、期望等..."
            rows={4}
            className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>

        {/* 生成按钮 */}
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 rounded-xl font-bold text-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 transition-all shadow-lg flex items-center justify-center gap-2"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-6 h-6 animate-spin" />
              AI智能分析中...
            </>
          ) : (
            <>
              <Sparkles className="w-6 h-6" />
              基于档案生成定位
            </>
          )}
        </button>

        {/* 历史定位列表 */}
        {positionings.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <History className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">历史定位方案</h3>
              <span className="text-xs text-muted-foreground">({positionings.length})</span>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {positionings.map((pos) => (
                <div
                  key={pos.id}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    selectedPositioning?.id === pos.id
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-border hover:border-border bg-card'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div 
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => viewPositioning(pos)}
                    >
                      <div className="font-medium text-sm text-foreground truncate">
                        {pos.positioning_name}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {new Date(pos.created_at).toLocaleDateString('zh-CN')}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {/* ✅ 新增：继续对话按钮 */}
                      <button
                        onClick={(e) => openHistoryDialog(pos, e)}
                        className="p-1.5 text-purple-600 hover:bg-purple-100 rounded-lg transition-colors"
                        title="继续对话"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          deletePositioning(pos.id)
                        }}
                        className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {pos.is_active && (
                    <span className="inline-block mt-2 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                      当前激活
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI说明 */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-4 border-2 border-blue-200">
          <div className="flex items-start gap-2">
            <Wand2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-foreground">
              <p className="font-bold mb-1.5">AI会基于您的档案智能分析</p>
              <ul className="space-y-1 text-muted-foreground">
                <li>✅ 最适合的账号定位和人设方向</li>
                <li>✅ 差异化标签和内容策略</li>
                <li>✅ 变现路径和时间节点规划</li>
                <li>✅ 7天冷启动执行计划</li>
                <li>✅ 判断标准和优化建议</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* 右侧结果展示 */}
      <div className="flex-1 overflow-y-auto p-8">
        {result ? (
          <div className="max-w-4xl mx-auto">
            <div className="bg-card rounded-2xl shadow-xl p-8 border-2 border-blue-500/30">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                  <Target className="w-6 h-6 text-blue-600" />
                  {selectedPositioning ? selectedPositioning.positioning_name : '定位方案'}
                </h2>
                {selectedPositioning && (
                  <div className="text-xs text-muted-foreground">
                    {new Date(selectedPositioning.created_at).toLocaleString('zh-CN')}
                  </div>
                )}
              </div>
              <div className="prose prose-slate max-w-none">
                <ReactMarkdown>{result}</ReactMarkdown>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-lg">
              <div className="relative mb-6">
                <Target className="w-28 h-28 mx-auto text-muted-foreground" />
                <Sparkles className="w-12 h-12 absolute top-0 right-1/3 text-purple-400 animate-pulse" />
              </div>
              <p className="text-2xl font-bold text-foreground mb-3">
                基于档案的智能定位
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                AI会读取您的档案信息<br/>
                包括平台、赛道、目标用户、资源配置等<br/>
                智能生成最适合您的账号定位方案<br/><br/>
                <span className="text-xs text-muted-foreground">点击左侧"生成"按钮开始</span>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 持续对话 */}
      <ContinuousDialog
        isOpen={showDialog}
        onClose={() => setShowDialog(false)}
        initialContent={result}
        conversationId={dialogConversationId}
        taskType="账号定位"
        contextData={{
          profileInfo: activeProfile ? `档案：${activeProfile.profile_name}` : undefined
        }}
      />
    </div>
  );
}

