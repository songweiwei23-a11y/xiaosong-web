import { describe, it, expect } from 'vitest';
import { sanitizeOutput, stripInternalLeaks, applyAdCompliance } from '@/lib/output-guard';
import { stripSelfCheck } from '@/lib/quality-checks';
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
    expect(applyAdCompliance('内幕揭秘：一锅汤的成本')).toBe('拆解：一锅汤的成本');
    expect(applyAdCompliance('扫码点单更快')).toBe('扫码点单更快');
  });
});

describe('复测修正（2026-10-11 第四轮）', () => {
  it('内部标题「【本轮目的说明】」及其下面的内容去掉，二级正文保留', () => {
    const out = stripInternalLeaks('## 【本轮目的说明】\n这一段是目的。\n## 第1步：脚本策略卡\n策略内容。', '脚本生成');
    expect(out).not.toContain('本轮目的说明');
    expect(out).not.toContain('这一段是目的');
    expect(out).toContain('策略内容。');
  });

  it('模型自己打的勾「✅ 没有绝对化承诺」是自检结论，去掉', () => {
    const out = stripInternalLeaks('- ✅ 没有绝对化承诺(没说"力求安排")\n正文一句。', '拆解爆款');
    expect(out).not.toContain('没有绝对化承诺');
    expect(out).toContain('正文一句。');
  });

  it('警告语境的引文不改写（「全濮阳福利最高（绝对化用语，违规且假）」是反例）', () => {
    const line = '「全濮阳福利最高」（绝对化用语，违规且假）';
    expect(applyAdCompliance(line)).toBe(line);
  });

  it('「数据最好的内容类型」改成较好；「全濮阳最好」去掉「全濮阳最」', () => {
    expect(applyAdCompliance('档案里「数据最好的内容类型」是讲故事')).toBe('档案里「数据较好的内容类型」是讲故事');
    expect(applyAdCompliance('全濮阳最好的火锅')).toBe('好的火锅');
  });

  it('「和你的目标人群100%匹配」改成绝大多数匹配', () => {
    expect(applyAdCompliance('和你的目标人群100%匹配')).toBe('和你的目标人群绝大多数匹配');
  });

  it('「最好拍」「最好在傍晚拍」是拍摄建议，不动', () => {
    expect(applyAdCompliance('最好拍：方案1需要卡开篇')).toBe('最好拍：方案1需要卡开篇');
    expect(applyAdCompliance('傍晚最好在门口拍')).toBe('傍晚最好在门口拍');
  });

  it('内容配比百分比（流量45% / 人设25% / 变现30%）不是数据，不报出处问题', () => {
    expect(unsupportedFacts('流量45% / 人设25% / 变现30%', '').some((i) => i.startsWith('百分比'))).toBe(false);
  });
});

describe('复测修正（2026-10-11 第五轮）', () => {
  it('描述性的最高级「数据最好的是…」「最好的情况」改成较好', () => {
    expect(applyAdCompliance('你的数据最好的是讲故事')).toBe('你的数据较好的是讲故事');
    expect(applyAdCompliance('最好的情况：师傅保留口音')).toBe('较好的情况：师傅保留口音');
  });

  it('警告语境的「我们最好」（容易被同行举报）不改写', () => {
    const line = '「我们最好」——容易被同行举报，不能说';
    expect(applyAdCompliance(line)).toBe(line);
  });

  it('操作建议「最好找本地的」「最好拍」不动', () => {
    expect(applyAdCompliance('最好找本地的，能见面聊')).toBe('最好找本地的，能见面聊');
    expect(applyAdCompliance('最好拍：方案1需要卡开篇')).toBe('最好拍：方案1需要卡开篇');
  });

  it('「就是从你村出来的」里的「你村」不是地名', () => {
    expect(unsupportedFacts('老板就是从你村出来的，靠这门手艺吃饭。', '').some((i) => i.startsWith('地名'))).toBe(false);
  });
});

describe('复测误报修正（2026-10-11 第三轮）', () => {
  it('「顾客反馈」「客户评价」作为名词（审稿在说档案里没有）不算顾客原话', () => {
    expect(unsupportedFacts('档案里没有顾客反馈，也没有客户评价，只能先写流程。', '').some((i) => i.startsWith('顾客见证'))).toBe(false);
  });

  it('「顾客反馈：」带冒号引出的才算顾客原话', () => {
    expect(unsupportedFacts('顾客反馈：「这个汤太好喝了」', '').some((i) => i.startsWith('顾客见证'))).toBe(true);
  });

  it('占位模板「顾客见证「换成你接待的真实客户…」」不算编的', () => {
    expect(unsupportedFacts('顾客见证「换成你接待的真实客户：他当时说了什么」', '').some((i) => i.startsWith('顾客见证'))).toBe(false);
  });

  it('「现在 10 月还没到冬季」是说还没到，不是时令错配', () => {
    expect(seasonMisstatements('现在 10 月还没到冬季，先拍秋天的。', AUTUMN)).toEqual([]);
  });
});

describe('按板块决定改写范围', () => {
  it('面向观众的脚本：断言用语和揭秘都改', () => {
    expect(sanitizeOutput('这一锅最划算，内幕揭秘', '脚本生成')).toBe('这一锅划算，拆解');
  });

  it('拆解分析：绝对化用语和平台词都改（E1、E2 对所有板块生效），只有审稿的原稿用语不动', () => {
    expect(sanitizeOutput('对方视频标题「全城最好吃的火锅」，封面写着揭秘', '拆解爆款')).toBe('对方视频标题「好吃的火锅」，封面写着拆解');
  });

  it('审稿优化：只去内部痕迹，原稿用语原样保留（不走 sanitizeOutput 的改写）', () => {
    const draft = '这一锅最划算，内幕揭秘。';
    expect(stripInternalLeaks(draft, '审稿优化')).toBe(draft);
  });
});

describe('复测修正（2026-10-11 第三轮）', () => {
  it('观众板块的编号即使在「错误示范」那一行也去掉（否定语境只管断言用语）', () => {
    const out = sanitizeOutput('计名：36计·第15计 正确做法VS错误做法', '选题策划');
    expect(out).not.toContain('36计');
    expect(out).not.toContain('第15计');
  });

  it('扫码关注、扫码领优惠是站外引流，去掉「扫码」；扫码点单不动；留电话改成来店咨询', () => {
    expect(applyAdCompliance('扫码关注领优惠')).toBe('关注领优惠');
    expect(applyAdCompliance('扫码领优惠')).toBe('领优惠');
    expect(applyAdCompliance('扫码点单更快')).toBe('扫码点单更快');
    expect(applyAdCompliance('留电话预约')).toBe('来店咨询预约');
  });
});

describe('复测修正（2026-10-11 第二轮）', () => {
  it('一级标题下面的内部规则段被删，二级标题开始的正文保留（原来整篇被删空，兜底又放回原文）', () => {
    const raw = '# 【本轮内容落实规则】\n- 时长按 30 秒\n- 人群按 A\n## 第1步：脚本策略卡\n策略内容。\n## 第2步：纯文字文案\n这一串烤得焦香。';
    const out = sanitizeOutput(raw, '脚本生成');
    expect(out).not.toContain('本轮内容落实规则');
    expect(out).not.toContain('时长按 30 秒');
    expect(out).toContain('## 第1步');
    expect(out).toContain('策略内容。');
    expect(out).toContain('## 第2步');
    expect(out).toContain('这一串烤得焦香。');
  });

  it('自检通用剥离也一样：一级「自检」标题不把后面的正文一起删掉', () => {
    const out = stripSelfCheck('# 发布前自检\n- 数字 ✅\n## 正文\n一句话。');
    expect(out).not.toContain('数字 ✅');
    expect(out).toContain('一句话。');
  });

  it('「为什么这样写」标签和它缩进的说明，在创作者板块也去掉', () => {
    const out = sanitizeOutput('- **为什么这样写**：\n  - 因为要吸引人\n正文一句。', '账号定位');
    expect(out).not.toContain('为什么这样写');
    expect(out).not.toContain('因为要吸引人');
    expect(out).toContain('正文一句。');
  });

  it('模型自称「未编造」的整行去掉（审稿也一样）', () => {
    expect(stripInternalLeaks('模型自称未编造销量。\n正文一句。', '审稿优化')).toBe('正文一句。');
  });

  it('观众板块去掉「起号36计、第23计」这类内部编号，保留选题本身', () => {
    const out = sanitizeOutput('## ✅ 选题1【流量型·起号36计·第23计 内幕拆解】\n拍摄角度：口播。', '选题策划');
    expect(out).not.toContain('36计');
    expect(out).not.toContain('第23计');
    expect(out).not.toContain('内幕');
    expect(out).toContain('拍摄角度：口播。');
  });

  it('创作者板块允许内部编号（标准 E7 只管面向观众）', () => {
    expect(sanitizeOutput('流量型·起号36计', '账号定位')).toContain('36计');
  });

  it('创作者板块的绝对化用语也改（标准 E1 对所有板块生效）', () => {
    expect(sanitizeOutput('门店最强引流概念', '账号定位')).toBe('门店很强引流概念');
    expect(sanitizeOutput('最低价不是唯一卖点', '行业建议')).toBe('低价不是唯一卖点');
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
