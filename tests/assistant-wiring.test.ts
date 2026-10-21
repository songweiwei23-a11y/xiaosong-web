/**
 * 助理的接线与安全（2026-10-20）：
 *  - 助理的工具不能直接调用会自己扣额度的生成接口，否则一次对话会扣两次；
 *  - 额度：每条消息预留 1 次自由对话，成功结算，停止或出错释放；
 *  - 中转密钥不能出现在仓库的任何文件里。
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('助理的工具不会重复扣额度', () => {
  it('工具文件不调用自由对话接口（它扣自由对话额度，会和助理对话重复）；板块接口只用于审稿，且走和页面一样的生成接口', () => {
    const src = read('lib/assistant/tools.ts');
    // 只看代码里的字符串（注释里提到这些接口是为了说明，不算调用）
    expect(src).not.toMatch(/['"`]\/api\/dify\/chat/);
    expect(src).not.toMatch(/\baskDify\s*\(/);
    expect(src).toContain('`${base}/api/dify/stream`');
    expect(src).toContain("taskType: '审稿优化'");
  });

  it('对话入口不调用自由对话或板块生成接口', () => {
    expect(read('lib/assistant/run.ts')).not.toContain('/api/dify');
    expect(read('app/api/assistant/route.ts')).not.toContain('/api/dify');
  });
});

describe('额度：每条消息预留 1 次自由对话，成功结算，停止或出错释放', () => {
  it('入口先预留（额度不够直接返回，不启动模型）', () => {
    const src = read('app/api/assistant/route.ts');
    expect(src).toMatch(/reserveCreation\(userId, 'freeChat'/);
    expect(src.indexOf('reserveCreation(')).toBeLessThan(src.indexOf('runAssistantJob('));
  });

  it('成功结算，停止和出错都释放', () => {
    const src = read('lib/assistant/run.ts');
    expect(src).toMatch(/settleCreation\(input\.reservation, true/);
    expect(src.match(/releaseCreation\(input\.reservation\)/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it('停止时不结算（先判断停止，再结算）', () => {
    const src = read('lib/assistant/run.ts');
    const stopCheck = src.indexOf('if (job.stopRequested)');
    const settle = src.indexOf('settleCreation(input.reservation');
    expect(stopCheck).toBeGreaterThan(0);
    expect(stopCheck).toBeLessThan(settle);
  });
});

describe('密钥不进仓库', () => {
  const KEY_PREFIX = 'sk-b4720cdc8391178ec9';
  const SCAN = ['lib', 'app', 'components', 'hooks', 'tests', 'scripts', 'supabase'];
  const SKIP = new Set(['node_modules', '.next', '.git']);

  const walk = (dir: string, out: string[]) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (SKIP.has(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full, out);
      else out.push(full);
    }
  };

  it('扫描的文件数足够多（否则这条测试是空过的），并且没有任何文件包含中转密钥', () => {
    const files: string[] = [];
    for (const d of SCAN) walk(path.join(ROOT, d), files);
    expect(files.length).toBeGreaterThan(200);
    const leaks = files.filter((f) => {
      // 这个测试文件自己写着密钥的前缀，用来做检查，不算泄露
      if (f.endsWith('assistant-wiring.test.ts')) return false;
      try {
        return fs.readFileSync(f, 'utf8').includes(KEY_PREFIX);
      } catch {
        return false;
      }
    });
    expect(leaks).toEqual([]);
  });
});

describe('界面：右下角助理，只在已配置时显示，靠轮询取进度', () => {
  it('仪表盘布局挂了助理', () => {
    expect(read('app/dashboard/layout.tsx')).toContain('<AssistantWidget />');
  });

  it('界面先问服务端是否已配置；提交后轮询进度，不一直挂着请求', () => {
    const src = read('components/assistant/AssistantWidget.tsx');
    expect(src).toContain('/api/assistant?status=1');
    expect(src).toContain('setInterval');
    expect(src).toContain('/api/assistant?job=');
    expect(src).not.toMatch(/process\.env/);
  });

  it('接口：提交立刻返回任务号，不等模型跑完', () => {
    const src = read('app/api/assistant/route.ts');
    expect(src).toContain('void runAssistantJob(');
    // 长期对话后多返回了对话编号（没有存储时为 null），任务号仍然是立刻返回的
    expect(src).toContain('return Response.json({ jobId: job.id, threadId });');
  });
});
