/**
 * 「勾选几条带去下一个板块」的拆分（2026-10-02）。样本是线上真实出现过的几种写法。
 */
import { describe, it, expect } from 'vitest';
import { splitCreationItems, selectionBody, itemsNoun } from '@/lib/creation-items';
import { buildCreationHandoff } from '@/lib/creation-flow';
import { readCode } from './helpers/source';

/** 自由对话里结合濮阳热点出选题，线上原样（节选） */
const PUYANG = `根据濮阳最近一周（10月1日前后）的热点信息，我给你出几个爆款选题：

## 基于濮阳近期热点的爆款选题

### 1. 【流量型·聊观点】成本选题+地域对立
**选题：** 国庆假期濮阳人都往哪儿扎堆？外地人以为的VS本地人真去的
**钩子：** 国庆七天濮阳最火的地方，外地人全猜错了

---

### 2. 【变现型·晒过程】头牌选题+怀旧选题
**选题：** 戚城公园国庆七天雅集，我拍下了濮阳人过节的老讲究
**钩子：** 抚琴轩的古琴、戚里的打铁花

---

### 3. 【流量型·教知识】成本选题+推荐型
**选题：** 国庆濮阳免费开放的5个地方，最后一个90%的人不知道

## 我推荐先拍哪个
第 1 个，最好拍。`;

const TOPIC_BATCH = `## 选题1：我在濮阳街头问了50个老板
内容方向：……
## 📌 选题2：【对抗反常识型】
**标题**：《三个月帮 7 家饭店从冷清到爆满》
开篇钩子：……
## 发布建议
晚上 8 点发`;

const DIRECTIONS = `给你三个方向：
### 方向一：老板人设
每天拍后厨
### 方向二：顾客故事
拍熟客
### 方向三：干货科普
讲选料`;

const SCRIPT = `## 脚本：濮阳火锅店
### 1. 开场（0-3秒）
口播：你绝对想不到……
### 2. 正文（3-40秒）
口播：……
### 3. 结尾
口播：关注我`;

const PLAIN_LIST = `可以试试这几个开头：
1. **你知道濮阳人最爱吃什么吗**
2. **这家店开了 20 年没换过锅底**
3. **老板说今天的肉不卖完不关门**`;

describe('拆成一条一条', () => {
  it('自由对话出的选题：按「### 1.」切，题目从「选题：」那行取；结尾的推荐不算一条', () => {
    const p = splitCreationItems(PUYANG);
    expect(p.items).toHaveLength(3);
    expect(p.items.map((x) => x.topic)).toEqual([
      '国庆假期濮阳人都往哪儿扎堆？外地人以为的VS本地人真去的',
      '戚城公园国庆七天雅集，我拍下了濮阳人过节的老讲究',
      '国庆濮阳免费开放的5个地方，最后一个90%的人不知道',
    ]);
    expect(p.items[0].kind).toBe('topic');
    expect(p.items[0].label).toBe('【流量型·聊观点】成本选题+地域对立');
    expect(p.footer).toMatch(/我推荐先拍哪个/);
    expect(p.items[2].body).not.toMatch(/我推荐/);
    expect(p.intro).toMatch(/根据濮阳最近一周/);
    expect(itemsNoun(p.items)).toBe('选题');
  });

  it('选题页的两种写法：「选题1：题目」和「选题2：【类别】+ 标题：《》」', () => {
    const p = splitCreationItems(TOPIC_BATCH);
    expect(p.items.map((x) => x.topic)).toEqual(['我在濮阳街头问了50个老板', '三个月帮 7 家饭店从冷清到爆满']);
    expect(p.footer).toMatch(/发布建议/);
  });

  it('方向一 / 方向二：带关键词的中文序号', () => {
    const p = splitCreationItems(DIRECTIONS);
    expect(p.items.map((x) => x.label)).toEqual(['方向一：老板人设', '方向二：顾客故事', '方向三：干货科普']);
    expect(itemsNoun(p.items)).toBe('方向思路');
  });

  it('「第1条」一次出几条文案（线上真实写法），认成脚本', () => {
    const md = '# 📝 5条文案（直接可拍）\n## 第1条：【变现型·晒过程】帮老板拍第一条\n### 【镜头1·开场钩子】（3秒）\n口播：……\n## 第2条：【流量型】国庆人挤人\n### 【镜头1】\n口播：……';
    const p = splitCreationItems(md);
    expect(p.items.map((x) => x.label)).toEqual(['第1条：【变现型·晒过程】帮老板拍第一条', '第2条：【流量型】国庆人挤人']);
    expect(itemsNoun(p.items)).toBe('脚本');
  });

  it('「选择1 / 建议2」也是可以挑一个接着做的', () => {
    const p = splitCreationItems('## 现在有两个选择：\n### 选择1：用常青选题替代\n……\n### 选择2：你告诉我最近发生了什么\n……');
    expect(p.items).toHaveLength(2);
    expect(itemsNoun(p.items)).toBe('方案建议');
  });

  describe('创作生产相关的都认（产品方：方向、思路、执行建议、选题、脚本……哪怕一个想法）', () => {
    it('「方向1️⃣」：关键词后面跟表情数字（线上真实写法）', () => {
      const p = splitCreationItems('# 定制3个爆款选题方向\n## 方向1️⃣ 弱势群体+头牌组合\n…\n## 方向2️⃣ 反差+成本组合\n…');
      expect(p.items.map((x) => x.label)).toEqual(['方向1 弱势群体+头牌组合', '方向2 反差+成本组合']);
      expect(itemsNoun(p.items)).toBe('方向思路');
    });

    it('思路 / 灵感 / 执行建议 / 拍法 都是关键词', () => {
      for (const [w, noun] of [['思路', '方向思路'], ['灵感', '方向思路'], ['执行建议', '方案建议'], ['拍法', '方案建议']]) {
        const p = splitCreationItems(`### ${w}1：甲\n…\n### ${w}2：乙\n…`);
        expect(itemsNoun(p.items), w).toBe(noun);
      }
    });

    it('「视频1 / Vlog 2」：一次策划几条视频', () => {
      expect(itemsNoun(splitCreationItems('### 视频1：串串火锅篇\n…\n### 视频2：烧烤篇\n…').items)).toBe('脚本');
      expect(splitCreationItems('## Vlog 1：早市\n…\n## Vlog 2：夜市\n…').items).toHaveLength(2);
    });

    it('「三、第1条：……」：大纲序号后面的条目编号', () => {
      expect(splitCreationItems('## 二、总体策略\n…\n## 三、第1条：成都串串火锅\n…\n## 四、第2条：川味烧烤\n…').items.map((x) => x.label)).toEqual(['第1条：成都串串火锅', '第2条：川味烧烤']);
    });

    it('条目没说是什么时看上面的大标题：拍摄建议下面的几条是执行建议，直接展开', () => {
      const p = splitCreationItems('## 拍摄时的几个建议\n### 1. 情境还原 > 摆拍表演\n…\n### 2. 多拍备用素材\n…\n### 3. 现场随机应变\n…');
      expect(p.items.every((x) => x.kind === 'plan')).toBe(true);
      expect(itemsNoun(p.items)).toBe('方案建议');
    });

    it('标题里说的事：切入、人设 → 方向思路；先做什么、每周固定 → 方案建议', () => {
      const p = splitCreationItems('### 1. 先从老板人设切入\n…\n### 2. 每周固定拍三条后厨\n…');
      expect(p.items.map((x) => x.kind)).toEqual(['direction', 'plan']);
      // 几类混在一起叫「创作内容」，照样展开
      expect(itemsNoun(p.items)).toBe('创作内容');
    });

    it('认不出来的普通条目（附件识别结果这类）仍然折叠', () => {
      expect(itemsNoun(splitCreationItems('1. **图片颜色**：红\n2. **Word 暗号**：梧桐\n3. **Excel 总和**：400').items)).toBe('内容');
    });
  });

  it('「第1步：策略卡」不是并列的几条', () => {
    expect(splitCreationItems('## 第1步：脚本策略卡\n…\n## 第2步：纯文字文案\n…').items).toEqual([]);
  });

  it('认不出类型的普通条目折叠成一行，认出选题/方向等直接展开', () => {
    expect(readCode('components/workspace/CreationLinks.tsx')).toMatch(/useState\(noun !== '内容'\)/);
    expect(readCode('components/workspace/CreationLinks.tsx')).toMatch(/只带其中几条？/);
  });

  it('脚本内部的「1. 开场」「2. 正文」不是并列的几条，不给勾', () => {
    expect(splitCreationItems(SCRIPT).items).toEqual([]);
  });

  it('整段没有标题时，顶格编号列表也能勾', () => {
    expect(splitCreationItems(PLAIN_LIST).items.map((x) => x.label)).toEqual(['你知道濮阳人最爱吃什么吗', '这家店开了 20 年没换过锅底', '老板说今天的肉不卖完不关门']);
  });

  it('只有一条、或者没有可拆的：不出勾选列表', () => {
    expect(splitCreationItems('### 选题1：只有一条\n内容').items).toEqual([]);
    expect(splitCreationItems('随便聊聊，没有列表').items).toEqual([]);
  });

  it('代码块里的编号标题不算', () => {
    expect(splitCreationItems('```\n## 选题1：a\n## 选题2：b\n```').items).toEqual([]);
  });
});

describe('勾选后带走', () => {
  it('只带勾中的几条，开头那句说明一起带，结尾的整批推荐不带', () => {
    const p = splitCreationItems(PUYANG);
    const s = selectionBody(p, ['item-1', 'item-3']);
    expect(s.body).toMatch(/根据濮阳最近一周/);
    expect(s.body).toMatch(/外地人以为的VS本地人真去的/);
    expect(s.body).toMatch(/免费开放的5个地方/);
    expect(s.body).not.toMatch(/戚城公园国庆七天雅集/);
    expect(s.body).not.toMatch(/我推荐先拍哪个/);
    expect(s.topicOptions).toHaveLength(2);
    expect(s.title).toMatch(/^2 条：/);
  });

  it('带去脚本页：勾中的题目成了候选，主题框填第一条；正文作为参考带上', () => {
    const p = splitCreationItems(PUYANG);
    const s = selectionBody(p, ['item-2', 'item-3']);
    const h = buildCreationHandoff('free-chat', 'script', s.body, { title: s.title, topicOptions: s.topicOptions });
    expect(h.target).toBe('/dashboard/script');
    expect(h.topicOptions).toEqual(s.topicOptions);
    expect(h.topic).toBe('戚城公园国庆七天雅集，我拍下了濮阳人过节的老讲究');
    expect(h.note).toMatch(/免费开放的5个地方/);
    expect(h.sourceContent).not.toMatch(/外地人以为的/);
  });

  it('组件：识别出两条以上才出勾选，默认全选（不勾时和原来整条带走一样），一条都没勾不让走', () => {
    const src = readCode('components/workspace/CreationLinks.tsx');
    expect(src).toMatch(/splitCreationItems\(body\)/);
    expect(src).toMatch(/parts\.items\.length >= 2/);
    expect(src).toMatch(/new Set\(parts\.items\.map\(\(it\) => it\.id\)\)/);
    expect(src).toMatch(/先勾选要带走的/);
  });

  it('自由对话、知识库、账号运营板块按勾选认出的类型推荐下一步：选题→写脚本，方向思路→生成选题', () => {
    const src = readCode('components/workspace/CreationLinks.tsx');
    expect(src).toMatch(/选题: \['script', 'growth', 'title'\]/);
    expect(src).toMatch(/方向思路: \['topic', 'script'\]/);
    expect(src).toMatch(/GENERAL_SOURCES\.has\(source\) && pickOpen && NEXT_BY_NOUN\[noun\]/);
    for (const s of ['free-chat', 'knowledge', 'positioning', 'content-positioning', 'creative-brief']) expect(src).toContain(`'${s}'`);
  });
});
