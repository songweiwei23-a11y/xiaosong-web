// 只读诊断：仅输出 RPC 状态，不输出账号、密钥或业务内容。
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z_0-9]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
}
(async () => {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data, error } = await db.from('subscriptions').select('user_id').eq('plan', 'enterprise').eq('status', 'active').limit(3);
  console.log(JSON.stringify({ phase: 'subscriptions', count: data?.length, error: error && { code: error.code, message: error.message } }));
  for (const s of data || []) {
    const result = await db.rpc('kaiwu_web_search', { p_user_id: s.user_id, p_limits: { free: 3, basic: 20, pro: 60, enterprise: 150 }, p_request_id: null });
    console.log(JSON.stringify({ phase: 'snapshot', data: result.data, error: result.error && { code: result.error.code, message: result.error.message, details: result.error.details } }));
  }
})().catch(e => { console.log(JSON.stringify({ error: e.message })); process.exitCode = 1; });
