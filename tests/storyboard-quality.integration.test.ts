// 分镜提示词的真实产出检验（手动运行，不纳入 npm test）
//   npx vitest run -c vitest.integration.config.ts tests/storyboard-quality.integration.test.ts
//
// 分镜此前只有格式约束，产出的是「格式正确的表」而不是「专业分镜」。
// 补上方法论之后，得真跑一次看它是不是真的按那套判断在排镜头。
import { describe, it, expect } from 'vitest';
import { buildStoryboardPrompt } from '@/lib/storyboard-standards';
import { buildSearchQuery } from '@/lib/search-query';

const KEY = process.env.DIFY_API_KEY || '';

const SCRIPT = `【开场钩子】0-3秒：拍了半年没人看？问题出在开头这3秒。

【镜头1】0-8秒
台词："你每天早上六点爬起来拍，发出去一看，播放量37，点赞3个，还有俩是你妈给的。"

【镜头2】8-30秒
台词："第一个原因，开头太慢。观众前三秒就决定走不走，你还在那儿自我介绍。
第二个原因，画面在复述台词——嘴上说牛肉新鲜，镜头就怼一块牛肉，等于白拍。"

【镜头3】30-55秒
台词："真正有效的做法是：开头直接抛冲突，画面给台词之外的信息。
比如说老板五点去进货，你就拍凌晨的市场和挂着水珠的箱子。"

【收尾】55-60秒
金句："开头不是自我介绍，是抛钩子"
CTA："评论区扣1，我发你一份开场钩子清单。"`;

describe('分镜提示词的真实产出', () => {
  it('把一条 60 秒口播稿拆成可执行分镜', async () => {
    const prompt = buildStoryboardPrompt({
      scriptContent: SCRIPT,
      platform: '抖音',
      duration: '60秒',
      contentType: 'tutorial',
      visualStyle: 'cinematic',
      visualStyleLabel: '电影感',
      additionalInfo: '一个人用手机拍，没有灯',
    });

    const searchQuery = buildSearchQuery('分镜脚本', { taskType: '分镜脚本', platform: '抖音' }, prompt);
    console.log('\n===== 分镜提示词规模 =====');
    console.log(`提示词 ${prompt.length} 字，检索短查询「${searchQuery}」`);

    const t0 = Date.now();
    const r = await fetch('https://api.dify.ai/v1/chat-messages', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inputs: { query: prompt, search_query: searchQuery, conversation_history: '', dealReasons: '' },
        query: prompt,
        response_mode: 'blocking',
        user: 'storyboard-quality-check',
      }),
    });
    const txt = await r.text();
    expect(r.ok, `HTTP ${r.status}: ${txt.slice(0, 300)}`).toBe(true);
    const data = JSON.parse(txt);
    const out: string = data.answer || '';

    console.log(
      `耗时 ${((Date.now() - t0) / 1000).toFixed(1)}s  产出 ${out.length} 字  知识库召回 ${(data.metadata?.retriever_resources || []).length} 条`
    );

    // ---- 结构层：该有的段落在不在 ----
    const rows = (out.match(/^\|\s*\d+\s*\|/gm) || []).length;
    const structural: Array<[string, boolean]> = [
      ['首行是分镜脚本表', /^#\s*🎬?\s*分镜脚本表/m.test(out)],
      ['有 markdown 表格', /\|\s*镜号\s*\|/.test(out)],
      [`表格有镜头行（实际 ${rows} 行）`, rows >= 4],
      ['景别用了 emoji', /[📷🎥📹📸🔍]/.test(out)],
      ['有节奏自检', /节奏自检|特写占比/.test(out)],
      ['有拍摄顺序建议', /拍摄顺序|拍摄批次/.test(out)],
      ['有拍摄清单', /拍摄清单|必备/.test(out)],
      ['有翻车风险提示', /翻车|风险/.test(out)],
      ['没有开场寒暄', !/^好的|^以下是|希望对你有帮助/.test(out.trim())],
      ['没有反问用户', !/请问你|你能否告诉我|需要你提供/.test(out)],
    ];

    console.log('\n===== 结构层 =====');
    for (const [n, ok] of structural) console.log(`  ${ok ? '✅' : '❌'} ${n}`);

    // ---- 专业层：它是不是真的按方法论在排 ----
    const closeUps = (out.match(/特写/g) || []).length;
    const allShots = (out.match(/[📷🎥📹📸🔍]/g) || []).length;
    const closeUpRatio = allShots ? Math.round(((out.match(/🔍/g) || []).length / allShots) * 100) : 0;
    const durations = [...out.matchAll(/\|\s*(\d+(?:\.\d+)?)\s*s\s*\|/gi)].map((m) => Number(m[1]));
    const total = durations.reduce((a, b) => a + b, 0);
    const longest = durations.length ? Math.max(...durations) : 0;

    const professional: Array<[string, boolean]> = [
      [`特写占比 ${closeUpRatio}%（应 ≤25%）`, closeUpRatio > 0 && closeUpRatio <= 30],
      [`镜头时长合计 ${total}s（目标 60s）`, total >= 50 && total <= 70],
      [`最长镜头 ${longest}s（应 ≤6s 或有说明）`, longest > 0 && longest <= 10],
      ['用了不止一种景别', new Set(out.match(/[📷🎥📹📸🔍]/g) || []).size >= 3],
      ['提到了画面提供台词之外的信息', /之外|不复述|补充|佐证|反差/.test(out)],
      ['台词是从原稿里摘的', out.includes('播放量') || out.includes('自我介绍')],
      ['提到了收音/环境音或空镜', /收音|环境音|空镜|同期声/.test(out)],
    ];

    console.log('\n===== 专业层 =====');
    for (const [n, ok] of professional) console.log(`  ${ok ? '✅' : '❌'} ${n}`);

    const sPass = structural.filter(([, ok]) => ok).length;
    const pPass = professional.filter(([, ok]) => ok).length;
    console.log(`\n结构层 ${sPass}/${structural.length}   专业层 ${pPass}/${professional.length}`);
    console.log(`（特写 ${closeUps} 处提及，表格识别到 ${allShots} 个景别标记）`);

    console.log('\n===== 产出前 1200 字 =====');
    console.log(out.slice(0, 1200));
  }, 240000);
});
