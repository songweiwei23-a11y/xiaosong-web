'use client'

import { useRouter } from 'next/navigation'
import { notify } from '@/components/ui/feedback'
import { setActiveProfileId } from '@/lib/active-profile'
import { ProfileForm, type ProfileFormData } from '@/components/profile/ProfileForm'

/**
 * 创建档案。表单本体在 ProfileForm 里，和编辑页共用同一份——
 * 两边各写一份的结果是它们会慢慢跑偏（之前编辑页就把几个数组字段
 * 声明成了字符串，一提交就会把数据覆盖掉）。
 */
export default function NewProfilePage() {
  const router = useRouter()

  const handleSubmit = async (data: ProfileFormData) => {
    try {
      const res = await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        notify('创建失败：' + (err.error || '请重试'))
        return
      }
      const created = await res.json()
      // 新建完直接设为当前档案并广播，省得用户回头还要再去侧边栏选一次
      setActiveProfileId(created.id, created)
      notify('档案创建成功，接下来可以生成账号定位了')
      router.push('/dashboard/positioning')
    } catch (e) {
      console.error('创建档案失败:', e)
      notify('创建失败，请重试')
    }
  }

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="glass-panel rounded-2xl p-8">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-foreground">创建账号档案</h1>
            <p className="mt-2 text-[13px] text-muted-foreground">
              大部分是勾选，几分钟能填完。这份档案会自动用在选题、脚本、分镜和账号定位里。
            </p>
          </div>

          <ProfileForm
            submitLabel="完成创建"
            submittingLabel="创建中…"
            onSubmit={handleSubmit}
            onCancel={() => router.push('/dashboard/profiles')}
          />
        </div>
      </div>
    </div>
  )
}
