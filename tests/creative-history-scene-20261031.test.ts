/**
 * 方向历史的名字不带拍摄场地、设备（2026-10-31）：以前生成的方向名字里带着「棚子」，新方向会接着写，场地被每次带进来。
 */
import { describe, expect, it } from 'vitest';
import { directionNamesOf } from '@/lib/creative-history';

describe('方向历史只留不带场地、设备的名字', () => {
  it('带棚子、灯光、稳定器的名字不进提示词，其余照常', () => {
    const results = [
      '### 方向1：降温后，棚子和清汤羊排锅一起入镜\n正文很长…\n### 方向2：摊位上的一天\n正文…',
      '### 方向1：灯光下的火锅\n### 方向2：老顾客的一句话',
    ];
    const names = directionNamesOf(results);
    expect(names).not.toContain('降温后，棚子和清汤羊排锅一起入镜');
    expect(names).not.toContain('灯光下的火锅');
    expect(names).toContain('摊位上的一天');
    expect(names).toContain('老顾客的一句话');
  });

  it('同一个名字只出现一次', () => {
    expect(directionNamesOf(['### 方向1：摊位上的一天', '### 方向1：摊位上的一天'])).toEqual(['摊位上的一天']);
  });
});
