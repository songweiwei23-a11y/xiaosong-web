import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) { const m = l.match(/^([A-Z_][A-Z_0-9]*)=(.*)$/); if (m) process.env[m[1]] = m[2].trim().replace(/^(['"])(.*)\1$/, '$2'); }
const U = process.env.NEXT_PUBLIC_SUPABASE_URL!, K = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const r = await fetch(`${U}/rest/v1/user_profiles?select=profile_name,competitive_advantage&profile_name=ilike.*${encodeURIComponent('万客隆')}*`, { headers: { apikey: K, Authorization: `Bearer ${K}` } });
for (const p of await r.json()) {
  const s = JSON.stringify(p); const i = s.indexOf('外兴');
  console.log(p.profile_name, i >= 0 ? s.slice(Math.max(0, i - 20), i + 10) : '无外兴', /阜南/.test(s) ? '仍有阜南' : '无阜南');
}
