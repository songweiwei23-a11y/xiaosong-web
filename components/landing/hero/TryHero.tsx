"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Sparkles, Wand2 } from "lucide-react";
import { INDUSTRY_SAMPLES, REGISTER_URL, matchIndustry, type IndustrySample } from "@/lib/landing";
import { track } from "@/lib/funnel";
import { PhoneStory } from "./PhoneStory";

/**
 * 首页首屏「一句话开始」。
 *
 * 给完全不懂的小白：3 秒内回答"这是干嘛的、跟我有没有关系、我能不能行"。
 * - 标题用他的话讲结果，不讲"编导""知识库"
 * - 首屏第一个动作是"就在这儿试"，不是跳去登录：说一句自己是做什么的，
 *   或点一个行业，右边的动画当场换成这一行的选题和开头第一句
 * - 看完再请他注册：注册页直接打开、公开体验码已填好（见 lib/landing.ts）
 *
 * 右边样例是示意，页面上标明；不需要登录、不调模型，零成本。
 */
export function TryHero() {
  const [text, setText] = useState("");
  const [ph, setPh] = useState(0);
  const [shown, setShown] = useState<{ ind: IndustrySample; guessed: boolean } | null>(null);
  const [empty, setEmpty] = useState(false);

  // 转化漏斗第一步：打开了首页（匿名，同一访客一天记一次，见 lib/funnel）
  useEffect(() => track("landing_view"), []);

  // 输入框的提示语轮换：让人一眼知道"就写这种话"
  useEffect(() => {
    const t = setInterval(() => setPh((p) => (p + 1) % INDUSTRY_SAMPLES.length), 2400);
    return () => clearInterval(t);
  }, []);

  const tryIt = () => {
    if (!text.trim()) {
      setEmpty(true);
      return;
    }
    const hit = matchIndustry(text);
    // 认不出是哪一行就先给餐饮的看，并且说清楚——不假装"这就是给你写的"
    setShown({ ind: hit ?? INDUSTRY_SAMPLES[0], guessed: !hit });
    track("landing_try");
  };

  const pick = (ind: IndustrySample) => {
    setText(ind.who);
    setEmpty(false);
    setShown({ ind, guessed: false });
    track("landing_try");
  };

  return (
    <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1fr_1.05fr] lg:gap-12">
      <div>
        {/*
          "说一句你是做什么的"九个字必须一行放下，不然"的"会单独掉到第三行：
          手机上字号跟屏幕宽度走（320 宽约 26px、375 宽约 31px），电脑上不上 6xl（左栏只有一半宽）
        */}
        <h1 className="text-[clamp(26px,8.2vw,34px)] font-extrabold leading-tight text-foreground sm:text-5xl">
          不会拍短视频？
          <br />
          <span className="brand-gradient bg-clip-text text-transparent">说一句你是做什么的</span>
        </h1>
        <p className="mt-4 text-[17px] leading-relaxed text-muted-foreground sm:text-lg">
          1 分钟给你一条能直接照着拍的脚本：拍什么、第一句说什么、镜头怎么排。
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            tryIt();
          }}
          className={`glass-panel mt-6 flex items-center gap-2 rounded-2xl p-2 pl-4 ${empty ? "ring-2 ring-destructive/50" : ""}`}
        >
          <input
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (e.target.value.trim()) setEmpty(false);
            }}
            placeholder={`比如：${INDUSTRY_SAMPLES[ph].who}`}
            aria-label="你是做什么的"
            maxLength={40}
            className="min-w-0 flex-1 bg-transparent py-2 text-[16px] text-foreground outline-none placeholder:text-muted-foreground/70"
          />
          <button type="submit" className="brand-gradient flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2.5 text-[14px] font-semibold text-white">
            <Wand2 className="h-4 w-4" />
            免费出选题
          </button>
        </form>
        {empty && <p className="mt-2 text-[13px] text-destructive">先写一句你是做什么的，或者点下面一个行业</p>}

        <div className="mt-3 flex flex-wrap gap-2">
          {INDUSTRY_SAMPLES.map((i) => (
            <button
              key={i.id}
              type="button"
              onClick={() => pick(i)}
              aria-pressed={shown?.ind.id === i.id && !shown.guessed}
              className={`rounded-full border px-3 py-1.5 text-[13px] transition-colors ${
                shown?.ind.id === i.id && !shown.guessed
                  ? "border-primary/60 bg-primary/10 text-foreground"
                  : "border-border/70 text-muted-foreground hover:border-primary/50 hover:text-foreground"
              }`}
            >
              {i.name}
            </button>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-muted-foreground">
          {["不用下载", "不会剪辑也能用", "新账号送 10 次"].map((x) => (
            <span key={x} className="flex items-center gap-1.5">
              <Check className="h-4 w-4 text-emerald-500" />
              {x}
            </span>
          ))}
        </div>
      </div>

      <div className="min-w-0">
        {shown ? (
          <div className="space-y-3">
            <div className="glass-panel rounded-2xl p-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-[13px] text-muted-foreground">
                  <Sparkles className="h-4 w-4 text-primary" />
                  开物给「{shown.ind.name}」写的选题
                </span>
                <span className="shrink-0 text-[11px] text-muted-foreground/70">示意样例</span>
              </div>
              {shown.guessed && (
                <p className="mb-3 rounded-lg bg-foreground/[0.04] px-3 py-2 text-[12.5px] text-muted-foreground">
                  先给你看餐饮店的样例。注册后，开物会按你自己的行业和情况来写。
                </p>
              )}
              <ol className="space-y-2">
                {shown.ind.topics.map((t, i) => (
                  <li key={t} className="flex gap-2.5 rounded-xl bg-foreground/[0.04] px-3 py-2.5 text-[14px] leading-snug text-foreground">
                    <span className="font-mono text-primary">{i + 1}</span>
                    {t}
                  </li>
                ))}
              </ol>
              <div className="mt-3 rounded-xl border border-primary/30 bg-primary/[0.07] px-3 py-2.5 text-[13px] text-foreground">
                <span className="text-muted-foreground">开头第一句：</span>「{shown.ind.hook}」
              </div>
            </div>
            <Link href={REGISTER_URL} className="brand-gradient flex items-center justify-between gap-3 rounded-2xl px-5 py-4 text-white transition-transform hover:scale-[1.01]">
              <span className="text-[14px]">想要完整口播稿、分镜和标题？</span>
              <span className="flex shrink-0 items-center gap-1 font-semibold">
                注册送 10 次 <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          </div>
        ) : (
          <PhoneStory />
        )}
      </div>
    </div>
  );
}
