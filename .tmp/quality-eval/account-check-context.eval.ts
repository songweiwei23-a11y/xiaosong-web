// 只读：把体检里命中的禁用词、引流词、无出处句子的上下文打印出来，供人工核对（不改数据）。
import fs from 'node:fs';
import { describe, it } from 'vitest';

describe('体检上下文', () => {
  it('打印命中上下文', async () => {
    const { getServiceSupabase } = await import('@/lib/admin-auth');
    const db = getServiceSupabase();
    const { data: profiles } = await db.from('user_profiles').select('user_id,id').limit(50);
    const uid = String((profiles as any[]).find((r) => String(r.id).startsWith('74586841')).user_id);
    const { data: hist } = await db.from('script_history').select('task_type,result,created_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(1500);
    const pat = /保证|绝对|揭秘|最正宗|全网|100%|必吃|私信|加微信|加我微信|私信发|私信我/g;
    const seen: Record<string, number> = {};
    const lines: string[] = [];
    for (const h of (hist as any[]) ?? []) {
      if (!['账号定位', '内容定位', '商业定位', '脚本生成', '选题策划', '标题封面', '审稿优化', '开篇钩子', '创作简报', '起号方案', '内容规划', '行业建议', '拆解爆款', '分镜脚本', '成交理由', '知识库查询'].includes(h.task_type)) continue;
      if ((seen[h.task_type] ?? 0) >= 2) continue;
      seen[h.task_type] = (seen[h.task_type] ?? 0) + 1;
      const text = String(h.result ?? '');
      const hits = [...text.matchAll(pat)].slice(0, 3);
      for (const m of hits) {
        const at = m.index ?? 0;
        lines.push(`[${h.task_type} ${String(h.created_at).slice(0, 10)}] …${text.slice(Math.max(0, at - 14), at + m[0].length + 10).replace(/\n/g, ' ')}…`);
      }
    }
    fs.writeFileSync('.tmp/quality-eval/account-check-context.txt', lines.join('\n'));
    console.log('LINES', lines.length);
  }, 120000);
});
