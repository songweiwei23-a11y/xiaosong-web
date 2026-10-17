/**
 * 2026-10-17 跨板块链路验证发现：来源页设置里残留的旧脚本，交接到「脚本」板块时也会带过去（原来只有选题页清理）。
 * 现在所有目标板块都一样：只有产出脚本的板块才能带自己的脚本过去。
 */
import { describe, it, expect } from 'vitest';
import { buildCreationHandoff } from '@/lib/creation-flow';

const OLD_SCRIPT = '【旧脚本】全场五折，限时抢购。';
const body = '### 方向1：国庆后门店冷清，用老客回访把人拉回来\n- **对应目的**：引流到店';

describe('旧脚本不跨板块带过去', () => {
  it('创作方向 → 脚本生成：不带旧脚本', () => {
    const p = buildCreationHandoff('direction', 'script', body, { from: '创作方向', title: '老客回访', settings: { workingScript: OLD_SCRIPT } });
    expect(p.settings?.workingScript).toBeUndefined();
  });
  it('创作方向 → 审稿优化：不带旧脚本', () => {
    const p = buildCreationHandoff('direction', 'review', body, { from: '创作方向', settings: { workingScript: OLD_SCRIPT } });
    expect(p.settings?.workingScript ?? '').not.toContain('全场五折');
  });
  it('脚本生成 → 审稿优化：带自己的脚本过去（这是正常的续接）', () => {
    const script = '## 第2步：纯文字文案\n店主：国庆过完，门店冷清了，想请老客回来看看。';
    const p = buildCreationHandoff('script', 'review', script, { from: '脚本生成', settings: {} });
    expect(p.settings?.workingScript ?? '').toContain('国庆过完');
  });
});
