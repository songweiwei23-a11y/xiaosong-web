"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Mic, MicOff } from "lucide-react";
import { notify } from "@/components/ui/feedback";
import { speechRecognitionCtor, voiceErrorMessage, type SpeechRecognitionLike } from "@/lib/voice-input";

const noop = () => () => {};

/**
 * 语音输入按钮（整改 C · 语音输入）：按一下开始听，再按一下停。听到的整句接到输入框里（onText）。
 * 浏览器不支持时整个按钮不出现，不占地方。
 */
export function VoiceInputButton({ onText, disabled, className = "" }: {
  onText: (spoken: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  // 用 useSyncExternalStore 判断是否支持：服务端返回 false，客户端按真实浏览器判断，不会水合不一致
  const supported = useSyncExternalStore(noop, () => !!speechRecognitionCtor(window), () => false);
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  // 离开页面时停掉，免得麦克风一直开着
  useEffect(() => () => recRef.current?.abort(), []);

  if (!supported) return null;

  const start = () => {
    const Ctor = speechRecognitionCtor(window);
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "zh-CN";
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) onText(r[0].transcript);
      }
    };
    rec.onerror = (e) => {
      setListening(false);
      if (e.error !== "aborted") notify(voiceErrorMessage(e.error), "error");
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      notify("语音输入没能启动，请稍后再试", "error");
    }
  };

  const stop = () => {
    recRef.current?.stop();
    setListening(false);
  };

  return (
    <button
      type="button"
      onClick={listening ? stop : start}
      disabled={disabled}
      aria-pressed={listening}
      aria-label={listening ? "停止语音输入" : "语音输入"}
      title={listening ? "再按一下停止" : "按一下开始说话，说完再按一下"}
      className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs disabled:opacity-50 ${
        listening ? "bg-red-500/15 text-red-600 dark:text-red-400" : "text-muted-foreground hover:bg-muted hover:text-foreground"
      } ${className}`}
    >
      {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
      <span className="hidden sm:inline">{listening ? "正在听…" : "语音"}</span>
    </button>
  );
}
