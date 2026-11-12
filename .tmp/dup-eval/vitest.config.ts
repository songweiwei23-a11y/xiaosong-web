// 选题查重真实验证专用配置（不纳入 npm test）。只在服务器上跑
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  root: process.cwd(),
  test: { environment: 'node', include: ['.tmp/dup-eval/*.eval.ts'], testTimeout: 600_000, globals: true },
  resolve: { alias: { '@': path.resolve(process.cwd()) } },
});
