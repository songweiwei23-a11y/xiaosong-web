'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { notify } from '@/components/ui/feedback';

export default function EditProfilePage() {
  const router = useRouter()
  const params = useParams()
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [formData, setFormData] = useState({
    id: '',
    profile_name: '',
    account_platform: [] as string[],
    account_track: [] as string[],
    account_stage: '',
    fans_level: '',
    target_gender: '',
    target_age: '',
    target_region: '',
    target_occupation: '',
    target_income: '',
    target_pain_points: '',
    target_needs: '',
    target_interests: '',
    content_style: [] as string[],
    content_format: [] as string[],
    content_themes: '',
    content_tone: '',
    content_value: '',
    unique_selling_point: '',
    video_duration: '',
    update_frequency: '',
    best_post_time: '',
    reference_accounts: '',
    avoid_content: '',
    monetization_model: [] as string[],
    product_category: '',
    price_range: '',
    target_conversion: '',
    competitive_advantage: ''
  })

  useEffect(() => {
    fetchProfile()
  }, [params?.id])

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/profiles')
      if (res.ok) {
        const profiles = await res.json()
        const profile = profiles.find((p: any) => p.id === params?.id)
        if (profile) {
          setFormData({
            ...profile,
            account_platform: profile.account_platform || [],
            account_track: profile.account_track || [],
            content_style: profile.content_style || [],
            content_format: profile.content_format || [],
            monetization_model: profile.monetization_model || []
          })
        } else {
          notify('档案不存在')
          router.push('/dashboard/profiles')
        }
      }
    } catch (error) {
      console.error('获取档案失败:', error)
      notify('获取档案失败')
    } finally {
      setFetching(false)
    }
  }

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleArrayToggle = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field as keyof typeof prev].includes(value)
        ? (prev[field as keyof typeof prev] as string[]).filter((v: string) => v !== value)
        : [...(prev[field as keyof typeof prev] as string[]), value]
    }))
  }

  const handleSubmit = async () => {
    if (!formData.profile_name) {
      notify('请填写档案名称')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/profiles', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (res.ok) {
        notify('档案更新成功！')
        router.push('/dashboard/profiles')
      } else {
        notify('更新失败，请重试')
      }
    } catch (error) {
      console.error('更新档案失败:', error)
      notify('更新失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const totalSteps = 5

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center mb-8">
      {[1, 2, 3, 4, 5].map((step) => (
        <div key={step} className="flex items-center">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center font-medium ${
              step === currentStep
                ? 'bg-purple-600 text-white'
                : step < currentStep
                ? 'bg-green-500 text-white'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {step < currentStep ? '✓' : step}
          </div>
          {step < 5 && (
            <div
              className={`w-16 h-1 ${
                step < currentStep ? 'bg-green-500' : 'bg-muted'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  )

  if (fetching) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-card border border-border rounded-lg shadow-sm p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground">编辑档案</h1>
            <p className="mt-2 text-muted-foreground">更新您的账号信息</p>
          </div>

          {renderStepIndicator()}

          <div className="mb-8">
            <p className="text-muted-foreground">编辑功能正在开发中，请先删除旧档案后重新创建</p>
          </div>

          <div className="flex justify-between pt-6 border-t border-border">
            <button
              onClick={() => router.push('/dashboard/profiles')}
              className="px-6 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/70"
            >
              返回档案列表
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}


