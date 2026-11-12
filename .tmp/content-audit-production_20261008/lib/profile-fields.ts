/**
 * 账号档案的字段定义：有哪些字段、叫什么、属于哪一步、能填什么。
 *
 * 【为什么从 ProfileForm 里搬出来】原来选项清单直接写在表单组件里。
 * 前采建档（lib/interview-import）要让 AI 按同一套选项往档案里填——
 * 两边各写一份的话，AI 填了个表单里没有的"粉丝量级：3 万"，
 * 编辑页的下拉框就显示成"请选择"，看上去像没填。
 * 所以选项只留这一份，表单和提取都从这里读。
 *
 * 也不能留在 ProfileForm 里让服务端去 import：那是 'use client' 模块，
 * 服务端拿到的是客户端引用，不是这些值。
 */
import { OPTION_GROUPS } from './profile-options';

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
export type ProfileKey = keyof ProfileFormData

export const splitToArray = (v: string) =>
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

/** 表单里多选、单选题的选项。表单和前采提取共用 */
export const PROFILE_CHOICES = {
  account_platform: ['抖音', '快手', '视频号', '小红书', 'B站'],
  account_track: ['美食烹饪', '时尚穿搭', '美妆护肤', '健身运动', '知识教育', '职场成长', '情感生活', '旅游探店', '家居装修', '母婴育儿', '数码科技', '本地服务'],
  account_stage: ['刚起号，定位未确定', '有定位，需要内容方向', '稳定运营，需要新选题', '成熟期，需要突破'],
  fans_level: ['0-1万', '1-5万', '5-10万', '10-50万', '50万+'],
  target_gender: ['男性为主', '女性为主', '不限'],
  target_age: ['18-24岁', '25-30岁', '31-40岁', '41岁以上'],
  target_region: ['一二线城市', '三四线城市', '全国', '本地同城'],
  target_occupation: ['白领', '学生', '宝妈', '自由职业', '企业主', '蓝领技工'],
  content_style: ['专业', '轻松', '幽默', '情感', '励志', '实用', '高级', '接地气'],
  content_format: ['口播', '剧情', '教程', 'Vlog', '测评', '采访', '混剪', '图文'],
  content_tone: ['亲切朋友式', '专业权威式', '幽默搞笑式', '温暖治愈式', '直率犀利式'],
  team_structure: ['一人全包', '2-3人小团队', '完整团队(编导/摄影/剪辑)', '专业MCN'],
  equipment: ['手机', '相机', '专业摄像机', '灯光', '收音设备', '稳定器'],
  shooting_location: ['家', '工作室', '外景', '店铺', '办公室'],
  editing_capability: ['基础剪辑', '中级特效', '专业制作'],
  video_duration: ['15-30秒', '30-60秒', '1-3分钟', '3-5分钟', '5分钟以上'],
  budget_per_video: ['0-500元', '500-2000元', '2000-5000元', '5000元以上'],
  monetization_model: ['到店消费', '带货佣金', '知识付费', '私域引流', '直播打赏', '品牌合作', '线下服务', '暂不考虑'],
  product_category: ['餐饮', '美妆护肤', '服装配饰', '生活用品', '食品饮料', '数码家电', '本地服务'],
  price_range: ['50元以下', '50-200元', '200-500元', '500元以上'],
} satisfies Partial<Record<ProfileKey, string[]>>

/**
 * 字段怎么填：
 *   multi  多选 + 可以自己加（库里是 text[]）
 *   single 单选，只能在选项里挑（表单是下拉框，选项外的值显示不出来）
 *   pick   勾选题 + 其他（库里是顿号分隔的 text，见 lib/profile-options）
 *   text   自由填写
 */
export type FieldKind = 'multi' | 'single' | 'pick' | 'text'

export interface ProfileFieldSpec {
  key: Exclude<ProfileKey, 'profile_name'>
  label: string
  kind: FieldKind
  options?: string[]
  /** pick 题能不能写选项以外的内容 */
  allowOther?: boolean
}

export interface ProfileSection {
  title: string
  fields: ProfileFieldSpec[]
}

const pickField = (key: ProfileFieldSpec['key']): ProfileFieldSpec => {
  const g = OPTION_GROUPS.find((x) => x.field === key)
  if (!g) throw new Error(`profile-options 里没有 ${key}`)
  return { key, label: g.label, kind: 'pick', options: g.options.map((o) => o.value), allowOther: g.allowOther !== false }
}
const multi = (key: keyof typeof PROFILE_CHOICES & ProfileFieldSpec['key'], label: string): ProfileFieldSpec =>
  ({ key, label, kind: 'multi', options: PROFILE_CHOICES[key] })
const single = (key: keyof typeof PROFILE_CHOICES & ProfileFieldSpec['key'], label: string): ProfileFieldSpec =>
  ({ key, label, kind: 'single', options: PROFILE_CHOICES[key] })
const text = (key: ProfileFieldSpec['key'], label: string): ProfileFieldSpec => ({ key, label, kind: 'text' })

/** 档案的六步，顺序和表单一致 */
export const PROFILE_SECTIONS: ProfileSection[] = [
  {
    title: '账号基础',
    fields: [
      multi('account_platform', '运营平台'),
      multi('account_track', '内容赛道'),
      single('account_stage', '账号阶段'),
      single('fans_level', '粉丝量级'),
    ],
  },
  {
    title: '目标受众',
    fields: [
      single('target_gender', '主要性别'),
      multi('target_age', '年龄段'),
      multi('target_region', '地域分布'),
      multi('target_occupation', '职业标签'),
      { key: 'target_interests', label: '目标人群的兴趣', kind: 'multi' },
      pickField('target_pain_points'),
      pickField('target_needs'),
      pickField('fan_common_questions'),
    ],
  },
  {
    title: '内容定位',
    fields: [
      multi('content_style', '内容风格'),
      multi('content_format', '内容形式'),
      single('content_tone', '语言风格'),
      text('content_themes', '主要选题方向'),
      pickField('content_value'),
      pickField('unique_selling_point'),
      pickField('viral_content_pattern'),
      pickField('content_restrictions'),
    ],
  },
  {
    title: '竞争策略',
    fields: [
      text('reference_accounts', '对标账号'),
      text('competitive_advantage', '竞争优势'),
      pickField('competitive_weakness'),
      pickField('unique_resources'),
    ],
  },
  {
    title: '资源配置',
    fields: [
      single('team_structure', '团队配置'),
      multi('equipment', '设备条件'),
      multi('shooting_location', '拍摄场地'),
      single('editing_capability', '后期能力'),
      multi('video_duration', '视频时长偏好'),
      single('budget_per_video', '单条预算'),
    ],
  },
  {
    title: '变现路径',
    fields: [
      multi('monetization_model', '变现方式'),
      multi('product_category', '产品品类'),
      multi('price_range', '价格区间'),
      pickField('conversion_path'),
      pickField('conversion_barriers'),
    ],
  },
]

export const PROFILE_FIELDS: ProfileFieldSpec[] = PROFILE_SECTIONS.flatMap((s) => s.fields)
