// 只读：核对「川菜品类」计划在线上的数据状态——档案两栏、最新账号定位的开头。不写库。
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; })
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data: profiles, error: pe } = await db
  .from('user_profiles')
  .select('id,profile_name,product_category,account_track,content_themes,updated_at')
  .limit(200);
if (pe) throw pe;
const row = (profiles ?? []).find((r) => String(r.id).startsWith('74586841'));
if (!row) { console.log('未找到 74586841 开头的档案'); process.exit(0); }
console.log('档案:', row.profile_name, '| updated_at:', row.updated_at);
console.log('product_category:', JSON.stringify(row.product_category));
console.log('account_track:', JSON.stringify(row.account_track));
console.log('content_themes:', JSON.stringify(row.content_themes));

const { data: pos, error: qe } = await db
  .from('account_positioning')
  .select('positioning_type,full_content,created_at')
  .eq('profile_id', row.id)
  .order('created_at', { ascending: false })
  .limit(20);
if (qe) throw qe;
const latest = (pos ?? []).find((p) => p.positioning_type === '账号定位');
if (!latest) { console.log('没有账号定位记录'); process.exit(0); }
const text = String(latest.full_content ?? '');
console.log('最新账号定位 @', latest.created_at, '| 含「川菜」', text.includes('川菜') ? '是' : '否', '| 长度', text.length);
console.log('账号定位开头:');
console.log(text.split(/\r?\n/).filter((l) => l.trim()).slice(0, 12).join('\n'));
