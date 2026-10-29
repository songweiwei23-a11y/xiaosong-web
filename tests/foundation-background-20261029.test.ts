/**
 * 地基一键生成：后台一直跑到完成，完成后提示用户（2026-10-29 产品方）。
 * - 服务端：按档案查最近一次（换浏览器、换设备也能接上）；跑完的留 24 小时。
 * - 页面：关掉页面再回来，跑完了就弹「地基已完成」（原来悄悄删掉记录，不提示）；
 *   任务找不到了（生成中服务器更新重启）不再一直转圈，按「中断」处理：已经齐了就提示完成，还缺就自动接着补一次。
 */
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createFoundation, latestFoundation } from '@/lib/foundation-job';

describe('服务端：按档案查最近一次', () => {
  it('正在跑的优先；没有在跑的就取最近跑完的；别人的、别的档案的都取不到', () => {
    const pid = '11111111-1111-4111-8111-111111111111';
    const older = createFoundation('u-latest', pid, ['positioning']);
    older.status = 'done';
    older.finishedAt = Date.now() - 60_000;
    const newer = createFoundation('u-latest', pid, ['brief']);
    newer.status = 'partial';
    newer.finishedAt = Date.now() - 1_000;
    expect(latestFoundation('u-latest', pid)?.id).toBe(newer.id);

    const running = createFoundation('u-latest', pid, ['advice']);
    expect(latestFoundation('u-latest', pid)?.id).toBe(running.id);

    expect(latestFoundation('someone-else', pid)).toBeNull();
    expect(latestFoundation('u-latest', '22222222-2222-4222-8222-222222222222')).toBeNull();
  });

  it('跑完的任务留 24 小时：隔几个小时回来还能看到结果', () => {
    const pid = '33333333-3333-4333-8333-333333333333';
    const job = createFoundation('u-ttl', pid, ['positioning']);
    job.status = 'done';
    job.finishedAt = Date.now() - 5 * 60 * 60_000;
    expect(latestFoundation('u-ttl', pid)?.id).toBe(job.id);
    job.finishedAt = Date.now() - 25 * 60 * 60_000;
    expect(latestFoundation('u-ttl', pid)).toBeNull();
  });

  it('接口：GET ?profileId= 查这个档案最近的一次，并校验档案编号', () => {
    const src = fs.readFileSync('app/api/foundation/route.ts', 'utf8');
    expect(src).toContain('latestFoundation(guard.userId!, profileId)');
    expect(src).toMatch(/profileId !== null\) \{\s*if \(!PROFILE_UUID\.test\(profileId\)\)/);
  });
});

describe('页面：关掉窗口后台继续，完成后提示', () => {
  const src = fs.readFileSync('components/foundation/FoundationSetup.tsx', 'utf8');

  it('回来时本机没记就按档案问服务端', () => {
    expect(src).toContain('`/api/foundation?profileId=${encodeURIComponent(pid)}`');
  });

  it('回来时已经跑完、还没提示过：弹出完成（不再悄悄删掉记录）', () => {
    expect(src).toMatch(/if \(!readLocal\(notifiedKey\(found\.id\)\)\) \{ writeLocal\(notifiedKey\(found\.id\), "1"\); setJob\(found\); setPhase\("done"\); \}/);
  });

  it('轮询时任务没了（404）：不再一直转圈，按中断处理', () => {
    expect(src).toMatch(/if \(r\.status === 404\) \{\s*window\.clearInterval\(timer\);[\s\S]{0,200}setInterrupted\(true\);/);
  });

  it('中断后：已经齐了提示完成；还缺就自动接着补，一次打开只自动续一次', () => {
    expect(src).toContain('if (readFlag(resumedKey(pid)))');
    expect(src).toContain('writeFlag(resumedKey(pid));');
    expect(src).toContain('void start();');
  });

  it('跑完时最小化着也会弹出完成；按钮写明关掉后后台继续', () => {
    expect(src).toMatch(/writeLocal\(notifiedKey\(d\.job\.id\), "1"\);\s*setMinimized\(false\);\s*setPhase\("done"\);/);
    expect(src).toContain('关掉窗口，后台继续生成');
    expect(src).toContain('✓ 地基已完成，可以继续创作了');
  });
});
