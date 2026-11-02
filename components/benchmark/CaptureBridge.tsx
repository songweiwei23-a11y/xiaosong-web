"use client";

import { useEffect, useRef, useState } from "react";
import { Download, ImagePlus, X } from "lucide-react";
import { COVER_PREFIX, sanitizeCollection, type Collection } from "@/lib/benchmark-collection";

/**
 * 「开物 · 截屏带入」浏览器插件和对标页的衔接（2026-11-01；11-02 加一键采集）。插件在 browser-extension/kaiwu-capture。
 * - 插件装了：它的桥接脚本会在页面上报到（data-kaiwu-capture 属性 + 一条 hello 消息）；没报到就提示安装。
 * - 插件里存了截图、一键采集的数据：交给页面，自动对上对标账号（没有就新建），放进它的拆解区；
 *   一键采集来的直接开始拆（编导在插件里点开始时已经确认过材料可以使用），只有截图的等编导点。
 * 采集数据来自网页，进来先过 lib/benchmark-collection 的校验和限量，评论只留文字和点赞数。
 */

const DISMISS_KEY = "kaiwu-capture-install-dismissed";
/** 插件包（public/kaiwu-capture.zip，由 browser-extension/kaiwu-capture 打包）。带 download 属性的链接是下载文件，不会整页跳转 */
const EXTENSION_ZIP = "/kaiwu-capture.zip";
const MAX_CAPTURES = 9;

/** kind=cover：一键采集顺手带来的作品封面；不写是编导截的屏 */
interface Capture { dataUrl: string; url?: string; title?: string; at?: string; kind?: string }

async function toFiles(captures: Capture[]): Promise<File[]> {
  const out: File[] = [];
  for (const [i, c] of captures.slice(0, MAX_CAPTURES).entries()) {
    if (typeof c?.dataUrl !== "string" || !/^data:image\/(jpeg|png|webp);/.test(c.dataUrl)) continue;
    const blob = await (await fetch(c.dataUrl)).blob();
    const type = /^image\/(jpeg|png|webp)$/.test(blob.type) ? blob.type : "image/jpeg";
    const ext = type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
    out.push(new File([blob], `${c.kind === "cover" ? COVER_PREFIX : "插件截图"}-${i + 1}.${ext}`, { type }));
  }
  return out;
}

/** 插件最新版本（browser-extension/kaiwu-capture/manifest.json）；装的比它旧就提示下载新版 */
export const PLUGIN_VERSION = "0.3.1";
/** 从这个版本起会一键采集；比它旧的粘贴链接没用，要先更新 */
export const COLLECT_SINCE = "0.3.0";
export function versionBelow(installed: string, target: string): boolean {
  const a = installed.split(".").map(Number);
  const b = target.split(".").map(Number);
  for (let i = 0; i < 3; i++) if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) < (b[i] || 0);
  return false;
}
export const pluginOutdated = (installed: string) => versionBelow(installed, PLUGIN_VERSION);

/** 同一批数据的记号：插件可能把同一批交两次（页面刚打开时，插件主动交一次、页面说 ready 又交一次），按它去重，免得建两个账号、拆两遍 */
export function batchKey(captures: Capture[], collection: Collection | null): string {
  return `${collection?.collectedAt ?? ""}|${collection?.url ?? ""}|${captures.map((c) => `${c.at ?? ""}:${c.dataUrl?.length ?? 0}`).join(",")}`;
}

/** 抖音主页链接里的账号标识（/user/ 后面那一段）；不是主页链接返回空 */
export function douyinUserKey(url: string | null | undefined): string {
  return (url ?? "").match(/douyin\.com\/user\/([\w-]+)/)?.[1] ?? "";
}

/**
 * 从编导粘贴的东西里取出抖音链接：浏览器地址栏的主页链接，或抖音 App「分享主页」复制的整段文字（里面带 v.douyin.com 短链）。
 * 只认抖音自己的域名；认不出返回空
 */
export function douyinLinkFromText(text: string): string {
  const m = text.match(/https?:\/\/(?:www\.|v\.)?(?:douyin|iesdouyin)\.com\/[^\s，。"'<>]*/i);
  return m ? m[0].replace(/^http:/i, "https:") : "";
}

/** 抖音主页的标题「某某的抖音 - 抖音」→「某某」 */
export function nameFromTitle(title: string | null | undefined): string {
  return (title ?? "").replace(/\s*[-|–—]\s*抖音.*$/, "").replace(/的抖音$/, "").trim().slice(0, 40);
}

/**
 * 截图该放进哪个对标账号：先按主页链接对上已有的账号；对不上，就按主页的名字和链接新建一个（2026-11-01 产品方：少让用户操作）。
 * 一键采集带来的主页链接和名字最准，优先用；返回 match（已有账号的编号）或 create（要新建的名字和链接）；
 * 连主页都认不出就返回 null，交给用户手动选。
 */
export function pickAccount(
  captures: Capture[],
  accounts: { id: string; link?: string | null }[],
  collection?: Pick<Collection, "url" | "profile"> | null,
): { match: string } | { create: { name: string; link: string } } | null {
  const home = collection && douyinUserKey(collection.url)
    ? { url: collection.url, title: collection.profile.name }
    : captures.find((c) => douyinUserKey(c.url)) ?? null;
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
  /** collected：一键采集的数据，有它就直接开始拆 */
  onAssign: (accountId: string, files: File[], collected?: Collection | null) => void;
  /** 新建一个对标账号，返回它的编号；失败返回 null */
  onCreate: (name: string, link: string) => Promise<string | null>;
}) {
  const [installed, setInstalled] = useState<boolean | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [collected, setCollected] = useState<Collection | null>(null);
  const [from, setFrom] = useState("");
  const [dismissed, setDismissed] = useState(true);
  const [pending, setPending] = useState<Capture[] | null>(null);
  const [placed, setPlaced] = useState("");
  const [started, setStarted] = useState(false);
  const [version, setVersion] = useState("");
  const [link, setLink] = useState("");
  const [linkMsg, setLinkMsg] = useState("");
  const lastBatch = useRef("");

  // 截图或采集数据到了、对标账号也读完了：自动放进对得上的账号，没有就新建一个
  useEffect(() => {
    if (!pending || (!files.length && !collected) || !accountsReady) return;
    const pick = pickAccount(pending, accounts, collected);
    setPending(null);
    if (!pick) return; // 认不出主页：留着让用户手动选
    void (async () => {
      const id = "match" in pick ? pick.match : await onCreate(pick.create.name, pick.create.link);
      if (!id) return;
      onAssign(id, files, collected);
      setStarted(!!collected);
      setPlaced("match" in pick ? (accounts.find((a) => a.id === id)?.name ?? "") : pick.create.name);
      setFiles([]);
      setCollected(null);
    })();
  }, [pending, files, collected, accounts, accountsReady, onAssign, onCreate]);

  useEffect(() => {
    try { setDismissed(localStorage.getItem(DISMISS_KEY) === "1"); } catch { setDismissed(false); }
    const onMessage = async (event: MessageEvent) => {
      if (event.source !== window || event.origin !== window.location.origin) return;
      const data = event.data as { source?: string; type?: string; version?: string; captures?: Capture[]; collection?: unknown } | null;
      if (data?.source !== "kaiwu-capture") return;
      setInstalled(true);
      if (typeof data.version === "string") setVersion(data.version);
      if (data.type !== "captures") return;
      const captures = Array.isArray(data.captures) ? data.captures : [];
      const got = captures.length ? await toFiles(captures) : [];
      const col = sanitizeCollection(data.collection);
      if (got.length || col) {
        const key = batchKey(captures, col);
        if (key === lastBatch.current) return;
        lastBatch.current = key;
        setFiles(got);
        setCollected(col);
        setFrom(col?.url || captures[0]?.url || "");
        setPending(captures);
        window.postMessage({ source: "kaiwu-page", type: "received" }, window.location.origin);
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

  // 粘贴主页链接一键拆解：交给插件去打开主页、自动采集，采完回到这一页自动开拆
  const collectByLink = () => {
    const url = douyinLinkFromText(link);
    if (!url) return setLinkMsg("没认出抖音链接：打开对标账号的主页，复制浏览器地址栏的链接，或者抖音 App 里「分享主页 → 复制链接」");
    if (!installed) {
      setDismissed(false);
      return setLinkMsg("要先装「开物 · 截屏带入」插件（看下面的步骤），装好刷新这一页再点");
    }
    if (version && versionBelow(version, COLLECT_SINCE)) return setLinkMsg("插件是旧版本，还不会一键采集：先按下面的提示更新插件");
    window.postMessage({ source: "kaiwu-page", type: "collect", url }, window.location.origin);
    setLinkMsg("插件已经去打开这个主页、自动采集了：大约 1 分钟，抖音页面会自己往下翻、打开热门作品，采完自动回到这里开始拆解。采集时先别动那个标签页；抖音要求验证的话，在那个页面上手动完成就行。");
    setLink("");
  };
  const linkForm = (
    <section className="glass-panel space-y-2 rounded-2xl p-5">
      <p className="text-[14px] font-medium text-foreground">粘贴对标账号主页，一键拆解</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          aria-label="对标账号的抖音主页链接"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") collectByLink(); }}
          placeholder="粘贴抖音主页链接，或抖音 App 里分享主页复制的整段文字"
          className="min-w-0 flex-1 rounded-lg border border-border bg-background/50 px-3 py-2 text-[13px] text-foreground"
        />
        <button type="button" onClick={collectByLink} className="brand-gradient shrink-0 rounded-lg px-4 py-2 text-[13px] font-medium text-white">一键采集并拆解</button>
      </div>
      <p className="text-[12px] text-muted-foreground">插件会读主页信息、作品和点赞、最火 3 条作品的评论，按做账号定位的维度把对方的定位倒着拆一遍。在电脑上登录抖音网页版能读得更全。</p>
      {linkMsg && <p className="text-[12.5px] text-foreground">{linkMsg}</p>}
    </section>
  );

  const status = (() => {
  if (placed) {
    return (
      <p className="rounded-xl border border-primary/40 px-4 py-2.5 text-[13px] text-foreground">
        {started
          ? <>插件采集的数据已经放进「{placed}」，正在拆解，往下找到这个账号看进度。想拆得更细，可以再传一两条爆款视频。</>
          : <>插件带来的截图已经放进「{placed}」的拆解里，往下找到这个账号，点「开始拆解」就行。想拆得更细，可以再传一两条爆款视频。</>}
      </p>
    );
  }

  if (files.length || collected) {
    return (
      <section className="glass-panel space-y-3 rounded-2xl border border-primary/40 p-5">
        <p className="flex items-center gap-2 text-[14px] font-medium text-foreground">
          <ImagePlus className="h-4 w-4 text-primary" />插件带来了{collected ? `「${collected.profile.name || "对标账号"}」的采集数据` : ""}{files.length ? ` ${files.length} 张截图` : ""}{from && <span className="truncate text-[12px] font-normal text-muted-foreground">（{from}）</span>}
        </p>
        {accounts.length ? (
          <>
            <p className="text-[12.5px] text-muted-foreground">放进哪个对标账号的拆解？放进去以后，可以再传爆款视频，一起拆。</p>
            <div className="flex flex-wrap gap-2">
              {accounts.map((a) => (
                <button key={a.id} type="button" onClick={() => { onAssign(a.id, files, collected); setFiles([]); setCollected(null); }} className="rounded-lg brand-gradient px-3 py-1.5 text-[12.5px] font-medium text-white">
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
            <p className="text-[14px] font-medium text-foreground">装一个「开物 · 截屏带入」插件，一键采集对标账号</p>
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              打开对标账号的抖音主页，点一下「一键采集」：插件自动读作品、点赞和热门作品的评论，大约 1 分钟，读完自动带进这里开始拆解。
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

  if (installed && version && pluginOutdated(version)) {
    return (
      <p className="rounded-xl border border-primary/40 px-4 py-2.5 text-[12.5px] text-foreground">
        {versionBelow(version, COLLECT_SINCE) ? "插件有新版本，能一键采集整个账号了" : "插件有新版本：采完一定会回到这里接着拆，抖音中途要求验证也会先把读到的带回来"}：<a href={EXTENSION_ZIP} download className="text-primary hover:underline">下载新版</a>，解压后覆盖原来的文件夹，再到扩展程序页点插件上的「重新加载」，然后刷新这一页。
      </p>
    );
  }

  if (installed) {
    return (
      <p className="rounded-xl border border-border/60 px-4 py-2.5 text-[12.5px] text-muted-foreground">
        插件已装好。也可以直接在抖音主页上点右下角开物面板的「一键采集这个账号」，读完一样会带回这里开始拆解。
      </p>
    );
  }

  return null;
  })();

  return (
    <div className="space-y-3">
      {linkForm}
      {status}
    </div>
  );
}
