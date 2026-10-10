import { describe, expect, it } from 'vitest';
import { extendEndDate } from '@/lib/admin-membership';
import { isUsableQrcodeUrl } from '@/lib/payment-qrcode';
import { dayWindows, startOfBeijingDay, sumAmounts } from '@/lib/admin-overview';
import { toCsv } from '@/lib/csv';

const NOW = Date.parse('2026-10-10T04:00:00Z');

describe('会员延期', () => {
  it('还没到期：从原到期日往后加', () => {
    const r = extendEndDate('2026-11-01T00:00:00Z', 30, NOW);
    expect('endDate' in r && r.endDate).toBe(new Date(Date.parse('2026-11-01T00:00:00Z') + 30 * 86400_000).toISOString());
  });

  it('已经到期：从现在起加，不往过去的日期上加', () => {
    const r = extendEndDate('2026-09-01T00:00:00Z', 7, NOW);
    expect('endDate' in r && r.endDate).toBe(new Date(NOW + 7 * 86400_000).toISOString());
  });

  it('永久会员不能延期，要先改成具体日期', () => {
    expect(extendEndDate(null, 30, NOW)).toEqual({ error: expect.stringContaining('永久') });
  });

  it('天数必须是 1 到 3650 之间的整数', () => {
    expect(extendEndDate('2026-11-01T00:00:00Z', 0, NOW)).toHaveProperty('error');
    expect(extendEndDate('2026-11-01T00:00:00Z', 3651, NOW)).toHaveProperty('error');
    expect(extendEndDate('2026-11-01T00:00:00Z', 1.5, NOW)).toHaveProperty('error');
  });
});

describe('收款码能不能给用户扫', () => {
  it('https 的真实地址可以用', () => {
    expect(isUsableQrcodeUrl('https://nxxbzdstmtuyplcwrrhs.supabase.co/storage/v1/object/public/payment-qrcodes/a.png')).toBe(true);
  });

  it('占位图、非 https、空地址一律不能用', () => {
    expect(isUsableQrcodeUrl('https://example.com/placeholder-qr.png')).toBe(false);
    expect(isUsableQrcodeUrl('https://example.com/PLACEHOLDER.png')).toBe(false);
    expect(isUsableQrcodeUrl('http://example.com/qr.png')).toBe(false);
    expect(isUsableQrcodeUrl('')).toBe(false);
    expect(isUsableQrcodeUrl(null)).toBe(false);
  });
});

describe('管理概览的日期与汇总', () => {
  it('北京时间的午夜：UTC 16:00 是北京时间的 0 点', () => {
    // 2026-10-10 16:30 UTC = 2026-10-11 00:30 北京时间，今天从 2026-10-10 16:00 UTC 开始
    expect(new Date(startOfBeijingDay(Date.parse('2026-10-10T16:30:00Z'))).toISOString()).toBe('2026-10-10T16:00:00.000Z');
  });

  it('近 7 天：从旧到新，首尾相接，标签是北京时间的 MM-DD', () => {
    const w = dayWindows(7, Date.parse('2026-10-10T16:30:00Z'));
    expect(w).toHaveLength(7);
    expect(w[6].label).toBe('10-11');
    expect(w[0].label).toBe('10-05');
    for (let i = 1; i < w.length; i++) expect(w[i].start).toBe(w[i - 1].end);
  });

  it('金额汇总忽略非数字', () => {
    expect(sumAmounts([{ amount: 49 }, { amount: '99' }, { amount: null }, { amount: 'x' }])).toBe(148);
  });
});

describe('CSV 导出', () => {
  it('带 BOM（Excel 打开中文不乱码），含逗号、引号、换行的字段正确转义', () => {
    const rows = [{ name: '张三, 李四', note: 'say "hi"\n换行', n: 3 }];
    const out = toCsv(rows, [
      { header: '名字', value: (r) => r.name },
      { header: '备注', value: (r) => r.note },
      { header: '数量', value: (r) => r.n },
    ]);
    expect(out.startsWith('﻿名字,备注,数量\r\n')).toBe(true);
    expect(out).toContain('"张三, 李四"');
    expect(out).toContain('"say ""hi""\n换行"');
    expect(out.endsWith('3')).toBe(true);
  });

  it('空值输出为空字符串，不输出 null', () => {
    const out = toCsv([{ a: null as string | null }], [{ header: 'a', value: (r) => r.a }]);
    expect(out).toBe('﻿a\r\n');
  });
});
