'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { notify, confirmDialog } from '@/components/ui/feedback';

interface UserProfile {
  id: string
  profile_name: string
  account_platform: string[]
  account_track: string[]
  account_stage: string
  fans_level: string
  target_gender: string
  target_age: string[]  // 改为数组
  content_style: string[]
  monetization_model: string[]
  created_at: string
}

export default function ProfilesPage() {
  const router = useRouter()
  const [profiles, setProfiles] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchProfiles()
  }, [])

  const fetchProfiles = async () => {
    try {
      const res = await fetch('/api/profiles')
      if (res.ok) {
        const data = await res.json()
        setProfiles(data)
      } else {
        console.error('获取档案失败，状态码:', res.status)
      }
    } catch (error) {
      console.error('获取档案失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!await confirmDialog('确定要删除这个档案吗？', { tone: 'danger', confirmText: '删除', title: '确认删除' })) return

    try {
      const res = await fetch(`/api/profiles?id=${id}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        setProfiles(profiles.filter(p => p.id !== id))
      } else {
        notify('删除失败')
      }
    } catch (error) {
      console.error('删除档案失败:', error)
      notify('删除失败')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 头部 */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">用户档案管理</h1>
            <p className="mt-2 text-muted-foreground">
              创建和管理您的账号档案，让AI更懂您的需求
            </p>
          </div>
          <Link
            href="/dashboard/profiles/new"
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
          >
            + 创建新档案
          </Link>
        </div>

        {/* 档案列表 */}
        {profiles.length === 0 ? (
          <div className="bg-card rounded-lg shadow-sm p-12 text-center">
            <div className="text-muted-foreground mb-4">
              <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">还没有档案</h3>
            <p className="text-muted-foreground mb-6">创建您的第一个用户档案，让AI生成更精准的内容</p>
            <Link
              href="/dashboard/profiles/new"
              className="inline-flex items-center px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              创建第一个档案
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {profiles.map((profile) => (
              <div
                key={profile.id}
                className="bg-card rounded-lg shadow-sm hover:shadow-md transition-shadow p-6"
              >
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-semibold text-foreground">
                    {profile.profile_name}
                  </h3>
                  <div className="flex gap-2">
                    <Link
                      href={`/dashboard/profiles/${profile.id}/edit`}
                      className="text-blue-600 hover:text-blue-700"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </Link>
                    <button
                      onClick={() => handleDelete(profile.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <span className="text-sm text-muted-foreground">平台：</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {profile.account_platform?.map((platform) => (
                        <span
                          key={platform}
                          className="inline-block px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded"
                        >
                          {platform}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="text-sm text-muted-foreground">赛道：</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {profile.account_track?.map((track) => (
                        <span
                          key={track}
                          className="inline-block px-2 py-1 text-xs bg-purple-50 text-purple-700 rounded"
                        >
                          {track}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="text-sm text-muted-foreground">账号阶段：</span>
                    <span className="ml-2 text-sm text-foreground">{profile.account_stage}</span>
                  </div>

                  <div>
                    <span className="text-sm text-muted-foreground">粉丝量级：</span>
                    <span className="ml-2 text-sm text-foreground">{profile.fans_level}</span>
                  </div>

                  <div className="pt-3 border-t border-border">
                    <span className="text-xs text-muted-foreground">
                      创建于 {new Date(profile.created_at).toLocaleDateString('zh-CN')}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
