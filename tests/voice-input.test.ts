import { describe, expect, it } from 'vitest';
import { appendTranscript, speechRecognitionCtor, voiceErrorMessage } from '@/lib/voice-input';

describe('语音输入（整改 C）', () => {
  it('听到的话接到原文后面；空白不接', () => {
    expect(appendTranscript('', '今天拍一条')).toBe('今天拍一条');
    expect(appendTranscript('开头：', '一元一串')).toBe('开头：一元一串');
    expect(appendTranscript('原有内容', '   ')).toBe('原有内容');
  });

  it('浏览器有 Web Speech 就用它；没有就返回 null（按钮不出现）', () => {
    class Fake {}
    expect(speechRecognitionCtor({ SpeechRecognition: Fake })).toBe(Fake);
    expect(speechRecognitionCtor({ webkitSpeechRecognition: Fake })).toBe(Fake);
    expect(speechRecognitionCtor({})).toBeNull();
    expect(speechRecognitionCtor(undefined)).toBeNull();
  });

  it('出错时给编导看的话，不直接甩英文错误码', () => {
    expect(voiceErrorMessage('not-allowed')).toMatch(/麦克风权限/);
    expect(voiceErrorMessage('no-speech')).toMatch(/没听到声音/);
    expect(voiceErrorMessage('network')).toMatch(/Google/);
    expect(voiceErrorMessage('something-else')).toMatch(/先打字/);
  });
});
