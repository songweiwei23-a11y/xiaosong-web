import { describe, it, expect } from 'vitest';
import {
  splitTopicSections,
  removeTopicSection,
  deletedTopicsOf,
  topicKey,
  collectTopics,
  buildNoRepeatBlock,
  wantsNewTopics,
  NO_REPEAT_LIMIT,
  NO_REPEAT_TASKS,
  ISOLATED_TASKS,
} from '@/lib/topic-library';
import { parseTopicOptions } from '@/lib/handoff';
import { readCode } from './helpers/source';

/**
 * 选题：每一条都留得住、找得到、拿得走；新生成的不和出过的撞车。
 *
 * 【线上的毛病】同样的输入连生成两次，10 条里 6 条是同一个选题，
 * 只是换了顺序、全角标点换成半角。根源是 Dify 会话记忆：模型看到
 * "上次同样的问题我答了这 10 条"，就照着再写一遍。
 * 另外选题只按"批"存，想找两周前的某一条得一批批翻，也没法单独拿去写脚本。
 */

// 三种线上出现过的写法，拆分都要认
const FORMAT_A = [
  '# 濮阳火锅店 10 个选题',
  '',
  '## 选题1：20年前濮阳老板怎么招客？看完我笑了',
  '**内容方向**：街头采访老店老板',
  '**开篇钩子**：你猜 20 年前一锅多少钱',
  '',
  '---',
  '',
  '## 选题2：老板拒单三次，这桌客人为什么还来',
  '**内容方向**：反常识',
  '',
  '## 发布建议',
  '晚上 7 点发',
].join('\n');

const FORMAT_B = [
  '## 📌 选题1：【对抗反常识型】',
  '**标题**：《火锅店最赚钱的不是锅底》',
  '拍法：后厨实拍',
  '',
  '## 📌 选题2：【人设故事型】',
  '**标题**：《90后老板 vs 70后老板》',
  '拍法：对比剪辑',
].join('\n');

const FORMAT_C = [
  '## 【教知识型选题】2条',
  '### 1. 《濮阳一家火锅店，老板不会拍视频》',
  '讲清楚为什么',
  '### 2. 《锅底到底该怎么选》',
  '讲清楚怎么选',
].join('\n');

describe('一批拆成一条一条', () => {
  it('## 选题N：标题 的写法', () => {
    const s = splitTopicSections(FORMAT_A);
    expect(s.map((x) => x.title)).toEqual([
      '20年前濮阳老板怎么招客？看完我笑了',
      '老板拒单三次，这桌客人为什么还来',
    ]);
    expect(s[0].body).toContain('街头采访老店老板');
    // 正文不能带上分隔线，最后一条也不能把"发布建议"吞进去
    expect(s[0].body).not.toMatch(/---\s*$/);
    expect(s[1].body).not.toContain('发布建议');
  });

  it('标题行只有类别时，从 **标题**：《……》 那行取题目', () => {
    expect(splitTopicSections(FORMAT_B).map((x) => x.title)).toEqual([
      '火锅店最赚钱的不是锅底',
      '90后老板 vs 70后老板',
    ]);
  });

  it('更早的"### 1. 《……》"写法兜底认出来', () => {
    expect(splitTopicSections(FORMAT_C).map((x) => x.title)).toEqual([
      '濮阳一家火锅店，老板不会拍视频',
      '锅底到底该怎么选',
    ]);
  });

  it('认得出"选题"写法时，不把选题内部的编号小节当成选题', () => {
    const md = ['## 选题1：甲', '### 1. 开头怎么拍', '### 2. 结尾怎么拍', '## 选题2：乙'].join('\n');
    expect(splitTopicSections(md).map((x) => x.title)).toEqual(['甲', '乙']);
  });

  it('送去写脚本时挑的选项，和选题库拆出来的是同一份', () => {
    expect(parseTopicOptions(FORMAT_B)).toEqual(splitTopicSections(FORMAT_B).map((x) => x.title));
  });
});

describe('判断是不是同一条', () => {
  it('只差全角半角标点、空格、书名号，算同一条', () => {
    expect(topicKey('20年前濮阳老板怎么招客？看完我笑了')).toBe(topicKey('《20年前濮阳老板怎么招客?看完 我笑了》'));
  });

  it('全角数字、全角字母和半角的算同一条', () => {
    expect(topicKey('２０年前的ＶＳ现在')).toBe(topicKey('20年前的vs现在'));
  });

  it('字不一样就不是同一条', () => {
    expect(topicKey('老板拒单三次')).not.toBe(topicKey('老板拒单两次'));
  });

  it('选题库去重：同一条出现在好几批里，只留最新那次', () => {
    const lib = collectTopics([
      { id: 'new', result: FORMAT_A, created_at: '2026-09-20' },
      { id: 'old', result: FORMAT_A.replace('？', '?'), created_at: '2026-09-19' },
    ]);
    expect(lib).toHaveLength(2);
    expect(lib.every((t) => t.batchId === 'new')).toBe(true);
  });
});

describe('逐条删除', () => {
  it('只删那一条，别的原样留着', () => {
    const r = removeTopicSection(FORMAT_A, '20年前濮阳老板怎么招客?看完我笑了');
    expect(r.removed).toEqual(['20年前濮阳老板怎么招客？看完我笑了']);
    expect(splitTopicSections(r.markdown).map((x) => x.title)).toEqual(['老板拒单三次，这桌客人为什么还来']);
    expect(r.markdown).toContain('发布建议');
  });

  it('没匹配上就原样返回', () => {
    expect(removeTopicSection(FORMAT_A, '不存在的选题')).toEqual({ markdown: FORMAT_A, removed: [] });
  });

  it('删掉的记录只认字符串', () => {
    expect(deletedTopicsOf({ deletedTopics: ['甲', '', 3, '乙'] })).toEqual(['甲', '乙']);
    expect(deletedTopicsOf(null)).toEqual([]);
    expect(deletedTopicsOf({ deletedTopics: 'x' })).toEqual([]);
  });
});

describe('不重复：把出过的明明白白告诉 AI', () => {
  it('清单里列出每一条，并禁止换个说法重出', () => {
    const block = buildNoRepeatBlock(['甲选题', '乙选题']);
    expect(block).toContain('一条都不能重复');
    expect(block).toContain('1. 甲选题');
    expect(block).toContain('2. 乙选题');
    expect(block).toMatch(/改标点.*调换语序|调换语序.*改标点/);
  });

  it('没出过就不加这一段', () => {
    expect(buildNoRepeatBlock([])).toBe('');
  });

  it('清单有上限', () => {
    const many = Array.from({ length: NO_REPEAT_LIMIT + 30 }, (_, i) => `选题${i}`);
    const block = buildNoRepeatBlock(many);
    expect(block).toContain(`${NO_REPEAT_LIMIT}. 选题${NO_REPEAT_LIMIT - 1}`);
    expect(block).not.toContain(`选题${NO_REPEAT_LIMIT}\n`);
  });

  it('选题策划既防重复、也不接共用会话', () => {
    expect(NO_REPEAT_TASKS.has('选题策划')).toBe(true);
    expect(ISOLATED_TASKS.has('选题策划')).toBe(true);
  });

  it.each([
    '再来10条',
    '再来 10 个选题',
    '换一批',
    '换一组看看',
    '重新生成一批',
    '多给几个选题',
    '给我一些新的选题',
    '有没有别的角度',
  ])('"%s" 是在要新选题', (q) => {
    expect(wantsNewTopics(q)).toBe(true);
  });

  it.each(['第3条展开讲讲', '这条怎么拍', '开篇钩子再改短一点', '帮我把第二个写成脚本'])(
    '"%s" 是追问某一条，不附清单',
    (q) => {
      expect(wantsNewTopics(q)).toBe(false);
    }
  );
});

describe('接线：生成和追问都用上', () => {
  const stream = readCode('app/api/dify/stream/route.ts');
  const chat = readCode('app/api/dify/chat/route.ts');
  const server = readCode('lib/topic-library-server.ts');

  it('生成选题前附上出过的清单', () => {
    expect(stream).toMatch(
      /if \(NO_REPEAT_TASKS\.has\(body\.taskType\)\)\s*\{\s*const prior = await loadPriorTopicTitles\(guard\.userId!\);\s*query \+= buildNoRepeatBlock\(prior\)/
    );
  });

  it('生成选题不接共用会话，也不写回去', () => {
    expect(stream).toMatch(/const isolated = ISOLATED_TASKS\.has\(body\.taskType\)/);
    expect(stream).toMatch(/isolated \? null : await getDifyConversationId\(/);
    expect(stream).toMatch(/if \(!isolated && [^{]*\)\s*\{\s*await saveDifyConversationId\(/);
  });

  it('清单覆盖所有历史批次，删掉的也算出过、排在最前', () => {
    expect(server).toMatch(/\.eq\('user_id', userId\)/);
    expect(server).toMatch(/\.eq\('task_type', '选题策划'\)/);
    const deleted = server.indexOf('deletedTopicsOf(b.input_data).forEach(add)');
    const collected = server.indexOf('collectTopics(data ?? [])');
    expect(deleted).toBeGreaterThan(-1);
    expect(collected).toBeGreaterThan(deleted);
  });

  it('追问：选题不接共用窗口，第一次把整批贴进去', () => {
    expect(chat).toMatch(/const isolated = ISOLATED_TASKS\.has\(taskType\)/);
    expect(chat).toMatch(/freshWindow \|\| isolated\s*\?\s*null/);
    expect(chat).toMatch(/const limit = isolated \? \d{4,} : 1500/);
    expect(chat).toMatch(/if \(conversationIdFromResponse && !isolated\)/);
  });

  it('追问要新选题时附清单，出的新一批存进选题库', () => {
    expect(chat).toMatch(/NO_REPEAT_TASKS\.has\(taskType\) && wantsNewTopics\(/);
    expect(chat).toMatch(/if \(askingNewTopics\)\s*\{\s*const prior = await loadPriorTopicTitles\(guard\.userId!\)\s*fullQuery \+= buildNoRepeatBlock\(prior\)/);
    expect(chat).toMatch(/if \(askingNewTopics\)\s*\{\s*await saveFollowUpTopics\(guard\.userId, query \|\| '', answerText, profileId\)/);
    expect(chat).toMatch(/answerText \+= data\.answer/);
    expect(server).toMatch(/splitTopicSections\(answer\)\.length < FOLLOW_UP_MIN_TOPICS\) return false/);
    expect(server).toMatch(/task_type: '选题策划'/);
  });

  it('追问对话把自己是哪个板块告诉服务端', () => {
    expect(readCode('components/ContinuousDialog.tsx')).toMatch(/taskType: taskType,\s*conversationId:/);
  });
});

describe('接线：删除与选题库', () => {
  const api = readCode('app/api/topics/route.ts');
  const page = readCode('app/dashboard/topic/page.tsx');

  it('按条删：在本人所有批次里删，并记下删了哪些', () => {
    expect(api).toMatch(/if \(topic\)\s*\{/);
    expect(api).toMatch(/removeTopicSection\(b\.result \|\| '', topic\)/);
    expect(api).toMatch(/deletedTopicsOf\(input\), \.\.\.r\.removed/);
    expect(api).toMatch(/input_data: \{ \.\.\.input, deletedTopics \}/);
    expect(api).toMatch(/\.eq\('id', b\.id\)\s*\.eq\('user_id', user\.id\)/);
  });

  it('页面挂上选题库，每条都能送出、删除', () => {
    expect(page).toMatch(/<TopicLibrary[\s\S]{0,200}batches=\{history\}/);
    expect(page).toMatch(/onAction=\{sendTopic\}/);
    expect(page).toMatch(/fetch\(`\/api\/topics\?topic=\$\{encodeURIComponent\(title\)\}`, \{ method: "DELETE" \}\)/);
  });

  it('关掉追问对话就刷新选题库，追问出的那批立刻看得到', () => {
    expect(page).toMatch(/onClose=\{\(\) => \{\s*closeContinuousDialog\(\);\s*loadHistory\(\);/);
  });
});
