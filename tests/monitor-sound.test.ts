/**
 * 监控大屏提示音（2026-10-02 产品方："提示音大一点，类似 QQ 上线那种感觉"）。
 * 声音出错不会报错，只会"听不见"或"听着不对"，所以把音色参数和接线守住
 */
import { describe, it, expect } from 'vitest';
import { SOUND_SPECS, BELL_PARTIALS, scheduleSound, DEFAULT_VOLUME } from '@/lib/monitor-sound';
import { readCode } from './helpers/source';

/** 记录排了哪些音的假 AudioContext */
function fakeCtx() {
  const oscs: { freqs: number[]; started: number; stopped: number; connectedTo: unknown }[] = [];
  const peaks: number[] = [];
  const param = (rec?: number[]) => ({
    setValueAtTime: (v: number) => { rec?.push(v); },
    linearRampToValueAtTime: (v: number) => { if (rec === undefined) peaks.push(v); },
    exponentialRampToValueAtTime: (v: number) => { rec?.push(v); },
  });
  const ctx = {
    currentTime: 0,
    createOscillator() {
      const o = { freqs: [] as number[], started: -1, stopped: -1, connectedTo: null as unknown, type: '' };
      oscs.push(o);
      return {
        set type(t: string) { o.type = t; },
        frequency: param(o.freqs),
        connect(g: { connect: (x: unknown) => unknown }) { o.connectedTo = g; return g; },
        start(t: number) { o.started = t; },
        stop(t: number) { o.stopped = t; },
      };
    },
    createGain() {
      return { gain: param(), connect: (x: unknown) => x };
    },
  };
  return { ctx, oscs, peaks };
}

describe('音色', () => {
  it('每个音都比原来响得多（原来单个正弦 0.05~0.13）', () => {
    for (const [kind, notes] of Object.entries(SOUND_SPECS)) {
      for (const n of notes) expect(n.peak, kind).toBeGreaterThanOrEqual(0.45);
    }
    expect(DEFAULT_VOLUME).toBeGreaterThanOrEqual(0.8);
  });

  it('新用户是「叮咚」：两个音、先高后低、尾音拖长', () => {
    const [a, b] = SOUND_SPECS.chime;
    expect(SOUND_SPECS.chime).toHaveLength(2);
    expect(a.freq).toBeGreaterThan(b.freq);
    expect(b.decay).toBeGreaterThanOrEqual(0.6);
  });

  it('付款最长、最不一样：上行四连音响两遍', () => {
    const alert = SOUND_SPECS.alert;
    expect(alert).toHaveLength(8);
    expect(alert.slice(0, 4).map((n) => n.freq)).toEqual([...alert.slice(0, 4).map((n) => n.freq)].sort((x, y) => x - y));
    expect(alert.length).toBeGreaterThan(SOUND_SPECS.chime.length);
    expect(alert.length).toBeGreaterThan(SOUND_SPECS.ping.length);
  });

  it('使用提示短促：整段半秒以内', () => {
    const end = Math.max(...SOUND_SPECS.ping.map((n) => n.at + n.decay));
    expect(end).toBeLessThan(0.5);
  });
});

describe('排音', () => {
  it('每个音按泛音数排出正弦振荡器，都会停下来（不留常驻振荡器）', () => {
    const { ctx, oscs, peaks } = fakeCtx();
    scheduleSound(ctx as unknown as BaseAudioContext, {} as AudioNode, 'chime');
    expect(oscs).toHaveLength(SOUND_SPECS.chime.length * BELL_PARTIALS.length);
    for (const o of oscs) expect(o.stopped).toBeGreaterThan(o.started);
    expect(Math.max(...peaks)).toBeCloseTo(0.6);
  });

  it('有滑音的音从低处滑到目标音', () => {
    const { ctx, oscs } = fakeCtx();
    scheduleSound(ctx as unknown as BaseAudioContext, {} as AudioNode, 'ping');
    const first = oscs[0];
    expect(first.freqs[0]).toBe(SOUND_SPECS.ping[0].glideFrom);
    expect(first.freqs[1]).toBe(SOUND_SPECS.ping[0].freq);
  });
});

describe('大屏页面', () => {
  const page = readCode('app/admin/monitor/page.tsx');

  it('声音走 总音量 → 压缩器 → 扬声器，可调音量、可试听', () => {
    expect(page).toMatch(/createOutput\(ctx, volume\)/);
    expect(page).toMatch(/scheduleSound\(ctx, out, kind\)/);
    expect(page).toContain('aria-label="提示音音量"');
    expect(page).toMatch(/\["alert", "付款"\]/);
    expect(readCode('lib/monitor-sound.ts')).toMatch(/createDynamicsCompressor\(\)/);
  });

  it('开声音时响一下「叮咚」，确认真的能响', () => {
    expect(page).toMatch(/setEnabled\(true\);[\s\S]{0,120}scheduleSound\(ctx, outRef\.current, "chime"\)/);
  });

  it('音量存本机，读写都包 try/catch', () => {
    expect(page).toMatch(/try \{[\s\S]{0,80}localStorage\.getItem\(VOLUME_KEY\)/);
    expect(page).toMatch(/try \{ localStorage\.setItem\(VOLUME_KEY/);
  });
});
