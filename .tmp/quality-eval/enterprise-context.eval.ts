// 只读：本账号真实输出中，E1/E2/E7 命中词的上下文（一行），供人工判断是否真违规。不改数据。
import fs from 'node:fs';
import { describe, it } from 'vitest';

const WORDS = /最正宗|最好吃|全城|全网|第一家|最好|最高|最便宜|最划算|最省|最强|最暖和|最实惠|最低|最新鲜|保证|绝对|必吃|必去|顶级|100%|加微信|揭秘|内幕|36计|自检|校对|【本轮/g;
const NEG = /不能|不要|不许|禁止|别说|别写|避免|不承诺|不说|❌|✗|×|反例|错误|误区|不可用|不写|不得|不用|不做/;

describe('命中上下文', () => {
  it('打印', async () => {
    const { getServiceSupabase } = await import('@/lib/admin-auth');
    const db = getServiceSupabase();
    const { data: profiles } = await db.from('user_profiles').select('id,user_id').limit(50);
    const pid = String((profiles as any[]).find((r) => String(r.id).startsWith('74586841')).id);
    const uid = String((profiles as any[]).find((r) => String(r.id).startsWith('74586841')).user_id);
    const { data: hist } = await db.from('script_history').select('task_type,result,created_at,input_data').eq('user_id', uid).order('created_at', { ascending: false }).limit(3000);
    const rows = ((hist as any[]) ?? []).filter((h) => String(h.input_data?.profileId ?? '') === pid && String(h.result ?? '').trim());
    const out: string[] = [];
    const per: Record<string, number> = {};
    for (const h of rows) {
      const t = String(h.result);
      for (const line of t.split('\n')) {
        if (NEG.test(line)) continue;
        for (const m of line.matchAll(WORDS)) {
          per[h.task_type] = (per[h.task_type] ?? 0) + 1;
          if (per[h.task_type] > 6) continue;
          const at = m.index ?? 0;
          out.push(`[${h.task_type} ${String(h.created_at).slice(0, 10)}] ${m[0]} ｜ ${line.slice(Math.max(0, at - 22), at + m[0].length + 14).trim()}`);
        }
      }
    }
    fs.writeFileSync('.tmp/quality-eval/enterprise-context.txt', out.join('\n'));
    console.log('HITS', out.length);
  }, 120000);
});
