// 联网搜索基准评测专用（不纳入 npm test），只在服务器上跑。
// overlay/ 里有本地改过、还没部署的模块时，评测用它们替换线上同名模块（见 make-overlay.mjs），线上代码本身不动
import { defineConfig } from 'vitest/config';
import path from 'node:path';
import fs from 'node:fs';

const root = process.cwd();
const overlayDir = path.resolve(root, '.tmp/search-bench/overlay');
const useOverlay = process.env.BENCH_OVERLAY === '1' && fs.existsSync(`${overlayDir}/names.json`);
const names: string[] = useOverlay ? JSON.parse(fs.readFileSync(`${overlayDir}/names.json`, 'utf8')) : [];

export default defineConfig({
  root,
  test: {
    environment: 'node',
    include: ['.tmp/search-bench/*.eval.ts'],
    setupFiles: ['.tmp/search-diag/env.setup.ts'],
    testTimeout: 1_800_000,
    globals: true,
  },
  resolve: {
    alias: [
      ...names.map((n) => ({ find: new RegExp(`^@/lib/${n}$`), replacement: `${overlayDir}/${n}.ts` })),
      { find: /^@\//, replacement: `${root}/` },
    ],
  },
});
