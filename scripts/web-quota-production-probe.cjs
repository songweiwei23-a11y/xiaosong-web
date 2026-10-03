/** 对真实服务做有限测试。凭据只从本地环境读取，不写入报告。 */
const fs = require('fs');
const { randomUUID, randomBytes } = require('crypto');
const { createClient } = require('@supabase/supabase-js');
for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z_0-9]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
}
const limits = { free: 3, basic: 20, pro: 60, enterprise: 150 };
const report = { time: new Date().toISOString(), tests: [] };
function assert(condition, name, detail = {}) {
  report.tests.push({ name, passed: !!condition, ...detail });
  console.log(JSON.stringify(report.tests.at(-1)));
  if (!condition) throw Error(name);
}
async function difyRun(name, enabled, query, files = []) {
  const base = process.env.DIFY_BASE_URL || 'https://api.dify.ai/v1';
  const res = await fetch(`${base}/chat-messages`, {
    method: 'POST', headers: { Authorization: `Bearer ${process.env.DIFY_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: 'kaiwu-web-quota-validation-20261001', query: '【高阶自由对话】请直接回答，控制在100字内。\n' + query,
      inputs: { search_query: 'Dify document extractor official documentation', dealReasons: '', web_search_enabled: enabled, web_search_note: enabled === '1' ? '本轮授权搜索一次' : '本轮未授权联网，必须跳过搜索' },
      files, response_mode: 'streaming' }), signal: AbortSignal.timeout(180000),
  });
  assert(res.ok, `${name}: HTTP成功`, { status: res.status });
  const reader = res.body.getReader(), decoder = new TextDecoder();
  let buffer = '', answer = '', searches = 0; const errors = [], nodes = [];
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    buffer += decoder.decode(value, { stream: true }); const lines = buffer.split('\n'); buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      let e; try { e = JSON.parse(line.slice(6)); } catch { continue; }
      if (e.event === 'message_replace') answer = e.answer || '';
      else if (e.event === 'message' && e.answer) answer += e.answer;
      if (e.event === 'error') errors.push(e.message || e.code);
      if (e.event === 'node_started' && e.data?.title === 'Tavily Search') searches++;
      if (e.event === 'node_finished') nodes.push({ title: e.data?.title, status: e.data?.status });
      if (e.event === 'workflow_finished' && e.data?.status !== 'succeeded') errors.push(e.data?.error || 'workflow failed');
    }
  }
  assert(!errors.length && !!answer && searches === (enabled === '1' ? 1 : 0), `${name}: 分支执行与回答正确`, { searches, answer, errors, nodes });
}
async function difyTest() {
  const base = process.env.DIFY_BASE_URL || 'https://api.dify.ai/v1';
  const headers = { Authorization: `Bearer ${process.env.DIFY_API_KEY}` };
  const p = await fetch(`${base}/parameters?quota_validation=${Date.now()}`, { headers: { ...headers, 'Cache-Control': 'no-cache' } }); const config = await p.json();
  report.tests.push({ name: '发布后的附件上限6且支持文档', passed: p.ok && config.file_upload?.enabled && config.file_upload?.number_limits === 6 && config.file_upload?.allowed_file_types?.includes('document'), fileUpload: config.file_upload, inputs: config.user_input_form });
  console.log(JSON.stringify(report.tests.at(-1)));
  await difyRun('关闭联网普通创作', '0', '把“我们店的串串很好吃”改写为一句自然的开篇，不要联网。');
  await difyRun('开启联网', '1', '联网查 Dify 的 Document Extractor 官方说明，给出一个真实官方链接。');
  const files = [];
  for (const [name, type] of [['视觉识别测试.png', 'image'], ['Word识别测试.docx', 'document']]) {
    const form = new FormData(); form.append('file', new Blob([fs.readFileSync(`docs/chat-capability-fixtures/${name}`)]), name); form.append('user', 'kaiwu-web-quota-validation-20261001');
    const r = await fetch(`${base}/files/upload`, { method: 'POST', headers, body: form }); const f = await r.json();
    assert(r.ok && !!f.id, `${name}: 上传成功`);
    files.push({ type, transfer_method: 'local_file', upload_file_id: f.id });
  }
  await difyRun('关闭联网读取图片文档', '0', '读取本轮附件：图片从左到右颜色是什么？Word暗号是什么？只回答两项。', files);
  if (report.tests.some(t => !t.passed)) process.exitCode = 1;
}
async function databaseTest(site) {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const tag = `web-quota-test-${randomUUID()}`;
  const password = randomBytes(24).toString('hex'); let uid;
  const rpc = async (name, args) => { const r = await db.rpc(name, args); if (r.error) throw Error(`${name}: ${r.error.message}`); return r.data; };
  const balance = () => rpc('kaiwu_web_search', { p_user_id: uid, p_limits: limits });
  try {
    const made = await db.auth.admin.createUser({ email: `${tag}@example.com`, password, email_confirm: true, user_metadata: { disposable_quota_test: tag } });
    if (made.error) throw Error(`test-account-create: ${made.error.status} ${made.error.code || ''} ${made.error.message}`); uid = made.data.user.id;
    const denied = await anon.rpc('kaiwu_web_search', { p_user_id: uid, p_limits: limits });
    assert(!!denied.error, '匿名用户无法调用联网授权RPC');
    const signed = await anon.auth.signInWithPassword({ email: `${tag}@example.com`, password });
    if (signed.error) throw Error(signed.error.message);
    const authDenied = await anon.rpc('kaiwu_web_search', { p_user_id: uid, p_limits: { free: 99999 } });
    assert(!!authDenied.error, '登录用户也无法伪造套餐额度');
    const requests = await Promise.all(Array.from({ length: 10 }, () => rpc('kaiwu_web_search', { p_user_id: uid, p_limits: limits, p_request_id: randomUUID() })));
    const allowed = requests.filter(r => r.allowed);
    assert(allowed.length === 3 && (await balance()).pending === 3, '十个并发请求最多放行三个免费搜索', { allowed: allowed.length });
    await Promise.all([rpc('kaiwu_settle_web_search', { p_request_id: allowed[0].requestId, p_state: 'started' }), rpc('kaiwu_settle_web_search', { p_request_id: allowed[0].requestId, p_state: 'started' })]);
    const once = await balance(); assert(once.used === 1 && once.pending === 2, '重复提交同一搜索只计一次');
    await rpc('kaiwu_settle_web_search', { p_request_id: allowed[1].requestId, p_state: 'released' });
    const freed = await balance(); assert(freed.remaining === 1 && freed.pending === 1, '确认搜索未执行后返还预占');
    await rpc('kaiwu_settle_web_search', { p_request_id: allowed[2].requestId, p_state: 'started' });
    const last = await rpc('kaiwu_web_search', { p_user_id: uid, p_limits: limits, p_request_id: randomUUID() });
    await rpc('kaiwu_settle_web_search', { p_request_id: last.requestId, p_state: 'started' });
    assert((await balance()).remaining === 0, '免费体验用尽后不能再搜');
    if (site) {
      const project = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
      const token = Buffer.from(JSON.stringify(signed.data.session)).toString('base64url');
      const cookie = `sb-${project}-auth-token=base64-${token}`;
      const r = await fetch(`${site}/api/web-search/quota`, { headers: { Cookie: cookie } }); const state = await r.json();
      assert(r.ok && state.remaining === 0 && state.limit === 3, '正式站读取认证账号真实联网余额', { status: r.status, remaining: state.remaining });
      const creative = await fetch(`${site}/api/dify/chat`, { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: '联网找一个串串店开篇灵感，只写一句，若不能联网就用现有知识。', freeChat: true, freshWindow: true, webSearchMode: 'on', inputs: { web_search_enabled: '1' }, plan: 'enterprise' }) });
      const text = await creative.text();
      assert(creative.ok && text.includes('quota_exhausted') && /"answer":"[^"\n]+/.test(text) && !text.includes('"status":"searching"'), '用尽后伪造请求仍无搜索，普通创作继续完成', { status: creative.status });
      assert((await balance()).used === 3 && (await balance()).pending === 0, '额度耗尽的生成未新增搜索费用');
    }
    for (const plan of ['basic', 'pro', 'enterprise']) {
      const sub = await db.from('subscriptions').upsert({ user_id: uid, plan, status: 'active', end_date: null }, { onConflict: 'user_id' }); if (sub.error) throw Error(sub.error.message);
      const q = await db.from('user_quotas').upsert({ user_id: uid, current_period_start: new Date().toISOString(), current_period_end: new Date(Date.now() + 86400000).toISOString() }, { onConflict: 'user_id' }); if (q.error) throw Error(q.error.message);
      assert((await balance()).limit === limits[plan] && (await balance()).remaining === limits[plan], `${plan}独立新周期额度正确`);
    }
    await db.from('subscriptions').update({ end_date: new Date(Date.now() - 1000).toISOString() }).eq('user_id', uid);
    assert((await balance()).remaining === 0 && !(await balance()).allowed, '付费到期不重新赠送免费联网体验');
  } finally {
    if (uid) {
      const owned = await db.auth.admin.getUserById(uid);
      if (owned.data.user?.user_metadata?.disposable_quota_test !== tag) throw Error('拒绝清理：测试账号标记不符');
      const cleaned = await db.auth.admin.deleteUser(uid); if (cleaned.error) throw Error(cleaned.error.message);
      assert(!(await db.auth.admin.getUserById(uid)).data.user, '只清理本次创建的临时测试账号');
    }
  }
}
async function concurrencyTest() {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const listed = await db.from('subscriptions').select('user_id').eq('plan','free').eq('status','active');
  if (listed.error) throw Error(listed.error.message);
  let uid, before;
  for (const row of listed.data || []) {
    const r = await db.rpc('kaiwu_web_search',{p_user_id:row.user_id,p_limits:limits});
    if (r.error) throw Error(r.error.message);
    if (r.data.pending === 0 && r.data.remaining === 3) { uid=row.user_id; before=r.data; break; }
  }
  if (!uid) throw Error('No untouched free quota available; skipped live concurrency test');
  const ids = Array.from({length:10},()=>randomUUID());
  try {
    const responses = await Promise.all(ids.map(id=>db.rpc('kaiwu_web_search',{p_user_id:uid,p_limits:limits,p_request_id:id})));
    if (responses.some(r=>r.error)) throw Error('concurrent quota RPC failed');
    const allowed=responses.filter(r=>r.data.allowed);
    assert(allowed.length===3,'十个并发申请最多放行三次',{allowed:allowed.length});
    const denied=await createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY).rpc('kaiwu_web_search',{p_user_id:uid,p_limits:{free:99999}});
    assert(!!denied.error,'匿名客户端不能伪造无限联网额度');
  } finally {
    // 只释放本测试生成的请求ID，不提交实际搜索，也不改变用户已用次数。
    const released=await Promise.all(ids.map(id=>db.rpc('kaiwu_settle_web_search',{p_request_id:id,p_state:'released'})));
    if (released.some(r=>r.error)) throw Error('test reservation release failed');
    const after=await db.rpc('kaiwu_web_search',{p_user_id:uid,p_limits:limits});
    assert(!after.error && after.data.used===before.used && after.data.pending===before.pending && after.data.remaining===before.remaining,'测试预占全部返还，用户额度保持原值');
  }
}
(async () => {
  if (process.argv.includes('--parameters')) {
    const base=process.env.DIFY_BASE_URL || 'https://api.dify.ai/v1';
    const r=await fetch(`${base}/parameters?validation=${Date.now()}`,{headers:{Authorization:`Bearer ${process.env.DIFY_API_KEY}`,'Cache-Control':'no-cache'}});
    const config=await r.json(); assert(r.ok && config.file_upload?.number_limits===6,'发布后的附件上限为六个',{fileUpload:config.file_upload});
  }
  if (process.argv.includes('--six-files')) {
    const base=process.env.DIFY_BASE_URL || 'https://api.dify.ai/v1'; const files=[];
    const fixtures=[['视觉识别测试.png','image'],['正文识别测试.txt','document'],['Word识别测试.docx','document'],['表格识别测试.xlsx','document'],['PPT识别测试.pptx','document'],['PDF识别测试.pdf','document']];
    for(const [name,type] of fixtures){
      const form=new FormData(); form.append('file',new Blob([fs.readFileSync(`docs/chat-capability-fixtures/${name}`)]),name);form.append('user','kaiwu-web-quota-validation-20261001');
      const r=await fetch(`${base}/files/upload`,{method:'POST',headers:{Authorization:`Bearer ${process.env.DIFY_API_KEY}`},body:form});const f=await r.json();assert(r.ok&&!!f.id,`${name}:六附件上传成功`);files.push({type,transfer_method:'local_file',upload_file_id:f.id});
    }
    await difyRun('六附件读取且不联网','0','读取6个附件：1图片左右颜色；2TXT暗号预算；3Word暗号；4Excel两行amount总和；5PPT validation code；6PDF validation code。只回答6项，不要猜测。',files);
  }
  if (process.argv.includes('--dify')) await difyTest();
  if (process.argv.includes('--database')) await databaseTest(process.argv.find(a => a.startsWith('--site='))?.slice(7));
  if (process.argv.includes('--concurrency')) await concurrencyTest();
})().catch(e => { console.error(e.message); report.error = e.message; process.exitCode = 1; }).finally(() => {
  fs.mkdirSync('docs',{recursive:true});
  const output=process.argv.includes('--six-files')?'docs/联网改造六附件实测_20261002.json':process.argv.includes('--parameters')?'docs/联网附件参数实测_20261002.json':process.argv.includes('--dify')?'docs/联网闸门Dify实测_20261001.json':process.argv.includes('--concurrency')?'docs/联网额度并发实测_20261001.json':'docs/联网额度数据库实测_20261001.json';
  fs.writeFileSync(output, JSON.stringify(report, null, 2));
});
