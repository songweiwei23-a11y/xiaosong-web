import { defineConfig } from 'vitest/config';
import path from 'node:path';

/**
 * 集成测试专用配置。
 *
 * 主配置把 *.integration.test.ts 排除在外——这些用例会真实调用 Dify，
 * 一次跑掉一分多钟还消耗接口额度，不适合跟每次提交跑。但排除之后就没法
 * 单独指定文件来跑了（vitest 的 exclude 优先于命令行过滤），
 * 所以单独留一份配置：
 *
 *   npx vitest run -c vitest.integration.config.ts
 *
 * 需要环境变量 DIFY_API_KEY。
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.integration.test.ts'],
    globals: true,
    // 账号定位那条提示词一万多字、产出一万三，实测跑满 5 分 13 秒。
    // 原来设 4 分钟，一改长就超时——超时报的是 test timeout，
    // 很容易被当成功能挂了，其实只是等得不够久
    testTimeout: 600000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
