import { describe, it, expect } from 'vitest';
import { parseTopicOptions } from '@/lib/handoff';

describe('parseTopicOptions 从选题结果里解析标题', () => {
  it('解析标准格式', () => {
    const md = `# 20条大流量选题方案

## 选题1：濮阳开店三年，我用手机拍了60条视频
一些正文

## 选题2：三个月帮7家饭店从冷清到爆满
更多正文`;
    expect(parseTopicOptions(md)).toEqual([
      '濮阳开店三年，我用手机拍了60条视频',
      '三个月帮7家饭店从冷清到爆满',
    ]);
  });

  it('兼容不同的分隔符与标题层级', () => {
    // 生成结果里序号与分隔符并不统一，放宽匹配才不会漏掉
    const md = `### 选题 1 - 标题甲
#### 选题2、标题乙
## **选题3：标题丙**`;
    expect(parseTopicOptions(md)).toEqual(['标题甲', '标题乙', '标题丙']);
  });

  it('去掉标题结尾的括号备注', () => {
    const md = '## 选题1：这是标题（标注爆款元素）';
    expect(parseTopicOptions(md)).toEqual(['这是标题']);
  });

  it('不把普通标题当成选题', () => {
    const md = `# 20条大流量选题方案
## 爆款元素说明
## 选题1：真正的选题`;
    expect(parseTopicOptions(md)).toEqual(['真正的选题']);
  });

  it('没有选题时返回空数组而不是抛错', () => {
    expect(parseTopicOptions('# 一段普通内容\n\n正文')).toEqual([]);
    expect(parseTopicOptions('')).toEqual([]);
  });
});
