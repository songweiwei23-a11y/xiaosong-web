/**
 * 拆解爆款的视频预处理（浏览器里切镜头、挑帧、切音频）。
 * 画面解码只能在浏览器里测；这里守的是纯计算部分——切错了镜头，后面整份拆解的结构就全乱了。
 */
import { describe, it, expect } from 'vitest';
import {
  detectCuts,
  shotsFromCuts,
  pickFrames,
  audioSegments,
  encodeWav,
  frameDiff,
  fmtTime,
  MAX_FRAMES,
} from '@/lib/video-frames';

/** 造一串差值：平时在 base 附近抖，指定时刻突然跳高 */
const series = (duration: number, cutsAt: number[], base = 6, jump = 60) =>
  Array.from({ length: Math.floor(duration / 0.5) }, (_, i) => {
    const time = (i + 1) * 0.5;
    const noise = ((i * 7919) % 5) - 2; // 确定性的小抖动
    return { time, diff: cutsAt.includes(time) ? jump : base + noise };
  });

describe('切镜头', () => {
  it('差值明显高出平常水平才算切', () => {
    expect(detectCuts(series(20, [3, 7.5, 12]))).toEqual([3, 7.5, 12]);
  });

  it('口播人一直在动（平常差值就高）：不能切出一堆假镜头', () => {
    const talking = series(30, [], 22).map((d, i) => ({ ...d, diff: d.diff + (i % 3) * 3 }));
    expect(detectCuts(talking)).toEqual([]);
  });

  it('两个切点至少隔 0.8 秒（转场的前后两帧都会跳，只算一次）', () => {
    expect(detectCuts(series(10, [4, 4.5]))).toEqual([4]);
  });

  it('全是一样的画面、空数组：不崩', () => {
    expect(detectCuts([])).toEqual([]);
    expect(detectCuts(series(10, [], 0).map((d) => ({ ...d, diff: 0 })))).toEqual([]);
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
