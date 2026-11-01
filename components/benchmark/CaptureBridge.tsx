"use client";

import { useEffect, useState } from "react";
import { Download, ImagePlus, X } from "lucide-react";

/**
 * 「开物 · 截屏带入」浏览器插件和对标页的衔接（2026-11-01）。插件在 browser-extension/kaiwu-capture。
 * - 插件装了：它的桥接脚本会在页面上报到（data-kaiwu-capture 属性 + 一条 hello 消息）；没报到就提示安装。
 * - 插件里存了截图：交给页面，编导选放进哪个对标账号，就进那个账号的拆解区，和手动上传走同一套拆解。
 * 插件只截编导点按钮那一刻看到的画面，不自动翻页、不读网页数据；这里也只收图片，不收别的。
 */

const DISMISS_KEY = "kaiwu-capture-install-dismissed";
/** 插件包（public/kaiwu-capture.zip，由 browser-extension/kaiwu-capture 打包）。带 download 属性的链接是下载文件，不会整页跳转 */
const EXTENSION_ZIP = "/kaiwu-capture.zip";
const MAX_CAPTURES = 9;

interface Capture { dataUrl: string; url?: string; title?: string; at?: string }

async function toFiles(captures: Capture[]): Promise<File[]> {
  const out: File[] = [];
  for (const [i, c] of captures.slice(0, MAX_CAPTURES).entries()) {
    if (typeof c?.dataUrl !== "string" || !c.dataUrl.startsWith("data:image/")) continue;
    const blob = await (await fetch(c.dataUrl)).blob();
    out.push(new File([blob], `插件截图-${i + 1}.jpg`, { type: blob.type || "image/jpeg" }));
  }
  return out;
}

/** 抖音主页链接里的账号标识（/user/ 后面那一段）；不是主页链接返回空 */
export function douyinUserKey(url: string | null | undefined): string {
  return (url ?? "").match(/douyin\.com\/user\/([\w-]+)/)?.[1] ?? "";
}

/** 抖音主页的标题「某某的抖音 - 抖音」→「某某」 */
export function nameFromTitle(title: string | null | undefined): string {
  return (title ?? "").replace(/\s*[-|–—]\s*抖音.*$/, "").replace(/的抖音$/, "").trim().slice(0, 40);
}

/**
 * 截图该放进哪个对标账号：先按主页链接对上已有的账号；对不上，就按主页的名字和链接新建一个（2026-11-01 产品方：少让用户操作）。
 * 返回 match（已有账号的编号）或 create（要新建的名字和链接）；连主页都认不出就返回 null，交给用户手动选。
 */
export function pickAccount(captures: Capture[], accounts: { id: string; link?: string | null }[]): { match: string } | { create: { name: string; link: string } } | null {
  const home = captures.find((c) => douyinUserKey(c.url)) ?? null;
  const key = douyinUserKey(home?.url);
  if (!key) return null;
  const hit = accounts.find((a) => douyinUserKey(a.link) === key);
  if (hit) return { match: hit.id };
  const name = nameFromTitle(home?.title) || "抖音对标账号";
  return { create: { name, link: (home?.url ?? "").split("?")[0] } };
}

export function CaptureBridge({ accounts, accountsReady, onAssign, onCreate }: {
  accounts: { id: string; name: string; link?: string | null }[];
  /** 对标账号读完了才去对：截图比账号列表先到时，提前对会把已有的账号当成新的，重复建一个 */
  accountsReady: boolean;
  onAssign: (accountId: string, files: File[]) => void;
  /** 新建一个对标账号，返回它的编号；失败返回 null */
  onCreate: (name: string, link: string) => Promise<string | null>;
}) {
  const [installed, setInstalled] = useState<boolean | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [from, setFrom] = useState("");
  const [dismissed, setDismissed] = useState(true);
  const [pending, setPending] = useState<Capture[] | null>(null);
  const [placed, setPlaced] = useState("");

  // 截图到了、对标账号也读完了：自动放进对得上的账号，没有就新建一个
  useEffect(() => {
    if (!pending || !files.length || !accountsReady) return;
    const pick = pickAccount(pending, accounts);
    setPending(null);
    if (!pick) return; // 认不出主页：留着让用户手动选
    void (async () => {
      const id = "match" in pick ? pick.match : await onCreate(pick.create.name, pick.create.link);
      if (!id) return;
      onAssign(id, files);
      setPlaced("match" in pick ? (accounts.find((a) => a.id === id)?.name ?? "") : pick.create.name);
      setFiles([]);
    })();
  }, [pending, files, accounts, accountsReady, onAssign, onCreate]);

  useEffect(() => {
    try { setDismissed(localStorage.getItem(DISMISS_KEY) === "1"); } catch { setDismissed(false); }
    const onMessage = async (event: MessageEvent) => {
      if (event.source !== window || event.origin !== window.location.origin) return;
      const data = event.data as { source?: string; type?: string; captures?: Capture[] } | null;
      if (data?.source !== "kaiwu-capture") return;
      setInstalled(true);
      if (data.type === "captures" && Array.isArray(data.captures) && data.captures.length) {
        const got = await toFiles(data.captures);
        if (got.length) {
          setFiles(got);
          setFrom(data.captures[0]?.url ?? "");
          setPending(data.captures);
          window.postMessage({ source: "kaiwu-page", type: "received" }, window.location.origin);
        }
      }
    };
    window.addEventListener("message", onMessage);
    window.postMessage({ source: "kaiwu-page", type: "ready" }, window.location.origin);
    // 插件的桥接脚本在页面加载完才跑：给它一点时间报到，没报到就当没装
    const timer = window.setTimeout(() => {
      if (document.documentElement.hasAttribute("data-kaiwu-capture")) setInstalled(true);
      else setInstalled((v) => v ?? false);
    }, 1500);
    return () => { window.removeEventListener("message", onMessage); window.clearTimeout(timer); };
  }, []);

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* 存不了就只关这一次 */ }
  };

  if (placed) {
    return (
      <p className="rounded-xl border border-primary/40 px-4 py-2.5 text-[13px] text-foreground">
        插件带来的截图已经放进「{placed}」的拆解里，往下找到这个账号，点「开始拆解」就行。想拆得更细，可以再传一两条爆款视频。
      </p>
    );
  }

  if (files.length) {
    return (
      <section className="glass-panel space-y-3 rounded-2xl border border-primary/40 p-5">
        <p className="flex items-center gap-2 text-[14px] font-medium text-foreground">
          <ImagePlus className="h-4 w-4 text-primary" />插件带来了 {files.length} 张截图{from && <span className="truncate text-[12px] font-normal text-muted-foreground">（{from}）</span>}
        </p>
        {accounts.length ? (
          <>
            <p className="text-[12.5px] text-muted-foreground">放进哪个对标账号的拆解？放进去以后，可以再传爆款视频，一起拆。</p>
            <div className="flex flex-wrap gap-2">
              {accounts.map((a) => (
                <button key={a.id} type="button" onClick={() => { onAssign(a.id, files); setFiles([]); }} className="rounded-lg brand-gradient px-3 py-1.5 text-[12.5px] font-medium text-white">
                  放进「{a.name}」
                </button>
              ))}
            </div>
          </>
        ) : (
          <p className="text-[12.5px] text-muted-foreground">还没有对标账号。先在下面加一个（主页链接可以填：{from || "截图来自的那个主页"}），截图会留在这里等你放进去。</p>
        )}
      </section>
    );
  }

  if (installed === false && !dismissed) {
    return (
      <section className="glass-panel space-y-3 rounded-2xl border border-primary/30 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[14px] font-medium text-foreground">装一个「开物 · 截屏带入」插件，拆对标账号更省事</p>
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              看对标账号主页时，点一下就把当前画面截下来，带进这里拆解。插件只截你点按钮那一刻看到的画面，不自动翻页、不读网页数据。
            </p>
          </div>
          <button type="button" onClick={dismiss} aria-label="暂不安装" className="shrink-0 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <ol className="list-decimal space-y-1 pl-5 text-[12.5px] text-foreground">
          <li><a href={EXTENSION_ZIP} download className="inline-flex items-center gap-1 text-primary hover:underline"><Download className="h-3.5 w-3.5" />下载插件</a>，解压成一个文件夹</li>
          <li>用 Chrome 打开 <code className="rounded bg-muted px-1">chrome://extensions</code>（Edge 打开 <code className="rounded bg-muted px-1">edge://extensions</code>），右上角打开「开发者模式」</li>
          <li>点「加载已解压的扩展程序」，选刚才解压出来的文件夹</li>
          <li>回到这一页刷新，看到「插件已装好」就可以用了</li>
        </ol>
        <button type="button" onClick={dismiss} className="text-[12px] text-muted-foreground hover:text-foreground">暂不安装</button>
      </section>
    );
  }

  if (installed) {
    return (
      <p className="rounded-xl border border-border/60 px-4 py-2.5 text-[12.5px] text-muted-foreground">
        插件已装好：打开对标账号的抖音主页，点浏览器右上角的「开物 · 截屏带入」，照着里面的步骤截图，再点「带进开物拆解」。
      </p>
    );
  }

  return null;
}
