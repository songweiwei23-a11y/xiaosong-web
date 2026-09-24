import { describe, it, expect } from 'vitest';
import {
  DEAL_REASONS,
  APPLICABLE_MIN_SCORE,
  buildDealReasonPrompt,
  parseDealReasons,
  toReasonLabels,
  normalizeLegacyResult,
} from '@/lib/deal-reasons';
import { readCode } from './helpers/source';

/**
 * 成交理由。改之前四个问题叠在一起：
 *   1. 表格被页面的"格式化"撑碎（<br> 换成空行，行就断了）
 *   2. 17 个全部逐条分析，不适用的也写一大段
 *   3. 分析完自动勾上全部 17 个，保存门槛是"至少 15 个"
 *   4. 保存从来没成功过：upsert 需要 user_id 唯一约束，线上表没有（42P10）
 * 外加存的是英文代号，各板块提示词里拿到的是 looks、honest。
 */

const SAMPLE = `## 适用的成交理由

### 1. 实在不坑 · 10分
**为什么成立**：目标人群被上一个代运营坑过
**怎么拍**：
- 拍今天拒单的过程

### 2. 专业强 · 9分
**为什么成立**：编导出身
**怎么拍**：
- 拆解爆款

### 3. 老板好（8分）
**为什么成立**：有温度
**怎么拍**：
- 深夜改稿

## 不太适用

颜值高（3分）：代运营没有门店
选择多（2分）：服务单一
- 规模大(1分): 一个人的工作室

## 建议主打

实在不坑 + 专业强`;

describe('解析分析结果', () => {
  const r = parseDealReasons(SAMPLE);

  it('认出适用的理由和分数，顺序保留', () => {
    expect(r.applicable).toEqual([
      { label: '实在不坑', score: 10 },
      { label: '专业强', score: 9 },
      { label: '老板好', score: 8 },
    ]);
  });

  it('认出不适用的，兼容全角半角括号和列表符号', () => {
    expect(r.notApplicable.map((x) => x.label)).toEqual(['颜值高', '选择多', '规模大']);
  });

  it('"建议主打"一节里提到的名字不会被误算进适用', () => {
    // 那一节里又出现了"实在不坑"，不能重复计入
    expect(r.applicable.filter((x) => x.label === '实在不坑')).toHaveLength(1);
  });

  it('放错节的低分理由以分数为准，不算适用', () => {
    const r2 = parseDealReasons('## 适用的成交理由\n### 1. 颜值高 · 5分\n### 2. 专业强 · 9分');
    expect(r2.applicable.map((x) => x.label)).toEqual(['专业强']);
    expect(r2.notApplicable.map((x) => x.label)).toContain('颜值高');
  });

  it('"稀缺唯一"这种长名字不会被短名字截胡', () => {
    const r3 = parseDealReasons('## 适用的成交理由\n### 1. 稀缺唯一 · 9分');
    expect(r3.applicable).toEqual([{ label: '稀缺唯一', score: 9 }]);
  });

  it('流式输出到一半也能解析，不报错', () => {
    const half = SAMPLE.slice(0, SAMPLE.indexOf('### 2.'));
    expect(parseDealReasons(half).applicable.map((x) => x.label)).toEqual(['实在不坑']);
    expect(parseDealReasons('').applicable).toEqual([]);
  });

  it('认不出的名字丢掉，不会勾上一个不存在的理由', () => {
    const r4 = parseDealReasons('## 适用的成交理由\n### 1. 地段好 · 9分');
    expect(r4.applicable).toEqual([]);
  });
});

describe('提示词', () => {
  const p = buildDealReasonPrompt({ storeName: '小宋', storeType: '其他', storeFeatures: '编导出身' });

  it('17 个理由都列出来，名字一字不差', () => {
    for (const r of DEAL_REASONS) expect(p).toContain(r.label);
  });

  it('禁止表格和 HTML 标签——表格被撑碎就是从 <br> 开始的', () => {
    expect(p).toContain('不要用表格');
    expect(p).toMatch(/不要用任何 HTML 标签/);
  });

  it('只详细写适用的，适用门槛和解析用的是同一个数', () => {
    expect(p).toContain(`${APPLICABLE_MIN_SCORE} 分及以上`);
    expect(p).toContain('## 适用的成交理由');
    expect(p).toContain('## 不太适用');
  });

  it('要求段与段空行、不适用写成列表——不然 Markdown 会把相邻两行挤成一段', () => {
    // 预览时实测过："为什么成立""怎么拍"挤成一行，"不太适用"几条连成一段
    expect(p).toMatch(/\*\*为什么成立\*\*：[^\n]*\n\n\*\*怎么拍\*\*/);
    expect(p).toMatch(/## 不太适用\n\n- 理由名称（几分）/);
  });

  it('输出格式和解析器认的格式对得上：拿提示词里的示例去解析，能解析出来', () => {
    // 提示词里示范的那一行，正是解析器要认的格式
    const example = p.slice(p.indexOf('## 适用的成交理由'));
    const parsed = parseDealReasons(
      example
        .replace('理由名称 · 9分', '专业强 · 9分')
        .replace('- 理由名称（几分）', '- 颜值高（2分）')
    );
    expect(parsed.applicable.map((x) => x.label)).toContain('专业强');
    // 不适用那一节的示例格式（列表）解析器也要认
    expect(parsed.notApplicable.map((x) => x.label)).toContain('颜值高');
  });
});

describe('存储统一成中文名', () => {
  it('老代码存的英文代号换成中文', () => {
    expect(toReasonLabels(['looks', 'honest'])).toEqual(['颜值高', '实在不坑']);
  });
  it('中文原样保留、认不出的丢掉、重复的去掉', () => {
    expect(toReasonLabels(['专业强', 'xxx', '专业强', 'professional'])).toEqual(['专业强']);
  });
  it('不是数组就返回空', () => {
    expect(toReasonLabels(null)).toEqual([]);
    expect(toReasonLabels('专业强')).toEqual([]);
  });
});

describe('老结果修补', () => {
  it('单元格里的 <br> 换成分号，表格行不再断开', () => {
    const row = '| 专业强 | 9分 | 【必拍1】A<br>【必拍2】B |';
    const fixed = normalizeLegacyResult(row);
    expect(fixed).not.toContain('<br>');
    expect(fixed.split('\n')).toHaveLength(1);
  });
});

describe('页面与接口', () => {
  const page = readCode('app/dashboard/deal-reason/page.tsx');
  const api = readCode('app/api/deal-reasons/route.ts');

  it('不再有把 <br> 换成空行、把 || 换成加粗的格式化', () => {
    expect(page).not.toMatch(/replace\(\/<br[^)]*,\s*['"]\\n\\n['"]\)/);
    expect(page).not.toMatch(/\\\|\\\|/);
  });

  it('不再自动勾上全部 17 个', () => {
    // 旧名 setSelectedReasons、新名 setSelected 都要管，只查旧名等于没查
    expect(page).not.toMatch(/setSelected(?:Reasons)?\(\s*(?:ALL_DEAL_REASONS|DEAL_REASONS)\.map/);
  });

  it('不再要求至少选 15 个', () => {
    expect(page).not.toMatch(/<\s*15/);
  });

  it('按解析出的适用理由自动勾选', () => {
    expect(page).toContain('parseDealReasons(');
  });

  it('保存走服务端接口，不再用那个必然失败的 upsert(onConflict: user_id)', () => {
    expect(page).not.toContain('dealReasonService.save');
    expect(api).toContain('export async function POST');
    expect(api).not.toMatch(/onConflict:\s*['"]user_id['"]/);
  });

  it('读取时显式按本人过滤，并统一成中文名', () => {
    const get = api.slice(api.indexOf('export async function GET'), api.indexOf('export async function POST'));
    expect(get).toMatch(/\.eq\('user_id', guard\.userId!?\)/);
    expect(get).toContain('toReasonLabels(');
  });

  it('选题页用的也是同一份 17 个理由', () => {
    expect(readCode('app/dashboard/topic/constants.ts')).toContain('@/lib/deal-reasons');
  });
});
