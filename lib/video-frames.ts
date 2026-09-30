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
/** 拼图：每张几行、最多几张 */
export const SHEET_ROWS = 3;
export const MAX_SHEETS = 6;

/**
 * 拼图的格子多大。竖屏 4 列、每格 384 宽；横屏 3 列、每格 512 宽。
 *
 * 实测横屏样片按 4 列拼，每格太小，字幕看不清，模型就开始猜：
 * 墙上的「我是河南人」被看成墓碑、「当服务员」被读成「当厨房门」。
 * 横屏画面本来就扁，同样的宽度里字更小，得给大一点。
 */
export function sheetLayout(width: number, height: number): { cols: number; cellW: number; perSheet: number; maxFrames: number } {
  const landscape = width > height;
  const cols = landscape ? 3 : 4;
  return { cols, cellW: landscape ? 512 : 384, perSheet: cols * SHEET_ROWS, maxFrames: cols * SHEET_ROWS * MAX_SHEETS };
}
/** 竖屏时最多能放多少张（给没有视频尺寸时兜底用） */
export const MAX_FRAMES = 4 * SHEET_ROWS * MAX_SHEETS;

/**
 * 所有拼图加起来最多多大（JPEG 原始字节）。
 *
 * 线上实测：Dify 云端调一次模型，请求体上限 5MB（ServerlessPayloadTooLarge: max_request_bytes=5242880），
 * 图片是 base64 塞进去的，要再胀三分之一。验证用的样片画面暗、压得小（5 张共 1.2MB），
 * 产品方拿一条明亮的餐饮视频一跑，5 张拼图 base64 后 8.2MB，直接被拒。
 *
 * 第二次还被拒（4 张、6.0MB）：「开物」工作流把同一批图发了两遍——视觉一遍、
 * 记忆模板里的 {{#sys.files#}} 又一遍（探针实测：2.8MB 的图 → 请求体 7.7MB）。
 * 模板已经改掉（scripts/dify-dsl-apply.cjs ⑦），但工作流是在 Dify 网页上改的，哪天重新导入、
 * 有人手动改回去，翻倍就又回来了。所以预算按"最坏被发两遍"来定：
 * 1.6MB × 4/3 × 2 ≈ 4.3MB，加上提示词和检索结果（实测约 0.3～0.4MB）仍在 5MB 以内。
 * 1.6MB 比验证时效果好的那一版（5 张共 1.2MB）还宽，画质不受影响。
 */
export const SHEETS_BYTE_BUDGET = Math.floor(1.6 * 1024 * 1024);

/** 每张拼图的字节上限：总预算平分 */
export function sheetByteBudget(sheetCount: number): number {
  return Math.floor(SHEETS_BYTE_BUDGET / Math.max(1, sheetCount));
}

/** 质量一档档往下试，还超就缩小画布再试。返回压到预算以内的 JPEG（实在压不下就给最小的那个） */
export async function encodeWithinBudget(canvas: HTMLCanvasElement, maxBytes: number): Promise<Blob> {
  const toBlob = (c: HTMLCanvasElement, q: number) => new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/jpeg', q));
  let src = canvas;
  let best: Blob | null = null;
  for (let round = 0; round < 3; round++) {
    for (const q of [0.82, 0.72, 0.62, 0.52]) {
      const b = await toBlob(src, q);
      if (!best || b.size < best.size) best = b;
      if (b.size <= maxBytes) return b;
    }
    // 缩到 85% 再来：字会变小，但总比被拒强
    const next = document.createElement('canvas');
    next.width = Math.round(src.width * 0.85);
    next.height = Math.round(src.height * 0.85);
    next.getContext('2d')!.drawImage(src, 0, 0, next.width, next.height);
    src = next;
  }
  return best!;
}

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
  /** 拆的这一段有多长（超过 3 分钟的只拆前 3 分钟） */
  duration: number;
  /** 视频本身多长 */
  fullDuration: number;
  /** 只拆了前面一段 */
  truncated: boolean;
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
 * 粗扫之后，哪些 0.5 秒的窗口值得细看：差值高于这条视频自己中位数的 1.5 倍、且不低于下限。
 * 这一步宁多勿漏——真假由 confirmCut 细看后判。
 *
 * 【为什么不直接按阈值切】第一版用"均值 + 2.5 倍标准差"一刀切，拿真实样片（采访 + 空镜穿插）一跑，
 * 一个"镜头"长达 72 秒：同一个紫色包间里换机位，和人说话时的动作，隔 0.5 秒看差值差不多大，
 * 阈值被大切换抬高后，这些机位切换全漏了。
 */
export function cutCandidates(diffs: { time: number; diff: number }[], floor = 6): { time: number; diff: number }[] {
  if (diffs.length === 0) return [];
  const sorted = diffs.map((d) => d.diff).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const threshold = Math.max(floor, median * 1.5);
  return diffs.filter((d) => d.diff >= threshold);
}

/**
 * 细看之后是不是真切：把 0.5 秒的窗口二分到 1/16 秒左右，
 * 切换是"一瞬间全变了"——变化几乎全集中在最后那一小段；
 * 人在动、镜头在摇是"一点一点变"——最后那一小段只占总变化的一小份。
 */
export function confirmCut(total: number, final: number, floor = 10): boolean {
  return final >= floor && final >= total * 0.55;
}

/** 切点去重：两个切点至少隔 minGap 秒（同一个转场前后被判两次） */
export function dedupeCuts(times: number[], minGap = 0.4): number[] {
  const out: number[] = [];
  for (const t of [...times].sort((a, b) => a - b)) {
    if (out.length && t - out[out.length - 1] < minGap) continue;
    out.push(t);
  }
  return out;
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
  return video;
}

/**
 * 拆哪一段：超过 3 分钟的只拆前 3 分钟。
 * 不整条拒掉——长视频的前 3 分钟正是决定留不留人的部分，拆这一段照样有用；
 * 再长，镜头多到拼图装不下，逐镜头表也没法看。
 */
export function analysisSpan(duration: number): { until: number; truncated: boolean } {
  return duration > MAX_DURATION_SEC + 1 ? { until: MAX_DURATION_SEC, truncated: true } : { until: duration, truncated: false };
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

/** 取当前画面的灰度缩略图 */
function thumbGrabber(video: HTMLVideoElement) {
  const canvas = document.createElement('canvas');
  canvas.width = THUMB_W;
  canvas.height = THUMB_H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  return async (t: number) => {
    await seek(video, t);
    ctx.drawImage(video, 0, 0, THUMB_W, THUMB_H);
    const d = ctx.getImageData(0, 0, THUMB_W, THUMB_H).data;
    const g = new Uint8ClampedArray(THUMB_W * THUMB_H);
    for (let i = 0; i < g.length; i++) g[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
    return g;
  };
}

/**
 * 找镜头切换（只看前 until 秒）：
 *   1. 粗扫：每 0.5 秒一张缩略图，算前后差值
 *   2. 挑出可疑窗口（cutCandidates）
 *   3. 每个窗口二分 3 次到 1/16 秒，变化集中在那一瞬间的才算切（confirmCut）
 */
export async function detectShots(video: HTMLVideoElement, until: number, onProgress?: (p: number) => void): Promise<Shot[]> {
  const grab = thumbGrabber(video);
  const diffs: { time: number; diff: number }[] = [];
  let prev: Uint8ClampedArray | null = null;
  const steps = Math.ceil(until / SCAN_STEP);
  for (let i = 0; i <= steps; i++) {
    const t = Math.min(i * SCAN_STEP, until - 0.05);
    const g = await grab(t);
    if (prev) diffs.push({ time: t, diff: frameDiff(prev, g) });
    prev = g;
    onProgress?.((i / steps) * 0.7);
  }

  const candidates = cutCandidates(diffs);
  const cuts: number[] = [];
  for (let k = 0; k < candidates.length; k++) {
    const c = candidates[k];
    let a = Math.max(0, c.time - SCAN_STEP);
    let b = c.time;
    let ga = await grab(a);
    let gb = await grab(b);
    const total = frameDiff(ga, gb);
    for (let i = 0; i < 3; i++) {
      const m = (a + b) / 2;
      const gm = await grab(m);
      if (frameDiff(ga, gm) >= frameDiff(gm, gb)) {
        b = m;
        gb = gm;
      } else {
        a = m;
        ga = gm;
      }
    }
    if (confirmCut(total, frameDiff(ga, gb))) cuts.push(+b.toFixed(2));
    onProgress?.(0.7 + ((k + 1) / candidates.length) * 0.3);
  }
  return shotsFromCuts(dedupeCuts(cuts), until);
}

/**
 * 已经做好的拼图再压一遍，压到总共 totalBudget 以内。
 * 兜底用：万一 Dify 还是嫌大（配置又被改回发两遍、提示词变长了），页面自动压小一半再试一次。
 */
export async function shrinkSheets(sheets: Blob[], totalBudget: number): Promise<Blob[]> {
  const per = Math.floor(totalBudget / Math.max(1, sheets.length));
  const out: Blob[] = [];
  for (const b of sheets) {
    if (b.size <= per) {
      out.push(b);
      continue;
    }
    const bmp = await createImageBitmap(b);
    const c = document.createElement('canvas');
    c.width = bmp.width;
    c.height = bmp.height;
    c.getContext('2d')!.drawImage(bmp, 0, 0);
    bmp.close();
    out.push(await encodeWithinBudget(c, per));
  }
  return out;
}

/** 按原比例截图，拼成带时间码的拼图（JPEG） */
export async function buildSheets(video: HTMLVideoElement, frames: KeyFrame[], shots: Shot[]): Promise<Blob[]> {
  const { cols, cellW, perSheet } = sheetLayout(video.videoWidth, video.videoHeight);
  const cellH = Math.round((cellW * video.videoHeight) / Math.max(1, video.videoWidth));
  const labelH = 34;
  const sheets: Blob[] = [];
  const sheetCount = Math.min(MAX_SHEETS, Math.ceil(frames.length / perSheet));
  const budget = sheetByteBudget(sheetCount);
  for (let s = 0; s * perSheet < frames.length && s < MAX_SHEETS; s++) {
    const chunk = frames.slice(s * perSheet, (s + 1) * perSheet);
    const rows = Math.ceil(chunk.length / cols);
    const canvas = document.createElement('canvas');
    canvas.width = cellW * cols;
    canvas.height = (cellH + labelH) * rows;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < chunk.length; i++) {
      const f = chunk[i];
      await seek(video, f.time);
      const x = (i % cols) * cellW;
      const y = Math.floor(i / cols) * (cellH + labelH);
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
    sheets.push(await encodeWithinBudget(canvas, budget));
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
    // 只渲染要拆的那一段（长视频只拆前 3 分钟，后面的不必转）
    const until = Math.min(decoded.duration, segs.length ? segs[segs.length - 1].end : decoded.duration);
    const off = new OfflineAudioContext(1, Math.ceil(until * rate), rate);
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
  const { until, truncated } = analysisSpan(video.duration);
  onStage?.('找镜头切换', 0);
  const shots = await detectShots(video, until, (p) => onStage?.('找镜头切换', p));
  const frames = pickFrames(shots, until, sheetLayout(video.videoWidth, video.videoHeight).maxFrames);
  onStage?.('截图拼图');
  const sheets = await buildSheets(video, frames, shots);
  return {
    video,
    input: {
      duration: until,
      fullDuration: video.duration,
      truncated,
      width: video.videoWidth,
      height: video.videoHeight,
      shots,
      frames,
      sheets,
    },
  };
}
