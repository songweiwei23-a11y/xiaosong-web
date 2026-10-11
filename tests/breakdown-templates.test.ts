import { describe, it, expect } from 'vitest';
import { parseBreakdownTemplates, TEMPLATE_SPEC } from '@/lib/breakdown-templates';
import { buildTextBreakdownPrompt } from '@/lib/text-breakdown';

const tpl = (n: number, name: string, purpose: string) => `### 模版${n}｜${name}
- **目的**：${purpose}
- **方向**：第${n}个方向的一句话
- **二创结构**：0-3 秒 · 抓人 · 理论依据：四大脚本：情绪型 · 新题材的具体内容：这一句【待确认：你的真实情况】
- **二创开篇**：前 2 秒靠反问，前 5 秒埋期待
- **二创情绪曲线**：反转型，第 6 秒起伏
- **二创镜头**：镜头 1 近景
- **开头第一句**：这一句【待确认：你的真实情况】
- **适合的板块**：选题`;

const REPORT = `# 拆解报告
## 一、账号层
内容
## 八、套用模版（至少 5 个）

${[1, 2, 3, 4, 5].map((n) => tpl(n, `名称${n}`, ['流量型', '人设型', '变现型', '流量型', '变现型'][n - 1])).join('\n\n')}

## 九、套到这个账号上的完整方案
这一节不是模版`;

describe('拆解报告里的套用模版：解析', () => {
  it('切出全部 5 个模版，编号、名称、目的、方向都取得到', () => {
    const list = parseBreakdownTemplates(REPORT);
    expect(list).toHaveLength(5);
    expect(list[0]).toMatchObject({ no: 1, name: '名称1', purpose: '流量型', direction: '第1个方向的一句话' });
    expect(list[1].purpose).toBe('人设型');
  });

  it('每个模版的正文完整，包含复刻需要的全部字段', () => {
    const [first] = parseBreakdownTemplates(REPORT);
    for (const key of ['二创结构', '二创开篇', '二创情绪曲线', '二创镜头', '开头第一句', '适合的板块']) {
      expect(first.body).toContain(key);
    }
  });

  it('模版之后的其他章节不会被并进最后一个模版', () => {
    const list = parseBreakdownTemplates(REPORT);
    expect(list[4].body).not.toContain('这一节不是模版');
    expect(list[4].body).not.toContain('## 九');
  });

  it('没有模版的报告返回空数组', () => {
    expect(parseBreakdownTemplates('## 一、账号层\n没有模版')).toEqual([]);
  });

  it('分隔符用全角竖线、半角竖线或冒号都能认', () => {
    const md = '### 模版1｜甲\n- **目的**：人设型\n### 模版2|乙\n- **目的**：变现型\n### 模版3：丙\n- **目的**：流量型';
    expect(parseBreakdownTemplates(md).map((t) => t.name)).toEqual(['甲', '乙', '丙']);
  });
});

describe('文字拆解的提示词：模版格式和拆解知识', () => {
  it('要求至少 5 个模版，并用共用的模版格式', () => {
    const p = buildTextBreakdownPrompt('今天教你挑牛肉', '', {} as any);
    expect(p).toContain(TEMPLATE_SPEC);
    expect(p).toContain('至少 5 个');
    expect(p).toContain('八大爆款元素');
    expect(p).not.toContain('下一步可以延伸的方向');
  });

  it('没有档案时不写「九、套到这个账号上」', () => {
    const p = buildTextBreakdownPrompt('今天教你挑牛肉', '', {} as any);
    expect(p).toContain('没有档案就不写第 6 点');
  });
});
