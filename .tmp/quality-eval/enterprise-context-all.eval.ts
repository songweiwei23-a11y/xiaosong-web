// 只读：全部档案中面向观众板块的 E1/E2/E7 命中上下文，供人工判断。
import fs from 'node:fs';
import { describe, it } from 'vitest';

const FACING = new Set(['脚本生成', '选题策划', '开篇钩子', '分镜脚本', '跨行业二创', '审稿优化']);
const HIT = /最正宗|最好吃|全城|全网|第一家|最(?:好|高|低|便宜|划算|值|强|专业|正宗|新鲜|暖和|实惠|省)(?!拍|看|的时候|的人)|100%|保证(?!画面|稳定|推进|焦点|拍摄|音)|绝对|稳赚|零添加|纯天然|必吃|必去|顶级|极致|加微信|加V|扫码|留电话|揭秘|内幕|自检|校对|交稿前|【本轮|【本条|提示词|本轮校对/g;
const NEG = /不能|不要|不许|禁止|别说|别写|避免|不承诺|不说|❌|✗|×|反例|错误|误区|不可用|不写|不得|不用|不做|不在/;

describe('上下文', () => {
  it('打印', async () => {
    const { getServiceSupabase } = await import('@/lib/admin-auth');
    const db = getServiceSupabase();
    const { data: profiles } = await db.from('user_profiles').select('id,user_id').limit(50);
    const owner = (profiles as any[]).find((r) => String(r.id).startsWith('74586841')).user_id;
    const { data: hist } = await db.from('script_history').select('task_type,result,created_at,input_data').eq('user_id', owner).order('created_at', { ascending: false }).limit(4000);
    const out: string[] = [];
    const count: Record<string, number> = {};
    for (const h of (hist as any[]) ?? []) {
      if (!FACING.has(h.task_type) || !String(h.result ?? '').trim()) continue;
      const pid = String(h.input_data?.profileId ?? h.input_data?.profile_id ?? '未记录').slice(0, 4);
      const t = String(h.result);
      for (const line of t.split('\n')) {
        if (NEG.test(line)) continue;
        for (const m of line.matchAll(HIT)) {
          const key = h.task_type + ':' + m[0];
          count[key] = (count[key] ?? 0) + 1;
          if (count[key] > 2) continue;
          const at = m.index ?? 0;
          out.push(`[${h.task_type}|${pid}|${String(h.created_at).slice(0, 10)}] ${m[0]} ｜ ${line.slice(Math.max(0, at - 24), at + m[0].length + 16).trim()}`);
        }
      }
    }
    fs.writeFileSync('.tmp/quality-eval/enterprise-context-all.txt', out.join('\n'));
    console.log('LINES', out.length);
  }, 120000);
});
