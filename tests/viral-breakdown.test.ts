/**
 * 拆解爆款：提示词、接口、页面接线。
 *
 * 守的是验证时踩过的坑（2026-09-30 拿真实样片跑出来的）：
 *   - 模型看不清拼图里的字就猜，编出原片没有的情节
 *   - 把"荷尔蒙"自己重新定义成"情感浓度"
 *   - 把几个镜头合成一行，漏掉中间一段
 *   - 长视频只拆了前 3 分钟，却替后面编结论
 */
import { describe, it, expect } from 'vitest';
import { buildBreakdownPrompt, metaLines, shotStats, BREAKDOWN_TASK_TYPE } from '@/lib/viral-breakdown';
import { shotsFromCuts, pickFrames } from '@/lib/video-frames';
import { VIRAL_ELEMENTS, SCRIPT_FAMILIES } from '@/lib/viral-elements';
import { OPENING_CARDS } from '@/lib/opening-cards';
import { GROWTH_TACTICS } from '@/lib/growth-tactics';
import { TASK_TYPE_TO_FEATURE } from '@/lib/task-type';
import { ISOLATED_TASKS } from '@/lib/topic-library';
import { COUNTED_FEATURES, SUBSCRIPTION_PLANS } from '@/lib/config/plans';
import { readCode } from './helpers/source';
import { friendlyDifyError } from '@/lib/dify-errors';

const shots = shotsFromCuts([8.6, 10.9, 12.3, 29.3], 40);
const base = {
  duration: 40,
  width: 1280,
  height: 720,
  shots,
  frames: pickFrames(shots, 40),
  sheetCount: 2,
  transcript: [
    { start: 0, end: 10.9, text: '🎼所以你没上大学录取通知书怎么处理了' },
    { start: 10.9, end: 40, text: '' },
  ],
  meta: {},
};

describe('提示词', () => {
  const p = buildBreakdownPrompt(base);

  it('八层 + 逐镜头表，按顺序一节不少', () => {
    const heads = ['一句话：这条为什么能火', '〇、值不值得学', '一、账号层', '二、选题层', '三、开篇拆解', '四、结构骨架和情绪曲线', '五、逐镜头拆解', '六、包装', '七、能学走什么'];
    let last = -1;
    for (const h of heads) {
      const i = p.indexOf(`### ${h}`);
      expect(i, h).toBeGreaterThan(last);
      last = i;
    }
    expect(p).toContain('| 镜头 | 时间 | 时长 | 画面内容 | 景别 | 运镜 | 构图/光线 | 写实/写意 | 置景 | 口播/字幕 | 声音 | 这一镜的作用 | 情绪(1-5) |');
  });

  it('分类名从代码里的同一份清单取，八大元素带上意思（实测模型把荷尔蒙说成情感浓度）', () => {
    for (const e of VIRAL_ELEMENTS) expect(p).toContain(`${e.name}：${e.hook}`);
    for (const s of SCRIPT_FAMILIES) expect(p).toContain(s.name);
    for (const c of OPENING_CARDS) expect(p).toContain(c.name);
    for (const t of GROWTH_TACTICS) expect(p).toContain(t.name);
    expect(p).toMatch(/不要自己重新定义/);
  });

  it('看不清的字不许猜；口播以语音识别为准；分清旁白和同期声；道具不许挪镜头', () => {
    expect(p).toMatch(/有一个字看不清，这一句就写「看不清」，\*\*绝对不要猜着补\*\*/);
    expect(p).toMatch(/以上面的语音识别为准/);
    expect(p).toMatch(/旁白/);
    expect(p).toMatch(/不要把别的镜头里的东西/);
  });

  it('一个镜头一行，不许随手合并（实测合并后漏了一段唱歌的空镜）', () => {
    expect(p).toMatch(/\*\*一个镜头一行，不要把几个镜头合成一行\*\*/);
  });

  it('声音：🎼 表示有背景音乐；其余听不到的标"推测"', () => {
    expect(p).toMatch(/带 🎼 的那一段有背景音乐/);
    expect(p).toMatch(/（推测）/);
  });

  it('镜头表和口播带时间码；程序算的数直接给', () => {
    expect(p).toContain('镜头1：00:00.0-00:08.6（8.6 秒）');
    expect(p).toContain('[00:00.0-00:10.9] 🎼所以你没上大学录取通知书怎么处理了');
    expect(p).toMatch(/一共 5 个镜头，平均每个 8\.0 秒/);
    expect(p).toContain('横屏（1280×720）');
  });

  it('长视频只拆前 3 分钟：明说，不许替后面编', () => {
    const t = buildBreakdownPrompt({ ...base, duration: 180, fullDuration: 593, truncated: true });
    expect(t).toMatch(/整条 593 秒，\*\*这次只拆前 180 秒\*\*/);
    expect(t).toMatch(/不要替后面编/);
    expect(p).not.toMatch(/这次只拆前/);
  });

  it('没识别出口播：用用户贴的文案；都没有就说明可能是纯画面', () => {
    const silent = { ...base, transcript: [] };
    expect(buildBreakdownPrompt({ ...silent, pastedScript: '今天教你挑牛肉' })).toMatch(/用户贴的文案）\n今天教你挑牛肉/);
    expect(buildBreakdownPrompt(silent)).toMatch(/纯画面 \+ 音乐/);
  });

  it('有档案才给"套到这个账号上"的 3 个选题；没有就提醒去选', () => {
    const withProfile = buildBreakdownPrompt({ ...base, profileSummary: '- 档案名称：阿强牛肉' });
    expect(withProfile).toMatch(/套到这个账号上\*\*：按下面的档案，给 3 个/);
    expect(withProfile).toContain('- 档案名称：阿强牛肉');
    expect(p).toMatch(/选好档案可以一键套用/);
    expect(p).not.toMatch(/当前账号档案/);
  });
});

describe('程序算好的数', () => {
  it('镜头统计：个数、平均、最长、前 3 秒切几刀', () => {
    expect(shotStats(shotsFromCuts([0.8, 1.6, 2.4, 10], 20))).toEqual({ count: 5, avgLen: 4, longest: 10, cutsInOpening: 3 });
    expect(shotStats([])).toMatchObject({ count: 0, avgLen: 0 });
  });

  it('数据：点赞是粉丝的几倍、互动比都算好；没填的不写', () => {
    const lines = metaLines({ likes: 100000, favorites: 30000, comments: 5000, followers: 20000, title: '扔掉录取通知书' });
    expect(lines).toContain('- 点赞是粉丝数的 5.0 倍');
    expect(lines.join('\n')).toMatch(/收藏\/点赞 = 0\.30，评论\/点赞 = 0\.05/);
    expect(lines).toContain('- 标题/文案：扔掉录取通知书');
    expect(metaLines({})).toEqual([]);
    expect(metaLines({ likes: -1, followers: 0 })).toEqual([]);
  });
});

describe('接到全站', () => {
  it('单独一项额度：免费 3 次；任务类型对得上；不接共用会话', () => {
    expect(TASK_TYPE_TO_FEATURE[BREAKDOWN_TASK_TYPE]).toBe('breakdown');
    expect(COUNTED_FEATURES.find((f) => f.key === 'breakdown')?.column).toBe('breakdown_used');
    expect(SUBSCRIPTION_PLANS.free.quotas.breakdown).toBe(3);
    expect(ISOLATED_TASKS.has(BREAKDOWN_TASK_TYPE)).toBe(true);
    expect(readCode('supabase/migrations/20260930_breakdown.sql')).toMatch(/add column if not exists breakdown_used/);
  });

  it('生成走 /api/dify/stream：只转发格式正确的图片 id，最多 6 张', () => {
    const stream = readCode('app/api/dify/stream/route.ts');
    expect(stream).toMatch(/\.\.\.difyImageFiles\(body\.imageFileIds\)/);
    expect(stream).toMatch(/UPLOAD_ID_RE\.test\(x\)\)\.slice\(0, MAX_IMAGE_FILES\)/);
    expect(stream).toMatch(/const MAX_IMAGE_FILES = 6/);
  });

  it('识别口播、上传截图：要登录、要还有拆解次数（不扣）、限流、限大小', () => {
    for (const f of ['app/api/breakdown/transcribe/route.ts', 'app/api/breakdown/upload/route.ts']) {
      const src = readCode(f);
      expect(src, f).toMatch(/requireUserWithQuota\('breakdown'\)/);
      expect(src, f).not.toMatch(/incrementUsageServer/);
      expect(src, f).toMatch(/if \(limited\(guard\.userId!\)\)/);
      expect(src, f).toMatch(/file\.size > MAX_BYTES/);
      // Dify 按 user 隔离文件：上传和发消息必须是同一个 user
      expect(src, f).toMatch(/out\.append\('user', guard\.userId!\)/);
    }
  });

  it('页面：先查额度、传图拿 id、按拆解爆款发、存历史、切回来能恢复', () => {
    const page = readCode('app/dashboard/breakdown/page.tsx');
    expect(page).toMatch(/checkQuota\("breakdown"\)/);
    expect(page).toMatch(/openUpgrade\("breakdown"\)/);
    expect(page).toMatch(/taskType: BREAKDOWN_TASK_TYPE,\s*query,\s*imageFileIds: ids/);
    expect(page).toMatch(/saveGenerationHistory\(\s*BREAKDOWN_TASK_TYPE/);
    expect(page).toMatch(/useRestoreLastResult\(lastResult, setResult\)/);
    // 视频不上传：页面里不能有把视频文件本身发出去的请求
    expect(page).not.toMatch(/append\("file", file\)/);
  });

  it('失败了错误留在结果区（不只是一闪而过的提示），可以只重来传图和 AI 拆解', () => {
    const page = readCode('app/dashboard/breakdown/page.tsx');
    expect(page).toMatch(/\{error && !running && \(/);
    expect(page).toMatch(/onClick=\{\(\) => start\(true\)\}/);
    expect(page).toMatch(/const p = retry && prepared\?\.file === file \? prepared : await prepare\(file\)/);
  });

  it('截图太大被 Dify 拒：给人话，不是"生成失败"', () => {
    expect(friendlyDifyError('PluginDaemonInternalServerError: ServerlessPayloadTooLarge: action=invoke_llm payload_bytes=8165757 max_request_bytes=5242880')).toMatch(/截图太大/);
  });

  it('识别和上传：网络断了自动重发（不扣次数，重发没代价）；没额度直接报', () => {
    const client = readCode('lib/breakdown-client.ts');
    expect(client).toMatch(/if \(!isNetworkError\(e\) \|\| attempt >= RETRIES\) throw e/);
    expect(client).toMatch(/res\.status === 402/);
  });
});
