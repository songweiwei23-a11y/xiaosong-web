'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Profile {
  id: string
  profile_name: string
  account_platform: string[]
  fans_level: string
  account_track: string[]
  created_at: string
  is_active: boolean
}

export default function ProfileDashboard() {
  const router = useRouter()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchProfiles()
    loadActiveProfile()
  }, [])

  const fetchProfiles = async () => {
    try {
      const res = await fetch('/api/profiles')
      if (res.ok) {
        const data = await res.json()
        setProfiles(data)
      }
    } catch (error) {
      console.error('获取档案失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadActiveProfile = () => {
    const saved = localStorage.getItem('activeProfileId')
    if (saved) setActiveProfileId(saved)
  }

  const setActiveProfile = (id: string) => {
    setActiveProfileId(id)
    localStorage.setItem('activeProfileId', id)
  }

  const calculateCompleteness = (profile: Profile) => {
    let filled = 0
    let total = 10
    if (profile.profile_name) filled++
    if (profile.account_platform?.length) filled++
    if (profile.fans_level) filled++
    if (profile.account_track?.length) filled++
    filled += 6
    return Math.round((filled / total) * 100)
  }

  if (loading) {
    return <div className="text-gray-500">加载中...</div>
  }

  return (
    <div className="bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 rounded-2xl p-6 shadow-lg mb-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center">
            <span className="text-2xl">📋</span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">我的档案库</h2>
            <p className="text-sm text-gray-600">{profiles.length} 个档案</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => router.push('/dashboard/profiles')}
            className="px-4 py-2 bg-white text-gray-700 rounded-lg hover:bg-gray-50 border border-gray-200 text-sm font-medium"
          >
            管理全部
          </button>
          <button
            onClick={() => router.push('/dashboard/profiles/new')}
            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:shadow-lg transition-all text-sm font-medium"
          >
            + 新建档案
          </button>
        </div>
      </div>

      {profiles.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl">
          <p className="text-gray-500 mb-4">还没有档案</p>
          <button
            onClick={() => router.push('/dashboard/profiles/new')}
            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg"
          >
            创建第一个档案
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {profiles.slice(0, 4).map((profile) => {
            const isActive = profile.id === activeProfileId
            const completeness = calculateCompleteness(profile)
            
            return (
              <div
                key={profile.id}
                className={`bg-white rounded-xl p-5 cursor-pointer transition-all hover:shadow-xl ${
                  isActive ? 'ring-2 ring-purple-600 shadow-lg' : ''
                }`}
                onClick={() => setActiveProfile(profile.id)}
              >
                {isActive && (
                  <div className="flex items-center gap-1 mb-2">
                    <span className="text-xs font-bold text-purple-600">🎯 激活中</span>
                  </div>
                )}
                <h3 className="font-bold text-gray-900 mb-2 truncate">{profile.profile_name}</h3>
                <div className="text-xs text-gray-600 mb-2">📱 {profile.account_platform?.[0] || '未设置'}</div>
                <div className="text-xs text-gray-600 mb-2">👥 {profile.fans_level || '未设置'}</div>
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-600">完整度</span>
                    <span className="font-bold text-purple-600">{completeness}%</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-purple-600 to-blue-600" style={{ width: `${completeness}%` }} />
                  </div>
                </div>
                <div className="text-xs text-gray-600 mb-3">📝 生成内容: 0条</div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setActiveProfile(profile.id)
                  }}
                  className={`w-full py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {isActive ? '生成内容' : '切换激活'}
                </button>
              </div>
            )
          })}

          {profiles.length > 4 && (
            <div
              className="bg-white rounded-xl p-5 cursor-pointer hover:shadow-xl transition-all flex flex-col items-center justify-center"
              onClick={() => router.push('/dashboard/profiles')}
            >
              <div className="text-4xl mb-2">➕</div>
              <div className="text-sm font-medium text-gray-700">还有 {profiles.length - 4} 个档案</div>
              <div className="text-xs text-gray-500 mt-1">点击查看全部</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
