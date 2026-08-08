'use client'

import { useState } from 'react'
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { notify } from '@/components/ui/feedback';

export default function NewProfilePage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    profile_name: '',
    account_platform: [] as string[],
    account_track: [] as string[],
    account_stage: '',
    fans_level: '',
    target_gender: '',
    target_age: [] as string[],
    target_region: [] as string[],
    target_occupation: [] as string[],
    target_pain_points: '',
    target_needs: '',
    fan_common_questions: '',
    target_interests: [] as string[],
    content_style: [] as string[],
    content_format: [] as string[],
    content_tone: '',
    content_themes: '',
    content_value: '',
    unique_selling_point: '',
    viral_content_pattern: '',
    content_restrictions: '',
    reference_accounts: '',
    competitive_advantage: '',
    competitive_weakness: '',
    market_opportunity: '',
    unique_resources: '',
    team_structure: '',
    equipment: [] as string[],
    shooting_location: [] as string[],
    editing_capability: '',
    video_duration: [] as string[],
    budget_per_video: '',
    monetization_model: [] as string[],
    product_category: [] as string[],
    price_range: [] as string[],
    conversion_path: '',
    conversion_barriers: '',
    conversion_hooks: '',
    avoid_content: ''
  })

  const totalSteps = 6

  const MultiSelectWithCustom = ({ field, label, options, placeholder, columns = 3 }: { field: string; label: string; options: string[]; placeholder?: string; columns?: number }) => {
    const [customInput, setCustomInput] = React.useState('')
    const selectedValues = (((formData as any)[field]) || []) as string[]
    
    return (
      <div className="space-y-3">
        <label className="block text-sm font-medium text-foreground">{label}</label>
        
        <div style={{display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: '8px'}}>
          {options.map((option) => {
            const isSelected = selectedValues.includes(option)
            return (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setFormData(prev => {
                    const current = (((prev as any)[field]) || []) as string[]
                    return {
                      ...prev,
                      [field]: current.includes(option) 
                        ? current.filter(v => v !== option)
                        : [...current, option]
                    }
                  })
                }}
                style={{
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: isSelected ? '2px solid #9333ea' : '2px solid #d1d5db',
                  backgroundColor: isSelected ? '#9333ea' : 'white',
                  color: isSelected ? 'white' : '#374151',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {option}
              </button>
            )
          })}
        </div>

        <div style={{
          background: 'linear-gradient(to right, #faf5ff, #eff6ff)',
          padding: '16px',
          borderRadius: '8px',
          border: '2px dashed #c084fc'
        }}>
          <div style={{display: 'flex', gap: '8px'}}>
            <input
              type="text"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (customInput.trim()) {
                    const newVals = customInput.split(/[,，、\s]+/).map(v => v.trim()).filter(v => v)
                    setFormData(prev => ({
                      ...prev,
                      [field]: Array.from(new Set([...(((prev as any)[field]) || []) as string[], ...newVals]))
                    }))
                    setCustomInput('')
                  }
                }
              }}
              placeholder={placeholder}
              style={{
                flex: 1,
                padding: '10px 16px',
                border: '1px solid #c084fc',
                borderRadius: '8px',
                fontSize: '14px'
              }}
            />
            <button
              type="button"
              onClick={() => {
                if (customInput.trim()) {
                  const newVals = customInput.split(/[,，、\s]+/).map(v => v.trim()).filter(v => v)
                  setFormData(prev => ({
                    ...prev,
                    [field]: Array.from(new Set([...(((prev as any)[field]) || []) as string[], ...newVals]))
                  }))
                  setCustomInput('')
                }
              }}
              style={{
                padding: '10px 24px',
                background: 'linear-gradient(to right, #9333ea, #3b82f6)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              ✚ 添加
            </button>
          </div>
          <p style={{fontSize: '12px', color: '#9333ea', marginTop: '8px'}}>
            💡 可输入多个，用逗号、顿号或空格分隔
          </p>
        </div>

        {selectedValues.filter(v => !options.includes(v)).length > 0 && (
          <div style={{
            background: '#f0fdf4',
            border: '1px solid #86efac',
            borderRadius: '8px',
            padding: '12px'
          }}>
            <span style={{fontSize: '14px', fontWeight: '500', color: '#166534', display: 'block', marginBottom: '8px'}}>
              ✓ 已添加自定义：
            </span>
            <div style={{display: 'flex', flexWrap: 'wrap', gap: '8px'}}>
              {selectedValues.filter(v => !options.includes(v)).map((tag, i) => (
                <span
                  key={i}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    background: 'white',
                    border: '2px solid #86efac',
                    color: '#166534',
                    borderRadius: '9999px',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({
                        ...prev,
                        [field]: (((prev as any)[field]) || []).filter((v: string) => v !== tag)
                      }))
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '2px',
                      fontSize: '16px'
                    }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleArrayToggle = (field: string, value: string) => {
    setFormData(prev => {
      const currentArray = prev[field as keyof typeof prev] as string[]
      return {
        ...prev,
        [field]: currentArray.includes(value)
          ? currentArray.filter((v: string) => v !== value)
          : [...currentArray, value]
      }
    })
  }

  const handleSubmit = async () => {
    if (!formData.profile_name) {
      notify('请填写档案名称')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      if (res.ok) {
        const newProfile = await res.json()
        console.log('✅ 档案创建成功:', newProfile)
        
        // 设置为当前激活档案
        localStorage.setItem('activeProfileId', newProfile.id)
        
        // 触发档案更新事件
        window.dispatchEvent(new Event('profileUpdated'))
        
        // 显示成功消息
        notify('🎉 档案创建成功！\n\n即将跳转到账号定位页面，基于您的档案生成专业的账号定位方案...')
        
        // 跳转到账号定位页面
        router.push('/dashboard/positioning')
      } else {
        const error = await res.json()
        notify('创建失败：' + (error.error || '请重试'))
      }
    } catch (error) {
      console.error('❌ 创建档案失败:', error)
      notify('创建失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center mb-8">
      {[1, 2, 3, 4, 5, 6].map((step) => (
        <div key={step} className="flex items-center">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-medium text-sm ${
            step === currentStep ? 'bg-purple-600 text-white' : step < currentStep ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'
          }`}>
            {step < currentStep ? '✓' : step}
          </div>
          {step < 6 && <div className={`w-12 h-1 ${step < currentStep ? 'bg-green-500' : 'bg-muted'}`} />}
        </div>
      ))}
    </div>
  )

  const MultiSelectButton = ({ field, value, label }: { field: string; value: string; label: string }) => (
    <button
      type="button"
      onClick={() => handleArrayToggle(field, value)}
      className={`px-4 py-2 rounded-lg border-2 transition-all text-sm ${
        (formData[field as keyof typeof formData] as string[]).includes(value)
          ? 'border-purple-600 bg-purple-50 text-purple-700'
          : 'border-border hover:border-border'
      }`}
    >
      {label}
    </button>
  )

  const renderStep1 = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground mb-6">第1步：账号基础</h2>
      
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          档案名称 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.profile_name}
          onChange={(e) => handleChange('profile_name', e.target.value)}
          placeholder="例如：美食探店账号、知识分享博主"
          className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        />
      </div>

      <MultiSelectWithCustom field="account_platform" label="运营平台（可多选）" options={['抖音', '快手', '视频号', '小红书', 'B站', '其他']} placeholder="自定义平台，如：知乎、微博、西瓜视频" />

      <MultiSelectWithCustom field="account_track" label="内容赛道（可多选）" options={['美食烹饪', '时尚穿搭', '美妆护肤', '健身运动', '知识教育', '职场成长', '情感生活', '旅游探店', '家居装修', '母婴育儿', '数码科技', '其他']} placeholder="自定义赛道，如：汽车、宠物、三农、财经" />

      <div>
        <label className="block text-sm font-medium text-foreground mb-2">账号阶段</label>
        <select
          value={formData.account_stage}
          onChange={(e) => handleChange('account_stage', e.target.value)}
          className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-purple-500"
        >
          <option value="">请选择</option>
          <option value="刚起号，定位未确定">刚起号，定位未确定</option>
          <option value="有定位，需要内容方向">有定位，需要内容方向</option>
          <option value="稳定运营，需要新选题">稳定运营，需要新选题</option>
          <option value="成熟期，需要突破">成熟期，需要突破</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-2">粉丝量级</label>
        <select
          value={formData.fans_level}
          onChange={(e) => handleChange('fans_level', e.target.value)}
          className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-purple-500"
        >
          <option value="">请选择</option>
          <option value="0-1万">0-1万</option>
          <option value="1-5万">1-5万</option>
          <option value="5-10万">5-10万</option>
          <option value="10-50万">10-50万</option>
          <option value="50万+">50万+</option>
        </select>
      </div>
    </div>
  )

  const renderStep2 = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground mb-6">第2步：目标受众</h2>
      
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">主要性别</label>
        <div className="grid grid-cols-3 gap-3">
          {['男性为主', '女性为主', '不限'].map((gender) => (
            <button
              key={gender}
              type="button"
              onClick={() => handleChange('target_gender', gender)}
              className={`px-4 py-2 rounded-lg border-2 transition-all ${
                formData.target_gender === gender ? 'border-purple-600 bg-purple-50 text-purple-700' : 'border-border hover:border-border'
              }`}
            >
              {gender}
            </button>
          ))}
        </div>
      </div>

      <MultiSelectWithCustom field="target_age" label="年龄段（可多选）" options={['18-24岁', '25-30岁', '31-40岁', '41岁以上']} placeholder="自定义年龄段，如：16-18岁、50岁以上" columns={2} />

      <MultiSelectWithCustom field="target_region" label="地域分布（可多选）" options={['一二线城市', '三四线城市', '全国', '特定省份']} placeholder="自定义地域，如：北京、上海、江浙沪" />

      <MultiSelectWithCustom field="target_occupation" label="职业标签（可多选）" options={['白领', '学生', '宝妈', '自由职业', '企业主', '其他']} placeholder="自定义职业，如：医生、教师、程序员" />

      <div>
        <label className="block text-sm font-medium text-foreground mb-2">核心痛点</label>
        <textarea
          value={formData.target_pain_points}
          onChange={(e) => handleChange('target_pain_points', e.target.value)}
          placeholder="受众遇到的主要问题"
          rows={3}
          className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-purple-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-2">核心需求</label>
        <textarea
          value={formData.target_needs}
          onChange={(e) => handleChange('target_needs', e.target.value)}
          placeholder="受众想要获得什么"
          rows={3}
          className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-purple-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          粉丝常问问题 <span className="text-xs text-muted-foreground">（新增）</span>
        </label>
        <textarea
          value={formData.fan_common_questions}
          onChange={(e) => handleChange('fan_common_questions', e.target.value)}
          placeholder="粉丝在评论区经常问什么？帮助AI生成更贴近受众的内容"
          rows={3}
          className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-purple-500"
        />
      </div>

      <MultiSelectWithCustom field="target_interests" label="兴趣爱好（可多选）" options={['美食', '旅游', '健身', '阅读', '购物', '娱乐']} placeholder="自定义兴趣，如：摄影、音乐、游戏" />
    </div>
  )

  const renderStep3 = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground mb-6">第3步：内容定位</h2>
      
      <MultiSelectWithCustom field="content_style" label="内容风格（可多选）" options={['专业', '轻松', '幽默', '情感', '励志', '实用', '高级', '接地气']} placeholder="自定义风格，如：文艺、复古、潮流" columns={4} />

      <MultiSelectWithCustom field="content_format" label="内容形式（可多选）" options={['口播', '剧情', '教程', 'Vlog', '测评', '采访', '混剪', '图文']} placeholder="自定义形式，如：动画、访谈、直播" columns={4} />

      <div>
        <label className="block text-sm font-medium text-foreground mb-2">语言风格</label>
        <select
          value={formData.content_tone}
          onChange={(e) => handleChange('content_tone', e.target.value)}
          className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-purple-500"
        >
          <option value="">请选择</option>
          <option value="亲切朋友式">亲切朋友式</option>
          <option value="专业权威式">专业权威式</option>
          <option value="幽默搞笑式">幽默搞笑式</option>
          <option value="温暖治愈式">温暖治愈式</option>
          <option value="直率犀利式">直率犀利式</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-2">主要选题方向</label>
        <textarea
          value={formData.content_themes}
          onChange={(e) => handleChange('content_themes', e.target.value)}
          placeholder="例如：平价好物推荐、职场穿搭技巧"
          rows={3}
          className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-purple-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-2">核心价值主张</label>
        <textarea
          value={formData.content_value}
          onChange={(e) => handleChange('content_value', e.target.value)}
          placeholder="你能为观众提供什么独特价值？"
          rows={3}
          className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-purple-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-2">差异化卖点</label>
        <textarea
          value={formData.unique_selling_point}
          onChange={(e) => handleChange('unique_selling_point', e.target.value)}
          placeholder="你和同类账号相比有什么不同？"
          rows={3}
          className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-purple-500"
        />
      </div>

      <div className="bg-yellow-50 p-4 rounded-lg">
        <label className="block text-sm font-medium text-foreground mb-2">
          🔥 爆款基因 <span className="text-xs text-yellow-600">（核心新增）</span>
        </label>
        <textarea
          value={formData.viral_content_pattern}
          onChange={(e) => handleChange('viral_content_pattern', e.target.value)}
          placeholder="历史什么类型的内容容易爆？例如：情绪共鸣类、知识干货类、对比反转类..."
          rows={3}
          className="w-full px-4 py-2 border border-yellow-200 rounded-lg focus:ring-2 focus:ring-yellow-500"
        />
      </div>

      <div className="bg-red-50 p-4 rounded-lg">
        <label className="block text-sm font-medium text-foreground mb-2">
          ⚠️ 内容禁区 <span className="text-xs text-red-600">（核心新增）</span>
        </label>
        <textarea
          value={formData.content_restrictions}
          onChange={(e) => handleChange('content_restrictions', e.target.value)}
          placeholder="不能做什么内容？例如：不能提竞品、不能夸大效果、避免敏感话题..."
          rows={3}
          className="w-full px-4 py-2 border border-red-200 rounded-lg focus:ring-2 focus:ring-red-500"
        />
      </div>
    </div>
  )

  const renderStep4 = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground mb-6">第4步：竞争策略</h2>
      
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">对标账号</label>
        <textarea
          value={formData.reference_accounts}
          onChange={(e) => handleChange('reference_accounts', e.target.value)}
          placeholder="列出3-5个对标账号，说明学习点"
          rows={4}
          className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-purple-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-2">竞争优势</label>
        <textarea
          value={formData.competitive_advantage}
          onChange={(e) => handleChange('competitive_advantage', e.target.value)}
          placeholder="你的核心竞争优势是什么？"
          rows={3}
          className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-purple-500"
        />
      </div>

      <div className="bg-blue-50 p-4 rounded-lg">
        <label className="block text-sm font-medium text-foreground mb-2">
          竞争劣势 <span className="text-xs text-blue-600">（新增）</span>
        </label>
        <textarea
          value={formData.competitive_weakness}
          onChange={(e) => handleChange('competitive_weakness', e.target.value)}
          placeholder="坦诚面对不足，AI才能帮你规避风险"
          rows={3}
          className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="bg-green-50 p-4 rounded-lg">
        <label className="block text-sm font-medium text-foreground mb-2">
          蓝海机会 <span className="text-xs text-green-600">（新增）</span>
        </label>
        <textarea
          value={formData.market_opportunity}
          onChange={(e) => handleChange('market_opportunity', e.target.value)}
          placeholder="市场上还有哪些空白机会点？"
          rows={3}
          className="w-full px-4 py-2 border border-green-200 rounded-lg focus:ring-2 focus:ring-green-500"
        />
      </div>

      <div className="bg-purple-50 p-4 rounded-lg">
        <label className="block text-sm font-medium text-foreground mb-2">
          独家资源 <span className="text-xs text-purple-600">（核心新增）</span>
        </label>
        <textarea
          value={formData.unique_resources}
          onChange={(e) => handleChange('unique_resources', e.target.value)}
          placeholder="你有哪些独特资源？供应链、人脉、场地、技术、数据等"
          rows={3}
          className="w-full px-4 py-2 border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500"
        />
      </div>
    </div>
  )

  const renderStep5 = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground mb-6">第5步：资源配置</h2>
      
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          团队配置 <span className="text-xs text-muted-foreground">（新增）</span>
        </label>
        <select
          value={formData.team_structure}
          onChange={(e) => handleChange('team_structure', e.target.value)}
          className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-purple-500"
        >
          <option value="">请选择</option>
          <option value="一人全包">一人全包</option>
          <option value="2-3人小团队">2-3人小团队</option>
          <option value="完整团队(编导/摄影/剪辑)">完整团队(编导/摄影/剪辑)</option>
          <option value="专业MCN">专业MCN</option>
        </select>
      </div>

      <MultiSelectWithCustom field="equipment" label="设备条件（可多选）" options={['手机', '相机', '专业摄像机', '灯光', '收音设备', '稳定器']} placeholder="自定义设备，如：无人机、三脚架、绿幕" />

      <MultiSelectWithCustom field="shooting_location" label="拍摄场地（可多选）" options={['家', '工作室', '外景', '店铺', '办公室', '其他']} placeholder="自定义场地，如：摄影棚、咖啡厅、景区" />

      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          后期能力 <span className="text-xs text-muted-foreground">（新增）</span>
        </label>
        <select
          value={formData.editing_capability}
          onChange={(e) => handleChange('editing_capability', e.target.value)}
          className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-purple-500"
        >
          <option value="">请选择</option>
          <option value="基础剪辑">基础剪辑</option>
          <option value="中级特效">中级特效</option>
          <option value="专业制作">专业制作</option>
        </select>
      </div>

      <MultiSelectWithCustom field="video_duration" label="视频时长偏好（可多选）" options={['15-30秒', '30-60秒', '1-3分钟', '3-5分钟', '5分钟以上']} placeholder="自定义时长，如：10-15秒、7-10分钟" />

      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          单条预算 <span className="text-xs text-muted-foreground">（新增）</span>
        </label>
        <select
          value={formData.budget_per_video}
          onChange={(e) => handleChange('budget_per_video', e.target.value)}
          className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-purple-500"
        >
          <option value="">请选择</option>
          <option value="0-500元">0-500元</option>
          <option value="500-2000元">500-2000元</option>
          <option value="2000-5000元">2000-5000元</option>
          <option value="5000元以上">5000元以上</option>
        </select>
      </div>
    </div>
  )

  const renderStep6 = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground mb-6">第6步：变现路径</h2>
      
      <MultiSelectWithCustom field="monetization_model" label="变现方式（可多选）" options={['广告变现', '带货佣金', '知识付费', '私域引流', '直播打赏', '品牌合作', '线下服务', '暂不考虑']} placeholder="自定义变现方式，如：会员订阅、培训课程" columns={4} />

      <MultiSelectWithCustom field="product_category" label="产品品类（可多选）" options={['美妆护肤', '服装配饰', '生活用品', '食品饮料', '数码家电', '其他']} placeholder="自定义品类，如：图书、家具、汽车用品" />

      <MultiSelectWithCustom field="price_range" label="价格区间（可多选）" options={['50元以下', '50-200元', '200-500元', '500元以上']} placeholder="自定义价格区间，如：100-300元、1000元以上" columns={4} />

      <div className="bg-green-50 p-4 rounded-lg">
        <label className="block text-sm font-medium text-foreground mb-2">
          完整转化路径 <span className="text-xs text-green-600">（核心新增）</span>
        </label>
        <textarea
          value={formData.conversion_path}
          onChange={(e) => handleChange('conversion_path', e.target.value)}
          placeholder="从观看到成交的每一步是什么？例如：看视频→点链接→进直播间→下单"
          rows={3}
          className="w-full px-4 py-2 border border-green-200 rounded-lg focus:ring-2 focus:ring-green-500"
        />
      </div>

      <div className="bg-red-50 p-4 rounded-lg">
        <label className="block text-sm font-medium text-foreground mb-2">
          成交障碍点 <span className="text-xs text-red-600">（核心新增）</span>
        </label>
        <textarea
          value={formData.conversion_barriers}
          onChange={(e) => handleChange('conversion_barriers', e.target.value)}
          placeholder="用户为什么不买？价格、信任、需求不明确？"
          rows={3}
          className="w-full px-4 py-2 border border-red-200 rounded-lg focus:ring-2 focus:ring-red-500"
        />
      </div>

      <div className="bg-yellow-50 p-4 rounded-lg">
        <label className="block text-sm font-medium text-foreground mb-2">
          转化话术/钩子 <span className="text-xs text-yellow-600">（核心新增）</span>
        </label>
        <textarea
          value={formData.conversion_hooks}
          onChange={(e) => handleChange('conversion_hooks', e.target.value)}
          placeholder="什么话术最能促成转化？限时优惠、客户见证、独家福利？"
          rows={3}
          className="w-full px-4 py-2 border border-yellow-200 rounded-lg focus:ring-2 focus:ring-yellow-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-2">禁忌内容</label>
        <textarea
          value={formData.avoid_content}
          onChange={(e) => handleChange('avoid_content', e.target.value)}
          placeholder="不想做或不适合做的内容类型"
          rows={3}
          className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-purple-500"
        />
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-muted py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-card rounded-lg shadow-sm p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground">创建用户档案（专业版）</h1>
            <p className="mt-2 text-muted-foreground">
              详细填写账号信息，让AI生成更专业的内容
            </p>
            <p className="mt-1 text-sm text-purple-600">
              ✨ 包含45个专业字段，13个多选项，适合专业编导/MCN
            </p>
          </div>

          {renderStepIndicator()}

          <div className="mb-8">
            {currentStep === 1 && renderStep1()}
            {currentStep === 2 && renderStep2()}
            {currentStep === 3 && renderStep3()}
            {currentStep === 4 && renderStep4()}
            {currentStep === 5 && renderStep5()}
            {currentStep === 6 && renderStep6()}
          </div>

          <div className="flex justify-between pt-6 border-t border-border">
            <button
              onClick={() => currentStep > 1 && setCurrentStep(currentStep - 1)}
              disabled={currentStep === 1}
              className={`px-6 py-2 rounded-lg ${
                currentStep === 1
                  ? 'bg-muted text-muted-foreground cursor-not-allowed'
                  : 'bg-muted text-foreground hover:bg-muted'
              }`}
            >
              上一步
            </button>

            <div className="flex gap-3">
              <button
                onClick={() => router.push('/dashboard/profiles')}
                className="px-6 py-2 border-2 border-border text-foreground rounded-lg hover:bg-muted"
              >
                取消
              </button>

              {currentStep < totalSteps ? (
                <button
                  onClick={() => setCurrentStep(currentStep + 1)}
                  className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  下一步
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="px-8 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? '创建中...' : '✓ 完成创建'}
                </button>
              )}
            </div>
          </div>

          {currentStep === totalSteps && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg text-sm text-blue-700">
              💡 提示：所有字段都是选填的，可以先创建后续再完善
            </div>
          )}
        </div>
      </div>
    </div>
  )
}









