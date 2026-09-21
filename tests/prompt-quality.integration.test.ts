// 提示词质量端到端检查（手动运行，不纳入 npm test）
//   npx vitest run tests/prompt-quality.integration.ts
//
// 用真实的 lib 函数拼出注入提示词的各段，调用 Dify 生成脚本，
// 再用项目自带的评分器打分，检验提示词改动是否真的产出更规整的脚本。
import { describe, it, expect } from 'vitest';
import { recommendFormula, generateFormulaGuide } from '@/lib/formula-enforcer';
import { getRelevantExample, evaluateScriptQualityStrict, formatQualityReport } from '@/lib/quality-checker';
import { getStructureNarrative } from '@/lib/script-structure-details';
import { buildSearchQuery } from '@/lib/search-query';

const KEY = 'app-GNoqBbJQjVLiGBrgMGUcpbhz';

function buildPrompt() {
  const scriptType = 'teach';
  const structureId = 'compare';
  const duration = '60秒';
  const formulaType = recommendFormula(scriptType, '对比型');
  const narrative = getStructureNarrative(structureId);

  return `# 内容创作短视频脚本生成

## 基础信息
- **内容类型**：教知识
- **行业领域**：本地餐饮
- **平台**：抖音
- **时长**：${duration}
- **主题**：新手开烤肉店，选址最容易踩的坑

## 🧠 本结构的设计意图

- **核心逻辑**：${narrative!.coreLogic}
- **情绪曲线**：${narrative!.emotionCurve}

情绪曲线里的每个箭头都是一次情绪转折，波点必须落在转折处。

${generateFormulaGuide(formulaType)}

## 📎 MCN级参考范例（9.5分标准）

只学分段节奏、波点标注位置和台词口语化程度，不要照搬行业与台词。

${getRelevantExample(scriptType, duration, structureId)}

## 目标定位
- **目标受众**：想开店的餐饮创业者
- **内容风格**：接地气

请直接输出完整可拍摄的脚本。`;
}

describe('提示词质量端到端', () => {
  it(
    '生成脚本并按项目评分标准打分',
    async () => {
      const prompt = buildPrompt();
      const searchQuery = buildSearchQuery('脚本生成', { taskType: '脚本生成', scriptType: 'teach' }, prompt);

      console.log('\n===== 提示词规模 =====');
      console.log(`完整提示词: ${prompt.length} 字`);
      console.log(`  其中公式指南: ${generateFormulaGuide('compare').length} 字`);
      console.log(`  其中MCN范例: ${getRelevantExample('teach', '60秒', 'compare').length} 字`);
      console.log(`检索用短查询(${searchQuery.length} 字): ${searchQuery}`);

      const t0 = Date.now();
      const r = await fetch('https://api.dify.ai/v1/chat-messages', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputs: { query: prompt, search_query: searchQuery, conversation_history: '', dealReasons: '' },
          query: prompt,
          response_mode: 'blocking',
          user: 'prompt-quality-check',
        }),
      });
      const txt = await r.text();
      expect(r.ok, `HTTP ${r.status}: ${txt.slice(0, 300)}`).toBe(true);
      const data = JSON.parse(txt);
      const script = data.answer || '';

      console.log(`\n===== 生成结果 =====`);
      console.log(`耗时 ${((Date.now() - t0) / 1000).toFixed(1)}s   长度 ${script.length} 字`);
      console.log(`知识库召回: ${(data.metadata?.retriever_resources || []).length} 条`);

      const evalResult = evaluateScriptQualityStrict(script);
      console.log('\n===== 质量评分（项目自带标准）=====');
      console.log(formatQualityReport(evalResult));

      console.log('\n===== 结构符合度 =====');
      const checks: Array<[string, boolean]> = [
        ['含秒数标注', /\d+\s*-\s*\d+\s*秒/.test(script)],
        ['含镜头描述', /镜头|画面/.test(script)],
        ['含情绪波点', /[😰😓💕🤝⚡💡🔍]|波点/.test(script)],
        ['含金句', /金句/.test(script)],
        ['含行动指令', /评论区|点赞|关注|扣1|私信/.test(script)],
        ['无废话开场', !/^[\s\S]{0,200}大家好我是/.test(script)],
        ['无营销腔', !/匠心|用心打造|倾力|赋能|深耕/.test(script)],
      ];
      for (const [name, pass] of checks) console.log(`  ${pass ? '✅' : '❌'} ${name}`);

      console.log('\n===== 脚本开头 300 字 =====');
      console.log(script.slice(0, 300));
    },
    180000
  );
});
