// 只读：档案里与价格、人均、团购、产品有关的字段原文（评测判断「价格说法有没有出处」用）。
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; })
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data } = await db.from('user_profiles').select('*');
const row = data.find((r) => String(r.id).startsWith('74586841'));
for (const k of ['price_range', 'product_category', 'conversion_path', 'unique_selling_point', 'competitive_advantage', 'content_restrictions', 'taboo_settings', 'team_structure']) {
  console.log(`${k}: ${JSON.stringify(row[k])}`);
}
const { data: pos } = await db.from('account_positioning').select('positioning_description,strategy_summary,full_content').eq('profile_id', row.id).eq('is_active', true).limit(1);
const text = JSON.stringify(pos ?? []);
console.log('定位里的价格字眼:', [...new Set(text.match(/[\d一二两三四五六七八九十百]+\s*(元|块|钱)[^，。"\\]{0,6}/g) ?? [])].slice(0, 20).join(' | ') || '无');
const iv = JSON.stringify(row.interview_notes ?? '') + JSON.stringify(row.interview_highlights ?? '');
console.log('访谈里的价格字眼:', [...new Set(iv.match(/[\d一二两三四五六七八九十百]+\s*(元|块|钱)[^，。"\\]{0,6}/g) ?? [])].slice(0, 20).join(' | ') || '无');
