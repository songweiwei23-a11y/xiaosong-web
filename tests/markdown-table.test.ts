import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Markdown } from '@/components/markdown';

/**
 * 分镜正文是一张 7 列的表格，线上却渲染成了一整段流水账：
 *   | 镜号 | 景别 | … | 拍摄要点 ||---|---|…|| 1 | 特写 🔍 | 推镜 | 店招牌…
 *
 * react-markdown 默认只支持 CommonMark，**表格是 GFM 扩展**，不挂 remark-gfm
 * 就不认。不认不会报错：那些行被当成一个普通段落，而 Markdown 会把段落内的
 * 单换行折叠成空格，于是整张表塌成一行。
 *
 * 所以这里不测「有没有 import 插件」，直接把 Markdown 真渲染一遍，
 * 看有没有出来 <table>——这是唯一能证明它真的生效的方式。
 */

const TABLE = `## 分镜脚本表

| 镜号 | 景别 | 运镜 | 画面内容 | 台词/旁白 | 时长 | 拍摄要点 |
|---|---|---|---|---|---|---|
| 1 | 特写 | 推镜 | 店招牌局部文字+灯光 | 无 | 2s | 傍晚或夜晚拍，招牌灯要亮 |
| 2 | 近景 | 固定 | 博主站在店门口 | 今天我要曝光编导行业 | 3s | 补光灯45度打在脸上 |
| 3 | 中景 | 固定 | 博主正面，手指向镜头 | 粉丝不到5000的老板 | 4s | 手指动作要自然 |`;

const render = (md: string) => renderToStaticMarkup(React.createElement(Markdown, null, md));

describe('Markdown 表格渲染', () => {
  it('分镜表真的渲染成 <table>，而不是一段文字', () => {
    const html = render(TABLE);
    expect(html, '没有渲染出 table，说明 remark-gfm 没生效').toContain('<table');
  });

  it('七列表头一列不少', () => {
    const html = render(TABLE);
    // 注意 <th 也会匹配上 <thead，所以要求紧跟空白或 >
    const headers = [...html.matchAll(/<th(?:\s[^>]*)?>(.*?)<\/th>/g)].map((m) => m[1]);
    expect(headers).toEqual(['镜号', '景别', '运镜', '画面内容', '台词/旁白', '时长', '拍摄要点']);
  });

  it('每一行都是独立的 <tr>，没有被挤成一段', () => {
    const html = render(TABLE);
    const bodyRows = (html.match(/<tr>/g) || []).length;
    expect(bodyRows).toBe(4); // 表头 1 行 + 内容 3 行
  });

  it('分隔行不会作为文字漏到页面上', () => {
    // 塌掉的时候页面上能看到 `||---|---|---|`，这是最显眼的症状
    expect(render(TABLE)).not.toContain('|---|');
  });

  it('宽表格能横向滚动——7 列在结果区里放不下', () => {
    expect(render(TABLE)).toContain('overflow-x-auto');
  });

  it('不把 react-markdown 的内部 node 对象漏成 HTML 属性', () => {
    // v9 会给自定义组件多传一个 node（AST 节点），原样展开就会渲染出
    // node="[object Object]"，React 还会在控制台告警
    expect(render(TABLE)).not.toContain('node="[object Object]"');
  });

  it('普通 Markdown 照常工作：标题、加粗、列表不受影响', () => {
    const html = render('## 标题\n\n**重点**内容\n\n- 第一条\n- 第二条');
    expect(html).toContain('<h2');
    expect(html).toContain('<strong>');
    expect(html).toContain('<li>');
  });
});
