// 联网搜索诊断专用（不纳入 npm test），只在服务器上跑
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  root: process.cwd(),
  test: {
    environment: 'node',
    include: ['.tmp/search-diag/*.eval.ts'],
    setupFiles: ['.tmp/search-diag/env.setup.ts'],
    testTimeout: 600_000,
    globals: true,
  },
  resolve: { alias: { '@': path.resolve(process.cwd()) } },
});
