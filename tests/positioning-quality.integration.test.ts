// 账号定位新旧提示词的真实对比（手动运行，不纳入 npm test）
//   npx vitest run -c vitest.integration.config.ts tests/positioning-quality.integration.test.ts
//
// 单测只能证明"该说的话进了提示词"，证明不了"产出真的变好"。
// 上一轮改分镜时就栽过：结构全接上、单测全绿，实测却发现模型压根没照做。
// 所以这里拿库里那个最完整的真实档案，新旧各跑一次，逐条比对差异。
import { describe, it, expect } from 'vitest';
import { buildPositioningPrompt } from '@/lib/positioning-standards';
import { buildSearchQuery } from '@/lib/search-query';

const KEY = process.env.DIFY_API_KEY || '';

const PROFILE_SUMMARY = `我的基本信息：
- 档案名称：言山廷潮汕牛肉自助火锅店
- 平台：抖音
- 赛道：美食烹饪
- 账号阶段：有定位，需要内容方向
- 粉丝量级：0-1万

目标用户画像：
- 年龄段：25-30岁、18-24岁
- 性别：不限
- 职业：白领、宝妈
- 痛点：低价自助宣传鲜切，实际是冻肉、调理合成肉
- 需求：真正鲜切原切牛肉，供货稳定不空盘

内容方向：
- 内容风格：接地气、实用
- 内容形式：口播、探店
- 内容价值：花亲民自助价格，吃实打实原切鲜切潮汕牛肉
- 独特卖点：坚持原切鲜切牛肉，拒绝合成调理冻肉

现有资源：
- 团队配置：2-3人小团队
- 设备资源：手机、相机、专业摄像机、灯光、收音设备、稳定器
- 拍摄场地：店铺、外景

变现规划：
- 变现模式：到店消费
- 价格区间：60-80元/人
- 转化钩子：60多吃潮汕牛肉自助，很多人第一反应：肉不会是合成的吧？`;

/** 旧版提示词的骨架：只规定输出哪些小节，没有任何判断依据 */
const OLD_PROMPT = `请帮我进行短视频账号定位分析

## 📋 用户档案信息
${PROFILE_SUMMARY}

## 💡 补充说明
希望多来本地客人

## 📋 输出要求

⚠️ 核心原则：只输出选题策划需要的核心信息，去掉视觉、执行、时间规划等细节

请按以下结构输出账号定位方案（总字数控制在1000字以内）：

⚠️ 特别强调：
- 必须结合抖音平台特性分析（算法偏好、用户习惯、流量分配）
- 内容配比根据账号阶段动态调整
- 内容分为：流量型、人设型、变现型
- 拍摄方向只提供思路，不要写具体选题标题
- 绝对不能出现"揭秘"二字

## 🎯 账号核心定位
### 赛道分析
### 目标用户
## 👤 账号IP个人优势
## 💎 内容方向与配比
## ⚡ 差异化优势
## 🎬 总结

⚠️ 重要要求：
- 总字数控制在1000字以内
- 不要输出：视觉呈现、妆容穿搭、话术风格、发布节奏、15天计划、变现路径、判断标准`;

async function run(prompt: string) {
  const searchQuery = buildSearchQuery('账号定位', { taskType: '账号定位' }, prompt);
  const r = await fetch('https://api.dify.ai/v1/chat-messages', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      inputs: { query: prompt, search_query: searchQuery, conversation_history: '', dealReasons: '' },
      query: prompt,
      response_mode: 'blocking',
      user: 'positioning-ab',
    }),
  });
  const t = await r.text();
  expect(r.ok, `HTTP ${r.status}: ${t.slice(0, 200)}`).toBe(true);
  return JSON.parse(t).answer || '';
}

describe('账号定位：新提示词是否真的产出更专业', () => {
  it('六维齐全、有变现路径、有判断理由', async () => {
    const neu = buildPositioningPrompt({
      profileSummary: PROFILE_SUMMARY,
      additionalNotes: '希望多来本地客人',
      platform: '抖音',
      restrictions: '绝对化宣传：最好、第一、全网最便宜',
      focus: 'full',
    });

    console.log(`\n提示词规模：新 ${neu.length} 字 / 旧 ${OLD_PROMPT.length} 字\n`);
    const [a, b] = await Promise.all([run(neu), run(OLD_PROMPT)]);
    console.log(`产出规模：新 ${a.length} 字 / 旧 ${b.length} 字\n`);

    // ① 六维是这套方法论的骨架，旧版根本没有这个概念
    const dims = ['人设定位', '用户定位', '内容定位', '呈现定位', '风格调性', '变现定位'];
    const hitNew = dims.filter((d) => a.includes(d));
    const hitOld = dims.filter((d) => b.includes(d));
    console.log('=== 六维覆盖 ===');
    console.log(`  新：${hitNew.length}/6  ${hitNew.join('、')}`);
    console.log(`  旧：${hitOld.length}/6  ${hitOld.join('、') || '（无）'}`);

    // ② 变现：旧版明确要求「不要输出变现路径」，这正是用户想要的那块
    const money = /客单价|成交路径|信任证据|到店|转化路径/g;
    const moneyNew = (a.match(money) || []).length;
    const moneyOld = (b.match(money) || []).length;
    console.log('\n=== 变现相关表述 ===');
    console.log(`  新：${moneyNew} 处 / 旧：${moneyOld} 处`);

    // ③ 有没有过"验证"这一关，而不是只抛一个漂亮标签。
    //    上一版这里数的是「因为/理由是/之所以」，新旧 1 比 0——纯噪音，
    //    模型讲理由未必用这些词。改成数提示词实际要求的结构标记。
    const verify = /验证|为什么是|凭什么|立得住|撑不住|持续证明/g;
    const vNew = (a.match(verify) || []).length;
    const vOld = (b.match(verify) || []).length;
    console.log('\n=== 论证与验证的痕迹 ===');
    console.log(`  新：${vNew} 处 / 旧：${vOld} 处`);

    // ④ 是否用上了档案里的真实资源（2-3人团队、专业设备）
    const res = /2-3人|小团队|专业摄像机|稳定器|灯光/g;
    console.log('\n=== 用上真实资源条件 ===');
    console.log(`  新：${(a.match(res) || []).length} 处 / 旧：${(b.match(res) || []).length} 处`);

    console.log('\n=== 新版产出，前 1200 字 ===');
    console.log(a.slice(0, 1200));

    expect(hitNew.length, '新版六维覆盖不足').toBeGreaterThanOrEqual(5);
    expect(hitNew.length, '新版六维应当明显多于旧版').toBeGreaterThan(hitOld.length);
    expect(moneyNew, '新版应当给出变现路径，这是旧版被砍掉的一块').toBeGreaterThan(moneyOld);
    expect(vNew, '新版应当能看到论证/验证的痕迹，而不是只抛结论').toBeGreaterThan(vOld);
  }, 300000);
});
