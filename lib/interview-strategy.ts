/**
 * 前采记录里混进的策划稿（2026-10-29）。
 *
 * 线上实测：一份前采文件前三节是客户原话和基本信息，后面几节（「四、IP定位与账号规划」「七、内容大纲」
 * 「八、拍摄执行方案」）是别人写好的策划稿。导入时两样一起当「前采」存进档案、一起交给提取，
 * 提取和生成都会把策划稿当成客户说过的话。
 *
 * 这里把策划稿的章节认出来、剔掉：只留客户原话，剔掉的章节标题告诉编导，由他自己判断。
 * 判断依据是章节标题（定位、规划、大纲、策略、执行、行动计划、待确认、分析、选题、拍摄方案），
 * 不认正文，所以不会把客户原话里的「规划」「分析」这类字误剔。
 */

/** 章节标题里出现这些词，就当作策划稿（编导或别人写的定位、大纲、执行安排，不是客户说的） */
const STRATEGY_HEADING = /定位|规划|大纲|策略|框架|执行|行动计划|待确认|分析|选题|拍摄方案/;

/** 章节开头：「一、」「十二、」或 markdown 标题 */
const SECTION_START = /^(?:[一二三四五六七八九十百]+、|#{1,4}\s)/;

export interface StrategySplit {
  /** 留下的：客户原话和基本信息（第一个章节之前的内容也留下） */
  kept: string;
  /** 剔掉的章节标题（原样），给编导看 */
  removed: string[];
}

export function splitStrategyBlock(text: string): StrategySplit {
  const kept: string[] = [];
  const removed: string[] = [];
  let dropping = false;
  for (const line of text.split('\n')) {
    if (SECTION_START.test(line)) {
      dropping = STRATEGY_HEADING.test(line);
      if (dropping) removed.push(line.trim());
    }
    if (!dropping) kept.push(line);
  }
  return { kept: kept.join('\n').replace(/\n{3,}/g, '\n\n').trim(), removed };
}
