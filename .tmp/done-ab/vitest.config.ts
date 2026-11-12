// 避重清单对照专用配置（不纳入 npm test）
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  root: process.cwd(),
  test: {
    environment: 'node',
    include: ['.tmp/done-ab/*.eval.ts'],
    testTimeout: 3_600_000,
    globals: true,
  },
  resolve: { alias: { '@': path.resolve(process.cwd()) } },
});
