// 创作上下文的真实效果检验（手动运行，不纳入 npm test）
//   npx vitest run -c vitest.integration.config.ts tests/creator-context.integration.test.ts
//
// 结构对不对，和模型有没有真的照着做，是两回事。这里拿库里那个填得最满的
// 真实档案跑两次分镜——一次带账号背景，一次不带——看产出是否真的不同。
import { describe, it, expect } from 'vitest';
import { buildStoryboardPrompt } from '@/lib/storyboard-standards';
import { buildContextBlock, type CreatorContext, type CreatorProfile } from '@/lib/creator-context';
import { buildSearchQuery } from '@/lib/search-query';

const KEY = process.env.DIFY_API_KEY || '';

/** 结构与库里那个 44 字段的真实档案一致 */
const PROFILE: CreatorProfile = {
  id: 'p1',
  profile_name: '言山廷潮汕牛肉自助火锅店',
  account_platform: ['抖音'],
  account_track: ['美食烹饪'],
  content_format: ['口播', '探店'],
  content_style: ['接地气', '实用'],
  // 关键：这个号有专业设备和团队，不是「一个人一部手机」
  equipment: ['手机', '相机', '专业摄像机', '灯光', '收音设备', '稳定器'],
  team_structure: '2-3人小团队',
  shooting_location: ['店铺', '外景'],
  video_duration: ['30-60秒'],
};

const SCRIPT = `【开场】0-5秒：60多吃潮汕牛肉自助，你敢信是原切鲜切的吗？
【中段】5-40秒：今天直接带你们进后厨。师傅正在现切吊龙，刀刃下去牛肉还在回弹。
旁边这盘是冷冻调理肉，颜色发暗、切面松散——区别一眼就看出来。
【收尾】40-55秒：好肉不怕看。评论区扣"想吃"，我发你避坑清单。`;

const base = {
  scriptContent: SCRIPT,
  platform: '抖音',
  duration: '55秒',
  contentType: 'food',
  visualStyle: 'bright',
  visualStyleLabel: '明亮清新',
  additionalInfo: '',
};

const ctx: CreatorContext = { profile: PROFILE, positioning: null, dealReasons: [] };

async function run(prompt: string) {
  const searchQuery = buildSearchQuery('分镜脚本', { taskType: '分镜脚本', platform: '抖音' }, prompt);
  const r = await fetch('https://api.dify.ai/v1/chat-messages', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      inputs: { query: prompt, search_query: searchQuery, conversation_history: '', dealReasons: '' },
      query: prompt,
      response_mode: 'blocking',
      user: 'context-check',
    }),
  });
  const txt = await r.text();
  expect(r.ok, `HTTP ${r.status}: ${txt.slice(0, 200)}`).toBe(true);
  return JSON.parse(txt).answer || '';
}

describe('账号背景是否真的改变了产出', () => {
  it('带上真实拍摄条件之后，分镜会用上这些设备', async () => {
    const withCtx = buildStoryboardPrompt({ ...base, contextBlock: buildContextBlock(ctx, 'storyboard') });
    const without = buildStoryboardPrompt(base);

    console.log(`\n提示词规模：带背景 ${withCtx.length} 字 / 不带 ${without.length} 字`);
    console.log(`背景块本身 ${withCtx.length - without.length} 字\n`);

    const [a, b] = await Promise.all([run(withCtx), run(without)]);
    console.log(`产出：带背景 ${a.length} 字 / 不带 ${b.length} 字\n`);

    // 设备类词汇：有稳定器就该敢安排运动镜头，有灯光就该设计光位
    // 注意：计数用 /g，逐行筛选必须用不带 /g 的那个。
    // 同一个 /g 正则反复 .test() 会带着 lastIndex 往前跳，漏掉一半的行。
    const GEAR = '稳定器|专业摄像机|灯光|补光|收音|麦克风|三脚架|双机位|第二机位|副机位';
    const gearAll = new RegExp(GEAR, 'g');
    const gearOne = new RegExp(GEAR);
    const gearWith = (a.match(gearAll) || []).length;
    const gearWithout = (b.match(gearAll) || []).length;

    console.log('=== 设备与团队相关的表述 ===');
    console.log(`  带背景：${gearWith} 处`);
    console.log(`  不带：  ${gearWithout} 处`);

    const showLines = (text: string, label: string) => {
      const hits = text.split('\n').filter((l) => gearOne.test(l)).slice(0, 4);
      console.log(`\n  ${label}：`);
      for (const l of hits) console.log('    ' + l.trim().slice(0, 110));
      if (hits.length === 0) console.log('    （没有提到任何设备）');
    };
    showLines(a, '带背景的分镜里');
    showLines(b, '不带背景的分镜里');

    // 不带背景时提示词明确说「只有一部手机、一个人、没有灯」，
    // 带背景时说「按它给的条件来」——产出应当有可观察的差别
    expect(gearWith).toBeGreaterThan(gearWithout);

    console.log('\n=== 带背景的产出，前 900 字 ===');
    console.log(a.slice(0, 900));
  }, 300000);
});

/**
 * 脚本板块以前只传 6 个字段（名称/平台/赛道/阶段/粉丝/风格），
 * 档案里「绝对不能说」这一栏一个字都没传。这条验它现在传到了、且被遵守。
 *
 * 【为什么不拿「最好/第一/全网最便宜」来测】试过，测不出来：
 * 对照组（完全不给禁忌）也是 0 处违规——Dify 后端本身就全局禁了绝对化用语。
 * 那条测试不管改没改都会绿，等于没测。所以这里改用**账号特有、后端不会管**
 * 的禁忌：不许出现具体价格数字。这是真实存在的需求（价格会变、平台也限流），
 * 而模型在"突出价格优势"的要求下一定会写出数字——对照组会踩，差异才成立。
 *
 * 注意：这里用的是精简提示词，不是脚本页那条完整的（它拼在组件里，
 * 没法从外面调）。测的是**禁忌这段文字有没有被遵守**，不是整页效果。
 */
describe('账号特有的硬禁忌是否真的被遵守', () => {
  const TASK = `请为下面这个账号写一条 45 秒的抖音促销口播脚本。
要求：突出我们的价格优势和牛肉品质优势，语气要强、要有冲击力，让人看完立刻想来。
只输出脚本正文。`;

  it('档案里写了「不许出现价格数字」，产出里就不能有', async () => {
    const profile: CreatorProfile = {
      ...PROFILE,
      content_tone: '亲切朋友式',
      unique_selling_point: '坚持原切鲜切牛肉，拒绝合成调理冻肉',
      target_pain_points: '低价自助宣传鲜切，实际是冻肉、调理合成肉',
      content_restrictions:
        '文案里绝对不能出现任何具体价格数字（不能写"60多""59元""人均80"这类），价格一律用"这个价""亲民价"带过',
    };
    const withCtx = buildContextBlock({ profile, positioning: null, dealReasons: [] }, 'script') + '\n\n' + TASK;

    const [a, b] = await Promise.all([run(withCtx), run(TASK)]);

    const price = /\d+\s*(?:元|块|多|块钱)|人均\s*\d+|￥\s*\d+/g;
    const hitsWith = a.match(price) || [];
    const hitsWithout = b.match(price) || [];

    console.log('\n=== 价格数字 ===');
    console.log(`  带禁忌：${hitsWith.length} 处 ${hitsWith.length ? '→ ' + hitsWith.join('、') : ''}`);
    console.log(`  不带：  ${hitsWithout.length} 处 ${hitsWithout.length ? '→ ' + hitsWithout.join('、') : ''}`);

    // 对照组得真的踩坑，这条对比才算数
    expect(
      hitsWithout.length,
      '对照组没写出任何价格数字，这条测试区分不了「禁忌生效」和「模型本来就不会写」'
    ).toBeGreaterThan(0);

    // 硬约束，不是"少一点就行"
    expect(hitsWith.length, `带了禁忌还写出：${hitsWith.join('、')}`).toBe(0);

    console.log('\n=== 带禁忌的产出，前 600 字 ===');
    console.log(a.slice(0, 600));
  }, 300000);
});
