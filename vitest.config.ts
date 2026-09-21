import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // 集成测试会真实调用 Dify、耗时约一分钟且消耗接口额度，
    // 不适合随每次提交跑。需要时单独指定文件运行：
    //   npx vitest run tests/prompt-quality.integration.test.ts
    exclude: ['**/node_modules/**', '**/*.integration.test.ts'],
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
