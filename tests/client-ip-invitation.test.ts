import { describe, expect, it } from 'vitest';
import { clientIp } from '@/lib/client-ip';
import { generateInvitationCode, normalizeInvitationCode, INVITATION_CODE_LENGTH } from '@/lib/invitation-code';

const req = (headers: Record<string, string>) => new Request('https://example.test/', { headers });

describe('clientIp：限流用的 IP 不能被客户端伪造', () => {
  it('取 X-Forwarded-For 最右一段（代理追加的那段）', () => {
    expect(clientIp(req({ 'x-forwarded-for': '1.1.1.1, 2.2.2.2' }))).toBe('2.2.2.2');
  });

  it('左边伪造的部分不作数', () => {
    expect(clientIp(req({ 'x-forwarded-for': '6.6.6.6, 7.7.7.7, 8.8.8.8' }))).toBe('8.8.8.8');
  });

  it('没有 XFF 时用 X-Real-IP，都没有就是 unknown', () => {
    expect(clientIp(req({ 'x-real-ip': '3.3.3.3' }))).toBe('3.3.3.3');
    expect(clientIp(req({}))).toBe('unknown');
  });
});

describe('邀请码：加密随机、位数够长、不含易混字符', () => {
  it('新码是 XS + 8 位，去掉了 0/O/1/I/L', () => {
    for (let i = 0; i < 500; i++) {
      const code = generateInvitationCode();
      expect(code).toMatch(new RegExp(`^XS[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{${INVITATION_CODE_LENGTH}}$`));
    }
  });

  it('一批码几乎不重复', () => {
    const set = new Set(Array.from({ length: 2000 }, generateInvitationCode));
    expect(set.size).toBe(2000);
  });

  it('用户输入：去空格、转大写；带奇怪字符的拒绝，不让通配符进查询', () => {
    expect(normalizeInvitationCode('  xs8af30e2k ')).toBe('XS8AF30E2K');
    expect(normalizeInvitationCode('XS%')).toBeNull();
    expect(normalizeInvitationCode("XS'1")).toBeNull();
    expect(normalizeInvitationCode('ab')).toBeNull();
  });
});
