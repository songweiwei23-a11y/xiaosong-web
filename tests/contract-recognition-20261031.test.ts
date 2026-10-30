/**
 * 契约认得出来（2026-10-31 整改）：认不出要说明原因、不能静默；37 计全部认得出、全部保留；
 * 内部规则不能露出来；契约标签行不被净化改字。
 */
import { describe, expect, it } from 'vitest';
import { contractLineFlags, findStructure, isContractLine, readContract, readTopicContract, tacticStructureName } from '@/lib/creation-tree';
import { GROWTH_TACTICS } from '@/lib/growth-tactics';
import { SCRIPT_STRUCTURE_NAMES } from '@/lib/tactic-mix';
import { tacticIndex1021 } from '@/lib/tool-first-1021';
import { sanitizeOutput } from '@/lib/output-guard';
import { buildStoryboardPrompt } from '@/lib/storyboard-standards';

/** 选题正文的一条（和选题提示词要求的格式一致） */
const topic = (title: string, tactic: string, extra = '') =>
  [
    `## 选题1：${title}`,
    '',
    '0️⃣ 视频目的',
    '人设型，让人信你做事靠谱',
    '',
    '视频任务',
    '让观众记住炒前准备才是关键',
    '',
    '🅰 打法',
    tactic,
    '',
    '1️⃣ 爆款元素',
    '- 反差',
    extra,
  ].join('\n');

describe('37 计全部认得出来', () => {
  it('每一计的全名（带编号）都认得出，编号对得上', () => {
    for (const t of GROWTH_TACTICS) {
      const hit = findStructure(`- 36计·第${t.no}计 ${t.name}：把结构公式套到这条上`);
      expect(hit?.structure, `第${t.no}计 ${t.name}`).toBe(tacticStructureName(t.no, t.name));
    }
  });

  it('只写计名、不写编号也认得出（编号被净化去掉以后照样认得）', () => {
    for (const t of GROWTH_TACTICS) {
      const hit = findStructure(`- ${t.name}：把结构公式套到这条上`);
      expect(hit?.structure, t.name).toBe(tacticStructureName(t.no, t.name));
    }
  });

  it('大小写、空格、标点不影响：软组合、正确做法VS错误做法', () => {
    expect(findStructure('- 36计·第6计 软组合 用a方式做b事：…')?.structure).toBe('36计·第6计 软组合：用A方式做B事');
    expect(findStructure('- 36计·第15计 正确做法 vs 错误做法：…')?.structure).toBe('36计·第15计 正确做法VS错误做法');
  });

  it('只写「第N计」也认得出', () => {
    expect(findStructure('- 第32计：…')?.structure).toBe('36计·第32计 换个视角');
  });

  it('清单是 37 条，一条都不少', () => {
    const rows = tacticIndex1021().split('\n').filter((l) => l.startsWith('- 第'));
    expect(rows).toHaveLength(37);
  });

  it('按目的筛掉的不再有：目的参数已经去掉，清单对任何目的都是 37 条', () => {
    // 老的调用方式（传 roles）已经不接受，只能按禁忌拿掉
    const rows = tacticIndex1021({ exclude: ['反向操作'] }).split('\n').filter((l) => l.startsWith('- 第'));
    expect(rows).toHaveLength(36);
  });
});

describe('四大脚本的结构都认得出来', () => {
  it('14 个全名都认得出', () => {
    for (const name of SCRIPT_STRUCTURE_NAMES) {
      expect(findStructure(`- ${name}：一句话说怎么讲`)?.structure, name).toBe(name);
    }
  });

  it('「类型·结构」的短写也认得出（写成「教知识·推荐」「四大脚本·聊观点·论证」）', () => {
    expect(findStructure('- 四大脚本·教知识·推荐：…')?.structure).toBe('教知识·推荐型');
    expect(findStructure('- 四大脚本·聊观点·论证：…')?.structure).toBe('聊观点·论证型');
  });

  it('只写类型：认出类型，结构为空（要明示让用户手选，不猜）', () => {
    const hit = findStructure('- 四大脚本·晒过程：…');
    expect(hit?.structure).toBe('');
    expect(hit?.kind).toBe('晒过程');
  });
});

describe('选题正文读出契约，认不出就说明原因', () => {
  it('标题对得上、打法认得出：node 有，没有缺项', () => {
    const r = readTopicContract(topic('川菜最不能省的是炒前准备', '- 四大脚本·聊观点·论证型：先立判断'), '川菜最不能省的是炒前准备');
    expect(r.node?.structure).toBe('聊观点·论证型');
    expect(r.node?.purpose).toBe('人设型');
    expect(r.problems).toEqual([]);
  });

  it('打法写的是计名（不写编号）：照样认出，node 有', () => {
    const r = readTopicContract(topic('换个说法', '- 换个视角：从顾客的角度讲'), '换个说法');
    expect(r.node?.structure).toBe('36计·第32计 换个视角');
  });

  it('标题对不上：node 为空，原因是找不到这一条', () => {
    const body = `${topic('第一条', '- 36计·第32计 换个视角：…')}\n\n${topic('第二条', '- 36计·第7计 一句话设定故事感：…')}`;
    const r = readTopicContract(body, '不存在的标题');
    expect(r.node).toBeNull();
    expect(r.problems[0]?.code).toBe('no-section');
  });

  it('没有写打法：node 为空，原因是没有打法', () => {
    const body = ['## 选题1：没有打法', '', '0️⃣ 视频目的', '流量型，…', '', '1️⃣ 爆款元素', '- 反差'].join('\n');
    const r = readTopicContract(body, '没有打法');
    expect(r.node).toBeNull();
    expect(r.problems[0]?.code).toBe('no-tactic');
  });

  it('打法写的不在注册表里：node 为空，原因里带着原文', () => {
    const r = readTopicContract(topic('乱写', '- 神秘套路：随便写'), '乱写');
    expect(r.node).toBeNull();
    expect(r.problems[0]?.code).toBe('unknown');
    expect(r.problems[0]?.text).toContain('神秘套路');
  });

  it('只写了四大脚本的类型：node 为空，原因是没写具体结构', () => {
    const r = readTopicContract(topic('只写类型', '- 四大脚本·聊观点：先讲判断'), '只写类型');
    expect(r.node).toBeNull();
    expect(r.problems[0]?.code).toBe('kind-only');
  });

  it('36 计和四大脚本同时写了两个结构：node 为空，原因是认不出用哪一个', () => {
    const r = readTopicContract(topic('两派', '- 36计·第32计 换个视角：…\n- 四大脚本·聊观点·论证型：…'), '两派');
    expect(r.node).toBeNull();
    expect(r.problems[0]?.code).toBe('ambiguous');
  });

  it('打法行只写了模板（全部名字的那种）：不算认出，要求重写', () => {
    const r = readTopicContract(topic('模板', '- 四大脚本·结构（晒过程·火车节 / 教知识·解题型，写全名）：一句话'), '模板');
    expect(r.node).toBeNull();
  });

  it('缺视频目的和视频任务：结构认得出，node 有，但要提示缺哪几项', () => {
    const body = ['## 选题1：缺两项', '', '🅰 打法', '- 四大脚本·教知识·解题型：…'].join('\n');
    const r = readTopicContract(body, '缺两项');
    expect(r.node?.structure).toBe('教知识·解题型');
    expect(r.problems.map((p) => p.code)).toEqual(['no-purpose', 'no-task']);
  });
});

describe('下游读契约：脚本正文没有策略卡时，从参考资料里读', () => {
  it('分镜：契约在参考资料（相关方案参考）里，提示词里照样有内容树', () => {
    const q = buildStoryboardPrompt({
      scriptContent: '我做了9年川菜。',
      additionalInfo: '【相关方案参考】\n### 第1步：脚本策略卡\n- **用户目的**：人设型\n- **实际采用形式**：四大脚本·聊观点·论证型',
      platform: '抖音',
      duration: '60秒',
      contentType: 'food',
      visualStyle: 'bright',
      visualStyleLabel: '明亮',
    });
    expect(q).toContain('【内容树】');
    expect(q).toContain('聊观点·论证型');
  });
});

describe('脚本策略卡读出契约', () => {
  it('实际采用形式写了四大脚本，用户目的写了：契约完整', () => {
    const r = readContract('### 第1步：脚本策略卡\n- **用户目的**：人设型\n- **实际采用形式**：四大脚本·聊观点·论证型\n- **视频任务**：让人信我');
    expect(r.node?.structure).toBe('聊观点·论证型');
    expect(r.node?.purpose).toBe('人设型');
    expect(r.problems).toEqual([]);
  });

  it('策略卡里找不到结构：node 为空，说明原因', () => {
    const r = readContract('### 第1步：脚本策略卡\n- **用户目的**：人设型');
    expect(r.node).toBeNull();
    expect(r.problems.length).toBeGreaterThan(0);
  });

  it('空文字：没有上游，不算认不出（没有问题）', () => {
    expect(readContract('')).toEqual({ node: null, problems: [] });
  });
});

describe('内部规则不能露出来', () => {
  const LEAKED = [
    '【本轮内容落实规则】  ',
    '- 不采用“成功/失败具体数字对比”，当前材料只有“做川菜9年”，不足以支撑案例数字；改用“锅很热却炒乱”与“准备充分后只盯菜变化”的可拍反差。  ',
    '- 说话人以“我”口播，不补充未提供的身份、顾客反馈或经营结果。  ',
    '',
    '### 第1步：脚本策略卡',
    '- **用户目的**：人设型',
    '',
    '### 第2步：纯文字文案',
    '做川菜，最不能省的，不是翻锅，是炒前准备。',
  ].join('\n');

  it('段首标记和它后面的条目一起删掉，正文保留', () => {
    const out = sanitizeOutput(LEAKED, '脚本生成');
    expect(out).not.toContain('本轮内容落实规则');
    expect(out).not.toContain('说话人以');
    expect(out).not.toContain('不采用');
    expect(out).toContain('### 第1步：脚本策略卡');
    expect(out).toContain('做川菜，最不能省的，不是翻锅，是炒前准备。');
  });

  it('净化不改契约标签行：内幕揭秘、教知识·揭秘型原样保留，普通句子里的揭秘照常换掉', () => {
    const body = [
      '## 选题1：揭秘',
      '🅰 打法',
      '- 36计·第23计 内幕揭秘：把结构公式套到这条上',
      '- 四大脚本·教知识·揭秘型：一句话说怎么讲',
      '这条会揭秘行业的真相',
    ].join('\n');
    const out = sanitizeOutput(body, '选题策划');
    expect(out).toContain('内幕揭秘');
    expect(out).toContain('教知识·揭秘型');
    expect(out).not.toContain('这条会揭秘');
  });

  it('契约行的判断：标签行算；打法小节里写着结构名的行算；小节外的普通句子不算', () => {
    expect(isContractLine('**用的计**：36计·第32计 换个视角')).toBe(true);
    expect(isContractLine('这条会揭秘行业的真相')).toBe(false);
    // 单独一行没有标签时不算（要看它在不在打法小节里）
    expect(isContractLine('- 36计·第23计 内幕揭秘：…')).toBe(false);
    expect(contractLineFlags(['🅰 打法', '- 36计·第23计 内幕揭秘：…', '1️⃣ 爆款元素', '- 内幕揭秘'])).toEqual([true, true, false, false]);
  });
});
