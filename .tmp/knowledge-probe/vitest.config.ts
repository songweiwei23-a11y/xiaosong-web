// 助理查知识库的真实探针（不纳入 npm test）：真实 Dify 检索 + 真实助理模型，额度相关调用用假的。
//   npx vitest run -c .tmp/knowledge-probe/vitest.config.ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  root: process.cwd(),
  test: {
    environment: 'node',
    include: ['.tmp/knowledge-probe/*.probe.ts'],
    setupFiles: ['.tmp/knowledge-probe/env.setup.ts'],
    testTimeout: 600_000,
    hookTimeout: 120_000,
    fileParallelism: false,
    globals: true,
  },
  resolve: {
    alias: { '@': path.resolve(process.cwd()) },
  },
});
