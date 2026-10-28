/**
 * 2026-10-28：质检按现行提示词认选题标签和年限（之前的检查和线上写法对不上，每批都误报）。
 */
import { describe, it, expect } from 'vitest';
import { topicTagIssues } from '@/lib/output-tags';
import { yearConflicts } from '@/lib/quality-checks';

describe('选题标签：认现行提示词的写法', () => {
  it('「0️⃣ 视频目的」「5️⃣ 结尾行动指令」「核心内容方向」「7️⃣ 成交理由」都算到位', () => {
    const current = [
      '## 选题1：沙发怎么挑',
      '**0️⃣ 视频目的**：流量型',
      '**核心内容方向**：沙发选购',
      '**5️⃣ 结尾行动指令**：关注我',
      '',
      '## 选题2：靠垫换一换',
      '**0️⃣ 视频目的**：变现型',
      '**核心内容方向**：客厅搭配',
      '**5️⃣ 结尾行动指令**：到店试坐',
      '**7️⃣ 成交理由**：现场能试坐',
    ].join('\n');
    expect(topicTagIssues(current)).toEqual([]);
  });

  it('流量、人设选题不写成交理由，不算缺；变现型缺成交理由才算缺', () => {
    const flowNoDeal = '## 选题1：沙发怎么挑\n**0️⃣ 视频目的**：流量型\n**核心内容方向**：沙发\n**5️⃣ 结尾行动指令**：关注我';
    expect(topicTagIssues(flowNoDeal)).toEqual([]);
    const convertNoDeal = '## 选题1：沙发怎么挑\n**0️⃣ 视频目的**：变现型\n**核心内容方向**：沙发\n**5️⃣ 结尾行动指令**：到店试坐';
    expect(topicTagIssues(convertNoDeal)).toEqual(['第 1 条选题缺少标签「成交步骤」']);
  });
});

describe('年限：「来自」是籍贯，不是来本地居住', () => {
  const persona = { yearsInTrade: '做川菜 9 年', yearsLocal: '来南乐半年' };

  it('「王来自成都、做川菜 9 年」不误报', () => {
    expect(yearConflicts('王来自成都、做川菜 9 年，能把菜做好。', persona)).toEqual([]);
  });

  it('真的把居住年限写错还是要报', () => {
    expect(yearConflicts('我在南乐扎根 18 年，看着这条街变了。', persona).length).toBeGreaterThan(0);
  });
});
