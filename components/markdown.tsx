"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { remarkAutolinkBoundary } from "@/lib/remark-autolink-boundary";
import type { ComponentProps } from "react";

/**
 * 全站统一的 Markdown 渲染。
 *
 * 【为什么要有这个组件】分镜脚本的正文是一张 7 列的表格，页面上却渲染成了
 * 一整段连着的文字：`| 镜号 | 景别 | … | 拍摄要点 ||---|---|…|| 1 | 特写 …`。
 *
 * 原因是 react-markdown 默认只支持 CommonMark，**表格属于 GFM 扩展**，
 * 不挂 remark-gfm 就不认。不认的后果不是报错，而是那些行被当成一个普通段落——
 * 而 Markdown 会把段落内的单个换行折叠成空格，于是整张表塌成一行流水账。
 * 分镜页当时 import 了 remarkGfm，但真正渲染结果的是 ResultPanel，
 * 那个 import 从头到尾没被用到，谁看代码都会以为已经支持了。
 *
 * 全站有 5 个地方渲染模型输出，当时 5 个都漏了。与其各自记得加插件，
 * 不如只留这一个入口——漏插件这种事不报错、构建正常，靠人记是记不住的。
 *
 * 【表格为什么要自己写样式】包一层 not-prose 是为了能给它加横向滚动：
 * 分镜表有 7 列，在结果区那个宽度里必然放不下，不滚动就会挤成一团或者
 * 把整个页面撑出横向滚动条。not-prose 会同时关掉 prose 对单元格的样式，
 * 所以 th/td 的边框和内边距得在这儿补回来。
 */

type MarkdownProps = {
  children: string;
  /** 额外的 class，挂在最外层包裹元素上 */
  className?: string;
};

const td = "border border-border/70 px-3 py-2 align-top text-[13px] leading-relaxed";

/**
 * react-markdown v9 会给每个自定义组件多传一个 `node`（AST 节点）。
 * 原样 {...props} 展开会把它当成 HTML 属性写进去，页面上就出现
 * `node="[object Object]"`，React 也会在控制台告警。这里统一摘掉。
 */
function clean<T extends object>(props: T & { node?: unknown }): T {
  const { node: _node, ...rest } = props;
  return rest as T;
}

export function Markdown({ children, className }: MarkdownProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkAutolinkBoundary]}
      components={{
        table: (props: ComponentProps<"table">) => (
          <div className={`not-prose my-4 overflow-x-auto rounded-xl border border-border ${className ?? ""}`}>
            <table className="w-full border-collapse text-foreground" {...clean(props)} />
          </div>
        ),
        thead: (props: ComponentProps<"thead">) => <thead className="bg-foreground/[0.06]" {...clean(props)} />,
        th: (props: ComponentProps<"th">) => (
          <th className={`${td} whitespace-nowrap font-semibold`} {...clean(props)} />
        ),
        // 单元格给个最小宽度：列多的表（分镜 5-7 列）在手机上会被挤成一个字一行，
        // 有了最小宽度就在表格框里左右滑，而不是挤扁；列少的表照样铺满
        td: (props: ComponentProps<"td">) => <td className={`${td} min-w-[5.5rem]`} {...clean(props)} />,
      }}
    >
      {children}
    </ReactMarkdown>
  );
}

export default Markdown;
