/* 离线交接检查（不调用模型）：每一跳交接后，原始诉求、焦点方案、目的还在不在；有没有带上不相干的旧脚本。 */
const path = require('node:path');
const b = require('./bundle.cjs');

const profile = { profile_name: '测试_青禾家具店_链路验收', account_platform: ['抖音'], account_track: ['家居装修'], product_category: ['沙发', '床', '衣柜'], persona_facts: { yearsInTrade: '家具从业12年', yearsLocal: '来苏州3年', others: '门店开了2年' }, taboo_settings: { excluded: [] } };
const ctx = { profile, positioning: null, dealReasons: [] };
const INTENT = '国庆过完这一周店里冷清了，进店的人少了一半。想拍几条视频把客人拉回来，但不想拍成甩卖降价';
const FOCUS = '国庆后门店冷清，用老客回访把人拉回来';
const OLD_SCRIPT = '【旧脚本·不相干】这是另一个方案：全场五折，限时抢购。';
const body = `### 方向1：${FOCUS}\n- **视频目的**：流量型\n- **讲法**：晒过程——店主回访老客，说明为什么回来看看。`;

const hops = [
  { name: '创作方向 → 选题策划', from: 'direction', to: 'topic', body },
  { name: '创作方向 → 脚本生成', from: 'direction', to: 'script', body },
  { name: '脚本生成 → 审稿优化', from: 'script', to: 'review', body: `## 第2步：纯文字文案\n店主：国庆过完，门店冷清了。\n## 第3步：完整分镜脚本\n【镜头1】0-5秒 店主站在门口说话。` },
  { name: '审稿优化 → 分镜脚本', from: 'review', to: 'storyboard', body: `## 4. 优化后的完整脚本\n店主：国庆过完，门店冷清了，想请老客回来看看。` },
];

let failures = 0;
for (const hop of hops) {
  // 模拟来源页的设置里残留着别的方案的旧脚本（交接之前就在设置里）：交接时要丢掉它，不能带到下一步
  const payload = b.buildCreationHandoff(hop.from, hop.to, hop.body, { from: b.CREATION_SOURCES[hop.from], title: FOCUS, settings: { userIntent: INTENT, focusContent: FOCUS, duration: '30秒', platform: '抖音', purposeText: '引流到店', workingScript: OLD_SCRIPT } });
  const dirty = payload;
  const s = b.resolveCreationSettings(dirty, ctx);
  const checks = {
    '原始诉求保留（冷清 + 不甩卖）': /冷清/.test(s.userIntent || '') && /甩卖/.test(s.userIntent || ''),
    '焦点方案保留': (s.focusContent || '').includes('老客回访'),
    '目的保留（引流到店）': (s.purposeText || '').includes('引流到店') || /到店|拉回/.test(s.userIntent || ''),
    '旧脚本没有带过去': !(s.workingScript || '').includes('全场五折') && !(payload.settings.workingScript || '').includes('全场五折'),
  };
  const bad = Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k);
  if (bad.length) failures++;
  console.log(`${bad.length ? '✗' : '✓'} ${hop.name}${bad.length ? '  失败项：' + bad.join('、') : ''}`);
}
console.log(failures ? `离线交接：${failures} 跳有问题` : '离线交接：全部通过');
