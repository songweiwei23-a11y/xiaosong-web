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
