"use client";

/**
 * 白噪音播放器：全后台只有一个。
 *
 * 放在模块里而不是组件里：用户开着雨声去写脚本，页面一跳组件就卸了，
 * 声音不能跟着断。模块在前端路由切换时不会重新加载，AudioContext 一直活着；
 * 首页的面板和顶栏的小条都只是它的遥控器。
 *
 * 不自动播放：浏览器本来也不许，而且开网页突然出声很吓人。
 * 记住上次的搭配和音量，点一下播放就回到那个状态。
 */

import { AMBIENT_SOUNDS, synthesize, type AmbientId } from "./synth";

export interface AmbientState {
  playing: boolean;
  /** 这次打开网页后放过没有：放过的，暂停了顶栏也留着小条，方便在别的页面接着放 */
  started: boolean;
  /** 选中的声音和各自音量（0~1） */
  mix: Partial<Record<AmbientId, number>>;
  master: number;
  /** 定时关闭的时间点（毫秒时间戳），没定时为 null */
  timerEnd: number | null;
  /** 定的是哪一档（分钟），界面据此切到下一档 */
  timerMinutes: number | null;
  /** 正在生成的声音（第一次打开要算一下） */
  loading: AmbientId[];
}

const PREF_KEY = "kaiwu:ambient";
/**
 * 默认音量偏小：白噪音是背景，盖过说话、盖过视频声就错了。
 * 用户要大声自己往上拉，比一点开就被吓一跳好。
 */
export const DEFAULT_VOLUME = 0.35;
export const DEFAULT_MASTER = 0.4;
const FADE = 0.8;

let state: AmbientState = {
  playing: false, started: false, mix: {}, master: DEFAULT_MASTER, timerEnd: null, timerMinutes: null, loading: [],
};
const listeners = new Set<() => void>();
let restored = false;

function emit(next: Partial<AmbientState>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
  if (next.mix !== undefined || next.master !== undefined) {
    try {
      localStorage.setItem(PREF_KEY, JSON.stringify({ mix: state.mix, master: state.master }));
    } catch {}
  }
}

/** 第一次有人来看状态时，把上次的搭配读回来（只读搭配，不播放） */
function restore() {
  if (restored || typeof window === "undefined") return;
  restored = true;
  try {
    const saved = JSON.parse(localStorage.getItem(PREF_KEY) || "null");
    if (saved && typeof saved === "object") {
      const mix: AmbientState["mix"] = {};
      for (const s of AMBIENT_SOUNDS) {
        const v = saved.mix?.[s.id];
        if (typeof v === "number" && v >= 0 && v <= 1) mix[s.id] = v;
      }
      const master = typeof saved.master === "number" && saved.master >= 0 && saved.master <= 1 ? saved.master : state.master;
      state = { ...state, mix, master };
    }
  } catch {}
}

export function subscribe(fn: () => void) {
  restore();
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getState() {
  restore();
  return state;
}

const SERVER_STATE = state;
export function getServerState() {
  return SERVER_STATE;
}

/* ---------------- 音频 ---------------- */

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
const buffers = new Map<AmbientId, AudioBuffer>();
const voices = new Map<AmbientId, { src: AudioBufferSourceNode; gain: GainNode }>();
let timer: number | null = null;

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    ctx = new AC();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0;
    masterGain.connect(ctx.destination);
  }
  return { ctx, master: masterGain! };
}

async function bufferFor(id: AmbientId): Promise<AudioBuffer> {
  const cached = buffers.get(id);
  if (cached) return cached;
  emit({ loading: [...state.loading, id] });
  // 让"加载中"先画出来，再开始算（算一次一两百毫秒）
  await new Promise((r) => setTimeout(r, 16));
  const { ctx } = audio();
  const s = synthesize(id);
  const buf = ctx.createBuffer(2, s.left.length, s.sampleRate);
  buf.copyToChannel(s.left as Float32Array<ArrayBuffer>, 0);
  buf.copyToChannel(s.right as Float32Array<ArrayBuffer>, 1);
  buffers.set(id, buf);
  emit({ loading: state.loading.filter((x) => x !== id) });
  return buf;
}

function ramp(param: AudioParam, to: number, seconds = FADE) {
  const { ctx } = audio();
  const now = ctx.currentTime;
  param.cancelScheduledValues(now);
  param.setValueAtTime(param.value, now);
  param.linearRampToValueAtTime(to, now + seconds);
}

async function startVoice(id: AmbientId) {
  if (voices.has(id)) return;
  const buf = await bufferFor(id);
  // 算完之前用户可能已经把它关了
  if (state.mix[id] === undefined || voices.has(id)) return;
  const { ctx, master } = audio();
  const gain = ctx.createGain();
  gain.gain.value = 0;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  src.connect(gain).connect(master);
  // 从随机位置开始，同一种声音每次听起来不完全一样
  src.start(0, Math.random() * buf.duration);
  voices.set(id, { src, gain });
  ramp(gain.gain, state.mix[id] ?? DEFAULT_VOLUME);
}

function stopVoice(id: AmbientId) {
  const v = voices.get(id);
  if (!v) return;
  voices.delete(id);
  ramp(v.gain.gain, 0);
  window.setTimeout(() => {
    try {
      v.src.stop();
      v.src.disconnect();
      v.gain.disconnect();
    } catch {}
  }, FADE * 1000 + 50);
}

/* ---------------- 对外的操作 ---------------- */

export async function play() {
  const ids = Object.keys(state.mix) as AmbientId[];
  if (ids.length === 0) {
    // 什么都没选就点播放：给一个最常用的
    emit({ mix: { rain: DEFAULT_VOLUME } });
  }
  const { ctx, master } = audio();
  if (ctx.state === "suspended") await ctx.resume();
  emit({ playing: true, started: true });
  ramp(master.gain, state.master);
  await Promise.all((Object.keys(state.mix) as AmbientId[]).map(startVoice));
}

export function pause() {
  if (!ctx || !masterGain) return emit({ playing: false });
  ramp(masterGain.gain, 0, 0.5);
  clearTimer();
  emit({ playing: false });
  window.setTimeout(() => {
    // 淡出期间又点了播放，就别停
    if (!state.playing) {
      for (const id of [...voices.keys()]) stopVoice(id);
    }
  }, 550);
}

export function toggle() {
  return state.playing ? pause() : play();
}

/** 点一个声音：没选就加上（顺便开始播放），选了就去掉 */
export async function toggleSound(id: AmbientId) {
  const mix = { ...state.mix };
  if (mix[id] !== undefined) {
    delete mix[id];
    emit({ mix });
    stopVoice(id);
    if (Object.keys(mix).length === 0) pause();
    return;
  }
  mix[id] = DEFAULT_VOLUME;
  emit({ mix });
  if (state.playing) await startVoice(id);
  else await play();
}

/**
 * 切换：换成下一种声音（按面板上的顺序，到头回到第一个）。
 * 叠了好几种时，从第一种往后换，换完只剩这一种——"切换"就是想换个听，不是再加一种。
 * 音量沿用刚才那种的，不会一换就忽大忽小。
 */
export async function next() {
  const active = AMBIENT_SOUNDS.filter((x) => state.mix[x.id] !== undefined);
  const from = active[0]?.id;
  const i = from ? AMBIENT_SOUNDS.findIndex((x) => x.id === from) : -1;
  const to = AMBIENT_SOUNDS[(i + 1) % AMBIENT_SOUNDS.length].id;
  const volume = from ? state.mix[from] ?? DEFAULT_VOLUME : DEFAULT_VOLUME;
  for (const x of active) if (x.id !== to) stopVoice(x.id);
  emit({ mix: { [to]: volume } });
  // 要换到的那种本来就在放（叠着的第二种），把它的音量对齐
  const already = voices.get(to);
  if (already) ramp(already.gain.gain, volume, 0.3);
  if (state.playing) await startVoice(to);
  else await play();
}

export function setVolume(id: AmbientId, v: number) {
  if (state.mix[id] === undefined) return;
  emit({ mix: { ...state.mix, [id]: v } });
  const voice = voices.get(id);
  if (voice) ramp(voice.gain.gain, v, 0.1);
}

export function setMaster(v: number) {
  emit({ master: v });
  if (masterGain && state.playing) ramp(masterGain.gain, v, 0.1);
}

function clearTimer() {
  if (timer !== null) window.clearTimeout(timer);
  timer = null;
  if (state.timerEnd !== null) emit({ timerEnd: null, timerMinutes: null });
}

/** 定时关闭：到点淡出停止。传 null 取消 */
export function setTimer(minutes: number | null) {
  clearTimer();
  if (!minutes) return;
  const end = Date.now() + minutes * 60_000;
  emit({ timerEnd: end, timerMinutes: minutes });
  timer = window.setTimeout(() => {
    timer = null;
    emit({ timerEnd: null, timerMinutes: null });
    pause();
  }, minutes * 60_000);
  if (!state.playing) play();
}
