/**
 * 白噪音：声音是现场合成的，出错不会报错，只会"听起来不对"——
 * 一段坏值就是爆音，循环接缝对不上就是每隔二十秒"咔"一下，响度失衡就是一开就吓人。
 * 这些都能在不出声的情况下量出来。
 */
import { describe, it, expect } from 'vitest';
import { AMBIENT_SOUNDS, SYNTH_RATE, synthesize, type AmbientId } from '@/lib/ambient/synth';
import { DEFAULT_MASTER, DEFAULT_VOLUME, OUTPUT_BOOST, isDefaultVolume } from '@/lib/ambient/engine';
import fs from 'node:fs';
import path from 'node:path';
import { readCode } from './helpers/source';

const listTsx = (dir: string): string[] =>
  fs.readdirSync(path.join(process.cwd(), dir), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? listTsx(path.join(dir, e.name)) : e.name.endsWith('.tsx') ? [path.join(dir, e.name)] : []
  );

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

  it('换声音不忽大忽小：每种声音"最响的时候"都和雨声差不多（翻书原来只有雨声的一半多）', () => {
    /*
     * 用户反馈"声音变小了"：点了顶栏的"切换"换到翻书，一下小了一大截。
     * 翻书是稀疏的声音（大半时间是安静房间），按整段平均定响度，翻页那一下也被压小了。
     * 所以这里不比整段平均，比"最响的那 10% 时刻"——人耳感觉的是这个。
     */
    const loudest = (id: AmbientId) => {
      const L = synthesize(id).left;
      const W = Math.round(SYNTH_RATE * 0.1);
      const win: number[] = [];
      for (let s = 0; s + W <= L.length; s += W) win.push(rms(L, s, s + W));
      win.sort((a, b) => b - a);
      const top = win.slice(0, Math.max(1, Math.floor(win.length * 0.1)));
      return top.reduce((a, c) => a + c, 0) / top.length;
    };
    const ref = loudest('rain');
    for (const s of AMBIENT_SOUNDS) {
      if (s.id === 'waves') continue; // 海浪本来就是一涨一落，涨起来那下比雨大是它的性格
      const ratio = loudest(s.id) / ref;
      expect(ratio, `${s.name} 最响时是雨声的 ${ratio.toFixed(2)} 倍`).toBeGreaterThan(0.8);
      expect(ratio, `${s.name} 最响时是雨声的 ${ratio.toFixed(2)} 倍`).toBeLessThan(1.3);
    }
  });
});

describe('播放器和界面', () => {
  it('默认音量偏小：白噪音是背景，不能一开就吓人', () => {
    // 2026-09-28 产品方两次反馈"偏小"：0.35×0.4=0.14 → 0.35×0.6=0.21 → 0.5×0.8=0.4
    expect(DEFAULT_VOLUME * DEFAULT_MASTER).toBeLessThanOrEqual(0.45);
    expect(DEFAULT_VOLUME * DEFAULT_MASTER).toBeGreaterThan(0.3);
  });

  it('调大默认音量后，老用户本机存着的旧默认值也跟着变大（自己调过的不动）', () => {
    const src = readCode('lib/ambient/engine.ts');
    expect(src).toMatch(/const PREVIOUS_DEFAULT_MASTERS = \[0\.4, 0\.6\]/);
    expect(src).toMatch(/const PREVIOUS_DEFAULT_VOLUMES = \[0\.35\]/);
    expect(src).toMatch(/if \(PREVIOUS_DEFAULT_MASTERS\.includes\(master\)\) master = DEFAULT_MASTER/);
    expect(src).toMatch(/PREVIOUS_DEFAULT_VOLUMES\.includes\(v\) \? DEFAULT_VOLUME : v/);
  });

  it('输出先放大、再过限幅器：默认就够响，叠几种、都拉满也不爆音', () => {
    const src = readCode('lib/ambient/engine.ts');
    expect(src).toMatch(/createDynamicsCompressor\(\)/);
    // 放大必须在限幅器前面——反过来就是先压再放，照样爆
    expect(src).toMatch(/masterGain\.connect\(boost\)\.connect\(limiter\)\.connect\(ctx\.destination\)/);
    expect(src).not.toMatch(/masterGain\.connect\(ctx\.destination\)/);
  });

  it('默认响度够得着：放大后的平均输出接近普通视频（产品方反馈"风扇都能盖住"）', () => {
    // 雨声合成出来平均约 0.12；默认音量下经放大后的平均输出
    const L = synthesize('rain').left;
    const out = rms(L) * DEFAULT_VOLUME * DEFAULT_MASTER * OUTPUT_BOOST;
    expect(out, `默认输出平均 ${out.toFixed(3)}`).toBeGreaterThan(0.12);
    expect(out, `默认输出平均 ${out.toFixed(3)}`).toBeLessThan(0.3);
  });

  it('恢复默认音量：改过音量才出现按钮，点了各声音和总音量都回默认', () => {
    expect(isDefaultVolume({ mix: { rain: DEFAULT_VOLUME }, master: DEFAULT_MASTER })).toBe(true);
    expect(isDefaultVolume({ mix: { rain: 0.1 }, master: DEFAULT_MASTER })).toBe(false);
    expect(isDefaultVolume({ mix: { rain: DEFAULT_VOLUME }, master: 0.1 })).toBe(false);
    const mixer = readCode('components/ambient/AmbientMixer.tsx');
    expect(mixer).toMatch(/\{!isDefaultVolume\(s\) && \([\s\S]{0,200}onClick=\{\(\) => resetVolumes\(\)\}/);
    const engine = readCode('lib/ambient/engine.ts');
    expect(engine).toMatch(/mix\[id\] = DEFAULT_VOLUME/);
    expect(engine).toMatch(/emit\(\{ mix, master: DEFAULT_MASTER \}\)/);
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
    // 一直都在：原来要先在首页放过才出现，在别的板块开不了
    expect(pill).not.toMatch(/return null/);
    // 点名字展开和首页同一块完整面板，手机上从底部升起
    expect(pill).toMatch(/<AdaptivePopover[\s\S]*<AmbientMixer \/>[\s\S]*<\/AdaptivePopover>/);
    expect(pill).toMatch(/panelRef\.current\?\.contains\(t\)/);
  });

  it('站内跳转不整页刷新（整页刷新会把正在放的白噪音掐断）', () => {
    const files = [
      ...listTsx('app/dashboard'),
      ...listTsx('components'),
    ];
    expect(files.length).toBeGreaterThan(60); // 自证不是空转
    const bad: string[] = [];
    for (const f of files) {
      const src = readCode(f);
      for (const m of src.matchAll(/window\.location\.(?:href\s*=|assign\(|replace\()\s*['"`]\/(?!api\/)/g)) bad.push(`${f}: ${m[0]}`);
      for (const m of src.matchAll(/<a\b[^>]*\bhref=["'`{]+\/(?!api\/)/g)) bad.push(`${f}: ${m[0]}`);
    }
    expect(bad).toEqual([]);
  });

  it('首页面板：切换、播放暂停、定时、总音量都在', () => {
    const mixer = readCode('components/ambient/AmbientMixer.tsx');
    for (const k of ['next()', 'toggle()', 'setTimer(', 'setMaster(', 'setVolume(']) expect(mixer).toContain(k);
    expect(mixer).toMatch(/active\.length > 0 && \(\s*<label/);
    expect(readCode('components/dashboard/TodayBoard.tsx')).toContain('<AmbientMixer />');
  });
});
