// 会员管理（2026-10-23）：免费版人数要以认证系统的全部用户为准，没有订阅记录的也算免费版。
// 数据形状取自线上：15 个用户，7 条订阅记录（3 条有效免费、1 条被封禁的免费、1 条专业、2 条企业）。
import { describe, expect, it } from 'vitest';
import { buildMembers, countMembers, expiringWithin, filterMembers, type SubRow } from '@/lib/admin-subscription-view';
import type { AdminUserRow } from '@/lib/admin-users';

const NOW = Date.parse('2026-10-23T12:00:00Z');
const DAY = 86_400_000;

// 第 0 个最新注册，依次变旧
const USERS: AdminUserRow[] = Array.from({ length: 15 }, (_, i) => ({
  id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
  email: `u${i + 1}@example.com`,
  created_at: new Date(NOW - (i + 1) * DAY).toISOString(),
  last_sign_in_at: null,
  banned_until: null,
}));

const row = (i: number, plan: string, status: string, end: string | null = null): SubRow => ({
  user_id: USERS[i].id,
  plan,
  status,
  end_date: end,
});

function sample(): SubRow[] {
  return [
    row(0, 'pro', 'active', '2027-01-01T00:00:00Z'),
    row(1, 'free', 'active'),
    row(2, 'free', 'inactive'),
    row(3, 'enterprise', 'active', '2027-06-01T00:00:00Z'),
    row(4, 'free', 'active'),
    row(5, 'free', 'active'),
    row(6, 'enterprise', 'active', '2027-03-01T00:00:00Z'),
  ];
}

const base = { plan: 'all', status: 'all', expiringDays: 0, q: '' };

describe('会员管理：免费版按全部用户算', () => {
  it('15 个用户、7 条记录：免费版 12 人（含 8 个没有记录的），付费 3 人', () => {
    const subs = sample();
    const members = buildMembers(USERS, subs, NOW);
    const counts = countMembers(members, subs, NOW);
    expect(counts.all).toBe(15);
    expect(counts.free).toBe(12);
    expect(counts.pro).toBe(1);
    expect(counts.enterprise).toBe(2);
    expect(counts.basic).toBe(0);
  });

  it('免费版列表包含没有记录的用户，也包含被封禁的那条免费记录', () => {
    const members = buildMembers(USERS, sample(), NOW);
    const free = filterMembers(members, { ...base, plan: 'free', now: NOW });
    expect(free).toHaveLength(12);
    expect(free.every((m) => m.effective === 'free')).toBe(true);
    expect(free.some((m) => m.sub === null)).toBe(true);
    expect(free.some((m) => m.user.id === USERS[2].id)).toBe(true);
  });

  it('状态筛选：没有记录的按有效算，封禁的那条不在 active 里', () => {
    const members = buildMembers(USERS, sample(), NOW);
    const active = filterMembers(members, { ...base, status: 'active', now: NOW });
    expect(active).toHaveLength(14);
    expect(active.some((m) => m.user.id === USERS[2].id)).toBe(false);
  });

  it('付费记录已过期：按免费版算，不计入专业会员', () => {
    const subs = sample();
    subs[0] = row(0, 'pro', 'active', '2026-10-01T00:00:00Z');
    const counts = countMembers(buildMembers(USERS, subs, NOW), subs, NOW);
    expect(counts.pro).toBe(0);
    expect(counts.free).toBe(13);
  });

  it('7 天内到期的付费记录：计入即将到期，只有免费版和已过期的不计', () => {
    const subs = sample();
    subs[0] = row(0, 'pro', 'active', new Date(NOW + 3 * DAY).toISOString());
    expect(expiringWithin(subs[0], NOW, 7)).toBe(true);
    expect(expiringWithin(subs[1], NOW, 7)).toBe(false);
    expect(expiringWithin(subs[0], NOW, 1)).toBe(false);
    const counts = countMembers(buildMembers(USERS, subs, NOW), subs, NOW);
    expect(counts.expiringSoon).toBe(1);
    const expiring = filterMembers(buildMembers(USERS, subs, NOW), { ...base, expiringDays: 7, now: NOW });
    expect(expiring.map((m) => m.user.id)).toEqual([USERS[0].id]);
  });

  it('按注册时间从新到旧排；按邮箱搜索', () => {
    const members = buildMembers(USERS, sample(), NOW);
    const all = filterMembers(members, { ...base, now: NOW });
    expect(all[0].user.id).toBe(USERS[0].id);
    const found = filterMembers(members, { ...base, q: 'u8@', now: NOW });
    expect(found.map((m) => m.user.email)).toEqual(['u8@example.com']);
  });
});
