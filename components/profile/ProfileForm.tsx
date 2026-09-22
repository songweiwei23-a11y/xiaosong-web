'use client'

import { useState } from 'react'
import { OptionPicker } from '@/components/form/OptionPicker'
import { OPTION_GROUPS } from '@/lib/profile-options'

/**
 * 账号档案表单。创建页和编辑页共用这一份。
 *
 * 【为什么要抽出来】编辑页原来是个空壳，页面上写着
 * 「编辑功能正在开发中，请先删除旧档案后重新创建」——而档案列表里就有
 * 「编辑」入口，用户点进去得到的是"请删掉重建"。
 *
 * 更麻烦的是它那份 formData 和创建页已经对不上了：target_age、
 * target_region、video_duration、price_range 这些库里是数组，
 * 编辑页声明成了字符串，一旦提交就会把数组列覆盖成空字符串。
 * 两份表单各写各的，迟早会这样。所以合并成一份。
 */

/** 字段与默认值。数组类型对应库里的 text[]，字符串对应 text */
export const EMPTY_PROFILE = {
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
}

export type ProfileFormData = typeof EMPTY_PROFILE

const splitToArray = (v: string) =>
  v.split(/[、,，]/).map((s) => s.trim()).filter(Boolean)

/**
 * 把库里的一行转成表单能用的形状。
 *
 * 必须逐字段按 EMPTY_PROFILE 的类型强制转换，不能直接 spread：
 * 库里同一个字段可能存成数组也可能存成字符串（早期手填的），
 * 类型对不上时 .includes() 会直接抛错，整个编辑页白屏。
 * 顺便也把 id / user_id / created_at 这些不该进表单的字段挡在外面。
 */
export function toFormData(row: Record<string, unknown> | null | undefined): ProfileFormData {
  const out = { ...EMPTY_PROFILE } as Record<string, unknown>
  for (const key of Object.keys(EMPTY_PROFILE)) {
    const v = row?.[key]
    const wantArray = Array.isArray((EMPTY_PROFILE as Record<string, unknown>)[key])
    if (wantArray) {
      out[key] = Array.isArray(v) ? v.filter(Boolean) : typeof v === 'string' && v.trim() ? splitToArray(v) : []
    } else {
      out[key] = Array.isArray(v) ? v.filter(Boolean).join('、') : v == null ? '' : String(v)
    }
  }
  return out as ProfileFormData
}

const SELECT_CLS =
  'w-full rounded-xl border border-border bg-background/50 px-3.5 py-2.5 text-[13px] text-foreground transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20'
const TEXTAREA_CLS = SELECT_CLS + ' placeholder:text-muted-foreground/70'

interface Props {
  /** 编辑时传入已有档案（原始库行即可，内部会做类型归一） */
  initial?: Record<string, unknown> | null
  submitLabel: string
  submittingLabel: string
  onSubmit: (data: ProfileFormData) => Promise<void>
  onCancel: () => void
}

export function ProfileForm({ initial, submitLabel, submittingLabel, onSubmit, onCancel }: Props) {
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState<ProfileFormData>(() => toFormData(initial))

  const totalSteps = 6

  const handleChange = (field: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const arr = (field: string) => ((formData as Record<string, unknown>)[field] || []) as string[]

  const toggleArray = (field: string, value: string) => {
    setFormData((prev) => {
      const cur = ((prev as Record<string, unknown>)[field] || []) as string[]
      return {
        ...prev,
        [field]: cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value],
      }
    })
  }

  const submit = async () => {
    if (!formData.profile_name.trim()) {
      setCurrentStep(1)
      return
    }
    setLoading(true)
    try {
      await onSubmit(formData)
    } finally {
      setLoading(false)
    }
  }

  /** 把一个填空题渲染成勾选题（见 lib/profile-options 的说明） */
  const pick = (field: string, columns: 1 | 2 | 3 = 2) => {
    const g = OPTION_GROUPS.find((x) => x.field === field)
    if (!g) return null
    return (
      <OptionPicker
        label={g.label}
        why={g.why}
        options={g.options}
        value={(formData as Record<string, unknown>)[field] as string}
        onChange={(v) => handleChange(field, v)}
        allowOther={g.allowOther}
        maxHint={g.maxHint}
        columns={columns}
      />
    )
  }

  /**
   * 多选 + 自由添加，给 text[] 字段用。
   *
   * 原来这个控件把颜色写死成内联样式（白底、#374151 文字、浅紫渐变面板），
   * 暗色主题下整片格格不入。这里改成主题令牌。
   */
  const MultiSelect = ({
    field,
    label,
    options,
    placeholder,
    columns = 3,
  }: {
    field: string
    label: string
    options: string[]
    placeholder?: string
    columns?: 2 | 3 | 4
  }) => {
    const selected = arr(field)
    const custom = selected.filter((v) => !options.includes(v))
    const [draft, setDraft] = useState('')

    const add = () => {
      const vals = splitToArray(draft).concat(draft.split(/\s+/).map((s) => s.trim()))
      const clean = Array.from(new Set(vals.filter(Boolean)))
      if (clean.length === 0) return
      setFormData((prev) => ({
        ...prev,
        [field]: Array.from(new Set([...(((prev as Record<string, unknown>)[field] || []) as string[]), ...clean])),
      }))
      setDraft('')
    }

    return (
      <div className="space-y-2.5">
        <label className="block text-[13px] font-medium text-foreground">{label}</label>
        <div
          className={`grid gap-1.5 ${
            columns === 4 ? 'grid-cols-4' : columns === 2 ? 'grid-cols-2' : 'grid-cols-3'
          }`}
        >
          {options.map((o) => {
            const on = selected.includes(o)
            return (
              <button
                key={o}
                type="button"
                onClick={() => toggleArray(field, o)}
                aria-pressed={on}
                className={`glass-interactive rounded-xl border px-3 py-2 text-[12.5px] font-medium ${
                  on ? 'glass-selected text-primary' : 'glass-panel text-foreground'
                }`}
              >
                {o}
              </button>
            )
          })}
        </div>

        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                add()
              }
            }}
            placeholder={placeholder || '上面没有的写在这里'}
            className={TEXTAREA_CLS + ' flex-1'}
          />
          <button
            type="button"
            onClick={add}
            className="shrink-0 rounded-xl border border-border px-4 text-[13px] text-foreground hover:bg-foreground/[0.06]"
          >
            添加
          </button>
        </div>

        {custom.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {custom.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-foreground/[0.04] px-3 py-1 text-[12px] text-foreground"
              >
                {t}
                <button
                  type="button"
                  onClick={() => toggleArray(field, t)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label={`移除 ${t}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    )
  }

  const Select = ({ field, label, options }: { field: string; label: string; options: string[] }) => (
    <div>
      <label className="mb-2 block text-[13px] font-medium text-foreground">{label}</label>
      <select
        value={(formData as Record<string, unknown>)[field] as string}
        onChange={(e) => handleChange(field, e.target.value)}
        className={SELECT_CLS}
      >
        <option value="">请选择</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  )

  const steps: Array<{ title: string; body: React.ReactNode }> = [
    {
      title: '账号基础',
      body: (
        <>
          <div>
            <label className="mb-2 block text-[13px] font-medium text-foreground">
              档案名称 <span className="text-destructive">*</span>
            </label>
            <input
              value={formData.profile_name}
              onChange={(e) => handleChange('profile_name', e.target.value)}
              placeholder="例如：言山廷潮汕牛肉自助、老张汽修"
              className={TEXTAREA_CLS}
            />
          </div>
          <MultiSelect
            field="account_platform"
            label="运营平台（可多选）"
            options={['抖音', '快手', '视频号', '小红书', 'B站']}
            placeholder="自定义平台，如：知乎、微博"
          />
          <MultiSelect
            field="account_track"
            label="内容赛道（可多选）"
            options={['美食烹饪', '时尚穿搭', '美妆护肤', '健身运动', '知识教育', '职场成长', '情感生活', '旅游探店', '家居装修', '母婴育儿', '数码科技', '本地服务']}
            placeholder="自定义赛道，如：汽车、宠物、三农"
          />
          <Select
            field="account_stage"
            label="账号阶段"
            options={['刚起号，定位未确定', '有定位，需要内容方向', '稳定运营，需要新选题', '成熟期，需要突破']}
          />
          <Select field="fans_level" label="粉丝量级" options={['0-1万', '1-5万', '5-10万', '10-50万', '50万+']} />
        </>
      ),
    },
    {
      title: '目标受众',
      body: (
        <>
          <div>
            <label className="mb-2 block text-[13px] font-medium text-foreground">主要性别</label>
            <div className="grid grid-cols-3 gap-1.5">
              {['男性为主', '女性为主', '不限'].map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => handleChange('target_gender', g)}
                  aria-pressed={formData.target_gender === g}
                  className={`glass-interactive rounded-xl border px-3 py-2 text-[12.5px] font-medium ${
                    formData.target_gender === g ? 'glass-selected text-primary' : 'glass-panel text-foreground'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
          <MultiSelect field="target_age" label="年龄段（可多选）" options={['18-24岁', '25-30岁', '31-40岁', '41岁以上']} columns={2} />
          <MultiSelect field="target_region" label="地域分布（可多选）" options={['一二线城市', '三四线城市', '全国', '本地同城']} placeholder="自定义地域，如：江浙沪" />
          <MultiSelect field="target_occupation" label="职业标签（可多选）" options={['白领', '学生', '宝妈', '自由职业', '企业主', '蓝领技工']} placeholder="自定义职业" />
          {pick('target_pain_points')}
          {pick('target_needs')}
          {pick('fan_common_questions')}
        </>
      ),
    },
    {
      title: '内容定位',
      body: (
        <>
          <MultiSelect field="content_style" label="内容风格（可多选）" options={['专业', '轻松', '幽默', '情感', '励志', '实用', '高级', '接地气']} columns={4} />
          <MultiSelect field="content_format" label="内容形式（可多选）" options={['口播', '剧情', '教程', 'Vlog', '测评', '采访', '混剪', '图文']} columns={4} />
          <Select field="content_tone" label="语言风格" options={['亲切朋友式', '专业权威式', '幽默搞笑式', '温暖治愈式', '直率犀利式']} />
          <div>
            <label className="mb-2 block text-[13px] font-medium text-foreground">主要选题方向</label>
            <textarea
              value={formData.content_themes}
              onChange={(e) => handleChange('content_themes', e.target.value)}
              placeholder="例如：平价好物推荐、后厨现切实拍"
              rows={3}
              className={TEXTAREA_CLS}
            />
          </div>
          {pick('content_value', 1)}
          {pick('unique_selling_point', 3)}
          {pick('viral_content_pattern')}
          {/* 禁忌是硬约束，漏掉可能直接产出违规文案，所以单独框出来提醒 */}
          <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-4">
            {pick('content_restrictions', 1)}
          </div>
        </>
      ),
    },
    {
      title: '竞争策略',
      body: (
        <>
          <div>
            <label className="mb-2 block text-[13px] font-medium text-foreground">对标账号</label>
            <textarea
              value={formData.reference_accounts}
              onChange={(e) => handleChange('reference_accounts', e.target.value)}
              placeholder="列出 3-5 个对标账号，说明想学他们什么"
              rows={4}
              className={TEXTAREA_CLS}
            />
          </div>
          {pick('competitive_weakness')}
          {pick('unique_resources')}
        </>
      ),
    },
    {
      title: '资源配置',
      body: (
        <>
          <Select field="team_structure" label="团队配置" options={['一人全包', '2-3人小团队', '完整团队(编导/摄影/剪辑)', '专业MCN']} />
          <MultiSelect field="equipment" label="设备条件（可多选）" options={['手机', '相机', '专业摄像机', '灯光', '收音设备', '稳定器']} placeholder="自定义设备，如：无人机、三脚架" />
          <MultiSelect field="shooting_location" label="拍摄场地（可多选）" options={['家', '工作室', '外景', '店铺', '办公室']} placeholder="自定义场地" />
          <Select field="editing_capability" label="后期能力" options={['基础剪辑', '中级特效', '专业制作']} />
          <MultiSelect field="video_duration" label="视频时长偏好（可多选）" options={['15-30秒', '30-60秒', '1-3分钟', '3-5分钟', '5分钟以上']} />
          <Select field="budget_per_video" label="单条预算" options={['0-500元', '500-2000元', '2000-5000元', '5000元以上']} />
        </>
      ),
    },
    {
      title: '变现路径',
      body: (
        <>
          <MultiSelect field="monetization_model" label="变现方式（可多选）" options={['到店消费', '带货佣金', '知识付费', '私域引流', '直播打赏', '品牌合作', '线下服务', '暂不考虑']} columns={4} />
          <MultiSelect field="product_category" label="产品品类（可多选）" options={['餐饮', '美妆护肤', '服装配饰', '生活用品', '食品饮料', '数码家电', '本地服务']} />
          <MultiSelect field="price_range" label="价格区间（可多选）" options={['50元以下', '50-200元', '200-500元', '500元以上']} columns={4} />
          {pick('conversion_path', 1)}
          {pick('conversion_barriers')}
        </>
      ),
    },
  ]

  const cur = steps[currentStep - 1]

  return (
    <>
      {/* 步骤条：点一下能直接跳过去，编辑时常常只想改某一步 */}
      <div className="mb-8 flex items-center justify-center">
        {steps.map((s, i) => {
          const n = i + 1
          const done = n < currentStep
          return (
            <div key={s.title} className="flex items-center">
              <button
                type="button"
                onClick={() => setCurrentStep(n)}
                title={s.title}
                className={`flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-medium transition-colors ${
                  n === currentStep
                    ? 'bg-primary text-primary-foreground'
                    : done
                      ? 'bg-emerald-500/80 text-white'
                      : 'bg-foreground/[0.08] text-muted-foreground hover:bg-foreground/[0.14]'
                }`}
              >
                {done ? '✓' : n}
              </button>
              {n < steps.length && (
                <div className={`h-0.5 w-10 ${done ? 'bg-emerald-500/80' : 'bg-foreground/[0.08]'}`} />
              )}
            </div>
          )
        })}
      </div>

      <div className="mb-8 space-y-6">
        <h2 className="text-xl font-semibold text-foreground">
          第{currentStep}步：{cur.title}
        </h2>
        {cur.body}
      </div>

      <div className="flex items-center justify-between border-t border-border pt-6">
        <button
          type="button"
          onClick={() => currentStep > 1 && setCurrentStep(currentStep - 1)}
          disabled={currentStep === 1}
          className="rounded-xl px-5 py-2 text-[13px] text-foreground disabled:cursor-not-allowed disabled:text-muted-foreground/50 enabled:hover:bg-foreground/[0.06]"
        >
          上一步
        </button>

        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="glass-panel rounded-xl px-5 py-2 text-[13px] text-foreground"
          >
            取消
          </button>
          {currentStep < totalSteps && (
            <button
              type="button"
              onClick={() => setCurrentStep(currentStep + 1)}
              className="rounded-xl bg-foreground/[0.08] px-5 py-2 text-[13px] text-foreground hover:bg-foreground/[0.14]"
            >
              下一步
            </button>
          )}
          {/* 保存不必等到最后一步——编辑时常常只改一处，没必要一路点到底 */}
          <button
            type="button"
            onClick={submit}
            disabled={loading}
            className="rounded-xl bg-primary px-6 py-2 text-[13px] font-medium text-primary-foreground disabled:opacity-50"
          >
            {loading ? submittingLabel : submitLabel}
          </button>
        </div>
      </div>

      <p className="mt-4 text-[12px] text-muted-foreground">
        除档案名称外都是选填。填得越全，账号定位和脚本越贴合你的实际情况——
        不填的部分 AI 只能靠赛道去猜。
      </p>
    </>
  )
}

export default ProfileForm
