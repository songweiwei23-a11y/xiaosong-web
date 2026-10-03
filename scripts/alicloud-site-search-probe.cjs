/** 只用本次临时测试账号验证正式网站联网记账；不读取真实用户会话。 */
const fs = require('node:fs');
const { randomUUID, randomBytes } = require('node:crypto');
const { createClient } = require('@supabase/supabase-js');
for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z_0-9]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
}
const site = 'http://122.51.234.155';
const report = { time: new Date().toISOString(), tests: [] };
function check(ok, name, detail = {}) {
  const item = { name, passed: !!ok, ...detail }; report.tests.push(item); console.log(JSON.stringify(item));
  if (!ok) throw Error(name);
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const tag = `kaiwu-ali-qa-${randomUUID()}`;
let uid;
(async () => {
  const email = `${tag}@example.com`, password = randomBytes(24).toString('hex');
  const made = await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { disposable_ali_search_test: tag } });
  if (made.error) throw Error(`创建临时账号失败: ${made.error.code || made.error.status}`);
  uid = made.data.user.id;
  const signed = await client.auth.signInWithPassword({ email, password });
  if (signed.error) throw Error(`临时账号登录失败: ${signed.error.code || signed.error.status}`);
  const project = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
  const cookie = `sb-${project}-auth-token=base64-${Buffer.from(JSON.stringify(signed.data.session)).toString('base64url')}`;
  async function quota() {
    const res = await fetch(`${site}/api/web-search/quota`, { headers: { Cookie: cookie }, signal: AbortSignal.timeout(30000) });
    const data = await res.json(); check(res.ok, '正式网站认证额度查询成功', { status: res.status }); return data;
  }
  const before = await quota();
  async function run(mode, query) {
    const res = await fetch(`${site}/api/dify/chat`, {
      method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ freeChat: true, freshWindow: true, webSearchMode: mode, query }), signal: AbortSignal.timeout(180000),
    });
    const body = await res.text(); check(res.ok, `${mode}: 正式网站生成成功`, { status: res.status });
    const events = body.split('\n').filter(line => line.startsWith('data: ')).flatMap(line => {
      try { return [JSON.parse(line.slice(6))]; } catch { return []; }
    });
    check(!events.some(e => e.event === 'error' || e.type === 'error'), `${mode}: 没有流式生成错误`);
    return { events, body };
  }
  const online = await run('on', '联网查 Dify 官方 Document Extractor 支持哪些文档，只用100字回答并带官方来源链接。');
  const statuses = online.events.filter(e => e.event === 'web_search');
  const found = statuses.find(e => (e.data?.status || e.status) === 'done' && (e.data?.sources || e.sources)?.length);
  check(!!found, '正式网站收到真实联网来源', { sources: found?.data?.sources || found?.sources || [], eventKinds: [...new Set(online.events.map(e => e.event || e.type || 'data'))] });
  const after = await quota();
  check(after.used === before.used + 1 && after.pending === 0, '阿里云搜索在正式网站恰好扣一次', { before: before.used, after: after.used, pending: after.pending });
  await run('off', '无需联网，把“串串很好吃”改成一句开篇钩子。');
  const final = await quota();
  check(final.used === after.used && final.pending === 0, '普通创作不扣联网额度', { used: final.used, pending: final.pending });
})().catch(error => { report.error = error.message; console.error(error.message); process.exitCode = 1; }).finally(async () => {
  if (uid) {
    const owned = await db.auth.admin.getUserById(uid);
    if (owned.data.user?.user_metadata?.disposable_ali_search_test !== tag) throw Error('临时测试标记不符，拒绝清理');
    const deleted = await db.auth.admin.deleteUser(uid);
    check(!deleted.error, '只清理本次生成的临时测试账号');
  }
  fs.writeFileSync('docs/阿里云联网正式网站验收_20261002.json', JSON.stringify(report, null, 2));
});
