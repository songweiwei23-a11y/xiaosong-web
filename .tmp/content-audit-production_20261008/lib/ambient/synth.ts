/**
 * 白噪音：全部在浏览器里实时合成，不下载任何录音。
 *
 * 【为什么合成而不是放录音】没有版权问题、不占流量、打开就有；
 * 雨、火、浪这类声音本质上就是"滤过的噪声 + 随机的小事件"，合成出来足够像。
 *
 * 每种声音生成一段 N 秒的立体声，首尾交叉淡化，循环播放听不出接缝。
 * 这里只做纯计算（给一个采样率和随机种子，吐出两个声道的采样），
 * 不碰浏览器 API——所以能在测试里验证：没有坏值、响度合适、循环处是连着的。
 */

export type AmbientId = 'rain' | 'cafe' | 'fire' | 'pages' | 'waves' | 'brown';

export interface AmbientSound {
  id: AmbientId;
  name: string;
  hint: string;
}

export const AMBIENT_SOUNDS: AmbientSound[] = [
  { id: 'rain', name: '雨声', hint: '窗外下着中雨' },
  { id: 'cafe', name: '咖啡馆', hint: '远处有人低声聊天，偶尔碰一下杯子' },
  { id: 'fire', name: '篝火', hint: '木柴噼啪作响' },
  { id: 'pages', name: '翻书', hint: '安静的书房，隔一会儿翻一页' },
  { id: 'waves', name: '海浪', hint: '浪一波一波涌上来又退回去' },
  { id: 'brown', name: '专注', hint: '低沉平稳的棕噪音，盖住周围的杂音' },
];

/** 合成用的采样率。环境声不需要 44.1k：最高的频率成分在 8kHz 以下，24k 足够，内存和计算都省一半 */
export const SYNTH_RATE = 24000;

export interface StereoBuffer {
  left: Float32Array;
  right: Float32Array;
  sampleRate: number;
}

/* ---------------- 基础部件 ---------------- */

/** 可复现的随机数（mulberry32）：同一个种子出同一段声音，测试才稳定 */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rand = () => number;

/** RBJ 双二阶滤波器 */
class Biquad {
  private b0 = 1; private b1 = 0; private b2 = 0; private a1 = 0; private a2 = 0;
  private x1 = 0; private x2 = 0; private y1 = 0; private y2 = 0;
  constructor(private fs: number, type: 'lp' | 'hp' | 'bp', f: number, q = 0.707) {
    this.set(type, f, q);
  }
  set(type: 'lp' | 'hp' | 'bp', f: number, q = 0.707) {
    const w0 = (2 * Math.PI * Math.min(f, this.fs * 0.45)) / this.fs;
    const cos = Math.cos(w0);
    const alpha = Math.sin(w0) / (2 * q);
    const a0 = 1 + alpha;
    let b0: number, b1: number, b2: number;
    if (type === 'lp') { b0 = (1 - cos) / 2; b1 = 1 - cos; b2 = (1 - cos) / 2; }
    else if (type === 'hp') { b0 = (1 + cos) / 2; b1 = -(1 + cos); b2 = (1 + cos) / 2; }
    else { b0 = alpha; b1 = 0; b2 = -alpha; }
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0;
    this.a1 = (-2 * cos) / a0; this.a2 = (1 - alpha) / a0;
  }
  run(x: number) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

/** 粉噪声（Paul Kellet）：比白噪声柔和，像雨幕、像风 */
function pinkSource(r: Rand) {
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  return () => {
    const w = r() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856;
    b4 = 0.55 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.016898;
    const out = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362;
    b6 = w * 0.115926;
    return out * 0.11;
  };
}

/** 棕噪声：更低沉，像远处的轰鸣、火焰的呼呼声 */
function brownSource(r: Rand) {
  let last = 0;
  return () => {
    last = (last + 0.02 * (r() * 2 - 1)) / 1.02;
    return last * 3.5;
  };
}

/** 慢慢起伏的随机量（0~1），用来让雨时大时小、火苗忽高忽低 */
function slowWander(r: Rand, fs: number, hz: number) {
  const f = new Biquad(fs, 'lp', hz, 0.5);
  // 先跑一段让滤波器稳定下来
  for (let i = 0; i < fs; i++) f.run(r() * 2 - 1);
  return () => Math.max(0, Math.min(1, 0.5 + f.run(r() * 2 - 1) * 6));
}

/** 往两个声道里叠一个短事件（雨滴、火星、碰杯） */
function addGrain(
  L: Float32Array, R: Float32Array, start: number, len: number,
  pan: number, gen: (i: number) => number,
) {
  const gl = Math.cos(pan * Math.PI / 2);
  const gr = Math.sin(pan * Math.PI / 2);
  const end = Math.min(L.length, start + len);
  for (let i = start, k = 0; i < end; i++, k++) {
    const s = gen(k);
    L[i] += s * gl;
    R[i] += s * gr;
  }
}

/** 首尾交叉淡化：多生成 F 个采样，把尾巴叠到开头，循环起来听不出接缝 */
function makeLoop(L: Float32Array, R: Float32Array, n: number, f: number): [Float32Array, Float32Array] {
  const outL = L.slice(0, n);
  const outR = R.slice(0, n);
  for (let i = 0; i < f; i++) {
    // 等功率交叉：噪声类的声音用线性交叉会在中间凹下去一块
    const a = Math.sin((i / f) * Math.PI / 2);
    const b = Math.cos((i / f) * Math.PI / 2);
    outL[i] = L[i] * a + L[n + i] * b;
    outR[i] = R[i] * a + R[n + i] * b;
  }
  return [outL, outR];
}

/** 调到目标响度，再用 tanh 软限幅兜住偶尔的尖峰 */
function finish(L: Float32Array, R: Float32Array, targetRms: number) {
  let sum = 0;
  for (let i = 0; i < L.length; i++) sum += L[i] * L[i] + R[i] * R[i];
  const rms = Math.sqrt(sum / (2 * L.length)) || 1;
  const k = targetRms / rms;
  for (let i = 0; i < L.length; i++) {
    L[i] = Math.tanh(L[i] * k);
    R[i] = Math.tanh(R[i] * k);
  }
}

function alloc(fs: number, seconds: number, fade: number) {
  const n = Math.round(fs * seconds);
  const f = Math.round(fs * fade);
  return { n, f, L: new Float32Array(n + f), R: new Float32Array(n + f) };
}

/* ---------------- 六种声音 ---------------- */

function rain(fs: number, r: Rand): [Float32Array, Float32Array] {
  const { n, f, L, R } = alloc(fs, 20, 1.5);
  const T = L.length;
  // 雨幕：两个声道各一路粉噪声，去掉低频的闷和高频的刺，强度慢慢起伏
  for (const [ch, seed] of [[L, 1], [R, 2]] as const) {
    const src = pinkSource(rng(Math.floor(r() * 1e9) + seed));
    const hp = new Biquad(fs, 'hp', 450);
    const lp = new Biquad(fs, 'lp', 6500);
    const swell = slowWander(r, fs, 0.15);
    for (let i = 0; i < T; i++) ch[i] += lp.run(hp.run(src())) * 0.9 * (0.75 + 0.35 * swell());
  }
  // 雨滴：每秒几十个，短促、高频、左右随机
  const drops = Math.round((T / fs) * 75);
  for (let d = 0; d < drops; d++) {
    const len = Math.round(fs * (0.003 + r() * 0.009));
    const bp = new Biquad(fs, 'bp', 1800 + r() * 4200, 1.2 + r() * 3);
    const amp = 0.05 + Math.pow(r(), 3) * 0.4;
    addGrain(L, R, Math.floor(r() * T), len, r(), (k) => bp.run(r() * 2 - 1) * amp * Math.exp(-k / (len * 0.25)));
  }
  // 落在屋檐上的重雨滴：低一些、慢一些
  const heavy = Math.round((T / fs) * 4);
  for (let d = 0; d < heavy; d++) {
    const len = Math.round(fs * (0.02 + r() * 0.025));
    const bp = new Biquad(fs, 'bp', 450 + r() * 650, 2);
    const amp = 0.1 + r() * 0.25;
    addGrain(L, R, Math.floor(r() * T), len, 0.2 + r() * 0.6, (k) => bp.run(r() * 2 - 1) * amp * Math.exp(-k / (len * 0.3)));
  }
  return makeLoop(L, R, n, f);
}

function fire(fs: number, r: Rand): [Float32Array, Float32Array] {
  const { n, f, L, R } = alloc(fs, 20, 1.5);
  const T = L.length;
  // 火焰的呼呼声：棕噪声压低，忽高忽低
  for (const ch of [L, R]) {
    const src = brownSource(rng(Math.floor(r() * 1e9)));
    const lp = new Biquad(fs, 'lp', 320);
    const flutter = slowWander(r, fs, 1.2);
    const hissSrc = pinkSource(rng(Math.floor(r() * 1e9)));
    const hiss = new Biquad(fs, 'bp', 2600, 0.7);
    const hissAmt = slowWander(r, fs, 0.6);
    for (let i = 0; i < T; i++) {
      ch[i] += lp.run(src()) * 0.55 * (0.55 + 0.45 * flutter());
      ch[i] += hiss.run(hissSrc()) * 0.06 * hissAmt();
    }
  }
  // 噼啪声：一簇一簇地出现，每簇几下
  const clusters = Math.round((T / fs) * 2.6);
  for (let c = 0; c < clusters; c++) {
    const at = Math.floor(r() * T);
    const count = 1 + Math.floor(Math.pow(r(), 2) * 6);
    for (let k = 0; k < count; k++) {
      const len = Math.round(fs * (0.0006 + r() * 0.0025));
      const bp = new Biquad(fs, 'bp', 1500 + r() * 5500, 0.8);
      const amp = 0.25 + Math.pow(r(), 2) * 0.9;
      addGrain(L, R, at + Math.floor(r() * fs * 0.15), len, r(), (i) => bp.run(r() * 2 - 1) * amp * Math.exp(-i / (len * 0.3)));
    }
  }
  // 偶尔一声"啪"：木柴裂开
  const pops = Math.round((T / fs) * 0.45);
  for (let p = 0; p < pops; p++) {
    const len = Math.round(fs * (0.015 + r() * 0.015));
    const bp = new Biquad(fs, 'bp', 700 + r() * 700, 1.5);
    addGrain(L, R, Math.floor(r() * T), len, 0.3 + r() * 0.4, (i) => bp.run(r() * 2 - 1) * 0.45 * Math.exp(-i / (len * 0.2)));
  }
  return makeLoop(L, R, n, f);
}

function pages(fs: number, r: Rand): [Float32Array, Float32Array] {
  const { n, f, L, R } = alloc(fs, 30, 1.5);
  const T = L.length;
  // 安静的房间：很低的底噪，让"静"有质感而不是一片死寂
  for (const ch of [L, R]) {
    const b = brownSource(rng(Math.floor(r() * 1e9)));
    const p = pinkSource(rng(Math.floor(r() * 1e9)));
    const lpB = new Biquad(fs, 'lp', 220);
    const lpP = new Biquad(fs, 'lp', 1400);
    for (let i = 0; i < T; i++) ch[i] += lpB.run(b()) * 0.05 + lpP.run(p()) * 0.012;
  }
  // 翻页：沙沙声（频率从低扫到高、强弱不规则）+ 最后纸落下的一下闷响
  let t = fs * (1 + r() * 2);
  while (t < n - fs) {
    const D = Math.round(fs * (0.45 + r() * 0.35));
    const bumps = Array.from({ length: 3 }, () => ({ c: r() * 0.8 + 0.1, w: 0.05 + r() * 0.12, a: 0.4 + r() * 0.6 }));
    const bp = new Biquad(fs, 'bp', 1200, 0.9);
    const pan = 0.4 + r() * 0.2;
    const start = Math.floor(t);
    addGrain(L, R, start, D, pan, (k) => {
      const x = k / D;
      if (k % 32 === 0) bp.set('bp', 1200 + 2400 * x, 0.9);
      let env = 0;
      for (const b of bumps) env += b.a * Math.exp(-((x - b.c) ** 2) / (2 * b.w * b.w));
      // 几下沙沙声挨得近时会叠成一个尖峰；封个顶，整体调响时才不会顶到头
      env = Math.min(env, 1);
      // 纸面的细碎颗粒感。原来是 1.6 倍：整体调响之后这几下尖刺会顶到头、被限幅压得发毛
      const crinkle = r() < 0.04 ? 1.25 : 1;
      return bp.run(r() * 2 - 1) * env * crinkle * 0.5;
    });
    const thumpLen = Math.round(fs * 0.08);
    const lp = new Biquad(fs, 'lp', 260);
    addGrain(L, R, start + D - Math.round(fs * 0.04), thumpLen, pan, (k) => lp.run(r() * 2 - 1) * 0.3 * Math.exp(-k / (thumpLen * 0.25)));
    t += fs * (7 + r() * 5);
  }
  return makeLoop(L, R, n, f);
}

function cafe(fs: number, r: Rand): [Float32Array, Float32Array] {
  const { n, f, L, R } = alloc(fs, 24, 1.5);
  const T = L.length;
  // 房间：空调和冰箱的低嗡
  for (const ch of [L, R]) {
    const b = brownSource(rng(Math.floor(r() * 1e9)));
    const p = pinkSource(rng(Math.floor(r() * 1e9)));
    const lpB = new Biquad(fs, 'lp', 260);
    const lpP = new Biquad(fs, 'lp', 900);
    for (let i = 0; i < T; i++) ch[i] += lpB.run(b()) * 0.12 + lpP.run(p()) * 0.04;
  }
  // 人声嘈杂：8 个远处的"人"，带音高的嗓音过元音共鸣，一句一句地说、中间停顿
  const babbleL = new Float32Array(T);
  const babbleR = new Float32Array(T);
  for (let v = 0; v < 8; v++) {
    const pan = 0.15 + r() * 0.7;
    const gl = Math.cos(pan * Math.PI / 2);
    const gr = Math.sin(pan * Math.PI / 2);
    const loud = 0.35 + r() * 0.65;
    const f0Base = r() < 0.5 ? 100 + r() * 40 : 180 + r() * 60;
    const f1 = new Biquad(fs, 'bp', 600, 5);
    const f2 = new Biquad(fs, 'bp', 1500, 6);
    let phase = 0;
    let i = Math.floor(r() * fs * 2);
    while (i < T) {
      const syllables = 4 + Math.floor(r() * 9);
      for (let s = 0; s < syllables && i < T; s++) {
        const len = Math.round(fs * (0.11 + r() * 0.15));
        f1.set('bp', 350 + r() * 500, 5);
        f2.set('bp', 900 + r() * 1400, 6);
        const f0 = f0Base * (0.9 + r() * 0.25);
        for (let k = 0; k < len && i < T; k++, i++) {
          phase += f0 / fs;
          let ex = (r() * 2 - 1) * 0.15;
          if (phase >= 1) { phase -= 1; ex += 1; }
          const env = Math.sin((k / len) * Math.PI) ** 1.5;
          const s2 = (f1.run(ex) + f2.run(ex) * 0.6) * env * loud;
          babbleL[i] += s2 * gl;
          babbleR[i] += s2 * gr;
        }
      }
      i += Math.round(fs * (0.3 + r() * 1.6));
    }
  }
  // 闷一点、糊一点：远处的声音听不清字，才像背景而不是有人在耳边说话
  for (const [src, ch] of [[babbleL, L], [babbleR, R]] as const) {
    const lp = new Biquad(fs, 'lp', 2400, 0.6);
    const d1 = Math.round(fs * 0.023), d2 = Math.round(fs * 0.041), d3 = Math.round(fs * 0.067);
    for (let i = 0; i < T; i++) {
      const wet = src[i] + (i >= d1 ? src[i - d1] * 0.45 : 0) + (i >= d2 ? src[i - d2] * 0.3 : 0) + (i >= d3 ? src[i - d3] * 0.2 : 0);
      ch[i] += lp.run(wet) * 0.5;
    }
  }
  // 勺子碰杯：几个不成倍数的泛音，清脆地衰减
  const clinks = Math.round((T / fs) * 0.35);
  for (let c = 0; c < clinks; c++) {
    const base = 1900 + r() * 900;
    const amp = 0.05 + r() * 0.08;
    const len = Math.round(fs * 0.45);
    const pan = r();
    const at = Math.floor(r() * T);
    const tone = (k: number) =>
      (Math.sin((2 * Math.PI * base * k) / fs) * Math.exp(-k / (fs * 0.12)) +
        0.6 * Math.sin((2 * Math.PI * base * 2.76 * k) / fs) * Math.exp(-k / (fs * 0.07)) +
        0.3 * Math.sin((2 * Math.PI * base * 5.4 * k) / fs) * Math.exp(-k / (fs * 0.04))) * amp;
    addGrain(L, R, at, len, pan, tone);
    if (r() < 0.35) addGrain(L, R, at + Math.round(fs * (0.08 + r() * 0.07)), len, pan, (k) => tone(k) * 0.7);
  }
  // 放杯子、挪椅子的轻响
  const thunks = Math.round((T / fs) * 0.15);
  for (let c = 0; c < thunks; c++) {
    const len = Math.round(fs * 0.05);
    const lp = new Biquad(fs, 'lp', 350);
    addGrain(L, R, Math.floor(r() * T), len, r(), (k) => lp.run(r() * 2 - 1) * 0.5 * Math.exp(-k / (len * 0.3)));
  }
  return makeLoop(L, R, n, f);
}

function waves(fs: number, r: Rand): [Float32Array, Float32Array] {
  const { n, f, L, R } = alloc(fs, 36, 2);
  const T = L.length;
  // 先排好每一波浪的起点和长度
  const starts: { at: number; len: number; peak: number }[] = [];
  let t = 0;
  while (t < T) {
    const len = Math.round(fs * (8 + r() * 4));
    starts.push({ at: t, len, peak: 0.7 + r() * 0.3 });
    t += len;
  }
  const envAt = (i: number) => {
    const w = starts.find((s) => i >= s.at && i < s.at + s.len) ?? starts[starts.length - 1];
    const x = (i - w.at) / w.len;
    // 涌起（前 35%，缓慢加速）→ 拍下 → 长长地退去
    const rise = x < 0.35 ? Math.pow(x / 0.35, 2.2) : Math.exp(-(x - 0.35) * 4.5);
    return rise * w.peak;
  };
  for (const [ch, offset] of [[L, 0], [R, Math.round(fs * 0.12)]] as const) {
    const src = pinkSource(rng(Math.floor(r() * 1e9)));
    const lp = new Biquad(fs, 'lp', 400);
    const foamSrc = pinkSource(rng(Math.floor(r() * 1e9)));
    const foam = new Biquad(fs, 'hp', 2500);
    let env = 0;
    for (let i = 0; i < T; i++) {
      if (i % 64 === 0) {
        env = envAt(Math.max(0, i - offset));
        lp.set('lp', 250 + 2600 * Math.pow(env, 1.5), 0.7);
      }
      ch[i] += lp.run(src()) * (0.12 + 0.9 * env);
      // 浪退时的泡沫嘶嘶声
      ch[i] += foam.run(foamSrc()) * 0.25 * env * env;
    }
  }
  return makeLoop(L, R, n, f);
}

function brown(fs: number, r: Rand): [Float32Array, Float32Array] {
  const { n, f, L, R } = alloc(fs, 12, 1.5);
  for (const ch of [L, R]) {
    const src = brownSource(rng(Math.floor(r() * 1e9)));
    const lp = new Biquad(fs, 'lp', 900);
    for (let i = 0; i < ch.length; i++) ch[i] = lp.run(src());
  }
  return makeLoop(L, R, n, f);
}

/**
 * 各声音的目标响度（整段的平均）。
 *
 * 翻书原来是 0.035，想着它和雨声叠着放时不要抢。可单独放翻书的人一听就是"声音变小了"——
 * 它是稀疏的声音：大部分时间是安静房间，隔几秒翻一页；按整段平均定响度，平均被静音段拉低，
 * 真正翻页那一下也跟着被压小了。现在抬到和其它几种接近，单放时不再忽大忽小；
 * 叠着放嫌它抢，各自的音量滑块可以单独往下拉。
 */
const LOUDNESS: Record<AmbientId, number> = {
  rain: 0.12, cafe: 0.1, fire: 0.11, pages: 0.065, waves: 0.12, brown: 0.12,
};

const GENERATORS: Record<AmbientId, (fs: number, r: Rand) => [Float32Array, Float32Array]> = {
  rain, cafe, fire, pages, waves, brown,
};

export function synthesize(id: AmbientId, seed = 7, sampleRate = SYNTH_RATE): StereoBuffer {
  const [left, right] = GENERATORS[id](sampleRate, rng(seed));
  finish(left, right, LOUDNESS[id]);
  return { left, right, sampleRate };
}
