import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ROUTES_GUIDE } from '@/lib/creative-routes';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');

describe('流量不靠教知识：小黄结构优先', () => {
  it('系统提示词不再把泛知识直接划成流量型，并列出小黄脚本结构库', () => {
    const sp = read('docs/dify/system-prompt.md');
    expect(sp).not.toContain('泛知识多为流量型');
    expect(sp).toContain('小黄脚本结构库');
    expect(sp).toContain('两套形式同等可用');
  });

  it('配比规则不再说泛知识能做流量', () => {
    const ps = read('lib/positioning-standards.ts');
    expect(ps).not.toContain('只有**泛知识、长见识**的角度才能做流量');
    expect(ps).toContain('先看档案的行业、人、货、场和团队条件');
  });

  it('内容规划的内容类型不再把四大脚本当唯一选项', () => {
    const cp = read('lib/content-plan.ts');
    expect(cp).not.toContain('教知识 / 晒过程 / 讲故事 / 聊观点 选一个');
    expect(cp).toContain('先在「出发点」里定好内容');
  });

  it('两套打法说明同等可用，大流量由出发点定义', () => {
    expect(ROUTES_GUIDE).toContain('两套同等可用');
    expect(ROUTES_GUIDE).not.toContain('两套都是好菜');
  });
});
