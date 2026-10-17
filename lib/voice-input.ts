/**
 * 语音输入的纯函数（整改 C · 语音输入）。
 * 用浏览器自带的 Web Speech API（不花钱、不新增服务）。注意：Chrome 的识别要连 Google 的服务，网络不通时会失败，界面会提示。
 */

/** 浏览器里的识别构造函数；不支持（比如 Firefox、部分手机浏览器）返回 null */
export function speechRecognitionCtor(win: unknown): (new () => SpeechRecognitionLike) | null {
  const w = win as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike } | undefined;
  return w?.SpeechRecognition ?? w?.webkitSpeechRecognition ?? null;
}

/** 识别时只用到的几个字段（DOM 的类型不全，这里自己定义） */
export interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

/** 把听到的话接到原文后面。空白的不接；中文之间不加空格 */
export function appendTranscript(prev: string, spoken: string): string {
  const s = spoken.trim();
  if (!s) return prev;
  return prev ? prev + s : s;
}

/** 识别出错时给编导看的一句话（不把英文错误码直接甩给用户） */
export function voiceErrorMessage(code: string): string {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return '没有麦克风权限，请在浏览器地址栏旁边允许使用麦克风';
    case 'no-speech':
      return '没听到声音，再说一次';
    case 'audio-capture':
      return '没找到麦克风，检查一下设备';
    case 'network':
      return '语音识别连不上服务（Chrome 需要能访问 Google 的语音服务），这次没识别成，可以先打字';
    default:
      return '这次语音没识别成，可以再试一次，或者先打字';
  }
}
