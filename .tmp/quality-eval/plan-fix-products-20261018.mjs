// 川菜品类计划（已确认）的数据步骤：产品品类「餐饮」→ 三个具体品类。只改 product_category 一列。
// 改之前核对当前值必须是预期的旧值；改完回读确认。
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const EXPECTED_OLD = ['川味串串火锅', '川味烧烤', '川菜', '餐饮'];
const NEW_VALUE = ['川味串串火锅', '川味烧烤', '川菜'];

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; })
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data: profiles, error: pe } = await db.from('user_profiles').select('id,profile_name,product_category').limit(200);
if (pe) throw pe;
const row = (profiles ?? []).find((r) => String(r.id).startsWith('74586841'));
if (!row) throw new Error('未找到档案');
const before = JSON.stringify(row.product_category);
console.log('改之前 product_category:', before);
if (JSON.stringify(row.product_category) !== JSON.stringify(EXPECTED_OLD)) {
  console.log('当前值不是预期的旧值，停止，不改。');
  process.exit(1);
}

const { error: ue } = await db.from('user_profiles').update({ product_category: NEW_VALUE }).eq('id', row.id);
if (ue) throw ue;

const { data: after, error: re } = await db.from('user_profiles').select('product_category').eq('id', row.id).single();
if (re) throw re;
console.log('改之后 product_category:', JSON.stringify(after.product_category));
console.log('回读一致:', JSON.stringify(after.product_category) === JSON.stringify(NEW_VALUE) ? '是' : '否');
