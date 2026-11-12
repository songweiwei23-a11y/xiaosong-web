// 联网读需求检验专用配置（不纳入 npm test）。只在服务器上跑：模型密钥只在服务器的 .env.local
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  root: process.cwd(),
  test: {
    environment: 'node',
    include: ['.tmp/search-plan-eval/*.eval.ts'],
    setupFiles: ['.tmp/search-plan-eval/env.setup.ts'],
    testTimeout: 300_000,
    globals: true,
  },
  resolve: { alias: { '@': path.resolve(process.cwd()) } },
});
