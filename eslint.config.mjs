// ESLint 9 平铺配置（2026-10-04）。
// Next.js 16 去掉了 `next lint`（见 node_modules/next/dist/docs/01-app/03-api-reference/05-config/03-eslint.md），
// 改用 ESLint 命令行：npm run lint = eslint .
//
// 规则调整只有下面几处，每处写明原因；没有整体关闭任何规则集。
import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // 和 eslint-config-next 注册 react-hooks 插件的文件范围一致
    files: ['**/*.{js,jsx,mjs,ts,tsx,mts,cts}'],
    rules: {
      // 历史代码里 supabase 行、流式事件大量用 any（约 250 处）。保留为警告，新代码尽量收窄；一次性全改风险大于收益
      '@typescript-eslint/no-explicit-any': 'warn',
      /*
       * eslint-plugin-react-hooks 7 新增的 React Compiler 诊断。项目是 React 18、没有启用 React Compiler，
       * 「effect 里 setState」「渲染中读 ref.current 存最新回调」「事件处理里调 Date.now()」在 React 18 下是合法写法。
       * 保留为警告做改造清单（数量见 docs/Claude优化交付_20261004.md），不当作错误阻断。
       * 注意：static-components（渲染中定义组件，会整块重新挂载、丢输入）仍是错误，已修掉 ProfileForm 里的 19 处。
       */
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
    },
  },
  {
    // CommonJS 脚本（运维、迁移演练、Dify 维护）和 tailwind 配置本来就用 require
    files: ['**/*.cjs', 'tailwind.config.js'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  globalIgnores([
    // eslint-config-next 默认忽略的
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // 验收素材、宣传片脚本、临时文件：不是应用代码
    'docs/**',
    '.tmp/**',
    'public/**',
  ]),
])

export default eslintConfig
