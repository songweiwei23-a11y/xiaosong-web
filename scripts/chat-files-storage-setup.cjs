const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z_0-9]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
}
(async () => {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: existing, error: lookup } = await db.storage.getBucket('chat-attachments');
  if (existing) {
    if (existing.public) throw new Error('Existing bucket is public; refusing to use it');
    console.log('Private chat attachment bucket verified'); return;
  }
  if (lookup && !/not found|does not exist/i.test(lookup.message)) throw new Error('Unable to inspect bucket');
  const { error } = await db.storage.createBucket('chat-attachments', { public: false, fileSizeLimit: 10 * 1024 * 1024 });
  if (error) throw new Error('Private attachment bucket creation failed');
  console.log('Private chat attachment bucket created, 10 MB limit; no public access');
})().catch(e => { console.error(e.message); process.exitCode = 1; });
