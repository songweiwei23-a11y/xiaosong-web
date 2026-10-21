import fs from 'node:fs';
import path from 'node:path';

/**
 * 读源码、去注释，供「代码里不许出现某某」这类扫描用。
 *
 * 【为什么单独抽出来】这个函数第一版是复制到各个测试文件里的，而且是错的。
 * 它试图单独处理 JSX 的花括号注释，用的正则大意是：
 * 先匹配一个左花括号，再匹配一段块注释，最后匹配右花括号。
 *
 * 问题在于 `} else {` 后面紧跟一段块注释时，那个左花括号会被当成
 * JSX 注释的开头，然后一路吞到很远处才找到「块注释结束 + 右花括号」，
 * 把中间的**真代码**一起删掉。实测 app/page.tsx 因此少了 5593 个字符、
 * app/login/page.tsx 少了 1101 个——而这几个文件上跑的正是
 * 「落地页不许出现编造的数字」这类断言，少扫 5.6k 字符
 * 意味着那条断言可能一直在假通过。
 *
 * 正确做法是不要特判 JSX：把所有块注释去掉之后，
 * JSX 注释自然只剩一对空花括号，对子串检查无害，也不会误伤代码。
 */
export function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '') // 块注释（JSX 注释的内容也在其中）
    .replace(/(^|[^:])\/\/.*$/gm, '$1'); // 行注释；别切到网址里的双斜杠
}

export const readSource = (rel: string) =>
  fs.readFileSync(path.join(process.cwd(), rel), 'utf8');

/** 只剩会真正跑起来/渲染出去的代码 */
export const readCode = (rel: string) => stripComments(readSource(rel));

/**
 * 选题板块的提示词拼装已经搬到 lib/boards/topic-query.ts，页面只剩收集状态。
 * 检查「提示词里有没有某句话」的测试，要读页面和这个模块合起来的源码。
 */
export const TOPIC_PAGE = 'app/dashboard/topic/page.tsx';
export const TOPIC_BOARD = 'lib/boards/topic-query.ts';
export const readTopicBoardCode = () => readCode(TOPIC_PAGE) + '\n' + readCode(TOPIC_BOARD);
export const readTopicBoardRaw = () => readSource(TOPIC_PAGE) + '\n' + readSource(TOPIC_BOARD);

/**
 * 脚本板块的提示词拼装同样搬到了 lib/boards/script-query.ts，页面只剩收集状态。
 * 检查「提示词里有没有某句话」的测试，要读页面和这个模块合起来的源码。
 */
export const SCRIPT_PAGE = 'app/dashboard/script/page.tsx';
export const SCRIPT_BOARD = 'lib/boards/script-query.ts';
export const readScriptBoardCode = () => readCode(SCRIPT_PAGE) + '\n' + readCode(SCRIPT_BOARD);
export const readScriptBoardRaw = () => readSource(SCRIPT_PAGE) + '\n' + readSource(SCRIPT_BOARD);
