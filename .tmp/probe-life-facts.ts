// 只读：拿最近的真实生成结果跑「个人经历」新规则，看命中的是不是真编的（只打印命中片段）
import fs from 'node:fs';
import { unsupportedFacts } from '@/lib/quality-checks';
const env: Record<string, string> = {};
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, ''); }
const sb = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` };
const rows = await (await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/script_history?select=task_type,result,input_data&order=created_at.desc&limit=60`, { headers: sb })).json();
let n = 0, hit = 0;
for (const r of rows) {
  n++;
  const known = JSON.stringify(r.input_data || {});
  const life = unsupportedFacts(r.result || '', known).filter((x) => x.startsWith('个人经历'));
  if (life.length) { hit++; console.log(`[${r.task_type}]`, life.join(' ｜ ')); }
}
console.log(`共 ${n} 条，${hit} 条有命中`);
