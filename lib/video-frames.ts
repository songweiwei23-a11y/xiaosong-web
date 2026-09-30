/**
 * 拆解爆款：在浏览器里把视频拆成「镜头 + 截图拼图 + 分段音频」。只在浏览器用。
 *
 * 【为什么在浏览器做】服务器 2 核 2G、没有 ffmpeg；视频动辄几十 MB，
 * 传上去再处理又慢又占服务器。浏览器自带解码：<video> 能逐帧取画面，
 * Web Audio 能把音轨解成 PCM——够用了，服务器一点不参与。
 *
 * 【为什么拼成拼图】模型每条消息最多收 6 张图（Dify 应用设置），
 * 一个镜头一张图不够发。拼成带时间码的拼图，一张 12 格，6 张能装 72 个画面，
 * 3 分钟以内的视频够用。时间码直接印在格子上，模型看图就知道是第几秒。
 */

export const MAX_DURATION_SEC = 180;
export const MAX_FILE_MB = 100;
/** 拼图：每张几列几行、最多几张 */
export const SHEET_COLS = 4;
export const SHEET_ROWS = 3;
export const MAX_SHEETS = 6;
export const MAX_FRAMES = SHEET_COLS * SHEET_ROWS * MAX_SHEETS;

/** 检测镜头切换时的取样间隔 */
const SCAN_STEP = 0.5;
/** 缩略图尺寸（只用来比较前后两帧差多少） */
const THUMB_W = 32;
const THUMB_H = 56;
/** 开头这几秒加密取帧：前 3 秒决定划不划走，要看得细 */
const OPENING_SEC = 3;
const OPENING_STEP = 0.5;

export interface Shot {
  /** 第几个镜头，从 1 开始 */
  no: number;
  start: number;
  end: number;
}

export interface KeyFrame {
  time: number;
  /** 属于第几个镜头 */
  shot: number;
  /** 开头加密取的帧 */
  opening: boolean;
}

export interface VideoBreakdownInput {
  duration: number;
  width: number;
  height: number;
  shots: Shot[];
  frames: KeyFrame[];
  /** JPEG 拼图 */
  sheets: Blob[];
}

export class VideoInputError extends Error {}

export function fmtTime(t: number): string {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${String(m).padStart(2, '0')}:${s.toFixed(1).padStart(4, '0')}`;
}

// ---------------------------------------------------------------- 纯计算（可单测）

/** 两张灰度缩略图差多少：平均绝对差，0～255 */
export function frameDiff(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]);
  return sum / a.length;
}

/**
 * 从相邻帧的差值里找镜头切换点。
 * 阈值自适应：差值明显高于这条视频自己的平常水平（均值 + 2.5 倍标准差）才算切，
 * 同时不低于一个绝对下限——口播视频人一直在动，固定阈值会切出一堆假镜头。
 * 两个切点至少隔 0.8 秒（快切会漏，但假切更伤：一个镜头被切成三截，结构全乱）。
 */
export function detectCuts(diffs: { time: number; diff: number }[], opts: { minGap?: number; floor?: number } = {}): number[] {
  const minGap = opts.minGap ?? 0.8;
  const floor = opts.floor ?? 18;
  if (diffs.length === 0) return [];
  const vals = diffs.map((d) => d.diff);
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const std = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length);
  const threshold = Math.max(floor, mean + 2.5 * std);
  const cuts: number[] = [];
  for (const d of diffs) {
    if (d.diff < threshold) continue;
    const last = cuts[cuts.length - 1];
    if (last !== undefined && d.time - last < minGap) continue;
    cuts.push(d.time);
  }
  return cuts;
}

export function shotsFromCuts(cuts: number[], duration: number): Shot[] {
  const bounds = [0, ...cuts.filter((c) => c > 0 && c < duration), duration];
  const shots: Shot[] = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    if (bounds[i + 1] - bounds[i] <= 0.05) continue;
    shots.push({ no: shots.length + 1, start: bounds[i], end: bounds[i + 1] });
  }
  return shots;
}

/**
 * 挑要截的画面：开头 3 秒每 0.5 秒一张；之后每个镜头一张（取镜头中间，避开转场）。
 * 镜头太多装不下时，按时长从短到长合并掉最短的——一闪而过的镜头信息最少。
 */
export function pickFrames(shots: Shot[], duration: number, max = MAX_FRAMES): KeyFrame[] {
  const shotAt = (t: number) => shots.find((s) => t >= s.start && t < s.end)?.no ?? shots[shots.length - 1]?.no ?? 1;
  const frames: KeyFrame[] = [];
  const opening = Math.min(OPENING_SEC, duration);
  for (let t = 0; t < opening - 0.01; t += OPENING_STEP) frames.push({ time: +t.toFixed(2), shot: shotAt(t), opening: true });

  let rest = shots.filter((s) => (s.start + s.end) / 2 >= opening);
  const budget = Math.max(0, max - frames.length);
  if (rest.length > budget) {
    const keep = new Set([...rest].sort((a, b) => b.end - b.start - (a.end - a.start)).slice(0, budget).map((s) => s.no));
    rest = rest.filter((s) => keep.has(s.no));
  }
  for (const s of rest) frames.push({ time: +((s.start + s.end) / 2).toFixed(2), shot: s.no, opening: false });
  return frames.sort((a, b) => a.time - b.time);
}

/**
 * 把音频按镜头边界切成段，每段 10～30 秒——太短语音识别容易断字，太长时间码太粗。
 * 返回每段的起止时间。
 */
export function audioSegments(shots: Shot[], duration: number, minLen = 10, maxLen = 30): { start: number; end: number }[] {
  const bounds = shots.map((s) => s.end).filter((t) => t < duration);
  const segs: { start: number; end: number }[] = [];
  let start = 0;
  for (const b of [...bounds, duration]) {
    const len = b - start;
    if (len >= minLen || b === duration) {
      // 超长的镜头（一镜到底的口播）按 maxLen 硬切
      let s = start;
      while (b - s > maxLen) {
        segs.push({ start: s, end: s + maxLen });
        s += maxLen;
      }
      if (b - s > 0.3) segs.push({ start: s, end: b });
      start = b;
    }
  }
  // 最后一段太短就并进前一段
  if (segs.length > 1 && segs[segs.length - 1].end - segs[segs.length - 1].start < 3) {
    const last = segs.pop()!;
    segs[segs.length - 1].end = last.end;
  }
  return segs;
}

/** PCM（单声道 Float32）→ 16 位 WAV */
export function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  v.setUint32(4, 36 + samples.length * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buf], { type: 'audio/wav' });
}

// ---------------------------------------------------------------- 浏览器里跑的

/** 打开视频文件，检查大小和时长 */
export async function openVideo(file: File): Promise<HTMLVideoElement> {
  if (file.size > MAX_FILE_MB * 1024 * 1024) throw new VideoInputError(`视频超过 ${MAX_FILE_MB}MB，请换一个小一点的`);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = URL.createObjectURL(file);
  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new VideoInputError('这个视频打不开：请用 mp4 格式（抖音"保存本地"下来的就是）'));
  });
  if (!Number.isFinite(video.duration) || video.duration <= 0) throw new VideoInputError('读不出视频时长，请换一个文件');
  if (video.duration > MAX_DURATION_SEC + 1) throw new VideoInputError(`视频有 ${Math.round(video.duration)} 秒，只支持 ${MAX_DURATION_SEC / 60} 分钟以内的`);
  return video;
}

function seek(video: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      video.removeEventListener('seeked', done);
      resolve();
    };
    video.addEventListener('seeked', done);
    video.currentTime = Math.min(t, Math.max(0, video.duration - 0.05));
  });
}

/** 逐 0.5 秒取灰度缩略图，算前后差值，找出镜头切换 */
export async function detectShots(video: HTMLVideoElement, onProgress?: (p: number) => void): Promise<Shot[]> {
  const canvas = document.createElement('canvas');
  canvas.width = THUMB_W;
  canvas.height = THUMB_H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const gray = () => {
    ctx.drawImage(video, 0, 0, THUMB_W, THUMB_H);
    const d = ctx.getImageData(0, 0, THUMB_W, THUMB_H).data;
    const g = new Uint8ClampedArray(THUMB_W * THUMB_H);
    for (let i = 0; i < g.length; i++) g[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
    return g;
  };
  const diffs: { time: number; diff: number }[] = [];
  let prev: Uint8ClampedArray | null = null;
  const steps = Math.ceil(video.duration / SCAN_STEP);
  for (let i = 0; i <= steps; i++) {
    const t = Math.min(i * SCAN_STEP, video.duration - 0.05);
    await seek(video, t);
    const g = gray();
    if (prev) diffs.push({ time: t, diff: frameDiff(prev, g) });
    prev = g;
    onProgress?.(i / steps);
  }
  return shotsFromCuts(detectCuts(diffs), video.duration);
}

/** 按原比例截图，拼成带时间码的拼图（JPEG） */
export async function buildSheets(video: HTMLVideoElement, frames: KeyFrame[], shots: Shot[]): Promise<Blob[]> {
  const cellW = 384;
  const cellH = Math.round((cellW * video.videoHeight) / Math.max(1, video.videoWidth));
  const labelH = 34;
  const perSheet = SHEET_COLS * SHEET_ROWS;
  const sheets: Blob[] = [];
  for (let s = 0; s * perSheet < frames.length && s < MAX_SHEETS; s++) {
    const chunk = frames.slice(s * perSheet, (s + 1) * perSheet);
    const rows = Math.ceil(chunk.length / SHEET_COLS);
    const canvas = document.createElement('canvas');
    canvas.width = cellW * SHEET_COLS;
    canvas.height = (cellH + labelH) * rows;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < chunk.length; i++) {
      const f = chunk[i];
      await seek(video, f.time);
      const x = (i % SHEET_COLS) * cellW;
      const y = Math.floor(i / SHEET_COLS) * (cellH + labelH);
      ctx.drawImage(video, x, y + labelH, cellW, cellH);
      const shot = shots.find((sh) => sh.no === f.shot);
      ctx.fillStyle = f.opening ? '#b45309' : '#1f2937';
      ctx.fillRect(x, y, cellW, labelH);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 20px sans-serif';
      ctx.textBaseline = 'middle';
      const range = shot ? `${fmtTime(shot.start)}-${fmtTime(shot.end)}` : '';
      ctx.fillText(`${fmtTime(f.time)}  镜头${f.shot}  ${range}`, x + 8, y + labelH / 2);
      // 格子之间留条缝，模型分得清
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 4;
      ctx.strokeRect(x, y, cellW, cellH + labelH);
    }
    sheets.push(await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), 'image/jpeg', 0.85)));
  }
  return sheets;
}

/**
 * 解出音轨、转成 16k 单声道，按段切成 WAV。
 * 解不出来（没有声音、编码不支持）返回空数组——口播可以让用户自己贴。
 */
export async function extractAudio(file: File, segs: { start: number; end: number }[]): Promise<{ start: number; end: number; wav: Blob }[]> {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    const decoded = await ctx.decodeAudioData(await file.arrayBuffer());
    await ctx.close();
    const rate = 16000;
    const off = new OfflineAudioContext(1, Math.ceil(decoded.duration * rate), rate);
    const src = off.createBufferSource();
    src.buffer = decoded;
    src.connect(off.destination);
    src.start();
    const mono = (await off.startRendering()).getChannelData(0);
    // 整段几乎没声音（纯画面配乐很小声也算有声，这里只挡住真没音轨的）
    let peak = 0;
    for (let i = 0; i < mono.length; i += 97) peak = Math.max(peak, Math.abs(mono[i]));
    if (peak < 0.01) return [];
    return segs.map((s) => ({ ...s, wav: encodeWav(mono.subarray(Math.floor(s.start * rate), Math.floor(s.end * rate)), rate) }));
  } catch {
    return [];
  }
}

/** 一条龙：打开 → 切镜头 → 挑帧 → 拼图 */
export async function prepareVideo(file: File, onStage?: (stage: string, p?: number) => void): Promise<{ input: VideoBreakdownInput; video: HTMLVideoElement }> {
  onStage?.('打开视频');
  const video = await openVideo(file);
  onStage?.('找镜头切换', 0);
  const shots = await detectShots(video, (p) => onStage?.('找镜头切换', p));
  const frames = pickFrames(shots, video.duration);
  onStage?.('截图拼图');
  const sheets = await buildSheets(video, frames, shots);
  return {
    video,
    input: { duration: video.duration, width: video.videoWidth, height: video.videoHeight, shots, frames, sheets },
  };
}
