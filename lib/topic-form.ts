/**
 * 选题页「自定义」模式点生成之前的校验。
 *
 * 页面上账号阶段写着「可选」，但生成函数里没选就直接 return，只在右上角闪一句
 * 「请选择账号阶段」。表单很长，视线停在底部按钮上，看起来就是点了没反应。
 * 快速模式不走这道校验，这里 mode !== 'custom' 时直接放行。
 */

export interface CustomTopicFieldValues {
  mode: string;
  accountStage: string;
}

export interface MissingTopicField {
  /** 对应表单控件 id 的后半段：topic-field-${key} */
  key: 'accountStage';
  /** 给用户看的字段名 */
  label: string;
}

const REQUIRED_IN_CUSTOM: MissingTopicField[] = [
  { key: 'accountStage', label: '账号阶段' },
];

/**
 * 自定义模式里这四个选项，和档案表单不是同一套说法。
 *
 * 档案（lib/profile-fields 的 PROFILE_CHOICES.account_stage，前采也只收这四句）：
 *   刚起号，定位未确定 / 有定位，需要内容方向 / 稳定运营，需要新选题 / 成熟期，需要突破
 * 选题页下拉原来只有：刚起号 / 有基础 / 稳定更新 / 寻求突破
 * 测试和旧数据里还出现过「起号期」「刚起号」。
 *
 * 「有定位，需要内容方向」不是「有基础」，「成熟期，需要突破」也不是「寻求突破」。
 * 对不上就不改写成另一句。原文正好是四个选项之一就选中它；否则把档案原文加成一项并选中。
 */
export const TOPIC_ACCOUNT_STAGE_OPTIONS = ['刚起号', '有基础', '稳定更新', '寻求突破'] as const;

export function profileAccountStageText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** 下拉里要出现的选项。档案原文或当前已选值对不上四项时，原样追加，不翻译。 */
export function topicAccountStageOptions(profileStage: unknown, current = ''): string[] {
  const options: string[] = [...TOPIC_ACCOUNT_STAGE_OPTIONS];
  for (const raw of [profileAccountStageText(profileStage), profileAccountStageText(current)]) {
    if (raw && !options.includes(raw)) options.push(raw);
  }
  return options;
}

/**
 * 档案加载完之后可以预填的值。没填返回空串（页面继续要求用户选）。
 * 返回的一定是档案原文，不会猜成下拉里的另一项。
 */
export function prefillTopicAccountStage(profileStage: unknown): string {
  return profileAccountStageText(profileStage);
}

export interface TopicStagePrefillInput {
  /** 档案还在加载，或别的板块带过来的内容还没写进表单 */
  loading: boolean;
  /** 这次承接就是当前这个档案的，阶段由承接写入，这里不覆盖 */
  handoffForProfile: boolean;
  profileId: string | null;
  profileStage: unknown;
  current: string;
  /** 已经为哪个档案定过阶段；null 表示还没定过 */
  settledProfileId: string | null;
  /** 用户动过下拉框。换档案之后作废，换之前的选择不带到新档案上 */
  userEdited: boolean;
}

export interface TopicStagePrefillDecision {
  /** null：保持当前值。字符串：写成这个值（可以是空串） */
  value: string | null;
  settledProfileId: string | null;
  userEdited: boolean;
}

/** 什么时候用档案阶段填下拉框。用户已经选过的不覆盖；档案没加载完不动。 */
export function decideTopicAccountStage(input: TopicStagePrefillInput): TopicStagePrefillDecision {
  if (input.loading) {
    return { value: null, settledProfileId: input.settledProfileId, userEdited: input.userEdited };
  }
  const id = input.profileId ?? '';
  const switched = Boolean(input.settledProfileId) && input.settledProfileId !== id;
  const edited = switched ? false : input.userEdited;
  if (input.handoffForProfile && !switched) {
    return { value: null, settledProfileId: id, userEdited: edited };
  }
  if (edited) {
    return { value: null, settledProfileId: id, userEdited: true };
  }
  if (input.settledProfileId === id) {
    return { value: null, settledProfileId: id, userEdited: false };
  }
  return { value: prefillTopicAccountStage(input.profileStage), settledProfileId: id, userEdited: false };
}

/** 承接数据是不是给当前这个档案的。没有承接，或者档案号对不上，就不算。 */
export function handoffOwnsProfile(incoming: { profileId?: string | null } | null, profileId: string | null): boolean {
  if (!incoming) return false;
  return (incoming.profileId ?? null) === (profileId ?? null);
}

/** 自定义模式还缺哪些必填项。快速模式返回空数组，生成照旧开始。 */
export function missingCustomTopicFields(values: CustomTopicFieldValues): MissingTopicField[] {
  if (values.mode !== 'custom') return [];
  return REQUIRED_IN_CUSTOM.filter((field) => !values[field.key].trim());
}

/** 点名缺的是哪一项。没有缺项时返回空串。 */
export function customTopicFieldMessage(missing: Pick<MissingTopicField, 'label'>[]): string {
  if (!missing.length) return '';
  const names = missing.map((field) => field.label).join('、');
  return missing.length === 1
    ? `请先选择${names}，再生成选题`
    : `请先补全这些必填项：${names}，再生成选题`;
}
