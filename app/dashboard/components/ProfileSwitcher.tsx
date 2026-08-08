'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, User, RefreshCw, Plus, Settings } from 'lucide-react'

interface Profile {
  id: string
  profile_name: string
  account_platform: string[]
  fans_level: string
  content_category: string[]
  target_audience: string[]
}

export default function ProfileSwitcher() {
  const router = useRouter()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchProfiles()
    
    // 监听档案更新事件
    const handleProfileUpdate = () => {
      fetchProfiles()
    }
    
    window.addEventListener('profileUpdated', handleProfileUpdate)
    return () => window.removeEventListener('profileUpdated', handleProfileUpdate)
  }, [])

  const fetchProfiles = async () => {
    try {
      const res = await fetch('/api/profiles')
      if (res.ok) {
        const data = await res.json()
        setProfiles(data)
        
        // 加载激活的档案
        const savedId = localStorage.getItem('activeProfileId')
        if (savedId) {
          const active = data.find((p: Profile) => p.id === savedId)
          if (active) {
            setActiveProfile(active)
          } else if (data.length > 0) {
            // 如果保存的档案不存在，激活第一个
            setActiveProfile(data[0])
            localStorage.setItem('activeProfileId', data[0].id)
          }
        } else if (data.length > 0) {
          // 默认激活第一个
          setActiveProfile(data[0])
          localStorage.setItem('activeProfileId', data[0].id)
        }
      }
    } catch (error) {
      console.error('❌ 获取档案失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const switchProfile = (profile: Profile) => {
    setActiveProfile(profile)
    localStorage.setItem('activeProfileId', profile.id)
    setIsOpen(false)
    
    // 触发全局事件，通知其他组件档案已切换
    window.dispatchEvent(new CustomEvent('profileChanged', { detail: profile }))
    
    console.log('✅ 已切换档案:', profile.profile_name)
  }

  const calculateCompleteness = (profile: Profile) => {
    const fields = [
      profile.profile_name,
      profile.account_platform?.length,
      profile.fans_level,
      profile.content_category?.length,
      profile.target_audience?.length,
    ]
    
    const filledCount = fields.filter(f => f && (Array.isArray(f) ? f.length > 0 : true)).length
    return Math.round((filledCount / fields.length) * 100)
  }

  if (loading) {
    return (
      <div className="px-3 py-3">
        <div className="animate-pulse bg-muted rounded-lg p-3">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-muted-foreground animate-spin" />
            <div className="text-xs text-muted-foreground">加载档案中...</div>
          </div>
        </div>
      </div>
    )
  }

  if (!activeProfile || profiles.length === 0) {
    return (
      <div className="px-3 py-3">
        <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/40 dark:to-blue-950/40 rounded-lg p-3 border border-purple-100 dark:border-purple-900/50">
          <div className="text-xs text-muted-foreground mb-2">
            📋 还没有档案
          </div>
          <button
            onClick={() => router.push('/dashboard/profiles/new')}
            className="w-full px-3 py-2 text-sm bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all flex items-center justify-center gap-2 font-medium shadow-sm"
          >
            <Plus className="w-4 h-4" />
            创建第一个档案
          </button>
        </div>
      </div>
    )
  }

  const completeness = calculateCompleteness(activeProfile)

  return (
    <div className="px-3 py-3">
      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
        当前工作档案
      </div>

      {/* 当前激活的档案卡片 */}
      <div className="bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 dark:from-purple-950/40 dark:via-blue-950/40 dark:to-pink-950/30 rounded-lg p-3 border border-purple-100 dark:border-purple-900/50 shadow-sm">
        <div className="flex items-start gap-2 mb-2">
          <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center shadow-sm">
            <User className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm text-foreground truncate">
              {activeProfile.profile_name}
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              {activeProfile.account_platform?.[0] && (
                <span className="bg-white/60 dark:bg-white/10 px-1.5 py-0.5 rounded text-[10px]">
                  {activeProfile.account_platform[0]}
                </span>
              )}
              {activeProfile.fans_level && (
                <span className="text-[10px]">• {activeProfile.fans_level}</span>
              )}
            </div>
          </div>
        </div>

        {/* 完整度进度条 */}
        <div className="mb-2">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-muted-foreground text-[10px]">档案完整度</span>
            <span className={`font-bold text-xs ${
              completeness >= 80 ? 'text-green-600' :
              completeness >= 50 ? 'text-yellow-600' :
              'text-red-600'
            }`}>
              {completeness}%
            </span>
          </div>
          <div className="h-1.5 bg-white/50 dark:bg-white/10 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-700 ${
                completeness >= 80 ? 'bg-gradient-to-r from-green-500 to-emerald-500' :
                completeness >= 50 ? 'bg-gradient-to-r from-yellow-500 to-orange-500' :
                'bg-gradient-to-r from-red-500 to-pink-500'
              }`}
              style={{ width: `${completeness}%` }}
            />
          </div>
        </div>

        {/* 档案信息标签 */}
        {activeProfile.content_category && activeProfile.content_category.length > 0 && (
          <div className="text-[10px] text-muted-foreground bg-white/40 dark:bg-white/5 px-2 py-1 rounded">
            🎬 {activeProfile.content_category.slice(0, 2).join('、')}
            {activeProfile.content_category.length > 2 && '...'}
          </div>
        )}
      </div>

      {/* 切换按钮 */}
      <div className="relative mt-2">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-3 py-2 bg-card border border-border rounded-lg hover:bg-muted hover:border-border transition-all flex items-center justify-between text-sm group"
        >
          <span className="text-foreground font-medium flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5 text-muted-foreground group-hover:rotate-180 transition-transform duration-500" />
            切换档案
          </span>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className="bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 px-1.5 py-0.5 rounded font-medium">
              {profiles.length}
            </span>
            <ChevronDown
              className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            />
          </div>
        </button>

        {/* 下拉菜单 */}
        {isOpen && (
          <>
            {/* 遮罩层 */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            
            <div className="absolute bottom-full left-0 right-0 mb-2 bg-card border border-border rounded-lg shadow-xl max-h-80 overflow-y-auto z-50">
              {/* 档案列表 */}
              <div className="p-2 max-h-60 overflow-y-auto">
                <div className="text-xs font-semibold text-muted-foreground px-2 py-1 mb-1">
                  选择工作档案
                </div>
                {profiles.map((profile) => {
                  const isActive = profile.id === activeProfile.id
                  const completion = calculateCompleteness(profile)
                  
                  return (
                    <button
                      key={profile.id}
                      onClick={() => switchProfile(profile)}
                      className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all mb-1 ${
                        isActive
                          ? 'bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/40 dark:to-blue-950/40 border border-purple-200 dark:border-purple-900/50 shadow-sm'
                          : 'hover:bg-muted border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {isActive && <span className="text-base">🎯</span>}
                        <div className="flex-1 min-w-0">
                          <div className={`font-medium truncate ${
                            isActive ? 'text-purple-700 dark:text-purple-400' : 'text-foreground'
                          }`}>
                            {profile.profile_name}
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                            <span>{profile.account_platform?.[0] || '未设置'}</span>
                            <span>•</span>
                            <span className={`font-medium ${
                              completion >= 80 ? 'text-green-600' :
                              completion >= 50 ? 'text-yellow-600' :
                              'text-red-600'
                            }`}>
                              {completion}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
              
              {/* 底部操作按钮 */}
              <div className="border-t border-border p-2 bg-muted/50">
                <button
                  onClick={() => {
                    setIsOpen(false)
                    router.push('/dashboard/profiles')
                  }}
                  className="w-full px-3 py-2 text-sm text-foreground hover:bg-card rounded-lg text-left flex items-center gap-2 transition-colors mb-1"
                >
                  <Settings className="w-4 h-4" />
                  管理所有档案
                </button>
                <button
                  onClick={() => {
                    setIsOpen(false)
                    router.push('/dashboard/profiles/new')
                  }}
                  className="w-full px-3 py-2 text-sm bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 rounded-lg text-left font-medium flex items-center gap-2 transition-all shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  创建新档案
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
