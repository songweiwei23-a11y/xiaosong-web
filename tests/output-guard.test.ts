import { describe, it, expect } from 'vitest';
import { sanitizeOutput, stripInternalLeaks, applyAdCompliance } from '@/lib/output-guard';
import { seasonMisstatements } from '@/lib/time-anchor';
import { unsupportedFacts } from '@/lib/quality-checks';

// 北京时间 2026-10-11 中午（秋季）、2026-12-15（冬季）、2026-07-15（夏季）
const AUTUMN = Date.parse('2026-10-11T04:00:00Z');
const WINTER = Date.parse('2026-12-15T04:00:00Z');
const SUMMER = Date.parse('2026-07-15T04:00:00Z');

describe('内部提示词痕迹（企业商用检测 P1）', () => {
  it('审稿稿里的校对指令原文去掉，正文保留', () => {
    const text = '作为审稿校对编辑，对照原稿与个人要求，我修正如下。\n根据本轮校对指令：‘审稿结果里没有材料依据的…’\n**按本轮校对要求的修正**：\n她在揉面，面团很软。';
    const out = stripInternalLeaks(text, '审稿优化');
    expect(out).not.toContain('校对编辑');
    expect(out).not.toContain('本轮校对');
    expect(out).not.toContain('校对指令');
    expect(out).toContain('她在揉面，面团很软。');
  });

  it('审稿的问题清单、优化稿保留；模型自加的「核对清单」段去掉', () => {
    const text = '## 问题清单\n- 原稿「38 元」没有依据，改成【待确认：价格】\n## 核对清单\n- 价格已核对 ✅\n## 优化后的脚本\n她在揉面。';
    const out = stripInternalLeaks(text, '审稿优化');
    expect(out).toContain('## 问题清单');
    expect(out).toContain('原稿「38 元」没有依据');
    expect(out).not.toContain('核对清单');
    expect(out).not.toContain('价格已核对');
    expect(out).toContain('她在揉面。');
  });

  it('脚本里的「本轮内容落实规则」整段去掉，后面的正文保留', () => {
    const text = '## 开头\n一元一串，老板亲手烤。\n## 【本轮内容落实规则确认】\n- 时长按 30 秒\n- 人群按 A\n## 正文\n这一串烤得焦香。';
    const out = sanitizeOutput(text, '脚本生成');
    expect(out).not.toContain('落实规则');
    expect(out).not.toContain('时长按 30 秒');
    expect(out).toContain('一元一串，老板亲手烤。');
    expect(out).toContain('这一串烤得焦香。');
  });

  it('分镜里的「节奏自检」「创作自检」去掉', () => {
    const text = '## 镜头1\n近景，她在揉面。\n## ⏱ 节奏自检\n- 前3秒有钩子 ✅\n- 每15秒换景 ✅\n## 镜头2\n远景，锅开了。\n✅ 创作自检：没有编造数字';
    const out = sanitizeOutput(text, '分镜脚本');
    expect(out).not.toContain('节奏自检');
    expect(out).not.toContain('创作自检');
    expect(out).toContain('近景，她在揉面。');
    expect(out).toContain('远景，锅开了。');
  });

  it('拍摄指令里的「自检」不误删', () => {
    expect(sanitizeOutput('拍前自检一下灯光和收音。', '分镜脚本')).toContain('拍前自检一下灯光和收音。');
  });
});

describe('断言式用语与平台敏感词（企业商用检测 P3、P4）', () => {
  it('最划算、最新鲜、必吃改写，保留原意', () => {
    expect(applyAdCompliance('没人告诉你怎么点最划算')).toBe('没人告诉你怎么点划算');
    expect(applyAdCompliance('今天什么最新鲜')).toBe('今天什么新鲜');
    expect(applyAdCompliance('入秋必吃清单')).toBe('入秋值得吃清单');
    expect(applyAdCompliance('全城最低价')).toBe('低价');
  });

  it('保证见效、100% 好吃改写为力求、绝大多数', () => {
    expect(applyAdCompliance('这一锅保证见效')).toBe('这一锅力求见效');
    expect(applyAdCompliance('100%好吃')).toBe('绝大多数好吃');
  });

  it('否定语境的行原样保留（是在提醒别这么写）', () => {
    expect(applyAdCompliance('不能说最划算，别承诺100%好吃')).toBe('不能说最划算，别承诺100%好吃');
    expect(applyAdCompliance('禁止保证见效')).toBe('禁止保证见效');
  });

  it('拍摄建议里的「最好」不动', () => {
    expect(applyAdCompliance('傍晚最好在门口拍')).toBe('傍晚最好在门口拍');
    expect(applyAdCompliance('保证画面稳定')).toBe('保证画面稳定');
  });

  it('站外引流改成关注账号；揭秘改成拆解；正常的扫码点单不动', () => {
    expect(applyAdCompliance('每桌客人都加微信')).toBe('每桌客人都关注账号');
    expect(applyAdCompliance('内幕揭秘：一锅汤的成本')).toBe('内幕拆解：一锅汤的成本');
    expect(applyAdCompliance('扫码点单更快')).toBe('扫码点单更快');
  });
});

describe('按板块决定改写范围', () => {
  it('面向观众的脚本：断言用语和揭秘都改', () => {
    expect(sanitizeOutput('这一锅最划算，内幕揭秘', '脚本生成')).toBe('这一锅划算，内幕拆解');
  });

  it('拆解分析：引用对方原话不改，只换揭秘', () => {
    expect(sanitizeOutput('对方视频标题「全城最好吃的火锅」，封面写着揭秘', '拆解爆款')).toBe('对方视频标题「全城最好吃的火锅」，封面写着拆解');
  });

  it('审稿优化：只去内部痕迹，原稿用语原样保留（不走 sanitizeOutput 的改写）', () => {
    const draft = '这一锅最划算，内幕揭秘。';
    expect(stripInternalLeaks(draft, '审稿优化')).toBe(draft);
  });
});

describe('时令错配（企业商用检测 P6）', () => {
  it('秋天里说「现在是冬天」被标出', () => {
    expect(seasonMisstatements('现在是冬天，地摊最适合吃火锅。', AUTUMN)).toHaveLength(1);
  });

  it('秋天里客人说冬天被标出', () => {
    expect(seasonMisstatements('昨天一桌客人说，冬天在地摊吃火锅。', AUTUMN)).toHaveLength(1);
  });

  it('将来的冬天不算：下个冬天、等到冬天、今年冬天会', () => {
    expect(seasonMisstatements('下个冬天我们再拍一期。', AUTUMN)).toEqual([]);
    expect(seasonMisstatements('等到冬天，客人会更多。', AUTUMN)).toEqual([]);
    expect(seasonMisstatements('今年冬天会很冷，提前备货。', AUTUMN)).toEqual([]);
  });

  it('没有现在时标记的「夏天的火锅」在秋天不算', () => {
    expect(seasonMisstatements('夏天的火锅很香。', AUTUMN)).toEqual([]);
  });

  it('冬天里说夏天被标出；说冬天不算', () => {
    expect(seasonMisstatements('眼下正是盛夏，火锅最热。', WINTER)).toHaveLength(1);
    expect(seasonMisstatements('眼下正是冬天，火锅最暖。', WINTER)).toEqual([]);
  });

  it('夏天里说「现在冬天」被标出', () => {
    expect(seasonMisstatements('现在冬天很冷，大家都来吃锅。', SUMMER)).toHaveLength(1);
  });

  it('素材或档案里写过的同一说法不算错（那是用户自己的设定）', () => {
    expect(seasonMisstatements('现在是冬天，地摊最适合吃火锅。', AUTUMN, '现在是冬天')).toEqual([]);
  });
});

describe('编出来的作息与顾客原话（企业商用检测 P2）', () => {
  it('今天早上六点去市场被标出', () => {
    expect(unsupportedFacts('今天早上六点去市场挑毛肚，很新鲜。', '').some((i) => i.startsWith('作息'))).toBe(true);
  });

  it('早上六点从批发市场拉回来、我早上五点熬的，都被标出', () => {
    expect(unsupportedFacts('早上六点从批发市场拉回来的鲜毛肚。', '').some((i) => i.startsWith('作息'))).toBe(true);
    expect(unsupportedFacts('我早上五点熬的牛油底料。', '').some((i) => i.startsWith('作息'))).toBe(true);
  });

  it('档案里写过的同一钟点不算；假设句不算；拍摄安排不算', () => {
    expect(unsupportedFacts('每天早上六点去批发市场进货。', '我们每天早上六点去批发市场进货').some((i) => i.startsWith('作息'))).toBe(false);
    expect(unsupportedFacts('比如今天早上六点去市场，你也可以试试。', '').some((i) => i.startsWith('作息'))).toBe(false);
    expect(unsupportedFacts('今天下午三点开拍，全程不超过半小时。', '').some((i) => i.startsWith('作息'))).toBe(false);
  });

  it('客户说「比预期还满意」被标出（原来只认「客人说」）', () => {
    expect(unsupportedFacts('客户说「比预期还满意」，就回头了。', '').some((i) => i.startsWith('顾客见证'))).toBe(true);
  });

  it('一桌客人说、昨天一桌客人说被标出', () => {
    expect(unsupportedFacts('昨天一桌客人说，这里的汤不一样。', '').some((i) => i.startsWith('顾客见证'))).toBe(true);
  });

  it('假设句「如果客人同意出镜说话」不算编的', () => {
    expect(unsupportedFacts('如果客人同意出镜说话，就拍一段。', '').some((i) => i.startsWith('顾客见证'))).toBe(false);
  });
});
