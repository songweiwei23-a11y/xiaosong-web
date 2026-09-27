/**
 * 首页首屏「一句话开始」+ 首页公开体验码。
 *
 * 首屏给完全不懂的小白：说一句自己是做什么的 → 当场看到这一行的选题样例 → 注册。
 * 邀请制保留，但从首页进注册时自动带上公开体验码——小白手上没有码，看到要填码就走了。
 * 这里守的都是"不报错、只是人流失"的那类：认错行业、码对不上、按钮还指向老地方。
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { INDUSTRY_SAMPLES, PUBLIC_TRIAL_CODE, REGISTER_URL, matchIndustry } from '@/lib/landing';
import { readCode } from './helpers/source';

describe('认行业', () => {
  it('常见说法认得对', () => {
    const cases: [string, string][] = [
      ['我在县城开了家面馆', 'food'],
      ['我是卖奶茶的', 'food'],
      ['包子铺老板', 'food'],
      ['我开了家理发店', 'beauty'], // 有"店"也有"理发"：认理发，不认门店
      ['做美甲的', 'beauty'],
      ['商场里的女装店', 'cloth'],
      ['我是初中英语老师', 'edu'],
      ['我在小区开了个水果店', 'shop'],
      ['卖五金的', 'shop'],
      ['全职宝妈想做副业', 'mom'],
      ['我开了一家店', 'shop'], // 只有一个"店"，没别的线索：按门店零售
    ];
    for (const [text, id] of cases) expect(matchIndustry(text)?.id, text).toBe(id);
  });

  it('认不出就老实说认不出（页面上说明是别的行业的样例），不硬猜', () => {
    expect(matchIndustry('随便看看')).toBeNull();
    expect(matchIndustry('   ')).toBeNull();
  });

  it('样例：每行 3 个选题 + 一句开头；不承诺收益', () => {
    expect(INDUSTRY_SAMPLES.length).toBeGreaterThanOrEqual(6);
    for (const i of INDUSTRY_SAMPLES) {
      expect(i.topics.length, i.name).toBe(3);
      expect(i.hook.length, i.name).toBeGreaterThan(5);
      expect([...i.topics, i.hook, i.who].join(' '), i.name).not.toMatch(/月入|年入|赚了|收入翻|保证/);
      // 每行自己的"自我介绍"要能认回自己——输入框的提示语就是它，照着打不能认错
      expect(matchIndustry(i.who)?.id, i.who).toBe(i.id);
    }
  });
});

describe('首屏', () => {
  const hero = readCode('components/landing/hero/TryHero.tsx');
  const home = readCode('app/page.tsx');

  it('标题讲小白能得到什么；原来那句"Claude AI 驱动 · 专业编导知识库"撤掉', () => {
    expect(hero).toContain('不会拍短视频？');
    expect(hero).toContain('说一句你是做什么的');
    expect(home).not.toContain('Claude AI驱动 · 专业编导知识库');
    expect(hero).not.toContain('Claude');
    expect(home).toContain('<TryHero />');
  });

  it('扫描：对外宣传不点名境外大模型（隐私政策里"数据交给了谁"的披露除外）', () => {
    // 生成式 AI 备案的合规风险：宣传写"AI 智能生成"，数据去向在隐私政策里照实写
    const list = (dir: string): string[] =>
      fs.readdirSync(path.join(process.cwd(), dir), { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? list(path.join(dir, e.name)) : /\.tsx$/.test(e.name) ? [path.join(dir, e.name)] : []
      );
    const files = [...list('app'), ...list('components')].filter((f) => !f.includes(path.join('app', 'privacy')));
    expect(files.length).toBeGreaterThan(100); // 自证不是空转
    const bad = files.filter((f) => /Claude|Anthropic/.test(readCode(f)));
    expect(bad).toEqual([]);
    // 隐私政策里的披露还在
    expect(fs.readFileSync(path.join(process.cwd(), 'app/privacy/page.tsx'), 'utf8')).toContain('Anthropic 的 Claude 模型');
  });

  it('样例标明示意；认不出行业时说清楚给的是别的行业', () => {
    expect(hero).toContain('示意样例');
    expect(hero).toContain('先给你看餐饮店的样例');
  });

  it('没写字就点：提示先写一句，不往下走', () => {
    expect(hero).toMatch(/if \(!text\.trim\(\)\) \{\s*setEmpty\(true\);\s*return;/);
  });
});

describe('首页公开体验码', () => {
  const migration = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/20260928_public_trial_code.sql'), 'utf8');

  it('代码里的码和迁移里插入的码是同一个（对不上就是注册时"邀请码不存在"）', () => {
    expect(migration).toContain(`'${PUBLIC_TRIAL_CODE}'`);
    expect(REGISTER_URL).toBe(`/login?mode=register&code=${PUBLIC_TRIAL_CODE}`);
  });

  it('兑换函数支持多人共用，一次性的旧码行为不变', () => {
    expect(migration).toMatch(/AND use_count < max_uses/);
    expect(migration).toMatch(/AND \(max_uses > 1 OR used_by IS NULL\)/);
    expect(migration).toMatch(/used_by = CASE WHEN max_uses = 1 THEN p_user_id ELSE used_by END/);
    // 只有服务端能调，浏览器不能拿来撞码
    expect(migration).toMatch(/GRANT EXECUTE ON FUNCTION claim_invitation_code\(TEXT, UUID\) TO service_role/);
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION claim_invitation_code\(TEXT, UUID\) FROM anon/);
  });

  it('首页所有"开始用"的按钮都进注册（码已填好），不再把人扔到登录框', () => {
    const home = readCode('app/page.tsx');
    expect((home.match(/href=\{REGISTER_URL\}/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect(readCode('components/landing/hero/TryHero.tsx')).toMatch(/href=\{REGISTER_URL\}/);
    expect(readCode('components/landing/LandingNavCTA.tsx')).toMatch(/href=\{REGISTER_URL\}[\s\S]{0,200}免费试用/);
  });

  it('登录页认这个链接：直接打开注册、码填好；已登录的直接回工作台', () => {
    const login = readCode('app/login/page.tsx');
    expect(login).toMatch(/q\.get\("mode"\) === "register"\) setIsLogin\(false\)/);
    expect(login).toMatch(/setInviteCode\(code\)/);
    expect(login).toMatch(/if \(session\) router\.replace\("\/dashboard"\)/);
    expect(login).toContain('体验码已经帮你填好了');
  });
});
