/**
 * 表单验证工具
 */

export interface ValidationResult {
  isValid: boolean
  errors: Record<string, string>
}

/**
 * 验证规则
 */
export interface ValidationRule {
  required?: boolean
  minLength?: number
  maxLength?: number
  pattern?: RegExp
  custom?: (value: any) => string | null
}

/**
 * 验证单个字段
 */
export function validateField(
  value: any,
  rules: ValidationRule,
  fieldName: string = '此字段'
): string | null {
  // 必填验证
  if (rules.required && (!value || value.toString().trim() === '')) {
    return `${fieldName}不能为空`
  }

  // 如果值为空且非必填，跳过其他验证
  if (!value || value.toString().trim() === '') {
    return null
  }

  const stringValue = value.toString()

  // 最小长度验证
  if (rules.minLength && stringValue.length < rules.minLength) {
    return `${fieldName}至少需要 ${rules.minLength} 个字符`
  }

  // 最大长度验证
  if (rules.maxLength && stringValue.length > rules.maxLength) {
    return `${fieldName}不能超过 ${rules.maxLength} 个字符`
  }

  // 正则表达式验证
  if (rules.pattern && !rules.pattern.test(stringValue)) {
    return `${fieldName}格式不正确`
  }

  // 自定义验证
  if (rules.custom) {
    return rules.custom(value)
  }

  return null
}

/**
 * 验证多个字段
 */
export function validateForm(
  data: Record<string, any>,
  rules: Record<string, ValidationRule>,
  fieldNames?: Record<string, string>
): ValidationResult {
  const errors: Record<string, string> = {}

  for (const [field, rule] of Object.entries(rules)) {
    const fieldName = fieldNames?.[field] || field
    const error = validateField(data[field], rule, fieldName)
    if (error) {
      errors[field] = error
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  }
}

/**
 * 常用验证规则
 */
export const commonRules = {
  // 邮箱验证
  email: {
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  },
  // 手机号验证
  phone: {
    pattern: /^1[3-9]\d{9}$/,
  },
  // 密码验证（至少6位）
  password: {
    minLength: 6,
  },
  // 强密码验证（包含数字、字母）
  strongPassword: {
    minLength: 8,
    pattern: /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]/,
  },
  // URL验证
  url: {
    pattern: /^https?:\/\/.+/,
  },
}

/**
 * 脚本生成表单验证规则
 */
export const scriptFormRules = {
  topic: {
    required: true,
    minLength: 2,
    maxLength: 100,
  },
  platform: {
    required: true,
  },
  duration: {
    required: true,
  },
}

/**
 * 选题策划表单验证规则
 */
export const topicFormRules = {
  topic: {
    required: true,
    minLength: 2,
    maxLength: 100,
  },
  accountType: {
    required: true,
  },
}

/**
 * 审稿优化表单验证规则
 */
export const reviewFormRules = {
  originalScript: {
    required: true,
    minLength: 10,
    maxLength: 5000,
  },
}

/**
 * 会员升级表单验证规则
 */
export const membershipFormRules = {
  plan: {
    required: true,
    custom: (value: string) => {
      const validPlans = ['basic', 'pro', 'enterprise']
      if (!validPlans.includes(value)) {
        return '请选择有效的会员套餐'
      }
      return null
    },
  },
}

/**
 * React Hook 表单验证
 */
export function useFormValidation<T extends Record<string, any>>(
  initialData: T,
  rules: Record<string, ValidationRule>,
  fieldNames?: Record<string, string>
) {
  const [data, setData] = React.useState<T>(initialData)
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [touched, setTouched] = React.useState<Record<string, boolean>>({})

  const validateAll = (): boolean => {
    const result = validateForm(data, rules, fieldNames)
    setErrors(result.errors)
    return result.isValid
  }

  const validateSingle = (field: keyof T) => {
    const fieldName = fieldNames?.[field as string] || (field as string)
    const error = validateField(data[field], rules[field as string], fieldName)
    setErrors(prev => ({
      ...prev,
      [field]: error || '',
    }))
  }

  const handleChange = (field: keyof T, value: any) => {
    setData(prev => ({ ...prev, [field]: value }))
    if (touched[field as string]) {
      validateSingle(field)
    }
  }

  const handleBlur = (field: keyof T) => {
    setTouched(prev => ({ ...prev, [field]: true }))
    validateSingle(field)
  }

  const reset = () => {
    setData(initialData)
    setErrors({})
    setTouched({})
  }

  return {
    data,
    errors,
    touched,
    handleChange,
    handleBlur,
    validateAll,
    reset,
  }
}

// 导入 React（用于 Hook）
import React from 'react'
