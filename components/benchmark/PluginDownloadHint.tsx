"use client";

import { EXTENSION_ZIP } from "@/lib/collect-link-client";

/** 没装插件、插件 8 秒没反应、或插件太旧：中文说明旁边给可点的下载链接 */
export function PluginDownloadHint({ text }: { text: string }) {
  if (!text) return null;
  return (
    <p className="text-[12.5px] text-foreground">
      {text}{" "}
      <a href={EXTENSION_ZIP} download className="text-primary underline">下载插件</a>
    </p>
  );
}
