/**
 * 白噪音：声音是现场合成的，出错不会报错，只会"听起来不对"——
 * 一段坏值就是爆音，循环接缝对不上就是每隔二十秒"咔"一下，响度失衡就是一开就吓人。
 * 这些都能在不出声的情况下量出来。
 */
import { describe, it, expect } from 'vitest';
import { AMBIENT_SOUNDS, SYNTH_RATE, synthesize, type AmbientId } from '@/lib/ambient/synth';
import { DEFAULT_MASTER, DEFAULT_VOLUME } from '@/lib/ambient/engine';
import { readCode } from './helpers/source';

const rms = (a: Float32Array, from = 0, to = a.length) => {
  let s = 0;
  for (let i = from; i < to; i++) s += a[i] * a[i];
  return Math.sqrt(s / (to - from));
};

describe('六种声音', () => {
  it('名字、编号都在，不重复', () => {
    expect(AMBIENT_SOUNDS.map((s) => s.name)).toEqual(['雨声', '咖啡馆', '篝火', '翻书', '海浪', '专注']);
    expect(new Set(AMBIENT_SOUNDS.map((s) => s.id)).size).toBe(6);
  });

  for (const snd of AMBIENT_SOUNDS) {
    describe(snd.name, () => {
      const b = synthesize(snd.id);

      it('没有坏值、不削顶、两个声道一样长', () => {
        expect(b.left.length).toBe(b.right.length);
        expect(b.left.length).toBeGreaterThan(SYNTH_RATE * 10);
        let peak = 0;
        for (let i = 0; i < b.left.length; i++) {
          if (!Number.isFinite(b.left[i]) || !Number.isFinite(b.right[i])) throw new Error(`第 ${i} 个采样是坏值`);
          peak = Math.max(peak, Math.abs(b.left[i]), Math.abs(b.right[i]));
        }
        expect(peak).toBeLessThan(0.95);
      });

      it('响度在背景音的范围里', () => {
        const r = rms(b.left);
        expect(r).toBeGreaterThan(0.02);
        expect(r).toBeLessThan(0.15);
      });

      it('循环接缝连得上：最后一个采样到第一个的跳变，和平时相邻采样差不多', () => {
        const L = b.left;
        let sum = 0;
        for (let i = 1; i < L.length; i++) sum += Math.abs(L[i] - L[i - 1]);
        const typical = sum / (L.length - 1);
        expect(Math.abs(L[L.length - 1] - L[0])).toBeLessThan(typical * 6);
      });
    });
  }

  it('同一个种子出同一段声音（可复现），换种子就不一样', () => {
    const a = synthesize('rain', 1);
    const b = synthesize('rain', 1);
    const c = synthesize('rain', 2);
    expect(a.left.slice(1000, 1100)).toEqual(b.left.slice(1000, 1100));
    expect(a.left.slice(1000, 1100)).not.toEqual(c.left.slice(1000, 1100));
  });

  it('声音性格对得上：雨声比专注（棕噪音）明亮得多，海浪有涨落、雨声平稳', () => {
    const zcr = (id: AmbientId) => {
      const L = synthesize(id).left;
      let z = 0;
      for (let i = 1; i < L.length; i++) if ((L[i - 1] < 0) !== (L[i] < 0)) z++;
      return z / (L.length / SYNTH_RATE);
    };
    expect(zcr('rain')).toBeGreaterThan(zcr('brown') * 5);

    const swing = (id: AmbientId) => {
      const L = synthesize(id).left;
      const per = [];
      for (let s = 0; s + SYNTH_RATE <= L.length; s += SYNTH_RATE) per.push(rms(L, s, s + SYNTH_RATE));
      return Math.max(...per) / Math.min(...per);
    };
    expect(swing('waves')).toBeGreaterThan(3);
    expect(swing('rain')).toBeLessThan(1.3);
  });
});

describe('播放器和界面', () => {
  it('默认音量偏小：白噪音是背景，不能一开就吓人', () => {
    expect(DEFAULT_VOLUME * DEFAULT_MASTER).toBeLessThanOrEqual(0.15);
  });

  it('不会自动播放：读回上次搭配、有人订阅状态时都不出声', () => {
    const src = readCode('lib/ambient/engine.ts');
    const body = (name: string) => {
      const m = src.match(new RegExp(`function ${name}\\([^)]*\\)[^{]*\\{([\\s\\S]*?)\\n\\}`));
      if (!m) throw new Error(`找不到 ${name}`);
      return m[1];
    };
    for (const fn of ['restore', 'subscribe', 'getState']) {
      expect(body(fn), `${fn} 里不能出声`).not.toMatch(/\bplay\(|\.resume\(|startVoice\(/);
    }
    // 模块顶层也不能有直接调用
    const topLevel = src.split('\n').filter((l) => /^(play|startVoice)\(/.test(l));
    expect(topLevel).toEqual([]);
  });

  it('顶栏在所有后台页面都能暂停、继续、切换', () => {
    expect(readCode('app/dashboard/layout.tsx')).toContain('<AmbientPill />');
    const pill = readCode('components/ambient/AmbientPill.tsx');
    expect(pill).toMatch(/onClick=\{\(\) => next\(\)\}/);
    expect(pill).toMatch(/onClick=\{\(\) => toggle\(\)\}/);
    // 暂停了也留着，才能在别的页面接着放
    expect(pill).toMatch(/if \(!s\.started \|\| names\.length === 0\) return null/);
  });

  it('首页面板：切换、播放暂停、定时、总音量都在', () => {
    const mixer = readCode('components/ambient/AmbientMixer.tsx');
    for (const k of ['next()', 'toggle()', 'setTimer(', 'setMaster(', 'setVolume(']) expect(mixer).toContain(k);
    expect(mixer).toMatch(/active\.length > 0 && \(\s*<label/);
    expect(readCode('components/dashboard/TodayBoard.tsx')).toContain('<AmbientMixer />');
  });
});
