import { describe, it, expect } from 'vitest';
import {
  splitQualityReport,
  parseQualitySummary,
  extractTitle,
  estimateSpeechStats,
  formatDuration,
  formatRelativeTime,
} from '@/lib/script-result-utils';

describe('splitQualityReport 拆出质量报告', () => {
  const body = '# 开篇钩子\n\n你有没有发现，同样是探店视频…';
  const report = '## 🟢 脚本质量评分\n\n**得分**：9.0 / 10.0 分';

  it('标准格式：分隔线 + 报告标题', () => {
    const out = splitQualityReport(`${body}\n\n---\n\n${report}`);
    expect(out.body).toBe(body);
    expect(out.report).toContain('脚本质量评分');
    // 正文里不能残留报告，否则用户复制脚本会把评分一起带走
    expect(out.body).not.toContain('脚本质量评分');
  });

  it('三种评分色标都能识别', () => {
    for (const icon of ['🟢', '🟡', '🔴']) {
      const out = splitQualityReport(`${body}\n\n---\n\n## ${icon} 脚本质量评分\n\n内容`);
      expect(out.report, `${icon} 未被识别`).toContain('脚本质量评分');
      expect(out.body).toBe(body);
    }
  });

  it('早期格式：没有分隔线也能从标题处切开', () => {
    const out = splitQualityReport(`${body}\n${report}`);
    expect(out.body).toBe(body);
    expect(out.report).toContain('脚本质量评分');
  });

  it('没有报告时正文原样返回', () => {
    const out = splitQualityReport(body);
    expect(out.body).toBe(body);
    expect(out.report).toBe('');
  });

  it('空输入不抛错', () => {
    expect(splitQualityReport('')).toEqual({ body: '', report: '' });
  });

  it('正文自身包含分隔线时不被误切', () => {
    // 脚本正文里用 --- 分隔段落是常见写法，不该被当成报告边界
    const withRule = '# 标题\n\n第一段\n\n---\n\n第二段';
    const out = splitQualityReport(withRule);
    expect(out.body).toBe(withRule);
    expect(out.report).toBe('');
  });
});

describe('parseQualitySummary 解析评分', () => {
  const full = '## 🟢 脚本质量评分\n\n**得分**：9.0 / 10.0 分\n**等级**：MCN级\n**状态**：✅ 达标\n';

  it('解析得分、等级与达标状态', () => {
    const out = parseQualitySummary(full);
    expect(out.score).toBe(9);
    expect(out.level).toBe('MCN级');
    expect(out.passed).toBe(true);
  });

  it('未达标状态能识别', () => {
    const out = parseQualitySummary(full.replace('✅ 达标', '❌ 需要改进'));
    expect(out.passed).toBe(false);
  });

  it('解析不到时返回 null 而不是 NaN', () => {
    // NaN 会让分数条的宽度计算变成 NaN%，整块样式塌掉
    const out = parseQualitySummary('一段没有评分的文字');
    expect(out.score).toBeNull();
  });

  it('空输入不抛错', () => {
    expect(parseQualitySummary('')).toEqual({ score: null, level: '', passed: false });
  });
});

describe('extractTitle 提取可辨识的标题', () => {
  it('优先取 Markdown 标题', () => {
    expect(extractTitle('# 三个致命坑\n\n正文内容')).toBe('三个致命坑');
  });

  it('跳过质量评分这类元信息标题', () => {
    const text = '## 🟢 脚本质量评分\n\n**得分**：9.0\n\n## 真正的标题\n\n正文';
    expect(extractTitle(text)).toBe('真正的标题');
  });

  it('没有标题时取第一句有实质内容的话', () => {
    expect(extractTitle('你有没有发现这个问题呢')).toBe('你有没有发现这个问题呢');
  });

  it('跳过过短的行', () => {
    // "1." 这种残行不足以辨识，应继续往下找
    expect(extractTitle('1.\n\n这是一句足够长的正文内容')).toBe('这是一句足够长的正文内容');
  });

  it('超长标题截断并加省略号', () => {
    const long = '一'.repeat(50);
    const out = extractTitle(`# ${long}`, 10);
    expect(out).toHaveLength(11); // 10 字 + 省略号
    expect(out.endsWith('…')).toBe(true);
  });

  it('空内容有兜底文案', () => {
    expect(extractTitle('')).toBe('未命名脚本');
  });
});

describe('estimateSpeechStats 估算口播时长', () => {
  it('按每秒 5 字计算', () => {
    const out = estimateSpeechStats('一'.repeat(300));
    expect(out.chars).toBe(300);
    expect(out.seconds).toBe(60);
  });

  it('Markdown 符号不计入字数', () => {
    const plain = estimateSpeechStats('你好世界');
    const marked = estimateSpeechStats('## **你好世界**');
    expect(marked.chars).toBe(plain.chars);
  });

  it('空文本返回零而不是 NaN', () => {
    expect(estimateSpeechStats('')).toEqual({ chars: 0, seconds: 0 });
  });
});

describe('formatDuration', () => {
  it('不足一分钟显示秒', () => {
    expect(formatDuration(45)).toBe('45秒');
  });

  it('整分钟不显示零秒', () => {
    expect(formatDuration(120)).toBe('2分钟');
  });

  it('带余数显示分秒', () => {
    expect(formatDuration(95)).toBe('1分35秒');
  });

  it('零或负数显示占位符', () => {
    expect(formatDuration(0)).toBe('—');
  });
});

describe('formatRelativeTime', () => {
  it('一分钟内显示刚刚', () => {
    expect(formatRelativeTime(Date.now() - 5_000)).toBe('刚刚');
  });

  it('小时级', () => {
    expect(formatRelativeTime(Date.now() - 3 * 3600_000)).toBe('3 小时前');
  });

  it('一天前显示昨天', () => {
    expect(formatRelativeTime(Date.now() - 25 * 3600_000)).toBe('昨天');
  });

  it('超过一周退回具体日期', () => {
    const out = formatRelativeTime(Date.now() - 30 * 24 * 3600_000);
    expect(out).toMatch(/^\d{4}\/\d{1,2}\/\d{1,2}$/);
  });

  it('非法时间不抛错', () => {
    expect(formatRelativeTime('not a date')).toBe('');
  });
});
