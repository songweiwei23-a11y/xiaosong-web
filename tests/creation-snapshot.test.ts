import { describe, it, expect } from 'vitest';
import { readCreationSnapshot, creationSnapshotUrl } from '@/lib/creation-snapshot';
import { mergeCreationSettings, creationSettingsBlock } from '@/lib/creation-settings';
import { withGenerationId } from '@/lib/safe-post';

const id = '00000000-0000-4000-8000-000000000001';
describe('durable creation intent', () => {
  it('preserves long source, selected settings, locked text and opening without summary truncation', () => {
    const text = '客户原始资料'.repeat(2000);
    const snapshot = readCreationSnapshot({ from: '审稿优化', target: '/dashboard/script', profileId: id, sourceContent: text, originContent: text, settings: { audience: '本地家庭', purpose: '人设型', structure: 'story', openingLine: '先保留这句', lockedTexts: ['真实事实'] } });
    expect(snapshot?.sourceContent).toBe(text);
    expect(snapshot?.settings?.audience).toBe('本地家庭');
    expect(snapshot?.settings?.lockedTexts).toEqual(['真实事实']);
    expect(snapshot?.settings?.openingLine).toBe('先保留这句');
  });
  it('rejects arbitrary destinations, foreign shape and oversized input without silent truncation', () => {
    expect(readCreationSnapshot({ from: '外部', target: 'https://example.com' })).toBeNull();
    expect(readCreationSnapshot({ from: '外部', target: '/dashboard/script', profileId: 'bad' })).toBeNull();
    expect(readCreationSnapshot({ from: '外部', target: '/dashboard/script', sourceContent: 'x'.repeat(900_000) })).toBeNull();
  });
  it('does not persist credentials or arbitrary object keys', () => {
    const out = readCreationSnapshot({ from: '审稿', target: '/dashboard/script', token: 'secret', apiKey: 'secret', settings: { audience: '本地家庭', apiKey: 'secret' } });
    expect(JSON.stringify(out)).not.toContain('secret');
  });
  it('explicit unlock clears inherited locked segments', () => {
    expect(mergeCreationSettings({ lockedTexts: ['旧锁定'] }, { lockedTexts: [] }).lockedTexts).toEqual([]);
    expect(creationSettingsBlock({ lockedTexts: ['客户原话'] })).toContain('客户原话');
    expect(creationSettingsBlock({ lockedTexts: [] })).not.toContain('锁定片段');
  });
  it('uses opaque resumable URL rather than customer script text', () => {
    const url = creationSnapshotUrl({ from: '开篇', target: '/dashboard/growth', workId: id, sourceContent: '客户私有资料', tab: 'opening' }, id);
    expect(url).toContain(`creation=${id}`);
    expect(url).toContain(`work=${id}`);
    expect(url).toContain('tab=opening');
    expect(url).not.toContain('客户');
  });
});

describe('generation request identity', () => {
  it('reuses identity for retries but creates a new identity for new operations', () => {
    const original = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' };
    const prepared = withGenerationId('/api/dify/stream', original);
    const first = new Headers(prepared.headers).get('X-Generation-Id');
    expect(first).toMatch(/^[0-9a-f-]{36}$/i);
    expect(new Headers(withGenerationId('/api/dify/stream', prepared).headers).get('X-Generation-Id')).toBe(first);
    expect(new Headers(withGenerationId('/api/dify/stream', original).headers).get('X-Generation-Id')).not.toBe(first);
    expect(new Headers(prepared.headers).get('Content-Type')).toBe('application/json');
  });
  it('preserves caller supplied request ID and leaves ordinary saves unchanged', () => {
    const init = { method: 'POST', headers: { 'X-Generation-Id': id } };
    expect(new Headers(withGenerationId('/api/dify/chat', init).headers).get('X-Generation-Id')).toBe(id);
    expect(withGenerationId('/api/library', init)).toBe(init);
  });
});
