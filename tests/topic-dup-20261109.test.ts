/**
 * 选题查重（2026-11-08 产品方选：生成后比对、标出来，用一次小模型调用判）。
 */
import { describe, expect, it } from 'vitest';
import { buildDupPrompt, parseDupJson } from '@/lib/topic-dup';
import { readCode } from './helpers/source';

const titles = ['一元一串的火锅，到底是赚还是赔', '川味烧烤和普通烧烤的区别'];
const done = [{ title: '一元火锅到底赚不赚钱', status: '已发布' as const }, { title: '川味烧烤的辣椒面怎么炒', status: '已拍摄' as const }];

describe('查重的提示词和结果', () => {
  it('只传标题；写明同一件事同一个角度才算、同品类不算、拿不准不算', () => {
    const p = buildDupPrompt(titles, done);
    expect(p.system).toContain('同一件事、同一个切入角度');
    expect(p.system).toContain('只是同一个品类');
    expect(p.system).toContain('拿不准的不算');
    expect(p.user).toContain('1. 一元一串的火锅，到底是赚还是赔');
    expect(p.user).toContain('2. 川味烧烤的辣椒面怎么炒');
  });
  it('按编号读回原标题；编号越界、重复、不是 JSON 的都丢掉', () => {
    expect(parseDupJson('结果：{"dups":[{"new":1,"done":1,"why":"都在算一元火锅赚不赚钱"},{"new":1,"done":2},{"new":9,"done":1},{"new":2,"done":7}]}', titles, done))
      .toEqual([{ title: titles[0], like: '一元火锅到底赚不赚钱', status: '已发布', why: '都在算一元火锅赚不赚钱' }]);
    expect(parseDupJson('{"dups":[]}', titles, done)).toEqual([]);
    expect(parseDupJson('不知道', titles, done)).toEqual([]);
  });
});

describe('页面怎么用', () => {
  it('定稿后才查（核对润色期间不查）；有做过的才查；同一批只查一次；只标不改', () => {
    expect(readCode('app/dashboard/topic/page.tsx')).toMatch(/dupCheck=\{!finishing && !!selectedProfileId && !!creatorContext\.doneList\?\.length \? selectedProfileId : null\}/);
    const list = readCode('components/workspace/TopicList.tsx');
    expect(list).toMatch(/const cached = dupCache\.get\(dupKey\)/);
    expect(list).toMatch(/（换不换你定）/);
  });
  it('接口不扣次数、限流、判不了就返回空', () => {
    const route = readCode('app/api/topic-dup/route.ts');
    expect(route).not.toMatch(/reserveCreation|settleCreation/);
    expect(route).toMatch(/createRateLimiter\(10 \* 60_000, 30\)/);
    expect(route).toMatch(/catch \{\s*return NextResponse\.json\(\{ hits: \[\]/);
  });
});
