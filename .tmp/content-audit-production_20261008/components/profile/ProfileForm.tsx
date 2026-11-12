'use client'

import { createContext, useContext, useState } from 'react'
import { OptionPicker } from '@/components/form/OptionPicker'
import { OPTION_GROUPS } from '@/lib/profile-options'
import { EMPTY_PROFILE, PROFILE_CHOICES as C, splitToArray, toFormData, type ProfileFormData } from '@/lib/profile-fields'
import { ContentMixPicker } from '@/components/workspace/ContentMix'
import { readSetting, type MixSetting } from '@/lib/content-mix'
import { TabooEditor } from '@/components/profile/TabooEditor'
import { readTabooSettings, type TabooSettings } from '@/lib/taboos'
import { PERSONA_FIELDS, readPersonaFacts, hasPersonaFacts, type PersonaFacts } from '@/lib/persona-facts'

// 字段定义和选项搬到了 lib/profile-fields（前采建档也要按同一套选项填），这里转出去，老的引用照常可用
export { EMPTY_PROFILE, toFormData }
export type { ProfileFormData }

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

const SELECT_CLS =
  'w-full rounded-xl border border-border bg-background/50 px-3.5 py-2.5 text-[13px] text-foreground transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20'
const TEXTAREA_CLS = SELECT_CLS + ' placeholder:text-muted-foreground/70'

interface Props {
  /** 编辑时传入已有档案（原始库行即可，内部会做类型归一） */
  initial?: Record<string, unknown> | null
  submitLabel: string
  submittingLabel: string
  /** content_mix 不在 ProfileFormData 里（它是 jsonb，不走表单字段那套归一），单独带上 */
  onSubmit: (data: ProfileFormData & { content_mix?: MixSetting; taboo_settings?: TabooSettings; persona_facts?: PersonaFacts }) => Promise<void>
  onCancel: () => void
}

/**
 * MultiSelect / Select 原来定义在 ProfileForm 里面（2026-10-04 lint 查出）：父组件每渲染一次，它们就是新组件、整个重新挂载——
 * 在一栏「自定义添加」里打了一半的字，去点别的选项就没了。挪到外面，表单状态用 context 传进来，调用处不变。
 */
type ProfileFormCtxValue = {
  formData: ProfileFormData
  setFormData: React.Dispatch<React.SetStateAction<ProfileFormData>>
  handleChange: (field: string, value: unknown) => void
  toggleArray: (field: string, value: string) => void
}
const ProfileFormCtx = createContext<ProfileFormCtxValue | null>(null)
function useProfileFormCtx(): ProfileFormCtxValue {
  const v = useContext(ProfileFormCtx)
  if (!v) throw new Error('MultiSelect / Select 只能放在 ProfileForm 里用')
  return v
}
/**
 * 多选 + 自由添加，给 text[] 字段用。
 *
 * 原来这个控件把颜色写死成内联样式（白底、#374151 文字、浅紫渐变面板），
 * 暗色主题下整片格格不入。这里改成主题令牌。
 */
function MultiSelect({
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
}) {
  const { formData, toggleArray, setFormData } = useProfileFormCtx()
  const selected = ((formData as Record<string, unknown>)[field] || []) as string[]
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

function Select({ field, label, options }: { field: string; label: string; options: string[] }) {
  const { formData, handleChange } = useProfileFormCtx()
  return (
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
}

export function ProfileForm({ initial, submitLabel, submittingLabel, onSubmit, onCancel }: Props) {
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState<ProfileFormData>(() => toFormData(initial))
  // 内容配比：没设过就是"系统推荐"
  const [mixSetting, setMixSetting] = useState<MixSetting>(() => readSetting(initial?.content_mix) ?? { preset: 'auto' })
  const [mixTouched, setMixTouched] = useState(false)
  // 禁忌设置：关掉的行业禁忌、手动加的行业、自己补充的
  const [tabooSettings, setTabooSettings] = useState<TabooSettings>(() => readTabooSettings(initial?.taboo_settings))
  const [tabooTouched, setTabooTouched] = useState(false)
  // 人设事实卡：最硬的事实，所有板块以它为准（lib/persona-facts）
  const [personaFacts, setPersonaFacts] = useState<PersonaFacts>(() => readPersonaFacts(initial?.persona_facts))
  const [personaTouched, setPersonaTouched] = useState(false)

  const totalSteps = 6

  const handleChange = (field: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

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
      // 没动过配比、库里也没存过，就不发这一栏：数据库还没加 content_mix 列时，老表单照样能存
      const hadMix = readSetting(initial?.content_mix) !== null
      const extras: { content_mix?: MixSetting; taboo_settings?: TabooSettings; persona_facts?: PersonaFacts } = {}
      if (personaTouched || hasPersonaFacts(initial?.persona_facts)) extras.persona_facts = readPersonaFacts(personaFacts)
      if (mixTouched || hadMix) extras.content_mix = mixSetting
      if (tabooTouched || initial?.taboo_settings) {
        extras.taboo_settings = { ...tabooSettings, extra: tabooSettings.extra.map((x) => x.trim()).filter(Boolean) }
      }
      await onSubmit({ ...formData, ...extras })
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
            options={C.account_platform}
            placeholder="自定义平台，如：知乎、微博"
          />
          <MultiSelect
            field="account_track"
            label="内容赛道（可多选）"
            options={C.account_track}
            placeholder="自定义赛道，如：汽车、宠物、三农"
          />
          <Select
            field="account_stage"
            label="账号阶段"
            options={C.account_stage}
          />
          <Select field="fans_level" label="粉丝量级" options={C.fans_level} />

          {/* 人设事实卡：最硬的事实。所有板块以它为准，和别的栏、前采、旧简报冲突时按它来（lib/persona-facts） */}
          <div className="rounded-xl border border-primary/30 bg-primary/[0.04] p-4">
            <p className="text-[13px] font-medium text-foreground">🪪 人设事实卡</p>
            <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
              出镜人是谁、干了几年、从哪来、在本地多久、主卖什么。填了以后，定位、简报、选题、脚本写到这些都以这里为准，
              不会再出现&quot;写成在本地 18 年&quot;这种错；没填的 AI 不会替你编。
            </p>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
              {PERSONA_FIELDS.map((f) => (
                <label key={f.key} className={f.multiline ? 'sm:col-span-2' : ''}>
                  <span className="mb-1 block text-[12px] text-muted-foreground">{f.label}</span>
                  {f.multiline ? (
                    <textarea
                      value={personaFacts[f.key] ?? ''}
                      onChange={(e) => { setPersonaFacts((p) => ({ ...p, [f.key]: e.target.value })); setPersonaTouched(true) }}
                      placeholder={f.placeholder}
                      rows={f.key === 'others' ? 3 : 2}
                      className={TEXTAREA_CLS}
                    />
                  ) : (
                    <input
                      value={personaFacts[f.key] ?? ''}
                      onChange={(e) => { setPersonaFacts((p) => ({ ...p, [f.key]: e.target.value })); setPersonaTouched(true) }}
                      placeholder={f.placeholder}
                      className={TEXTAREA_CLS}
                    />
                  )}
                </label>
              ))}
            </div>
          </div>
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
              {C.target_gender.map((g) => (
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
          <MultiSelect field="target_age" label="年龄段（可多选）" options={C.target_age} columns={2} />
          <MultiSelect field="target_region" label="地域分布（可多选）" options={C.target_region} placeholder="自定义地域，如：江浙沪" />
          <MultiSelect field="target_occupation" label="职业标签（可多选）" options={C.target_occupation} placeholder="自定义职业" />
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
          <MultiSelect field="content_style" label="内容风格（可多选）" options={C.content_style} columns={4} />
          <MultiSelect field="content_format" label="内容形式（可多选）" options={C.content_format} columns={4} />
          <Select field="content_tone" label="语言风格" options={C.content_tone} />
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
          {/* 内容配比：选题、方向、起号、定位、简报都按它分流量 / 人设 / 变现 */}
          <div className="rounded-xl border border-border bg-foreground/[0.02] p-4">
            <label className="mb-1 block text-[13px] font-medium text-foreground">内容配比</label>
            <p className="mb-3 text-[12px] leading-relaxed text-muted-foreground">
              流量型让新人刷到你，人设型让人记住你，变现型带来咨询和订单。选「系统推荐」会按账号阶段自动定；
              设好后，选题、创作方向、起号方案、定位和创作简报都按这个比例来，各板块也能临时改。
            </p>
            <ContentMixPicker
              value={mixSetting}
              onChange={(s) => { setMixSetting(s); setMixTouched(true) }}
              profile={formData as unknown as Record<string, unknown>}
            />
          </div>
          {pick('content_value', 1)}
          {pick('unique_selling_point', 3)}
          {pick('viral_content_pattern')}
          {/* 禁忌是硬约束，漏掉可能直接产出违规文案，所以单独框出来提醒 */}
          <div className="space-y-4 rounded-xl border border-destructive/25 bg-destructive/5 p-4">
            <div>
              <p className="text-[13px] font-medium text-foreground">禁忌与红线</p>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                设好后，选题、方向、脚本等所有板块生成时都会避开——不能拍的方向在源头就不会出现；生成完还会再扫一遍，踩到了会标出来。
              </p>
            </div>
            {pick('content_restrictions', 1)}
            <TabooEditor
              value={tabooSettings}
              onChange={(s) => { setTabooSettings(s); setTabooTouched(true) }}
              profile={formData as unknown as Record<string, unknown>}
            />
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
          <Select field="team_structure" label="团队配置" options={C.team_structure} />
          <MultiSelect field="equipment" label="设备条件（可多选）" options={C.equipment} placeholder="自定义设备，如：无人机、三脚架" />
          <MultiSelect field="shooting_location" label="拍摄场地（可多选）" options={C.shooting_location} placeholder="自定义场地" />
          <Select field="editing_capability" label="后期能力" options={C.editing_capability} />
          <MultiSelect field="video_duration" label="视频时长偏好（可多选）" options={C.video_duration} />
          <Select field="budget_per_video" label="单条预算" options={C.budget_per_video} />
        </>
      ),
    },
    {
      title: '变现路径',
      body: (
        <>
          <MultiSelect field="monetization_model" label="变现方式（可多选）" options={C.monetization_model} columns={4} />
          <MultiSelect field="product_category" label="产品品类（可多选）" options={C.product_category} />
          <MultiSelect field="price_range" label="价格区间（可多选）" options={C.price_range} columns={4} />
          {pick('conversion_path', 1)}
          {pick('conversion_barriers')}
        </>
      ),
    },
  ]

  const cur = steps[currentStep - 1]

  return (
    <ProfileFormCtx.Provider value={{ formData, setFormData, handleChange, toggleArray }}>
      {/* 步骤条：点一下能直接跳过去，编辑时常常只想改某一步 */}
      {/* 连接线按宽度伸缩：原来每段定宽 40px，六步加起来 416px，手机上首尾两步被切掉 */}
      <div className="mx-auto mb-8 flex max-w-md items-center">
        {steps.map((s, i) => {
          const n = i + 1
          const done = n < currentStep
          return (
            <div key={s.title} className={`flex items-center ${n < steps.length ? 'flex-1' : ''}`}>
              <button
                type="button"
                onClick={() => setCurrentStep(n)}
                title={s.title}
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-medium transition-colors sm:h-9 sm:w-9 ${
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
                <div className={`mx-1 h-0.5 min-w-2 flex-1 ${done ? 'bg-emerald-500/80' : 'bg-foreground/[0.08]'}`} />
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
          className="rounded-xl px-3 py-2 text-[13px] text-foreground disabled:cursor-not-allowed disabled:text-muted-foreground/50 enabled:hover:bg-foreground/[0.06] sm:px-5"
        >
          上一步
        </button>

        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="glass-panel rounded-xl px-3 py-2 text-[13px] text-foreground sm:px-5"
          >
            取消
          </button>
          {currentStep < totalSteps && (
            <button
              type="button"
              onClick={() => setCurrentStep(currentStep + 1)}
              className="rounded-xl bg-foreground/[0.08] px-3 py-2 text-[13px] text-foreground hover:bg-foreground/[0.14] sm:px-5"
            >
              下一步
            </button>
          )}
          {/* 保存不必等到最后一步——编辑时常常只改一处，没必要一路点到底 */}
          <button
            type="button"
            onClick={submit}
            disabled={loading}
            className="rounded-xl bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground disabled:opacity-50 sm:px-6"
          >
            {loading ? submittingLabel : submitLabel}
          </button>
        </div>
      </div>

      <p className="mt-4 text-[12px] text-muted-foreground">
        除档案名称外都是选填。填得越全，账号定位和脚本越贴合你的实际情况——
        不填的部分 AI 只能靠赛道去猜。
      </p>
    </ProfileFormCtx.Provider>
  )
}

export default ProfileForm
