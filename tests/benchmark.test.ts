import { describe, expect, it } from 'vitest';
import { checkAccount, checkHotTopic, checkVideo, summarizeBenchmark } from '@/lib/benchmark';

describe('对标账号汇总（整改 C）', () => {
  it('没录的播放不算 0；完播取中位数；播放最高的一条', () => {
    const s = summarizeBenchmark([
      { id: '1', title: 'A', published_on: null, views: 1000, likes: null, completion: 30 },
      { id: '2', title: 'B', published_on: null, views: null, likes: null, completion: 40 },
      { id: '3', title: 'C', published_on: null, views: 3000, likes: null, completion: 50 },
    ]);
    expect(s.count).toBe(3);
    expect(s.avgViews).toBe(2000);
    expect(s.medianCompletion).toBe(40);
    expect(s.best).toEqual({ title: 'C', views: 3000 });
  });

  it('一条数据都没有：平均和中位数是 null，不是 0', () => {
    const s = summarizeBenchmark([]);
    expect(s).toEqual({ count: 0, avgViews: null, medianCompletion: null, best: null });
  });
});

describe('手动录入的校验（整改 C）', () => {
  it('对标账号：名字必填；链接要 http 开头', () => {
    expect(checkAccount({ name: '  ' }).ok).toBe(false);
    expect(checkAccount({ name: '某某', link: 'www.x.com' })).toMatchObject({ ok: false });
    expect(checkAccount({ name: '某某', link: 'https://x.com/a' })).toMatchObject({ ok: true, value: { name: '某某', link: 'https://x.com/a' } });
  });

  it('作品：播放支持「1.2万」；完播率超过 100 不存；日期格式要对', () => {
    expect(checkVideo({ title: 't', views: '1.2万' })).toMatchObject({ ok: true, value: { views: 12000, likes: null } });
    expect(checkVideo({ title: 't', completion: '120' }).ok).toBe(false);
    expect(checkVideo({ title: 't', publishedOn: '10/17' }).ok).toBe(false);
    expect(checkVideo({ title: 't', publishedOn: '2026-10-17' })).toMatchObject({ ok: true, value: { published_on: '2026-10-17' } });
  });

  it('热点线索：只有标题必填；来源链接要 http 开头', () => {
    expect(checkHotTopic({ title: '' }).ok).toBe(false);
    expect(checkHotTopic({ title: '某热点', sourceUrl: 'x' }).ok).toBe(false);
    expect(checkHotTopic({ title: '某热点' })).toMatchObject({ ok: true, value: { title: '某热点', source_url: null } });
  });
});
