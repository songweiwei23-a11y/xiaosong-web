// 开物多轮质量评测专用配置（不纳入 npm test）。
//   npx vitest run -c .tmp/quality-eval/vitest.config.ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  root: process.cwd(),
  test: {
    environment: 'node',
    include: ['.tmp/quality-eval/*.eval.ts'],
    setupFiles: ['.tmp/quality-eval/env.setup.ts'],
    testTimeout: 900_000,
    hookTimeout: 120_000,
    fileParallelism: false,
    globals: true,
  },
  resolve: {
    alias: { '@': path.resolve(process.cwd()) },
  },
});
