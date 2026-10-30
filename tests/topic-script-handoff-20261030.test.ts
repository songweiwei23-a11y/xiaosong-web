/**
 * 选题 → 脚本 的跳转（2026-10-30）：选题打法行里的四大脚本类型和结构，要带到脚本页。
 *
 * 线上现象：选题写的是「四大脚本·聊观点：…」，跳到脚本页后脚本类型认不出，脚本页自动决策，
 * 结构指导整段丢掉，产出变成问句串，「你」指向出镜人自己。
 * 原因：选题的打法行只写了类型头，而解析器只认「讲法」标签和完整结构名；选题页还用整批结果算设置，整批会被直接跳过。
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { scriptFormOfTopic } from '@/lib/creation-settings';
import { buildTopicBoardQuery } from '@/lib/boards/topic-query';

describe('选题的打法行：四大脚本的类型和结构认得出来', () => {
  it('写全名「聊观点·论证型」：类型和结构都带过去', () => {
    expect(scriptFormOfTopic('**🅰 打法**\n- 四大脚本·聊观点·论证型：先讲判断，再用亲身经历说明依据')).toEqual({ scriptType: 'discuss', structure: 'argue' });
  });

  it('只写类型「四大脚本·聊观点：…」：类型带过去，结构取这一类的第一种', () => {
    const got = scriptFormOfTopic('**🅰 打法**\n- 四大脚本·聊观点：先讲判断，再用亲身经历说明依据');
    expect(got.scriptType).toBe('discuss');
    expect(got.structure).toBe('argue');
  });

  it('写「晒过程·火车节」：类型 show、结构 train', () => {
    expect(scriptFormOfTopic('- 四大脚本·晒过程·火车节：按时间顺序拍')).toEqual({ scriptType: 'show', structure: 'train' });
  });

  it('36 计的行不当成四大脚本：返回空，不误判', () => {
    expect(scriptFormOfTopic('**🅰 打法**\n- 36计·第1计 反向操作：把顺序倒过来')).toEqual({});
  });

  it('没有四大脚本的行：返回空（仍走自动决策）', () => {
    expect(scriptFormOfTopic('这条选题讲一个故事，没有写打法')).toEqual({});
  });

  it('只看这一条：正文里别处提到的四大脚本，不会被当成这一条的', () => {
    expect(scriptFormOfTopic('**🅰 打法**\n- 36计·第1计 反向操作：…\n\n另外可以试试四大脚本·教知识·解题型')).toEqual({});
  });
});

describe('选题页的跳转用这一条的打法', () => {
  it('选题页 sendTopic 把 scriptFormOfTopic(body) 合进脚本设置（两处跳转都要）', () => {
    const page = readFileSync(join(process.cwd(), 'app/dashboard/topic/page.tsx'), 'utf8');
    const uses = page.split('scriptFormOfTopic(body ?? ').length - 1;
    expect(uses).toBeGreaterThanOrEqual(2);
  });
});

describe('选题提示词要求写全名的四大脚本结构', () => {
  it('打法格式行列出完整的结构名，不只是类型头', () => {
    const src = readFileSync(join(process.cwd(), 'lib/boards/topic-query.ts'), 'utf8');
    expect(src).toContain('四大脚本·结构（${SCRIPT_STRUCTURE_NAMES.join(\' / \')}，写全名）');
    expect(src).not.toContain('四大脚本·脚本类型（聊观点 / 晒过程 / 教知识 / 讲故事）');
    expect(typeof buildTopicBoardQuery).toBe('function');
  });
});
