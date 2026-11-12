// 只在服务器应用目录里跑线上探针（.kb-probe/），不纳入 npm test。
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  root: process.cwd(),
  test: {
    environment: 'node',
    include: ['.kb-probe/*.probe.ts'],
    setupFiles: ['.kb-probe/env.setup.ts'],
    testTimeout: 1_200_000,
    hookTimeout: 120_000,
    fileParallelism: false,
    globals: true,
  },
  resolve: {
    alias: { '@': path.resolve(process.cwd()) },
  },
});
