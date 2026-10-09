/**
 * 素材库「全部产出」（2026-10-02）：历史里生成过的结果自动按库归好，和收藏分开。
 */
import { describe, it, expect } from 'vitest';
import { OUTPUT_LIBRARIES, OUTPUT_SKIP_TASKS, libraryOfTask, outputTitle, outputPreview } from '@/lib/library-outputs';
import { CATEGORY_IDS, CATEGORY_NEXT } from '@/lib/library';
import { TASK_TYPE_TO_FEATURE } from '@/lib/task-type';
import { readCode } from './helpers/source';

describe('归库规则', () => {
  it('每种会生成内容的任务都有库可归（除了分镜页的 AI 推荐）——漏了就等于用户的产出在素材库里看不见', () => {
    const missing = Object.keys(TASK_TYPE_TO_FEATURE).filter((t) => !OUTPUT_SKIP_TASKS.has(t) && t !== '自由对话' && !libraryOfTask(t));
    expect(missing, `这些任务的产出没归到任何库：${missing.join('、')}`).toEqual([]);
  });

  it('库的 id 都是素材库分类，并且都有推荐的下一步', () => {
    for (const l of OUTPUT_LIBRARIES) {
      expect(CATEGORY_IDS.has(l.id), l.label).toBe(true);
      expect(CATEGORY_NEXT[l.id].length, l.label).toBeGreaterThan(0);
    }
  });

  it('定位四件套进定位库；开篇和起号方案分开', () => {
    for (const t of ['账号定位', '商业定位', '内容定位', '创作简报']) expect(libraryOfTask(t)?.label).toBe('定位库');
    expect(libraryOfTask('开篇钩子')?.label).toBe('开篇库');
    expect(libraryOfTask('起号方案')?.label).toBe('起号方案库');
    expect(libraryOfTask('创作方向')?.label).toBe('方向库');
  });
});

describe('标题和预览', () => {
  it('先用当时填的主题 / 文件名', () => {
    expect(outputTitle('# 随便', { topic: '国庆濮阳免费开放的5个地方' })).toBe('国庆濮阳免费开放的5个地方');
    expect(outputTitle('# 随便', { fileName: '下载.mp4' })).toBe('下载.mp4');
  });

  it('没有就取正文第一个像样的标题，「## 选题方案」「# 📝 完整文案」这种栏目名跳过', () => {
    expect(outputTitle('## 选题方案\n### 晒过程｜一元火锅怎么给料')).toBe('晒过程｜一元火锅怎么给料');
    expect(outputTitle('# 📝 完整文案（可直接拍摄版）\n## 老板凌晨挑肉')).toBe('老板凌晨挑肉');
    expect(outputTitle('没有标题的一段话\n第二行')).toBe('没有标题的一段话');
  });

  it('线上实测分不出是哪条的几类：按任务类型取（分镜、审稿、起号、定位、二创）', () => {
    // 分镜 / 审稿：带过来的原稿里的【视频主题】
    expect(outputTitle('## 1. 分镜表', { originContent: '【视频主题】牛肉穿串前的真实备菜过程\n【创作方向】…' }, '分镜脚本')).toBe('牛肉穿串前的真实备菜过程');
    // 老记录没存主题：取稿子第一句，去掉段落标记，跳过审稿打分
    expect(outputTitle('## 📊 节奏自检', { scriptContent: '【开篇钩子·验证解密】评论区好多人问，一元火锅怎么给料的？' }, '分镜脚本')).toBe('分镜 · 评论区好多人问，一元火锅怎么给料的');
    expect(outputTitle('## 1. 总评', { draftContent: '1. 总评 - 综合得分 8.7 分。今天带你们看后厨怎么备菜' }, '审稿优化')).toBe('审稿 · 今天带你们看后厨怎么备菜');
    // 起号方案：跳过「先说结论」
    expect(outputTitle('## 先说结论\n## 主攻打法：街头采访', {}, '起号方案')).toBe('主攻打法：街头采访');
    // 定位四件套：类型 + 档案名；没存档案名就叫类型名
    expect(outputTitle('## 1. 一句话定位', { profileSummary: '- 档案名称：锦园地摊串串\n- …' }, '账号定位')).toBe('账号定位 · 锦园地摊串串');
    expect(outputTitle('### 人设与口吻', { notes: '' }, '创作简报')).toBe('创作简报');
    // 二创：原片名
    expect(outputTitle('### 方案1：甲', { source: '下载 (2).mp4' }, '跨行业二创')).toBe('二创 · 下载 (2).mp4');
  });

  it('预览去掉标题行和符号', () => {
    expect(outputPreview('## 标题\n**口播**：你绝对想不到')).toBe('口播 ：你绝对想不到');
  });
});

describe('接口和页面', () => {
  const api = readCode('app/api/library/outputs/route.ts');
  // 分页、隔离、搜索、选题按条拆的真实行为见 tests/library-assets.test.ts（内存数据库跑真实路由）
  it('按本人读；列表不带全文（用户网络对大请求敏感），全文点开再取', () => {
    expect(api).toMatch(/const userId = guard\.userId!/);
    expect(api.match(/\.eq\('user_id', userId\)/g)?.length).toBeGreaterThanOrEqual(3);
    expect(api).toMatch(/preview: outputPreview/);
  });

  it('选题库按一条一条拆（选题索引），一条的 id 是「批次id#序号」', () => {
    expect(readCode('lib/library-topic-index.ts')).toMatch(/id: `\$\{row\.history_id\}#\$\{idx\}`/);
  });

  it('搜索关键词里的通配符和过滤语法符号去掉', () => {
    expect(api).toMatch(/const kw = cleanKeyword\(sp\.get\('q'\)\)/);
  });

  it('素材库分「我的收藏」「全部产出」「风格预设」；没收藏过直接进全部产出', () => {
    const page = readCode('app/dashboard/library/page.tsx');
    expect(page).toMatch(/"我的收藏"/);
    expect(page).toMatch(/"全部产出"/);
    expect(page).toMatch(/"风格预设"/);
    expect(page).toMatch(/if \(\(data\.counts\?\.all \?\? list\.length\) === 0\) setTab\("outputs"\)/);
  });

  it('每条产出能看全文、复制、继续创作、收藏（按原板块归类）、回到原板块', () => {
    const panel = readCode('components/library/OutputsPanel.tsx');
    expect(panel).toMatch(/<CreationLinks body=\{bodies\[it\.id\]\} favoriteBoard=\{current\.board\}/);
    expect(panel).toMatch(/historyOpenUrl\(\{ task_type: it\.taskType, work_id: it\.workId \}\)/);
  });
});
