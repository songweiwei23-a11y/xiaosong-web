import { defineConfig } from 'vitest/config';
import path from 'node:path';

/**
 * 真实调用模型的评测（evals/），和日常测试分开：日常测试只收 tests/，不碰 evals/。
 * evals/ 不在部署清单里，不会传到服务器。
 * 用法：npx vitest run --config vitest.eval.config.ts evals/chain-eval.eval.ts
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['evals/**/*.eval.ts'],
    globals: true,
    testTimeout: 14_400_000,
    hookTimeout: 60_000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
