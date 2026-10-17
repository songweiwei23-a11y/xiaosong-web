"use client";

import { useState } from "react";
import { ArrowRight, Check, RotateCcw, X } from "lucide-react";
import type { Challenge } from "@/lib/newbie-course";

type Judge = Extract<Challenge, { kind: "judge" }>;
type Order = Extract<Challenge, { kind: "order" }>;

/** 随机排一个不是原样的顺序（原样就等于白给） */
function shuffled(n: number): number[] {
  for (;;) {
    const a = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    if (a.some((v, i) => v !== i)) return a;
  }
}

/**
 * 小挑战（两种玩法：判断、排顺序）。只有「第一次玩」决定能不能加星：
 * 第一次就全对 → onReport(true)；有错 → onReport(false)。之后重玩只是练手，不再报告。
 * 挑战不影响过关，所以「回去」随时可以退出。
 */
export function ChallengePanel({
  challenge,
  reported,
  onReport,
  onBack,
}: {
  challenge: Challenge;
  /** 这关的挑战已经报告过（第一次已经玩过），这次只是练手 */
  reported: boolean;
  onReport: (perfect: boolean) => void;
  onBack: () => void;
}) {
  const [run, setRun] = useState(0);
  const [result, setResult] = useState<{ miss: number; counted: boolean } | null>(null);

  const finish = (miss: number) => {
    const counted = !reported;
    if (counted) onReport(miss === 0);
    setResult({ miss, counted });
  };

  const again = () => {
    setResult(null);
    setRun((r) => r + 1);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-white/60">小挑战 · {challenge.kind === "judge" ? "判断题" : "排顺序"}</span>
        <button type="button" onClick={onBack} className="text-[13px] text-white/70 underline underline-offset-4">
          回去
        </button>
      </div>
      <div className="mt-3 text-[20px] font-bold leading-snug">{challenge.title}</div>
      <div className="mt-4">
        {result ? (
          <Verdict challenge={challenge} miss={result.miss} counted={result.counted} onAgain={again} />
        ) : challenge.kind === "judge" ? (
          <JudgeGame key={run} challenge={challenge} onFinish={finish} />
        ) : (
          <OrderGame key={run} challenge={challenge} onFinish={finish} />
        )}
      </div>
    </div>
  );
}

function JudgeGame({ challenge, onFinish }: { challenge: Judge; onFinish: (miss: number) => void }) {
  const [i, setI] = useState(0);
  const [miss, setMiss] = useState(0);
  const [pick, setPick] = useState<boolean | null>(null);
  const n = challenge.cases.length;
  const c = challenge.cases[i];
  const right = pick === c.ok;

  const answer = (v: boolean) => {
    if (pick !== null) return;
    setPick(v);
    if (v !== c.ok) setMiss((m) => m + 1);
  };

  const next = () => {
    if (i + 1 < n) {
      setI(i + 1);
      setPick(null);
    } else {
      onFinish(miss);
    }
  };

  return (
    <div>
      <div className="text-[12px] text-white/60">第 {i + 1} / {n} 条</div>
      <div className="mt-2 rounded-2xl bg-white/10 p-4 text-[16px] leading-relaxed">{c.text}</div>
      {pick === null ? (
        <>
          <p className="mt-3 text-[13px] text-white/65">{challenge.intro}</p>
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <button type="button" onClick={() => answer(true)} className="rounded-2xl border border-white/20 bg-white/5 py-3.5 text-[15px] hover:border-white/40">
              对
            </button>
            <button type="button" onClick={() => answer(false)} className="rounded-2xl border border-white/20 bg-white/5 py-3.5 text-[15px] hover:border-white/40">
              不对
            </button>
          </div>
        </>
      ) : (
        <div className="mt-4">
          <div className={`flex items-center gap-2 text-[15px] font-semibold ${right ? "text-emerald-300" : "text-rose-300"}`}>
            {right ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
            {right ? "判断对了" : "判断错了"}
          </div>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-white/85">{c.why}</p>
          <button type="button" onClick={next} className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-2xl bg-white py-3 text-[14px] font-semibold text-black">
            {i + 1 < n ? "下一条" : "看结果"} <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function OrderGame({ challenge, onFinish }: { challenge: Order; onFinish: (miss: number) => void }) {
  const n = challenge.steps.length;
  const [order] = useState(() => shuffled(n));
  const [slots, setSlots] = useState<number[]>([]);
  const rest = order.filter((idx) => !slots.includes(idx));

  // 排满就判断：整段顺序对了才算全对
  const place = (idx: number) => {
    const next = [...slots, idx];
    setSlots(next);
    if (next.length === n) onFinish(next.every((v, k) => v === k) ? 0 : 1);
  };

  const takeBack = (k: number) => setSlots(slots.slice(0, k));

  return (
    <div>
      <p className="text-[13px] leading-relaxed text-white/75">{challenge.intro}</p>
      <div className="mt-4 space-y-2">
        {Array.from({ length: n }, (_, k) => {
          const idx = slots[k];
          const filled = idx !== undefined;
          return (
            <button
              key={k}
              type="button"
              disabled={!filled}
              onClick={() => takeBack(k)}
              aria-label={filled ? `第 ${k + 1} 段，点一下拿回` : `第 ${k + 1} 段，还空着`}
              className={`flex min-h-[3rem] w-full items-start gap-2.5 rounded-2xl border border-dashed px-3.5 py-2.5 text-left text-[14px] leading-relaxed ${
                filled ? "border-white/40 bg-white/10 text-white" : "border-white/20 text-white/40"
              }`}
            >
              <span className="shrink-0 font-semibold">{k + 1}</span>
              <span>{filled ? challenge.steps[idx] : "点下面的句子，放到这里"}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-5 text-[12px] text-white/55">点上面的格子可以拿回已放的句子，排满后自动判断。</div>
      <div className="mt-2 space-y-2">
        {rest.map((idx) => (
          <button key={idx} type="button" onClick={() => place(idx)} className="w-full rounded-2xl bg-white/10 px-3.5 py-2.5 text-left text-[14px] leading-relaxed hover:bg-white/15">
            {challenge.steps[idx]}
          </button>
        ))}
      </div>
    </div>
  );
}

function Verdict({ challenge, miss, counted, onAgain }: { challenge: Challenge; miss: number; counted: boolean; onAgain: () => void }) {
  const perfect = miss === 0;
  const text = perfect
    ? counted
      ? "全对！这一关的挑战星拿到了"
      : "全对（这次是练手，星星不变）"
    : counted
      ? `这次错了 ${miss} 处，这一关的挑战星就不加了`
      : `错了 ${miss} 处，再练一次吧`;

  return (
    <div>
      <div className={`flex items-center gap-2 text-[16px] font-semibold ${perfect ? "text-emerald-300" : "text-rose-200"}`}>
        {perfect ? <Check className="h-5 w-5" /> : <X className="h-5 w-5" />}
        {text}
      </div>
      {challenge.kind === "order" && (
        <div className="mt-4 rounded-2xl bg-white/10 p-4">
          <div className="text-[12.5px] text-white/60">正确的顺序</div>
          <ol className="mt-2 space-y-1.5 text-[14px] leading-relaxed text-white/90">
            {challenge.steps.map((s, k) => (
              <li key={s} className="flex gap-2">
                <span className="shrink-0 text-white/50">{k + 1}.</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-[13.5px] leading-relaxed text-white/85">{challenge.why}</p>
        </div>
      )}
      <button type="button" onClick={onAgain} className="mt-5 flex w-full items-center justify-center gap-1.5 rounded-2xl border border-white/30 py-3 text-[14px] text-white">
        <RotateCcw className="h-4 w-4" />
        再练一次
      </button>
    </div>
  );
}
