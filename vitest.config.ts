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
    // 全量跑、机器忙时，很多用例要冷启动导入整条 Dify 路由、记账等大模块，
    // 默认 5 秒 / 10 秒会误判超时；超时的用例还会把没收完的请求留给下一个用例。放宽到 30 秒，真卡死的仍会失败。
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
