/**
 * 拆解爆款的视频预处理（浏览器里切镜头、挑帧、切音频）。
 * 画面解码只能在浏览器里测；这里守的是纯计算部分——切错了镜头，后面整份拆解的结构就全乱了。
 */
import { describe, it, expect } from 'vitest';
import {
  cutCandidates,
  confirmCut,
  dedupeCuts,
  sheetLayout,
  sheetByteBudget,
  SHEETS_BYTE_BUDGET,
  shotsFromCuts,
  pickFrames,
  audioSegments,
  encodeWav,
  frameDiff,
  fmtTime,
  MAX_FRAMES,
} from '@/lib/video-frames';
import { readCode } from './helpers/source';

/** 造一串差值：平时在 base 附近抖，指定时刻突然跳高 */
const series = (duration: number, cutsAt: number[], base = 6, jump = 60) =>
  Array.from({ length: Math.floor(duration / 0.5) }, (_, i) => {
    const time = (i + 1) * 0.5;
    const noise = ((i * 7919) % 5) - 2; // 确定性的小抖动
    return { time, diff: cutsAt.includes(time) ? jump : base + noise };
  });

describe('切镜头', () => {
  it('粗扫：高出这条视频平常水平的窗口都拿去细看（宁多勿漏）', () => {
    expect(cutCandidates(series(20, [3, 7.5, 12])).map((d) => d.time)).toEqual([3, 7.5, 12]);
    // 大切换不会把阈值抬高到盖住小切换（第一版按均值+2.5倍标准差，实测漏掉了同一场景里的机位切换）
    const mixed = series(40, [5, 10, 15, 20, 25], 6, 90).map((d) => (d.time === 30 ? { ...d, diff: 20 } : d));
    expect(cutCandidates(mixed).map((d) => d.time)).toContain(30);
  });

  it('全是一样的画面、空数组：不崩', () => {
    expect(cutCandidates([])).toEqual([]);
    expect(cutCandidates(series(10, [], 0).map((d) => ({ ...d, diff: 0 })))).toEqual([]);
  });

  it('细看：变化集中在最后那一瞬间才是切换；人在动、镜头在摇是一点点变，不算', () => {
    expect(confirmCut(40, 38)).toBe(true); // 一瞬间全变了
    expect(confirmCut(40, 6)).toBe(false); // 0.5 秒里慢慢变过去的
    expect(confirmCut(12, 8)).toBe(false); // 变化太小，不算
  });

  it('同一个转场被判两次只算一个', () => {
    expect(dedupeCuts([4.1, 4.3, 9, 2])).toEqual([2, 4.1, 9]);
  });

  it('横屏格子更大（实测横屏按竖屏的格子拼，字幕看不清，模型开始猜字）', () => {
    expect(sheetLayout(1280, 720)).toMatchObject({ cols: 3, cellW: 512 });
    expect(sheetLayout(720, 1280)).toMatchObject({ cols: 4, cellW: 384 });
    expect(sheetLayout(1280, 720).maxFrames).toBe(54);
  });

  it('切点变成镜头：首尾补齐，编号从 1 开始，贴得太近的丢掉', () => {
    expect(shotsFromCuts([3, 7.5], 12)).toEqual([
      { no: 1, start: 0, end: 3 },
      { no: 2, start: 3, end: 7.5 },
      { no: 3, start: 7.5, end: 12 },
    ]);
    expect(shotsFromCuts([], 5)).toEqual([{ no: 1, start: 0, end: 5 }]);
    expect(shotsFromCuts([12, 13], 12)).toHaveLength(1);
  });

  it('灰度差：一样是 0，黑白之间是 255', () => {
    expect(frameDiff(new Uint8ClampedArray([10, 20]), new Uint8ClampedArray([10, 20]))).toBe(0);
    expect(frameDiff(new Uint8ClampedArray([0, 0]), new Uint8ClampedArray([255, 255]))).toBe(255);
  });
});

describe('挑帧', () => {
  it('开头 3 秒每 0.5 秒一张（前 3 秒决定划不划走），之后每个镜头取中间一张', () => {
    const shots = shotsFromCuts([2, 6, 10], 15);
    const frames = pickFrames(shots, 15);
    expect(frames.filter((f) => f.opening).map((f) => f.time)).toEqual([0, 0.5, 1, 1.5, 2, 2.5]);
    expect(frames.filter((f) => !f.opening).map((f) => [f.time, f.shot])).toEqual([[4, 2], [8, 3], [12.5, 4]]);
    // 开头的帧标着属于哪个镜头
    expect(frames.find((f) => f.time === 2.5)?.shot).toBe(2);
  });

  it('镜头太多装不下：丢最短的，总数不超过上限，按时间排好', () => {
    const cuts = Array.from({ length: 150 }, (_, i) => 3 + i * (i % 2 ? 0.9 : 0.3));
    const duration = Math.max(...cuts) + 2;
    const frames = pickFrames(shotsFromCuts(cuts, duration), duration);
    expect(frames.length).toBeLessThanOrEqual(MAX_FRAMES);
    expect(frames.map((f) => f.time)).toEqual([...frames.map((f) => f.time)].sort((a, b) => a - b));
  });

  it('不到 3 秒的短视频：只取开头那几张', () => {
    const frames = pickFrames(shotsFromCuts([], 2), 2);
    expect(frames.map((f) => f.time)).toEqual([0, 0.5, 1, 1.5]);
  });
});

describe('拼图大小', () => {
  it('所有拼图加起来压在 2.4MB 以内：base64 后约 3.2MB，远低于 Dify 一次调用 5MB 的上限（线上实测 8.2MB 被拒）', () => {
    expect(SHEETS_BYTE_BUDGET * (4 / 3)).toBeLessThan(5 * 1024 * 1024 * 0.7);
    for (const n of [1, 3, 5, 6]) expect(sheetByteBudget(n) * n).toBeLessThanOrEqual(SHEETS_BYTE_BUDGET);
    expect(sheetByteBudget(0)).toBe(SHEETS_BYTE_BUDGET);
  });

  it('拼图不再用固定质量，而是压到预算以内', () => {
    const src = readCode('lib/video-frames.ts');
    expect(src).toMatch(/sheets\.push\(await encodeWithinBudget\(canvas, budget\)\)/);
    expect(src).not.toMatch(/'image\/jpeg', 0\.85/);
  });
});

describe('切音频', () => {
  it('按镜头边界合成 10～30 秒一段，首尾相接不漏', () => {
    const shots = shotsFromCuts([4, 9, 13, 21, 27, 40], 55);
    const segs = audioSegments(shots, 55);
    expect(segs[0].start).toBe(0);
    expect(segs[segs.length - 1].end).toBe(55);
    for (let i = 1; i < segs.length; i++) expect(segs[i].start).toBe(segs[i - 1].end);
    for (const s of segs) expect(s.end - s.start).toBeLessThanOrEqual(30);
    // 切点落在镜头边界上（一句话不会从镜头中间劈开，除非一个镜头本身超过 30 秒）
    const bounds = new Set([0, 4, 9, 13, 21, 27, 40, 55]);
    for (const s of segs) expect(bounds.has(s.end)).toBe(true);
  });

  it('一镜到底的长口播：按 30 秒硬切', () => {
    const segs = audioSegments(shotsFromCuts([], 75), 75);
    expect(segs.map((s) => [s.start, s.end])).toEqual([[0, 30], [30, 60], [60, 75]]);
  });

  it('最后剩下不到 3 秒：并进前一段', () => {
    const segs = audioSegments(shotsFromCuts([], 61), 61);
    expect(segs.map((s) => [s.start, s.end])).toEqual([[0, 30], [30, 61]]);
  });
});

describe('WAV 编码', () => {
  it('文件头对：16k 单声道 16 位，长度对得上', async () => {
    const wav = encodeWav(new Float32Array(16000), 16000);
    const v = new DataView(await wav.arrayBuffer());
    const tag = (o: number) => String.fromCharCode(...[0, 1, 2, 3].map((i) => v.getUint8(o + i)));
    expect(tag(0)).toBe('RIFF');
    expect(tag(8)).toBe('WAVE');
    expect(v.getUint16(22, true)).toBe(1);
    expect(v.getUint32(24, true)).toBe(16000);
    expect(v.getUint32(40, true)).toBe(32000);
    expect(wav.size).toBe(44 + 32000);
  });
});

describe('时间码', () => {
  it('分:秒.一位小数', () => {
    expect(fmtTime(0)).toBe('00:00.0');
    expect(fmtTime(7.5)).toBe('00:07.5');
    expect(fmtTime(83.25)).toBe('01:23.3');
  });
});
