/**
 * 点「一键采集」之前和之后（2026-11-10：点了没反应）。页面上用，诊断账号、月度复盘、拆对标共用。
 * 之前：先让服务器把链接解析一遍（app/api/douyin-link）——不是主页的当场说清楚，是主页的把真实地址交给插件；
 * 之后：插件正常会马上新开一个抖音标签页（开物这一页就被切到后台）。8 秒内这一页一直在前台，说明插件没动，提示怎么查。
 */
import { DOUYIN_LINK_BAD, webProfileUrl } from './douyin-link';

export type PreparedLink = { ok: true; url: string } | { ok: false; message: string };

export async function prepareCollectLink(url: string): Promise<PreparedLink> {
  try {
    const res = await fetch('/api/douyin-link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
    const d = await res.json().catch(() => null) as { url?: string; kind?: string; error?: string } | null;
    if (!res.ok || !d?.url) return { ok: true, url }; // 解析服务出问题：不挡，原样交给插件
    if (d.kind === 'other') return { ok: false, message: DOUYIN_LINK_BAD };
    return { ok: true, url: webProfileUrl(d.url) };
  } catch {
    return { ok: true, url };
  }
}

export const PLUGIN_SILENT = '插件没有打开抖音页面。请检查：① 浏览器右上角「扩展程序」里「开物 · 截屏带入」是开着的、版本是 0.5.0（旧的到「对标 & 热点」页重新下载安装）；② 装好或更新后刷新这一页再点。还不行，可以先点「只用导入的数据」。';

/** 交给插件后看一眼：8 秒内这一页一直在前台（插件没开新标签页），调 onSilent */
export function watchPluginOpened(onSilent: () => void, ms = 8000): () => void {
  let left = false;
  const onHide = () => { if (document.visibilityState === 'hidden') left = true; };
  document.addEventListener('visibilitychange', onHide);
  const timer = window.setTimeout(() => {
    document.removeEventListener('visibilitychange', onHide);
    if (!left && document.visibilityState === 'visible') onSilent();
  }, ms);
  return () => { window.clearTimeout(timer); document.removeEventListener('visibilitychange', onHide); };
}

/** 插件版本：页面标记 data-kaiwu-capture 的值就是版本号（插件的 bridge.js 写的），hello 消息没收到也能读到 */
export function pluginVersionFromPage(): string {
  return document.documentElement.getAttribute('data-kaiwu-capture') || '';
}
