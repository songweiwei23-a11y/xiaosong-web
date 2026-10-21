/**
 * 黄金测试集的结构检查 + 工具白名单（升级方案 F1、H2）。
 * 这里不调用模型，只保证：用例够多、类别齐全、用例引用的工具都存在，并且助理的工具清单和白名单一致。
 * 新增工具必须先登记到 tests/assistant-golden/cases.ts 的白名单里，否则这里会失败。
 * 真正跑模型的是 tests/assistant-golden/live.probe.ts（在服务器上跑，见 docs/助理升级方案_20261022）。
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { GOLDEN_CASES, WRITE_TOOLS, PROPOSAL_TOOLS, BOARD_TOOLS } from './assistant-golden/cases';
import { createAssistantTools } from '@/lib/assistant/tools';

/** 只读的工具（查询，不改数据） */
const READ_TOOLS = ['read_account', 'read_quota', 'search_web', 'search_knowledge', 'list_todos', 'list_notes', 'daily_brief'];

describe('黄金测试集：结构', () => {
  it('用例够多（至少 30 条），编号不重复', () => {
    expect(GOLDEN_CASES.length).toBeGreaterThanOrEqual(30);
    const ids = GOLDEN_CASES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('五类都有用例', () => {
    for (const cat of ['read', 'write', 'refuse', 'proposal', 'knowledge'] as const) {
      expect(GOLDEN_CASES.filter((c) => c.category === cat).length, cat).toBeGreaterThanOrEqual(3);
    }
  });

  it('写入类和确认类都要求「不许虚假成功」；拒绝类也要', () => {
    for (const c of GOLDEN_CASES.filter((x) => ['write', 'proposal', 'refuse'].includes(x.category))) {
      expect(c.noFalseSuccess, c.id).toBe(true);
    }
  });

  it('知识类里至少有三条要求写出资料名', () => {
    expect(GOLDEN_CASES.filter((c) => c.citeKnowledge).length).toBeGreaterThanOrEqual(3);
  });

  it('每条用例都有一句话的问题', () => {
    for (const c of GOLDEN_CASES) expect(c.question.trim().length, c.id).toBeGreaterThan(2);
  });
});

describe('工具白名单（H2）：助理的工具清单就是这一份，多一个少一个都要改这里', () => {
  it('工具清单和白名单完全一致', () => {
    const prev = process.env.DIFY_DATASET_API_KEY;
    process.env.DIFY_DATASET_API_KEY = 'dataset-golden-test';
    try {
      const names = createAssistantTools({ userId: 'u', cookie: 'c=1' }).map((t) => t.name);
      const expected = [...READ_TOOLS, ...WRITE_TOOLS, ...PROPOSAL_TOOLS, ...BOARD_TOOLS, 'remember', 'propose_forget'];
      expect([...new Set(names)].sort()).toEqual([...new Set(expected)].sort());
      expect(names.length).toBe(new Set(names).size);
    } finally {
      if (prev === undefined) delete process.env.DIFY_DATASET_API_KEY;
      else process.env.DIFY_DATASET_API_KEY = prev;
    }
  });

  it('每条用例引用的工具都在清单里', () => {
    const known = new Set([...READ_TOOLS, ...WRITE_TOOLS, ...PROPOSAL_TOOLS, ...BOARD_TOOLS, 'remember', 'propose_forget']);
    for (const c of GOLDEN_CASES) {
      for (const t of [...(c.expectTools ?? []), ...(c.forbidTools ?? [])]) {
        expect(known.has(t), `${c.id} 引用了不存在的工具 ${t}`).toBe(true);
      }
    }
  });

  it('提议类工具不会直接改数据：工具源码里它们只调用 onAction，不调用写接口', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'lib', 'assistant', 'tools.ts'), 'utf8');
    for (const name of ['propose_delete_todo', 'propose_profile_update', 'propose_work_status']) {
      const start = src.indexOf(`name: '${name}'`);
      expect(start, name).toBeGreaterThan(0);
      const body = src.slice(start, src.indexOf('\n    },', start));
      expect(body, name).toContain('ctx.onAction?.(');
      expect(body, name).not.toMatch(/method: '(PATCH|PUT|DELETE|POST)'/);
      expect(body, name).not.toContain('todoPatch(');
    }
  });
});
