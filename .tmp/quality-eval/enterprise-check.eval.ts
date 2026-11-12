// 企业商用验收：全板块真实输出的确定性检测（只读，不调用模型）。
// 结果写 .tmp/quality-eval/enterprise-check.json，供人工复核。
import fs from 'node:fs';
import { describe, it } from 'vitest';
import { unsupportedFacts } from '@/lib/quality-checks';

const K = 5;
const FACING = new Set(['脚本生成', '选题策划', '标题封面', '开篇钩子', '分镜脚本', '跨行业二创', '审稿优化']);
const BOARDS = ['脚本生成', '选题策划', '标题封面', '开篇钩子', '分镜脚本', '跨行业二创', '审稿优化', '创作方向', '成交理由', '知识库查询', '账号定位', '内容定位', '商业定位', '创作简报', '起号方案', '内容规划', '行业建议', '拆解爆款'];
// E1 绝对化：肯定陈述中出现才算
// 收窄：只认对产品的断言式用语（最好/最高/最便宜/最划算…），不认「最怕的」「最容易」这类描述语
const ABSOLUTE = /最正宗|最好吃|全城|全网|第一家|第一(?!招|步|次|条|种|个|句|波|轮|遍|眼|秒|站|件|季|天|批)|最(?:好|高|低|便宜|划算|值|强|专业|正宗|新鲜|暖和|实惠|优惠|大牌|全|省)(?!拍|看|吃的时候|的时候)|100%|保证|绝对|稳赚|零添加|纯天然|必吃|必去|顶级|极致/g;
// E2 平台：站外引流与敏感、操纵
const PLATFORM = /加微信|加V|加v|扫码|留电话|揭秘|内幕|刷评论|刷量|小号|买赞|买粉/g;
// 否定语境：这一行是在提醒「别这么写」，不算
const NEGATED = /不能|不要|不许|禁止|别说|别写|避免|不承诺|不说|❌|✗|×|反例|错误|误区|不可用|不写|不得|不用|不做/;
// E7 元信息（不做否定过滤：规则举例本身就是泄漏）
const META = /自检|校对|交稿前|核对清单|数字来源核查|禁忌核查|三有自检|为什么这样写|数据说明|【本轮|【本条|【高阶自由对话】|【高阶自由|提示词|第\d+计|36计|起号36|内部术语/g;
const DM = /私信/g;

function scanLines(text: string, re: RegExp, filterNegated: boolean): string[] {
  const hits: string[] = [];
  for (const line of text.split('\n')) {
    if (filterNegated && NEGATED.test(line)) continue;
    for (const m of line.matchAll(re)) hits.push(m[0]);
  }
  return [...new Set(hits)];
}

function judge(text: string, known: string, board: string) {
  const facing = FACING.has(board);
  const e1 = scanLines(text, ABSOLUTE, true);
  const e2 = scanLines(text, PLATFORM, true);
  const e3 = unsupportedFacts(text, known).slice(0, 8);
  const e5: string[] = [];
  const body = text.trimEnd();
  if (!body) e5.push('空输出');
  else if (/[，、：（(]$|【$|\*\*$/.test(body)) e5.push('疑似截断');
  if (/未提供档案|无法核对|缺少档案|需要用户提供档案|待用户提供档案/.test(text)) e5.push('拒答：以缺档案为由停下');
  const e7 = facing ? [...new Set([...text.matchAll(META)].map((m) => m[0]))] : [];
  const placeholders = (text.match(/【待确认|【换成/g) ?? []).length;
  const warn: string[] = [];
  if (facing && [...text.matchAll(DM)].length) warn.push(`私信引导 ${[...text.matchAll(DM)].length} 处（平台规则与内容限制需统一）`);
  if (facing && placeholders > 5) warn.push(`占位过多 ${placeholders} 处，直接念不了`);
  return {
    facing, chars: text.length,
    E1_absolute: e1, E2_platform: e2, E3_unsupported: e3, E5_complete: e5, E7_meta: e7,
    placeholders, warn,
    pass: e1.length === 0 && e2.length === 0 && e3.length === 0 && e5.length === 0 && (!facing || e7.length === 0),
  };
}

describe('企业商用验收检测', () => {
  it('全板块真实输出', async () => {
    const { getServiceSupabase } = await import('@/lib/admin-auth');
    const db = getServiceSupabase();
    const { data: profiles } = await db.from('user_profiles').select('*');
    const row = (profiles as any[]).find((r) => String(r.id).startsWith('74586841'));
    const uid = String(row.user_id), pid = String(row.id);
    const { data: pos } = await db.from('account_positioning').select('positioning_type,is_active,full_content').eq('profile_id', pid);
    const brief = String(((pos as any[]) ?? []).find((p) => p.positioning_type === '创作简报')?.full_content ?? '');
    const activePos = String(((pos as any[]) ?? []).find((p) => p.is_active && p.positioning_type === '账号定位')?.full_content ?? '');
    const known = [JSON.stringify(row), activePos, brief, String(row.interview_notes ?? ''), String(row.interview_highlights ?? '')].join('\n');

    // 只看本账号：按 input_data.profileId 归属；没有档案 ID 的记录无法归属，单独计数
    const { data: histAll } = await db.from('script_history').select('task_type,result,created_at,input_data').eq('user_id', uid).order('created_at', { ascending: false }).limit(3000);
    const ownOf = (h: any) => String(h.input_data?.profileId ?? h.input_data?.profile_id ?? '');
    const hist = ((histAll as any[]) ?? []).filter((h) => ownOf(h) === pid);
    const unattributed = ((histAll as any[]) ?? []).filter((h) => !ownOf(h)).length;
    const records: any[] = [];
    for (const b of BOARDS) {
      const rows = ((hist as any[]) ?? []).filter((h) => h.task_type === b && String(h.result ?? '').trim()).slice(0, K);
      for (const r of rows) records.push({ board: b, at: String(r.created_at).slice(0, 16), source: 'script_history', ...judge(String(r.result), known, b) });
    }

    // 自由对话：chat_conversations.messages 里的助手回复
    const { data: convs } = await db.from('chat_conversations').select('kind,task_type,messages,created_at,profile_id').eq('user_id', uid).order('created_at', { ascending: false }).limit(50);
    let freeCount = 0;
    for (const c of ((convs as any[]) ?? []).filter((x) => String(x.profile_id ?? '') === pid)) {
      const msgs = Array.isArray(c.messages) ? c.messages : [];
      const assistant = msgs.filter((m: any) => m && (m.role === 'assistant' || m.role === 'ai' || m.sender === 'assistant'));
      for (const m of assistant.slice(-2)) {
        const text = String(m.content ?? m.text ?? '');
        if (!text.trim()) continue;
        freeCount++;
        if (freeCount > K * 2) break;
        records.push({ board: `自由对话(${c.kind ?? c.task_type ?? '?'})`, at: String(c.created_at).slice(0, 16), source: 'chat_conversations', ...judge(text, known, '自由对话') });
      }
    }

    const summary: Record<string, any> = {};
    for (const r of records) {
      const s = (summary[r.board] ??= { n: 0, pass: 0, E1: 0, E2: 0, E3: 0, E5: 0, E7: 0, warnings: 0 });
      s.n++; if (r.pass) s.pass++;
      if (r.E1_absolute.length) s.E1++;
      if (r.E2_platform.length) s.E2++;
      if (r.E3_unsupported.length) s.E3++;
      if (r.E5_complete.length) s.E5++;
      if (r.E7_meta.length) s.E7++;
      if (r.warn.length) s.warnings++;
    }
    fs.writeFileSync('.tmp/quality-eval/enterprise-check.json', JSON.stringify({ at: new Date().toISOString(), profile: 'b账号-锦园', ownRecords: hist.length, unattributedRecords: unattributed, summary, records }, null, 2));
    console.log('RECORDS', records.length, 'BOARDS', Object.keys(summary).length);
  }, 300000);
});
