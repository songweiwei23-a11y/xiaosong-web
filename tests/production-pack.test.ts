import { describe, it, expect } from 'vitest';
import { buildProductionPack, parseProductionShots, productionSpeech, productionMarkdown, productionChecklistKey, readProductionChecklist, productionFilename, type ProductionWork } from '@/lib/production-pack';
import type { WorkItem } from '@/lib/resume';

const item = (id: string, task_type: string, result: string, day: number): WorkItem => ({ id, task_type, result, created_at: `2026-10-0${day}T12:00:00Z` });
const work = (...items: WorkItem[]): ProductionWork => ({ id: 'w1', title: '这条家具怎么选', profile_id: 'p1', is_done: false, items });
const storyboard = `# 分镜脚本表
| 镜号 | 景别 | 运镜 | 画面内容 | 台词/旁白 | 时长 | 拍摄要点 |
|---|---|---|---|---|---|---|
| 1 | 近景 | 固定 | 老板指着柜门 | 先看门能不能打开。 | 3s | 真实演示 |
| 2 | 特写 | 推镜 | 柜门缓慢打开 | 这段台词要保留。<br>看清过道距离。 | 4s | 保留空间 |
| 3 | 全景 | 固定 | 门店空镜 | 无 | 2s | 不出现客人正脸 |
## 拍摄准备
- 道具：实际门店展示柜
- 场地：已确定的门店
## 节奏自检
总时长9秒。`;

describe('真实台词提取', () => {
  it('表格按表头识别台词，保留换行和转义竖线，不混入画面、时长或空镜', () => {
    expect(productionSpeech(storyboard)).toBe('先看门能不能打开。\n这段台词要保留。\n看清过道距离。');
    expect(productionSpeech('| 画面 | 旁白 | 时间 |\n|---|---|---|\n| 推门 | A\\|B都能选。 | 3秒 |')).toBe('A|B都能选。');
    expect(productionSpeech('| 台词 | 时间 |\n|---|---|\n| 真正口播 | 3秒 |\n## 道具\n| 道具 | 用途 |\n|---|---|\n| 相机 | 拍摄 |')).toBe('真正口播');
  });
  it('明确的纯文字文案优先，标签只取台词，不把策略和质量报告念出来', () => {
    const source = '## 策略卡\n涨粉目的\n## 拍摄脚本\n台词：旧台词。\n## 纯文字文案\n这才是最终口播。\n\n---\n## 🟢 脚本质量评分\n得分8';
    expect(productionSpeech(source)).toBe('这才是最终口播。');
    expect(productionSpeech('画面：老板指着柜子\n**台词**：看看实际尺寸。\n- 旁白：留够过道。')).toBe('看看实际尺寸。\n留够过道。');
    expect(productionSpeech('## 创作建议\n你应该多讲案例，安排三盏灯。')).toBe('');
  });
});

describe('分镜清单', () => {
  it('提取镜头与原始字段，忽略节奏自检，ID稳定而内容变化会更新', () => {
    const shots = parseProductionShots(storyboard);
    expect(shots).toHaveLength(3);
    expect(shots[0]).toMatchObject({ number: '1', visual: '老板指着柜门', speech: '先看门能不能打开。', duration: '3s', framing: '近景', movement: '固定', notes: '真实演示' });
    expect(parseProductionShots(storyboard)).toEqual(shots);
    expect(parseProductionShots(storyboard.replace('3s', '5s'))[0].id).not.toBe(shots[0].id);
  });
  it('列序变化及明确镜头段落可识别，普通文字不凭空拆镜头', () => {
    const swapped = '| 序号 | 台词 | 画面 | 时长 |\n|---|---|---|---|\n| 01 | 真实台词 | 实际门店 | 2秒 |';
    expect(parseProductionShots(swapped)[0]).toMatchObject({ number: '01', speech: '真实台词', visual: '实际门店' });
    const sections = '## 镜头1\n- 画面：实际柜门\n- 台词：先量尺寸。\n- 时长：3秒\n## 镜头2\n画面：地上量尺\n旁白：留下走动空间。';
    expect(parseProductionShots(sections)).toHaveLength(2);
    expect(parseProductionShots('拍老板和柜子，准备灯光。')).toEqual([]);
  });
});

describe('交付包版本与真实来源', () => {
  it('优先最新审稿交付稿，诊断中的错误原文不会进入口播', () => {
    const current = item('r2', '审稿优化', '### 问题清单\n原文：我们在苏州做了99年。\n### 优化后的完整脚本\n台词：来苏州3年，选柜子先量尺寸。\n### 其他建议\n拍稳一点。', 3);
    const p = buildProductionPack(work(current, item('s1', '脚本生成', '## 纯文字文案\n旧脚本。', 1), item('r1', '审稿优化', '### 优化后的完整脚本\n更早审稿。', 2)));
    expect(p.spoken).toBe('来苏州3年，选柜子先量尺寸。');
    expect(p.scriptSource?.id).toBe('r2');
    expect(p.spoken).not.toContain('99年');
  });
  it('最新审稿空正文不能代用原稿；采用旧稿需明确提示', () => {
    const p = buildProductionPack(work(item('r2', '审稿优化', '### 问题清单\n原稿有错误。\n### 优化后的完整脚本\n\n### 其他建议\n先写完。', 3), item('s1', '脚本生成', '## 纯文字文案\n已保存的脚本。', 2)));
    expect(p.spoken).toBe('已保存的脚本。');
    expect(p.warnings.join(' ')).toContain('最新审稿未识别');
  });
  it('口播比分镜新、脚本比采用的审稿新，都提示版本核对', () => {
    const p = buildProductionPack(work(item('r', '审稿优化', '### 优化后的完整脚本\n这是审稿定稿。', 3), item('b', '分镜脚本', storyboard, 2), item('s', '脚本生成', '## 纯文字文案\n这是更晚脚本。', 4)));
    expect(p.warnings.join(' ')).toContain('口播稿比当前分镜更新');
    expect(p.warnings.join(' ')).toContain('更晚生成的脚本');
  });
  it('只用实际已有准备项、标题与分镜，不发明设备或自动确认许可', () => {
    const p = buildProductionPack(work(item('b', '分镜脚本', storyboard, 2), item('t', '标题封面', '### 1. 小户型先看这里\n- 封面配合：留够过道', 2)));
    expect(p.preparation).toEqual(['道具：实际门店展示柜', '场地：已确定的门店']);
    expect(p.titleCover).toContain('留够过道');
    const empty = buildProductionPack(work());
    expect(empty.shots).toEqual([]);
    expect(empty.preparation).toEqual([]);
    expect(empty.warnings.join(' ')).toContain('镜头清单待生成');
    expect(empty.warnings.join(' ')).toContain('素材使用许可需要自行确认');
  });
  it('完整Markdown保留来源、分镜原文、勾选状态，口播TXT仅来自spoken', () => {
    const p = buildProductionPack(work(item('b', '分镜脚本', storyboard, 2)));
    const exported = productionMarkdown(p, [p.shots[0].id]);
    expect(exported).toContain('- [x] 镜头 1 · 3s');
    expect(exported).toContain('- [ ] 镜头 2');
    expect(exported).toContain('来源：分镜脚本 / 2026-10-02T12:00:00Z / b');
    expect(exported).toContain(storyboard);
    expect(productionFilename('abc/def:店', 'md')).toBe('abc_def_店_拍摄交付包.md');
  });
});

describe('本机拍摄标记隔离', () => {
  it('账号、档案、作品分别隔离，未登录不能创建共享key', () => {
    expect(new Set([productionChecklistKey('u1', 'p1', 'w1'), productionChecklistKey('u2', 'p1', 'w1'), productionChecklistKey('u1', 'p2', 'w1'), productionChecklistKey('u1', 'p1', 'w2')]).size).toBe(4);
    expect(productionChecklistKey(null, 'p1', 'w1')).toBeNull();
    expect(productionChecklistKey('u1', null, 'w1')).not.toBe(productionChecklistKey('u1', 'p1', 'w1'));
  });
  it('仅恢复当前镜头ID，重生成后的旧标记不错误套用', () => {
    const shots = parseProductionShots(storyboard);
    expect(readProductionChecklist(JSON.stringify([shots[0].id, shots[0].id, 'old-id', {}, null]), shots)).toEqual([shots[0].id]);
    expect(readProductionChecklist('{broken', shots)).toEqual([]);
    expect(readProductionChecklist('{}', shots)).toEqual([]);
  });
});
