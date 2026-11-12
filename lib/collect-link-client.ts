/**
 * 点「一键采集」之前和之后（2026-11-10：点了没反应）。页面上用，诊断账号、月度复盘、拆对标共用。
 * 之前：先让服务器把链接解析一遍（app/api/douyin-link）——不是主页的当场说清楚，是主页的把真实地址交给插件；
 * 之后：插件正常会马上新开一个抖音标签页（开物这一页就被切到后台）。8 秒内这一页一直在前台，说明插件没动，提示怎么查。
 */
import { DOUYIN_LINK_BAD, webProfileUrl } from './douyin-link';

export type PreparedLink = { ok: true; url: string } | { ok: false; message: string };

/** 插件包。页面上的「下载插件」都指到这里（public/kaiwu-capture.zip，构建时打包） */
export const EXTENSION_ZIP = '/kaiwu-capture.zip';

/** 认定没装插件时立刻给的中文说明。必须在 8 秒内出现，旁边再放下载链接，不能先转圈 */
export const PLUGIN_MISSING = '还没检测到「开物 · 截屏带入」插件。请先下载安装，解压后在浏览器扩展程序页打开「开发者模式」，点「加载已解压的扩展程序」，选解压出来的文件夹，装好刷新这一页再点。';

/** 插件后来报到了：把「没装」那句收掉，别的提示留着 */
export function clearMissingPluginMessage(message: string): string {
  return message === PLUGIN_MISSING ? '' : message;
}

/**
 * 采集结果要开一轮新生成时，会先把结果区清空。
 * 结果区已经有内容（没写完的拆解、诊断）就先别开，免得盖掉。
 * 用户写在输入框里的字不从这里判断：那个框本来就不会被采集正文替换。
 */
export function canStartFromCapture(visibleResult: string): boolean {
  return !visibleResult.trim();
}

/** 正在改策略卡，或这张卡已经是用户改过再保存的：采集回来先别开一轮新复盘（会换成新卡） */
export function shouldHoldReviewCapture(input: { editing: boolean; edited: boolean }): boolean {
  return input.editing || input.edited;
}

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

export const PLUGIN_SILENT = '插件没有打开抖音页面。请检查：① 浏览器右上角「扩展程序」里「开物 · 截屏带入」是开着的、版本是 0.5.0（旧的点旁边的「下载插件」重新安装）；② 装好或更新后刷新这一页再点。还不行，可以先点「只用导入的数据」。';

/** 没装、没反应、或插件太旧：说明旁边要有可点的下载链接 */
export function pluginMessageNeedsDownload(message: string): boolean {
  return message === PLUGIN_MISSING || message === PLUGIN_SILENT || message.includes('旧版本');
}

/** 交给插件之后最多等这么久。到点这一页还在前台，就说明插件没开新标签页 */
export const PLUGIN_PROMPT_MS = 8000;

/** 交给插件后看一眼：8 秒内这一页一直在前台（插件没开新标签页），调 onSilent */
export function watchPluginOpened(onSilent: () => void, ms = PLUGIN_PROMPT_MS): () => void {
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
