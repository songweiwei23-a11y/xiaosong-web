'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { notify } from '@/components/ui/feedback'
import { ProfileForm, type ProfileFormData } from '@/components/profile/ProfileForm'
import { getActiveProfileId, setActiveProfileId } from '@/lib/active-profile'
import { invalidateCreatorContext } from '@/hooks/useCreatorContext'
import { InterviewEntry, InterviewNotesCard } from '@/components/interview/InterviewEntry'
import { postSafely } from '@/lib/safe-post'
import { droppedColumnsNotice } from '@/lib/persona-facts'
import { PreferenceCard } from '@/components/preferences/PreferenceCard'

/**
 * 编辑已有档案。
 *
 * 这一页原来是个空壳，上面写着「编辑功能正在开发中，请先删除旧档案后重新创建」，
 * 而档案列表里就有「编辑」入口——用户点进来得到的是"请删掉重建"。
 * 现在复用 ProfileForm，和创建页是同一份表单。
 */
export default function EditProfilePage() {
  const router = useRouter()
  const params = useParams()
  const id = typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params.id[0] : ''

  const [profile, setProfile] = useState<Record<string, unknown> | null>(null)
  // 「没找到这份档案」和「接口没取到」是两回事：前者该提示已删除，
  // 后者多半是登录过期或网络问题，提示成"已被删除"会把人误导
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading')
  const [errMsg, setErrMsg] = useState('')

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await fetch('/api/profiles')
        if (!alive) return
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          setErrMsg(body?.error || (res.status === 401 ? '登录已过期，请重新登录' : `接口返回 ${res.status}`))
          setState('error')
          return
        }
        const list = await res.json()
        const found = Array.isArray(list) ? list.find((p: { id: string }) => p.id === id) : null
        if (!alive) return
        if (found) {
          setProfile(found)
          setState('ready')
        } else {
          setState('missing')
        }
      } catch (e) {
        console.error('获取档案失败:', e)
        if (!alive) return
        setErrMsg('网络不通，稍后再试')
        setState('error')
      }
    })()
    return () => {
      alive = false
    }
  }, [id])

  const handleSubmit = async (data: ProfileFormData) => {
    try {
      const res = await postSafely('/api/profiles', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        // 只发表单字段 + id。不要把整行原样回传——
        // 里面的 user_id / created_at 不该被改写
        body: JSON.stringify({ id, ...data }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        notify('保存失败：' + (err.error || '请重试'))
        return
      }
      const updated = await res.json()

      // 档案内容变了，各板块缓存的上下文要作废，否则接着生成用的还是旧的
      invalidateCreatorContext()
      // 改的正是当前在用的档案时，广播一下让各页面重新取
      if (getActiveProfileId() === id) setActiveProfileId(id, updated)
      // 改的不是当前档案时，侧边栏下拉里那一行的完整度也要跟着变
      else window.dispatchEvent(new Event('profileUpdated'))

      // 数据库还没升级时有的栏存不上：明说，不能让编导以为存上了
      const dropped = droppedColumnsNotice(updated)
      notify(dropped || '已保存')
      router.push('/dashboard/profiles')
    } catch (e) {
      console.error('更新档案失败:', e)
      notify('保存失败，请重试')
    }
  }

  if (state === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-[13px] text-muted-foreground">加载中…</p>
      </div>
    )
  }

  if (state === 'missing' || state === 'error') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <p className="text-[13px] text-muted-foreground">
          {state === 'missing' ? '没找到这份档案，可能已经被删除了。' : `档案没取到：${errMsg}`}
        </p>
        <div className="flex gap-2.5">
          {state === 'error' && (
            <button
              onClick={() => location.reload()}
              className="rounded-xl bg-primary px-5 py-2 text-[13px] text-primary-foreground"
            >
              重试
            </button>
          )}
          <button
            onClick={() => router.push('/dashboard/profiles')}
            className="glass-panel rounded-xl px-5 py-2 text-[13px] text-foreground"
          >
            返回档案列表
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="glass-panel rounded-2xl p-4 sm:p-8">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-foreground">
              编辑档案：{String(profile?.profile_name || '未命名')}
            </h1>
            <p className="mt-2 text-[13px] text-muted-foreground">
              改哪一步都行，随时可以保存，不必一路点到最后。
            </p>
          </div>

          <InterviewEntry profileId={id} />
          {profile && (
            <InterviewNotesCard
              profile={profile}
              onCleared={() => setProfile({ ...profile, interview_notes: null, interview_highlights: null })}
            />
          )}

          {/* 我的创作偏好（lib/preferences）：从修改、收藏、发布里学到的写法，看得见、改得了 */}
          <PreferenceCard profileId={id} />

          <ProfileForm
            initial={profile}
            submitLabel="保存修改"
            submittingLabel="保存中…"
            onSubmit={handleSubmit}
            onCancel={() => router.push('/dashboard/profiles')}
          />
        </div>
      </div>
    </div>
  )
}
