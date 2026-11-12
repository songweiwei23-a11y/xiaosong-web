/**
 * 监控大屏的提示音（Web Audio 现场合成，不引音频文件）。
 *
 * 【2026-10-02 产品方】原来的提示音太小、太"电子"：单个正弦波 0.05 的音量，
 * 隔着房间根本听不见。要的是"类似 QQ 上线那种感觉"——清脆、圆润、一听就知道来人了。
 *
 * 做法：
 * - 音色用"钟琴"：基频 + 2 倍、3 倍泛音，起音快、尾巴自然衰减，听着像"叮"而不是"哔"
 * - 整体推响：每个音峰值 0.6，再过一道压缩器——响度上去了，但多个音叠在一起也不会爆音
 * - 三级区别要大：使用 = 轻快"嘀嘟"；新用户 = "叮咚"上线；付款/凭证 = 上行四连音响两遍
 */

export type SoundKind = 'ping' | 'chime' | 'alert';

export interface ToneNote {
  /** 相对开始的秒数 */
  at: number;
  freq: number;
  /** 衰减到几乎无声用多久（秒） */
  decay: number;
  /** 峰值音量（0~1，压缩器之前） */
  peak: number;
  /** 起音时从多高的音滑上来（制造"嘟"的弹性感）；不写就不滑 */
  glideFrom?: number;
}

/** 泛音配比：[倍数, 相对音量]。只用整数倍，听起来是"叮"不是"咣" */
export const BELL_PARTIALS: [number, number][] = [[1, 1], [2, 0.35], [3, 0.12]];

export const SOUND_SPECS: Record<SoundKind, ToneNote[]> = {
  // 有人在用：两声短促上扬，像收到消息的"嘀嘟"
  ping: [
    { at: 0, freq: 1175, decay: 0.18, peak: 0.45, glideFrom: 900 },
    { at: 0.11, freq: 1568, decay: 0.22, peak: 0.45, glideFrom: 1200 },
  ],
  // 新用户注册：上线的"叮咚"，先高后低，尾音拖长
  chime: [
    { at: 0, freq: 1319, decay: 0.55, peak: 0.6 },
    { at: 0.2, freq: 1047, decay: 0.85, peak: 0.6 },
  ],
  // 付款 / 上传凭证：上行四连音，响两遍，最响也最不一样——隔着房间也知道"有人付钱了"
  alert: [0, 0.75].flatMap((offset) =>
    [1047, 1319, 1568, 2093].map((freq, i) => ({ at: offset + i * 0.11, freq, decay: i === 3 ? 0.7 : 0.3, peak: 0.6 })),
  ),
};

export const DEFAULT_VOLUME = 0.9;

/** 把一种提示音排进 AudioContext。out 是总音量节点（已经接好压缩器和扬声器） */
export function scheduleSound(ctx: BaseAudioContext, out: AudioNode, kind: SoundKind): void {
  const start = ctx.currentTime + 0.01;
  for (const n of SOUND_SPECS[kind]) {
    const t0 = start + n.at;
    for (const [mult, rel] of BELL_PARTIALS) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime((n.glideFrom ?? n.freq) * mult, t0);
      if (n.glideFrom) osc.frequency.exponentialRampToValueAtTime(n.freq * mult, t0 + 0.04);
      // 高次泛音衰减得更快，尾音才干净
      const decay = n.decay / mult ** 0.5;
      // 直接切断会有"咔哒"声：5ms 起音，指数衰减
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(n.peak * rel, t0 + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + decay);
      osc.connect(gain).connect(out);
      osc.start(t0);
      osc.stop(t0 + decay + 0.05);
    }
  }
}

/** 总音量 → 压缩器 → 扬声器。返回总音量节点，调音量改它的 gain */
export function createOutput(ctx: AudioContext, volume: number): GainNode {
  const master = ctx.createGain();
  master.gain.value = volume;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -12;
  comp.knee.value = 6;
  comp.ratio.value = 8;
  comp.attack.value = 0.002;
  comp.release.value = 0.15;
  master.connect(comp).connect(ctx.destination);
  return master;
}
