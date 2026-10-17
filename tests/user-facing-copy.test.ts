/**
 * 体检 P0-1：普通用户看得到的文字里，不能出现运维的话（「请先在 Supabase 执行 xxx.sql」「数据库还没升级」之类）。
 * 管理员页面（admin）可以写细节；注释和 console 日志不算用户可见。
 * 扫的是源码里的字符串，所以新加的功能也会被管住。
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const ROOTS = ['app', 'components', 'lib', 'hooks'];
/** 只给管理员看的代码（路径里有这些就跳过） */
const ADMIN_PATH = /[\\/](admin|admin-[a-z]+)[\\/]|[\\/]admin[\\/]|lib[\\/]admin|gate-tickets|lib[\\/]migration-registry/;
const FORBIDDEN = /Supabase 执行|请先在 Supabase|请先执行|执行 supabase|supabase\/migrations|\.sql\b|数据库还没|数据库尚未|数据库没升级|还没启用|尚未启用|还没开通|表还没建|迁移没跑|对应迁移|请联系管理员执行|Supabase request|Authentication request/;
const COMMENT = /^\s*(\/\/|\*|\/\*|\{\/\*)/;

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(tsx?|jsx?)$/.test(e.name) && !/\.test\./.test(e.name)) out.push(p);
  }
  return out;
}

describe('用户看得到的文字：不出现运维的话', () => {
  it('扫到了足够多的文件（防空转）', () => {
    expect(walk(path.join(process.cwd(), 'app')).length).toBeGreaterThan(50);
  });

  it('普通用户页面和接口里，没有「请先执行 SQL」「数据库还没升级」之类的话', () => {
    const offenders: string[] = [];
    for (const root of ROOTS) {
      for (const file of walk(path.join(process.cwd(), root))) {
        const rel = path.relative(process.cwd(), file);
        if (ADMIN_PATH.test(rel)) continue;
        fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
          if (COMMENT.test(line) || /console\./.test(line)) return;
          if (FORBIDDEN.test(line)) offenders.push(`${rel}:${i + 1}  ${line.trim().slice(0, 100)}`);
        });
      }
    }
    expect(offenders).toEqual([]);
  });
});
