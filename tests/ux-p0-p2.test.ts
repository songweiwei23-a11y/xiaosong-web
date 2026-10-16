/**
 * 2026-10-16 体验拆解的 P0–P2 修复：
 * 免费联网不乱扣、进门说明写清楚、拆解的守页与通知、禁忌给出原句、导航说明、版本错配提示、长结果摘要优先。
 */
import { describe, it, expect } from 'vitest';
import { previewCut } from '@/lib/text-preview';
import { scanTaboos, fixRequest } from '@/lib/taboos';
import { notifyDone, askDoneNotice } from '@/lib/browser-notify';
import { readCode } from './helpers/source';

describe('长结果摘要优先（previewCut）', () => {
  it('不超过上限的原样返回', () => {
    expect(previewCut('很短的一段', 100)).toBe('很短的一段');
  });
  it('在段落处截断，不把一段话切成两半', () => {
    const text = 'a'.repeat(900) + '\n\n' + 'b'.repeat(1500);
    expect(previewCut(text, 1000)).toBe('a'.repeat(900));
  });
  it('段落分隔太靠前就按字数截，避免摘要只剩一小段', () => {
    const text = 'a'.repeat(100) + '\n\n' + 'b'.repeat(3000);
    expect(previewCut(text, 2000).length).toBe(2000);
  });
  it('没有段落分隔时按字数硬截', () => {
    expect(previewCut('c'.repeat(3000), 2000).length).toBe(2000);
  });
});

describe('禁忌提示给出原句', () => {
  it('命中词所在的原句被保留，长句以命中词为中心截短', () => {
    const line = 'x'.repeat(80) + '全城最便宜' + 'y'.repeat(80);
    const hits = scanTaboos(line, null);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].line).toContain('全城最便宜');
    expect(hits[0].line.length).toBeLessThan(line.length);
  });
  it('修改要求里带上原句，AI 能找到是哪一句', () => {
    const hits = scanTaboos('今天来吃，全城最便宜！', null);
    expect(fixRequest(hits)).toContain('原句：「今天来吃，全城最便宜！」');
  });
});

describe('系统通知（拆解完成时）', () => {
  it('没有 Notification 或没有授权时静默，不影响结果', () => {
    expect(() => askDoneNotice()).not.toThrow();
    expect(() => notifyDone('拆解完成', '测试', true)).not.toThrow();
  });
});

describe('接线：各处确实用上了这次的改动', () => {
  it('免费联网：按需联网的说明写进了下拉框提示，「本轮联网」注明会扣次数', () => {
    const page = readCode('app/dashboard/free-chat/page.tsx');
    expect(page).toMatch(/title="按需联网：只在要查资料、或问新闻时自动搜，每次扣 1 次额度/);
    expect(page).toMatch(/<option value="on">本轮联网（扣 1 次）<\/option>/);
  });

  it('进门：门禁页、落地页、定价页都写了去哪里索要邀请', () => {
    expect(readCode('app/gate/page.tsx')).toMatch(/还没有邀请？加客服微信[\s\S]{0,80}SUPPORT_WECHAT/);
    expect(readCode('app/page.tsx')).toMatch(/没有邀请码？加客服微信[\s\S]{0,80}SUPPORT_WECHAT/);
    expect(readCode('app/pricing/page.tsx')).toMatch(/没有邀请码？加客服微信[\s\S]{0,80}SUPPORT_WECHAT/);
    expect(readCode('app/pricing/page.tsx')).toMatch(/索要邀请码体验/);
  });

  it('拆解：只有浏览器里的前三步才拦关页；AI 那一步不拦，文案按阶段区分', () => {
    const page = readCode('app/dashboard/breakdown/page.tsx');
    expect(page).toMatch(/const browserBusy = running && !textMode && \(stage === "frames" \|\| stage === "audio" \|\| stage === "upload"\)/);
    expect(page).toMatch(/addEventListener\("beforeunload", warn\)/);
    expect(page).toMatch(/stage === 'ai'[\s\S]{0,120}离开页面也会继续/);
  });

  it('拆解：开始时请求通知授权，完成时按是否离开页面决定要不要提醒', () => {
    const page = readCode('app/dashboard/breakdown/page.tsx');
    expect(page).toMatch(/setRunning\(true\);\n\s+askDoneNotice\(\);/);
    expect(page).toMatch(/notifyDone\("拆解完成"[\s\S]{0,80}!alive\.current\)/);
  });

  it('禁忌提示显示原句', () => {
    expect(readCode('components/workspace/TabooScan.tsx')).toMatch(/原句：「\{h\.line\}」/);
  });

  it('导航：账号运营组有建议顺序，「高阶自由」改名「自由对话」并带说明', () => {
    const sidebar = readCode('components/dashboard/Sidebar.tsx');
    expect(sidebar).toMatch(/建议顺序：前采建档 → 账号定位 → 创作简报 → 起号/);
    expect(sidebar).toMatch(/name: "自由对话"/);
    expect(sidebar).not.toMatch(/name: "高阶自由"/);
    expect(sidebar).toMatch(/title=\{item\.hint\}/);
  });

  it('版本错配：根布局挂了刷新提示，识别的是版本错配类错误', () => {
    expect(readCode('app/layout.tsx')).toMatch(/<VersionRefreshNotice \/>/);
    expect(readCode('components/ui/VersionRefreshNotice.tsx')).toMatch(/Failed to find Server Action/);
  });

  it('退出登录按钮说明了退出后这台电脑要重新凭邀请进门', () => {
    expect(readCode('components/auth/UserProfile.tsx')).toMatch(/title="退出后，这台电脑再打开首页要重新凭邀请链接或门票进门"/);
  });

  it('长结果：单篇正文超过上限时先显示摘要，复制下载仍用全文', () => {
    const panel = readCode('components/workspace/ResultPanel.tsx');
    expect(panel).toMatch(/collapseBody \? previewCut\(view, PREVIEW_BODY_CHARS\) : view/);
    expect(panel).toMatch(/展开全文（共 \{view\.length\} 字/);
  });
});
