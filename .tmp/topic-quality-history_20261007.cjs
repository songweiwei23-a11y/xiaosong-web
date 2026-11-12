const fs = require('node:fs');
const { createClient } = require('@supabase/supabase-js');
for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
(async () => {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data, error } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new Error('Owner lookup failed');
  const owner = data.users.find(u => u.email === 'song.weiwei23@gmail.com');
  if (!owner) throw new Error('Project owner account not found; no other account read');
  const history = await db.from('script_history').select('input_data,result,created_at').eq('user_id', owner.id).eq('task_type', '选题策划').order('created_at', { ascending: false }).limit(12);
  if (history.error) throw new Error('Topic history read failed');
  fs.writeFileSync('.tmp/topic-quality-owner-history_20261007.json', JSON.stringify(history.data, null, 2), { mode: 0o600 });
  console.log(JSON.stringify(history.data.map(r => ({ created: r.created_at, from: r.input_data?.sourceFrom, keywords: r.input_data?.keywords, direction: r.input_data?.personalRequirement, route: r.input_data?.route, titles: String(r.result).split('\n').filter(l => /^#{1,3}\s/.test(l)).slice(0, 10) })), null, 2));
})().catch(() => { console.error('Topic history diagnostic failed; no credentials logged'); process.exitCode = 1; });
