import { describe, it, expect } from 'vitest';
import {
  validateField,
  validateForm,
  commonRules,
  scriptFormRules,
  membershipFormRules,
} from '@/lib/validation';

describe('validateField', () => {
  it('returns error when a required field is empty', () => {
    expect(validateField('', { required: true }, '主题')).toBe('主题不能为空');
    expect(validateField('   ', { required: true }, '主题')).toBe('主题不能为空');
    expect(validateField(null, { required: true }, '主题')).toBe('主题不能为空');
  });

  it('skips other rules when value is empty and not required', () => {
    expect(validateField('', { minLength: 5 })).toBeNull();
  });

  it('enforces minLength and maxLength', () => {
    expect(validateField('a', { minLength: 2 }, '标题')).toBe('标题至少需要 2 个字符');
    expect(validateField('abcdef', { maxLength: 3 }, '标题')).toBe('标题不能超过 3 个字符');
    expect(validateField('ab', { minLength: 2, maxLength: 3 })).toBeNull();
  });

  it('validates against a regex pattern', () => {
    expect(validateField('not-an-email', commonRules.email, '邮箱')).toBe('邮箱格式不正确');
    expect(validateField('user@example.com', commonRules.email)).toBeNull();
  });

  it('runs custom validators', () => {
    const rule = { custom: (v: string) => (v === 'ok' ? null : '无效') };
    expect(validateField('bad', rule)).toBe('无效');
    expect(validateField('ok', rule)).toBeNull();
  });

  it('validates Chinese phone numbers via commonRules.phone', () => {
    expect(validateField('13800138000', commonRules.phone)).toBeNull();
    expect(validateField('12345', commonRules.phone, '手机号')).toBe('手机号格式不正确');
  });
});

describe('validateForm', () => {
  it('aggregates errors and reports validity', () => {
    const result = validateForm(
      { topic: '', platform: '', duration: '60' },
      scriptFormRules,
      { topic: '主题', platform: '平台', duration: '时长' }
    );
    expect(result.isValid).toBe(false);
    expect(result.errors.topic).toBe('主题不能为空');
    expect(result.errors.platform).toBe('平台不能为空');
    expect(result.errors.duration).toBeUndefined();
  });

  it('passes when all fields satisfy the rules', () => {
    const result = validateForm(
      { topic: '春季穿搭', platform: '抖音', duration: '60' },
      scriptFormRules
    );
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it('applies custom membership plan validation', () => {
    expect(validateForm({ plan: 'gold' }, membershipFormRules).errors.plan).toBe(
      '请选择有效的会员套餐'
    );
    expect(validateForm({ plan: 'pro' }, membershipFormRules).isValid).toBe(true);
  });
});
