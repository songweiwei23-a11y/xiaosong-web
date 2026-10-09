"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { LogIn, Mail, Lock, ArrowLeft, Home, Ticket, Eye, EyeOff, Gift } from "lucide-react";
import { LoginGreeting, DailyTip, rememberLoginName, freeTrialLine } from "@/components/auth/LoginExtras";
import { BrandSeal, BrandWordmark } from "@/components/brand/Brand";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { AuthTransition } from "@/components/auth/AuthTransition";
// 数字走 FACTS 统一口径。原来这里 import 整套方法库只为数一个 length——
// 900 多行数据被打进登录页的包，访客还没登录就先下载一份完整知识资产
import { FACTS } from "@/lib/showcase";
import { track } from "@/lib/funnel";
import { authErrorText } from "@/lib/auth-errors";
import { postRegistration } from "@/lib/auth-register-request";
import { INVITE_CONTACT } from "@/lib/landing";


export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  /** 注册必填。校验在服务端做，这里只负责收集 */
  const [inviteCode, setInviteCode] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [showForgot, setShowForgot] = useState(false);
  const [loading, setLoading] = useState(false);
  /** 验证通过、正在把人交接给工作台。这期间全屏过渡层不撤 */
  const [handingOff, setHandingOff] = useState(false);
  const [message, setMessage] = useState("");
  /** 码是从链接带过来的（管理员发的带码注册链接）：输入框下面换一句话，告诉他不用管 */
  const [codeFromLink, setCodeFromLink] = useState(false);
  /** 小眼睛：看看密码到底输的是啥（2026-10-04 产品方） */
  const [showPassword, setShowPassword] = useState(false);
  /** 大写锁定开着：输错密码最常见的原因，打字时提醒一句 */
  const [capsOn, setCapsOn] = useState(false);
  const mounted = useRef(false);
  // React 更新按钮前，同一轮事件里也只能提交一次。
  const authBusy = useRef(false);
  const authAttempt = useRef(0);
  const navigationPending = useRef(false);
  const handoffTarget = useRef("/dashboard");
  const registrationAbort = useRef<AbortController | null>(null);
  const loginTabTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /*
   * 从首页点"免费试用 / 免费注册体验"进来：地址是 /login?mode=register（2026-10-04 起不再自动带码，邀请码找管理员要）；管理员发的链接可能带 &code=邀请码，会自动填好。
   * 直接打开注册、码已填好——完全不懂的小白手上没有邀请码，看到要填码就走了。
   * 读地址用 window.location 而不是 useSearchParams：后者要求整页包一层 Suspense。
   *
   * 已经登录的人点了同样的按钮，直接送回工作台，不让他对着注册表单发愣。
   */
  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    const initialAttempt = authAttempt.current;
    const q = new URLSearchParams(window.location.search);
    if (q.get("mode") === "register") setIsLogin(false);
    const code = (q.get("code") || "").trim().toUpperCase();
    if (code) {
      setInviteCode(code);
      setCodeFromLink(true);
    }
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        // 旧会话探测不能覆盖用户刚发起的登录或注册，也不能在卸载后跳转。
        if (!cancelled && mounted.current && !authBusy.current && authAttempt.current === initialAttempt && session) {
          goDashboard();
        }
      })
      .catch(() => {
        // 会话恢复失败时保留登录表单，用户仍然可以重新登录。
      });
    return () => {
      cancelled = true;
      mounted.current = false;
      registrationAbort.current?.abort();
      if (loginTabTimer.current) clearTimeout(loginTabTimer.current);
    };
    // 只在进页面时读一次
  }, []);

  // 转化漏斗：打开了注册页（从首页链接进来的，或者自己切到注册的；匿名，一天记一次）
  useEffect(() => {
    if (!isLogin) track("register_view");
  }, [isLogin]);

  /**
   * 跳转到工作台，并全程保持过渡层。
   *
   * 登录请求已经写好会话 Cookie 后，单次整页导航让服务端读取新会话。
   * 验证成功一直到新页面接管，过渡层和提交锁都保持。
   */
  const goDashboard = (to: string = "/dashboard") => {
    handoffTarget.current = to;
    // 下次打开登录页叫得出名字（只存邮箱 @ 前面那段，在本机；登录页上「不是你？」能清掉）
    if (email.includes("@")) rememberLoginName(email.trim());
    navigationPending.current = true;
    authBusy.current = true;
    setLoading(true);
    setHandingOff(true);
    window.location.assign(to);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authBusy.current) return;
    authBusy.current = true;
    authAttempt.current += 1;
    if (loginTabTimer.current) clearTimeout(loginTabTimer.current);
    setLoading(true);
    setMessage("");

    try {
      if (isLogin) {
        // 登录
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) throw error;
        if (!mounted.current) return;

        // 原来这里要先 setMessage 再等 500ms 才跳，纯粹是为了让人看清那句
        // "登录成功"。现在过渡层本身就在说话，这 500ms 只是白等，去掉。
        goDashboard();
        return;
      } else {
        /*
         * 注册走服务端，不再用浏览器里的 supabase.auth.signUp()。
         *
         * 邀请码校验只能在服务端做：signUp 用的是公开的 anon key，
         * 任何人都可以跳过这个页面直接 POST 到 Supabase 的 /auth/v1/signup，
         * 前端加多少个输入框都拦不住。/api/auth/register 用 service_role
         * 建号，并在同一次请求里原子地占用邀请码。
         */
        const controller = new AbortController();
        registrationAbort.current = controller;
        const data = await postRegistration(
          { email: email.trim(), password, code: inviteCode },
          controller.signal,
        );
        registrationAbort.current = null;
        if (!mounted.current) return;

        setMessage(`${data.message || "注册成功"}！正在为你登录…`);

        // 直接把人登进去。让他注册完再手输一遍同样的账号密码，
        // 是没有必要的一道坎
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (!mounted.current) return;
        if (signInError) {
          // 原来这里把真正的原因吞掉了，只说"请切换到登录"——登不上时谁也不知道为什么
          setMessage(`注册成功，但自动登录没成功（${authErrorText(signInError)}）。请切换到登录标签页再试一次。`);
          const completedAttempt = authAttempt.current;
          loginTabTimer.current = setTimeout(() => {
            if (mounted.current && authAttempt.current === completedAttempt) setIsLogin(true);
          }, 1500);
        } else {
          /*
           * 刚注册完的人一步都没做过，直接送去引导清单。
           * 线上漏斗显示 90% 的人没做到创作简报——而那一步是让整个产品
           * 真正生效的关键。不主动带一程，他们不会自己找到。
           */
          goDashboard("/onboarding");
          return;
        }
      }
    } catch (error: unknown) {
      if (!mounted.current) return;
      navigationPending.current = false;
      setMessage(authErrorText(error));
      setHandingOff(false);
    } finally {
      registrationAbort.current = null;
      // return 仍然会执行 finally，必须显式保留成功导航的提交锁。
      if (!navigationPending.current) {
        authBusy.current = false;
        if (mounted.current) setLoading(false);
      }
    }
  };

  return (
    // 背景交给全站的 AmbientBackground。这里原本自带一层写死的渐变和光斑，
    // 会盖住氛围层，且颜色不跟随配色方案切换。
    /*
     * 顶栏占自己的一行，内容在下面剩余的空间里居中。
     * 原来顶栏是浮在上面的（absolute），内容在整屏里垂直居中且裁掉溢出：
     * 手机屏幕矮一点、或切到注册多出邀请码那一栏，内容就往上顶，
     * Logo 那一块盖住了「返回首页」和外观按钮——点上去没反应，
     * 上面被裁掉的部分也滚不回来。
     */
    <div className="relative flex min-h-screen min-h-dvh flex-col">

      {/* 验证通过之后到工作台出现之前，全程盖住——这段原来是完全没有反馈的 */}
      <AuthTransition
        show={handingOff}
        name={email.includes("@") ? email.split("@")[0] : undefined}
        onRetry={() => {
          // 卡住时给个出口：整页重载比停在这里干等强
          window.location.assign(handoffTarget.current);
        }}
      />

      {/* 顶部导航 */}
      <header className="relative z-20 shrink-0">
        <div className="container mx-auto px-2 sm:px-4 h-14 sm:h-16 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-lg px-2 py-2.5 text-foreground/80 hover:text-primary transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">返回首页</span>
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 pb-10 pt-2 sm:py-10">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3.5 mb-4 transition-opacity hover:opacity-90">
            <BrandSeal size={48} />
            <h1 className="text-[34px] text-foreground">
              <BrandWordmark latin />
            </h1>
          </Link>
          <p className="text-muted-foreground">懂编导的 AI 短视频搭档 · 从选题到拍完、发完、看数据</p>
        </div>

        {/* Login Form */}
        <div className="glass-panel rounded-2xl p-6 sm:p-8 shadow-xl">
          {/* 按时段问候；这台电脑上登录过的叫得出名字（components/auth/LoginExtras） */}
          <LoginGreeting isLogin={isLogin} />
          {/* 登录/注册切换 */}
          <div className="flex gap-2 mb-6">
            <button
              disabled={loading || handingOff}
              onClick={() => {
                setIsLogin(true);
                setMessage("");
              }}
              className={`flex-1 py-2.5 rounded-lg font-medium transition-all ${
                isLogin
                  ? "brand-gradient text-white shadow-lg"
                  : "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
              }`}
            >
              登录
            </button>
            <button
              disabled={loading || handingOff}
              onClick={() => {
                setIsLogin(false);
                setMessage("");
              }}
              className={`flex-1 py-2.5 rounded-lg font-medium transition-all ${
                !isLogin
                  ? "brand-gradient text-white shadow-lg"
                  : "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
              }`}
            >
              注册
            </button>
          </div>

          <form onSubmit={handleAuth} className="space-y-5">
            {/* 邮箱输入 */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                邮箱地址
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full pl-10 pr-4 py-3 bg-background/50 border border-border rounded-xl focus:ring-2 focus:ring-primary/25 focus:border-primary text-foreground placeholder:text-muted-foreground transition-colors"
                  required
                />
              </div>
            </div>

            {/* 密码输入 */}
            <div>
              <div className="mb-2 flex items-baseline justify-between">
                <label className="block text-sm font-medium text-foreground">
                  密码
                </label>
                {/*
                  忘记密码不走邮件：系统没有配置发信服务，用户邮箱也从未验证过，
                  做一个"发重置邮件"的按钮就是一个点了没反应的按钮。
                  现在的流程是找客服，管理员在后台一键重置、发临时密码，
                  用户登录后在「我的账户」里改掉。
                  在这之前全站没有任何找回途径——注册又是邀请制，
                  忘了密码的人永远进不来，连重新注册都要再要一个邀请码。
                */}
                {isLogin && (
                  <button
                    type="button"
                    onClick={() => setShowForgot((v) => !v)}
                    className="-my-3 py-3 pl-3 text-xs text-primary hover:underline"
                  >
                    忘记密码？
                  </button>
                )}
              </div>
              {isLogin && showForgot && (
                <div className="mb-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                  加客服微信 <span className="font-semibold text-foreground">13240286600</span>（手机同号），
                  报上注册邮箱，我们会重置并发你一个临时密码。登录后请到「我的账户」里改成你自己的。
                </div>
              )}
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => setCapsOn(e.getModifierState?.("CapsLock") ?? false)}
                  onKeyUp={(e) => setCapsOn(e.getModifierState?.("CapsLock") ?? false)}
                  onBlur={() => setCapsOn(false)}
                  autoComplete={isLogin ? "current-password" : "new-password"}
                  placeholder="至少6位密码"
                  className="w-full pl-10 pr-12 py-3 bg-background/50 border border-border rounded-xl focus:ring-2 focus:ring-primary/25 focus:border-primary text-foreground placeholder:text-muted-foreground transition-colors"
                  required
                  minLength={6}
                />
                {/* 小眼睛：点一下显示密码，确认没输错；再点一下藏起来 */}
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "隐藏密码" : "显示密码"}
                  aria-pressed={showPassword}
                  title={showPassword ? "隐藏密码" : "显示密码"}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {capsOn && <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">⚠️ 大写锁定已开启，密码区分大小写</p>}
            </div>

            {/* 邀请码：只在注册时出现 */}
            {!isLogin && (
              <div>
                {/* 注册送什么说清楚（从免费版配置算） */}
                <p className="mb-4 flex items-start gap-1.5 rounded-lg bg-primary/[0.07] px-3 py-2 text-xs leading-relaxed text-foreground">
                  <Gift className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />{freeTrialLine()}
                </p>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  邀请码
                </label>
                <div className="relative">
                  <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input
                    type="text"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    placeholder="例如 XS8AF30E"
                    // 码里不含 0/O/1/I/L，统一转大写展示，抄错的概率低很多
                    className="w-full pl-10 pr-4 py-3 bg-background/50 border border-border rounded-xl font-mono tracking-wider focus:ring-2 focus:ring-primary/25 focus:border-primary text-foreground placeholder:text-muted-foreground placeholder:font-sans placeholder:tracking-normal transition-colors"
                    required
                    autoComplete="off"
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {/* 2026-10-04：首页不再自动带体验码，邀请码找管理员要；管理员发的带码链接仍会自动填好 */}
                  {codeFromLink
                    ? "邀请码已经帮你填好了，填上邮箱和密码就能注册。"
                    : INVITE_CONTACT}
                </p>
              </div>
            )}

            {/* 消息提示 */}
            {message && (
              <div className={`p-3 rounded-lg text-sm font-medium ${
                message.includes("成功")
                  ? "bg-emerald-500/15 dark:bg-green-900/30 text-green-500 dark:text-green-400 border border-green-500/25"
                  : "bg-destructive/15 dark:bg-red-900/30 text-destructive dark:text-red-400 border border-destructive/25"
              }`}>
                {message}
              </div>
            )}

            {/* 提交按钮 */}
            <button
              type="submit"
              disabled={loading || handingOff}
              className="w-full flex items-center justify-center gap-2 btn-brand py-3.5 rounded-xl font-semibold disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  处理中...
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  {isLogin ? "登录账户" : "注册账户"}
                </>
              )}
            </button>
          </form>

          {/* 切换提示 */}
          <div className="mt-6 text-center text-sm text-muted-foreground">
            {isLogin ? "还没有账号？" : "已有账号？"}
            <button
              disabled={loading || handingOff}
              onClick={() => {
                setIsLogin(!isLogin);
                setMessage("");
              }}
              className="ml-1 py-2 text-primary hover:opacity-80 font-semibold transition-opacity"
            >
              {isLogin ? "立即注册" : "立即登录"}
            </button>
          </div>
        </div>

        {/*
          功能亮点。三个数字原来是「8 核心功能 / 10000+ 知识库 / 10秒 生成脚本」，
          三个都不对：
            · 板块早就 15 个了，不是 8 个；
            · 知识库是 154 篇文档，「10000+」没有出处；
            · **最要命的是「10秒生成脚本」**——脚本要跑一两分钟、定位要几分钟。
              先许诺 10 秒，用户等 90 秒就会觉得"卡死了"。
              这一条等于在亲手制造"这产品很慢"的印象。

          换成三个从代码里数得出来、也确实是卖点的数字。
        */}
        {/*
          说辞要讲清楚"这个数字意味着什么"。
          「内置编导方法 73」只是个数字，「73 条可直接照拍的方法」才是优势。
          数字统一从 lib/showcase.ts 的 FACTS 取，全站一个口径。
        */}
        <div className="mt-8 grid grid-cols-3 gap-4">
          {[
            // 和落地页数据带保持同一组数：方法数、知识库字数、板块数。
            // 原来中间一格是 pipeline.length（5），三个数里最小的一个摆中间，
            // 把整排都压下去了
            { n: String(FACTS.methods), label: "条带公式的方法" },
            { n: `${FACTS.wordsWan}万`, label: "字符编导资料" },
            { n: String(FACTS.boards), label: "个创作板块" },
          ].map((x) => (
            <div key={x.label} className="glass-panel text-center p-4 rounded-xl">
              <div className="text-3xl font-bold brand-text">{x.n}</div>
              <div className="text-xs text-muted-foreground mt-1 leading-snug">{x.label}</div>
            </div>
          ))}
        </div>

        {/* 今日一计：还没登录先送一招真方法（每天换） */}
        <DailyTip />

        {/* 底部链接 */}
        <div className="mt-6 text-center">
          <Link 
            href="/"
            className="inline-flex items-center gap-1 py-2 text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            <Home className="w-4 h-4" />
            返回首页了解更多
          </Link>
        </div>
      </div>
      </main>
    </div>
  );
}
