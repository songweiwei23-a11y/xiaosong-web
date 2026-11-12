// 企业商用验收：同一用户名下全部档案的真实产出（只读，不调用模型）。
// 每个档案用自己的档案、定位、简报、访谈做出处比对；没有档案 ID 的记录单独归为「无法归属」。
import fs from 'node:fs';
import { describe, it } from 'vitest';
import { unsupportedFacts } from '@/lib/quality-checks';

const K = 5;
const FACING = new Set(['脚本生成', '选题策划', '标题封面', '开篇钩子', '分镜脚本', '跨行业二创', '审稿优化']);
const BOARDS = ['脚本生成', '选题策划', '标题封面', '开篇钩子', '分镜脚本', '跨行业二创', '审稿优化', '创作方向', '成交理由', '知识库查询', '账号定位', '内容定位', '商业定位', '创作简报', '起号方案', '内容规划', '行业建议', '拆解爆款'];
// E1 断言式绝对化（对产品的承诺/最高级）。否定语境与描述语（最怕、最容易）不算
const E1 = /最正宗|最好吃|全城|全网|第一家|最(?:好|高|低|便宜|划算|值|强|专业|正宗|新鲜|暖和|实惠|省)(?!拍|看|的时候|的人)|100%|保证(?!画面|稳定|推进|焦点|拍摄|音)|绝对|稳赚|零添加|纯天然|必吃|必去|顶级|极致/g;
// E2 平台：站外引流作为行动指令、平台敏感词、操纵数据
const E2 = /加微信|加V|加v|扫码|留电话|揭秘|内幕|刷评论|刷量|小号|买赞|买粉/g;
// E7 内部泄漏（观众文案不得出现；创作者文档允许编号）
const E7 = /自检|校对|交稿前|核对清单|数字来源核查|禁忌核查|三有自检|为什么这样写|数据说明|【本轮|【本条|【高阶自由对话】|提示词|系统指令|本轮校对|内部术语/g;
const NEG = /不能|不要|不许|禁止|别说|别写|避免|不承诺|不说|❌|✗|×|反例|错误|误区|不可用|不写|不得|不用|不做|不在/;

function judge(text: string, known: string, board: string) {
  const facing = FACING.has(board);
  const lines = text.split('\n');
  const e1: string[] = [], e2: string[] = [], e7: string[] = [];
  for (const line of lines) {
    const neg = NEG.test(line);
    for (const m of line.matchAll(E1)) if (!neg) e1.push(m[0]);
    for (const m of line.matchAll(E2)) if (!neg) e2.push(m[0]);
    if (facing) for (const m of line.matchAll(E7)) e7.push(m[0]);
  }
  const e3 = unsupportedFacts(text, known).filter((s) => !/模型自称|顾客见证「[^」]*(如果|若|可以|记得|就说|拍|提前|沟通|同意)/.test(s)).slice(0, 8);
  const e5: string[] = [];
  const body = text.trimEnd();
  if (!body) e5.push('空输出');
  if (/未提供档案|无法核对|缺少档案|需要用户提供档案|待用户提供档案/.test(text)) e5.push('拒答');
  const ph = (text.match(/【待确认|【换成/g) ?? []).length;
  const warn: string[] = [];
  if (facing && (text.match(/私信/g) ?? []).length) warn.push('私信引导');
  if (facing && ph > 5) warn.push(`占位${ph}处`);
  return {
    facing, chars: text.length,
    E1: [...new Set(e1)], E2: [...new Set(e2)], E3: e3, E5: e5, E7: [...new Set(e7)], warn,
    pass: e1.length === 0 && e2.length === 0 && e3.length === 0 && e5.length === 0 && e7.length === 0,
  };
}

describe('企业商用验收（全部档案）', () => {
  it('真实产出检测', async () => {
    const { getServiceSupabase } = await import('@/lib/admin-auth');
    const db = getServiceSupabase();
    const { data: profiles } = await db.from('user_profiles').select('*');
    const owner = (profiles as any[]).find((r) => String(r.id).startsWith('74586841')).user_id;
    const mine = (profiles as any[]).filter((p) => p.user_id === owner);
    const { data: pos } = await db.from('account_positioning').select('profile_id,positioning_type,is_active,full_content').eq('user_id', owner);
    const { data: histAll } = await db.from('script_history').select('task_type,result,created_at,input_data').eq('user_id', owner).order('created_at', { ascending: false }).limit(4000);
    const { data: convs } = await db.from('chat_conversations').select('kind,task_type,messages,created_at,profile_id').eq('user_id', owner).order('created_at', { ascending: false }).limit(200);
    const ownOf = (h: any) => String(h.input_data?.profileId ?? h.input_data?.profile_id ?? '');
    const unattributed = ((histAll as any[]) ?? []).filter((h) => !ownOf(h)).length;

    const records: any[] = [];
    const perProfile: Record<string, any> = {};
    for (const p of mine) {
      const pid = String(p.id);
      const name = String(p.profile_name ?? '').slice(0, 20);
      const pp = ((pos as any[]) ?? []).filter((x) => x.profile_id === pid);
      const brief = String(pp.find((x) => x.positioning_type === '创作简报')?.full_content ?? '');
      const activePos = String(pp.find((x) => x.is_active && x.positioning_type === '账号定位')?.full_content ?? '');
      const known = [JSON.stringify(p), activePos, brief, String(p.interview_notes ?? ''), String(p.interview_highlights ?? '')].join('\n');
      const hist = ((histAll as any[]) ?? []).filter((h) => ownOf(h) === pid);
      for (const b of BOARDS) {
        const rows = hist.filter((h) => h.task_type === b && String(h.result ?? '').trim()).slice(0, K);
        for (const r of rows) records.push({ profile: name, board: b, at: String(r.created_at).slice(0, 10), ...judge(String(r.result), known, b) });
      }
      for (const c of ((convs as any[]) ?? []).filter((x) => String(x.profile_id ?? '') === pid)) {
        const msgs = Array.isArray(c.messages) ? c.messages : [];
        for (const m of msgs.filter((m: any) => m && (m.role === 'assistant' || m.role === 'ai')).slice(-2)) {
          const text = String(m.content ?? m.text ?? '');
          if (!text.trim()) continue;
          records.push({ profile: name, board: '自由对话', at: String(c.created_at).slice(0, 10), ...judge(text, known, '自由对话') });
        }
      }
      perProfile[name] = { records: hist.length };
    }

    const summary: Record<string, any> = {};
    for (const r of records) {
      const s = (summary[r.board] ??= { n: 0, pass: 0, E1: 0, E2: 0, E3: 0, E5: 0, E7: 0, warn: 0 });
      s.n++; if (r.pass) s.pass++;
      if (r.E1.length) s.E1++; if (r.E2.length) s.E2++; if (r.E3.length) s.E3++; if (r.E5.length) s.E5++; if (r.E7.length) s.E7++; if (r.warn.length) s.warn++;
    }
    fs.writeFileSync('.tmp/quality-eval/enterprise-all.json', JSON.stringify({ at: new Date().toISOString(), profiles: perProfile, unattributed, summary, records }, null, 2));
    console.log('PROFILES', mine.length, 'RECORDS', records.length, 'UNATTRIBUTED', unattributed);
  }, 300000);
});
