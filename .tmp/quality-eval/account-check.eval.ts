// 账号全面体检（真实线上记录，只读）：每个板块取最近 N 条真实输出，用验收标准做确定性检查，并与档案、定位、简报交叉核对。
// 不调用模型。结果写到 .tmp/quality-eval/account-check.json。
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'vitest';
import { unsupportedFacts } from '@/lib/quality-checks';

const PER_BOARD = 3;
const FORBIDDEN = /最正宗|最好吃|全城|全网|第一家|绝对|100%|保证|稳赚|零添加|必吃|必去|揭秘/g;
const DIRECT_CONTACT = /加微信|加V|加v|私信我|私信发|加我微信|扫码/g;
const META = /自检|校对|交稿前|核对清单|数字来源核查|禁忌核查|三有自检|为什么这样写|数据说明|【本轮|【高阶自由对话】|内部|36计|起号36|第\d+计/g;
const PLACEHOLDER = /【待确认|【换成|【示例|\bX\b元|X块|X年|X串|X%/g;

describe('账号体检', () => {
  it('真实输出体检', async () => {
    const { getServiceSupabase } = await import('@/lib/admin-auth');
    const db = getServiceSupabase();
    const { data: profiles } = await db.from('user_profiles').select('*');
    const row = (profiles as any[]).find((r) => String(r.id).startsWith('74586841'));
    const uid = String(row.user_id);
    const pid = String(row.id);

    const { data: pos } = await db.from('account_positioning').select('positioning_type,is_active,full_content,strategy_summary').eq('profile_id', pid);
    const { data: briefRows } = await db.from('account_positioning').select('full_content').eq('profile_id', pid).eq('positioning_type', '创作简报');
    const brief = String((briefRows as any[])?.[0]?.full_content ?? '');
    const activePos = String(((pos as any[]) ?? []).find((p) => p.is_active && p.positioning_type === '账号定位')?.full_content ?? '');
    const known = [JSON.stringify(row), activePos, brief, String(row.interview_notes ?? ''), String(row.interview_highlights ?? '')].join('\n');

    const { data: hist } = await db.from('script_history').select('task_type,result,created_at,input_data').eq('user_id', uid).order('created_at', { ascending: false }).limit(1500);
    const boards = ['账号定位', '内容定位', '商业定位', '创作简报', '起号方案', '内容规划', '行业建议', '拆解爆款', '脚本生成', '选题策划', '标题封面', '开篇钩子', '创作方向', '审稿优化', '跨行业二创', '分镜脚本', '成交理由', '知识库查询'];
    const out: any[] = [];
    for (const b of boards) {
      const rows = ((hist as any[]) ?? []).filter((h) => h.task_type === b).slice(0, PER_BOARD);
      for (const r of rows) {
        const text = String(r.result ?? '');
        const endsOk = /[。！？!?）)》”"」】*|\-\d\w]\s*$/.test(text.trimEnd()) || /[一-鿿]$/.test(text.trimEnd());
        const issues: Record<string, any> = {
          chars: text.length,
          truncatedGuess: !endsOk,
          forbidden: [...new Set([...text.matchAll(FORBIDDEN)].map((m) => m[0]))],
          directContact: [...new Set([...text.matchAll(DIRECT_CONTACT)].map((m) => m[0]))],
          meta: [...new Set([...text.matchAll(META)].map((m) => m[0]))],
          placeholders: (text.match(PLACEHOLDER) ?? []).length,
          unsupported: unsupportedFacts(text, known).slice(0, 6),
          headings: (text.match(/^#{1,4}\s+/gm) ?? []).length,
        };
        out.push({ board: b, at: String(r.created_at).slice(0, 16), ...issues });
      }
    }

    // 账号数据层面的一致性
    const consistency: string[] = [];
    if (!String(row.persona_facts ?? '').length || row.persona_facts === null) consistency.push('人设事实卡为空：审稿与事实检查缺少年限、出镜人等对照物');
    if (row.taboo_settings === null) consistency.push('禁忌设置为空：禁忌只在文字里（content_restrictions），没有结构化禁忌');
    if (row.content_mix === null) consistency.push('内容配比为空：配比每次现算，未保存');
    if (!row.account_stage) consistency.push('账号阶段为空');
    if (Array.isArray(row.product_category) && row.product_category.includes('餐饮')) consistency.push('产品品类仍含泛称「餐饮」（应只留具体品类）');
    const dupSell = String(row.unique_selling_point ?? '').split(/[、，,]/).filter((x, i, a) => a.indexOf(x) !== i);
    if (dupSell.length) consistency.push(`卖点重复：${[...new Set(dupSell)].join('、')}`);
    if (String(row.conversion_path ?? '').includes('私信')) consistency.push('转化路径含「私信」，与内容限制（不引导站外联系方式）及审稿规则冲突');
    const cat = Array.isArray(row.account_track) ? row.account_track : [];
    if (!String(row.content_themes ?? '').includes('川菜') && cat.includes('川菜')) consistency.push('选题方向没写川菜，但赛道含川菜');
    const dupPos = ((pos as any[]) ?? []).filter((p) => p.positioning_type === '商业定位').length;
    if (dupPos > 1) consistency.push(`商业定位有 ${dupPos} 份同名记录（多为历史版本，未清理）`);
    if (!((pos as any[]) ?? []).some((p) => p.positioning_type === '创作简报' && p.is_active)) consistency.push('创作简报未启用（is_active=false），与「启用」字段语义不一致，需确认读取逻辑');

    const dir = path.join('.tmp', 'quality-eval');
    fs.writeFileSync(path.join(dir, 'account-check.json'), JSON.stringify({ at: new Date().toISOString(), consistency, outputs: out }, null, 2));
    console.log('CHECKED', out.length, 'CONSISTENCY', consistency.length);
  }, 300000);
});
