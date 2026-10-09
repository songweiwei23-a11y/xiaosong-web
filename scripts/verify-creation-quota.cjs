/* Isolated SQL rehearsal. Install @electric-sql/pglite in .tmp/quota-probe; never connects to production. */
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { PGlite } = require('../.tmp/quota-probe/node_modules/@electric-sql/pglite');
const bundle = require('esbuild').buildSync({ entryPoints: ['lib/config/plans.ts'], bundle: true, platform: 'node', format: 'cjs', write: false });
const mod = { exports: {} };
vm.runInNewContext(bundle.outputFiles[0].text, { module: mod, exports: mod.exports });
const { SUBSCRIPTION_PLANS: plans, COUNTED_FEATURES: features } = mod.exports;
const { createHash } = require('node:crypto');
const owner = '11111111-1111-4111-8111-111111111111';

(async () => {
  const db = new PGlite();
  await db.exec(`CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TABLE subscriptions(user_id uuid PRIMARY KEY,plan text,status text,end_date timestamptz);
    CREATE TABLE user_quotas(user_id uuid PRIMARY KEY REFERENCES auth.users(id),current_period_start timestamptz DEFAULT now(),current_period_end timestamptz DEFAULT now()+interval '1 month',updated_at timestamptz DEFAULT now(),${features.map(f => `${f.column} integer DEFAULT 0`).join(',')});
    CREATE TABLE usage_events(id bigserial PRIMARY KEY,user_id uuid,feature text,task_type text,created_at timestamptz DEFAULT now());
    INSERT INTO auth.users VALUES ('${owner}');`);
  const migration = fs.readFileSync('supabase/migrations/20261003_creation_quota_reservations.sql', 'utf8');
  await db.exec(migration);
  await db.exec(migration); // idempotent migration
  const reserve = async (id, feature='script', fingerprint='same', config=plans) => (await db.query('SELECT kaiwu_reserve_creation($1,$2,$3,$4,$5::jsonb,$6::jsonb) AS result', [owner,id,feature,fingerprint,JSON.stringify(config),JSON.stringify(features)])).rows[0].result;
  const settle = async (id, success) => (await db.query('SELECT kaiwu_settle_creation($1,$2,$3,$4,$5::jsonb) AS result', [owner,id,success,'测试生成',JSON.stringify({ answer: 'isolated fixture' })])).rows[0].result;
  const used = async () => (await db.query('SELECT script_used FROM user_quotas WHERE user_id=$1',[owner])).rows[0].script_used;
  const count = async () => Number((await db.query('SELECT count(*) AS count FROM usage_events')).rows[0].count);
  const results = [];
  const check = async (name, run) => { await run(); results.push({ name, passed: true }); };
  await check('parallel submissions cannot reserve beyond free feature limit', async () => {
    const responses = await Promise.all(Array.from({length:8},(_,i)=>reserve(`first-${i}`)));
    assert.equal(responses.filter(r=>r.allowed).length,5); assert.equal(await used(),0);
  });
  await check('same id is rejected, different payload is conflict', async () => {
    assert.equal((await reserve('first-0')).reason,'duplicate');
    assert.equal((await reserve('first-0','script','different')).reason,'conflict');
  });
  await check('double confirmation increments counter and event once', async () => {
    await Promise.all([settle('first-0',true),settle('first-0',true)]);
    assert.equal(await used(),1); assert.equal(await count(),1);
  });
  await check('failed generation releases quota without successful event', async () => {
    await settle('first-1',false); await settle('first-1',false);
    assert.equal(await used(),1); assert.equal(await count(),1);
    assert.equal((await reserve('after-release')).allowed,true);
    assert.equal((await settle('first-1',true)).settled,false);
  });
  await check('different feature retains independent quota', async () => assert.equal((await reserve('topic-one','topic')).allowed,true));
  await check('pending request from crashed process expires without blocking forever', async () => {
    await db.exec("UPDATE creation_requests SET expires_at=now()-interval '1 second' WHERE request_id='first-2'");
    assert.equal((await reserve('after-expired')).allowed,true);
  });
  await check('paid rollover resets once and reserves against new period', async () => {
    await db.exec(`INSERT INTO subscriptions VALUES('${owner}','basic','active',now()+interval '20 days'); UPDATE user_quotas SET current_period_end=now()-interval '1 day',script_used=50`);
    assert.equal((await reserve('paid-period')).allowed,true); assert.equal(await used(),0);
    await settle('first-3',true); assert.equal(await used(),0); assert.equal(await count(),2);
    await settle('paid-period',true); assert.equal(await used(),1);
  });
  await check('expired paid plan cannot reuse free trial', async () => {
    await db.exec("UPDATE subscriptions SET end_date=now()-interval '1 minute'");
    assert.equal((await reserve('expired-plan')).allowed,false); assert.equal(await used(),5);
  });
  await check('banned users cannot reserve even with remaining balance', async () => {
    await db.exec("UPDATE subscriptions SET status='inactive'; UPDATE user_quotas SET script_used=0");
    assert.equal((await reserve('banned')).reason,'banned');
  });
  await check('transaction rollback restores both event and balance', async () => {
    await db.exec("UPDATE subscriptions SET status='active',end_date=now()+interval '1 month'; UPDATE user_quotas SET script_used=0");
    await reserve('rollback'); const before = await count();
    await db.exec('BEGIN'); await settle('rollback',true); await db.exec('ROLLBACK');
    assert.equal(await used(),0); assert.equal(await count(),before);
    assert.equal((await reserve('rollback')).state,'pending');
  });
  await check('total-pool configuration counts pending requests across features', async () => {
    const total = JSON.parse(JSON.stringify(plans)); total.basic.totalQuota=1;
    assert.equal((await reserve('total-pool','review','same',total)).allowed,false);
  });
  await check('anon and authenticated cannot invoke quota RPCs', async () => {
    for(const role of ['anon','authenticated']) {
      const permissions = (await db.query('SELECT has_function_privilege($1,$2,$3) AS allowed',[role,'kaiwu_reserve_creation(uuid,text,text,text,jsonb,jsonb)','EXECUTE'])).rows[0];
      assert.equal(permissions.allowed,false);
    }
  });
  await db.exec('CREATE TABLE admin_logs(id bigserial PRIMARY KEY,admin_id uuid,action text,target_type text,details jsonb)');
  const evidenceMigration=fs.readFileSync('supabase/migrations/20261004_creation_completion_evidence.sql','utf8');
  await db.exec(evidenceMigration); await db.exec(evidenceMigration);
  const completion=async(id,text='可信完整答案',hash=createHash('sha256').update(text).digest('hex'),terminal='message_end') =>
    (await db.query('SELECT kaiwu_record_creation_completion($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb) AS result',
      [owner,id,text,hash,terminal,'测试生成','conversation-id','message-id',JSON.stringify({prompt_tokens:21,completion_tokens:34})])).rows[0].result;
  const reconcile=async(ids,dryRun=true)=>(await db.query('SELECT kaiwu_reconcile_creation($1,$2::jsonb,$3) AS result',
    [owner,ids==null?null:JSON.stringify(ids.map(id=>({userId:owner,requestId:id}))),dryRun])).rows[0].result;
  await check('only valid nonempty hashed terminal evidence is accepted',async()=>{
    await reserve('proof-invalid');
    await assert.rejects(completion('proof-invalid','完整答案','bad-hash'),/hash mismatch/);
    await assert.rejects(completion('proof-invalid',''),/invalid completion/);
    await assert.rejects(completion('proof-invalid','完整答案',undefined,'partial'),/invalid completion terminal/);
    await assert.rejects(completion('never-reserved'),/invalid generation reservation/);
  });
  await check('same full completion can be retried; another answer conflicts',async()=>{
    await reserve('proof-success'); await completion('proof-success'); await completion('proof-success');
    await assert.rejects(completion('proof-success','另一个回答'),/evidence conflict/);
    assert.equal(Number((await db.query('SELECT count(*) AS n FROM creation_completion_evidence')).rows[0].n),1);
  });
  await check('dry-run defaults preserve quota and usage while logging preview',async()=>{
    const before=await used(),events=await count();
    const preview=await reconcile(['proof-success']); assert.equal(preview.counted,0); assert.equal(preview.results[0].state,'ready');
    assert.equal(await used(),before); assert.equal(await count(),events);
    assert.equal((await db.query('SELECT details FROM admin_logs ORDER BY id DESC LIMIT 1')).rows[0].details.dryRun,true);
  });
  await check('expired unknown reservation is never charged and released request stays released',async()=>{
    await reserve('proof-unknown'); await db.exec("UPDATE creation_requests SET expires_at=now()-interval '3 hours' WHERE request_id='proof-unknown'");
    const before=await count(), result=await reconcile(['proof-unknown','first-1'],false);
    assert.equal(result.counted,0); assert.equal(result.results[0].state,'released'); assert.equal(result.results[1].state,'unknown');
    assert.equal(await count(),before);
  });
  await check('evidence-only reconciliation increments and logs exactly once',async()=>{
    const before=await used(),events=await count();
    const result=await reconcile(['proof-success','proof-success'],false); assert.equal(result.counted,1);
    assert.equal(await used(),before+1); assert.equal(await count(),events+1);
    assert.equal((await reconcile(['proof-success'],false)).counted,0);
    const details=(await db.query('SELECT detail FROM usage_events ORDER BY id DESC LIMIT 1')).rows[0].detail;
    assert.equal(details.generation_request_id,'proof-success'); assert.equal(details.usage.prompt_tokens,21);
    assert.equal(details.usage.total_price,undefined);
  });
  await check('tampered hash or scope is rejected during reconciliation',async()=>{
    await reserve('proof-tampered'); await completion('proof-tampered');
    await db.exec("UPDATE creation_completion_evidence SET feature='wrong-feature' WHERE request_id='proof-tampered'");
    assert.equal((await reconcile(['proof-tampered'],false)).results[0].state,'invalid_evidence');
    await db.exec("UPDATE creation_completion_evidence SET feature='script',result_sha256='bad' WHERE request_id='proof-tampered'");
    assert.equal((await reconcile(['proof-tampered'],false)).results[0].state,'invalid_evidence');
  });
  await check('audit insertion failure rolls back successful quota settlement',async()=>{
    await reserve('proof-log-failure'); await completion('proof-log-failure');
    const before=await used(),events=await count();
    await db.exec("ALTER TABLE admin_logs ADD CONSTRAINT simulated_audit_failure CHECK (action<>'quota_reconcile') NOT VALID");
    await assert.rejects(reconcile(['proof-log-failure'],false),/simulated_audit_failure/);
    await db.exec('ALTER TABLE admin_logs DROP CONSTRAINT simulated_audit_failure');
    assert.equal(await used(),before); assert.equal(await count(),events);
    assert.equal((await reconcile(['proof-log-failure'])).results[0].state,'ready');
  });
  await check('automatic batch handles only evidenced pending completions, max fifty',async()=>{
    const result=await reconcile(null,false);
    assert(result.counted>=1); assert(result.results.length<=50); assert(!result.results.some(r=>r.requestId==='proof-unknown'));
    await assert.rejects(reconcile(Array(51).fill('proof-unknown')),/at most 50/);
  });
  await check('clients cannot read/write completion evidence or invoke reconciliation',async()=>{
    for(const role of ['anon','authenticated']){
      assert.equal((await db.query('SELECT has_table_privilege($1,$2,$3) AS allowed',[role,'creation_completion_evidence','INSERT'])).rows[0].allowed,false);
      assert.equal((await db.query('SELECT has_function_privilege($1,$2,$3) AS allowed',[role,'kaiwu_record_creation_completion(uuid,text,text,text,text,text,text,text,jsonb)','EXECUTE'])).rows[0].allowed,false);
      assert.equal((await db.query('SELECT has_function_privilege($1,$2,$3) AS allowed',[role,'kaiwu_reconcile_creation(uuid,jsonb,boolean)','EXECUTE'])).rows[0].allowed,false);
    }
  });
  console.log(JSON.stringify({ passed: results.length, database: 'isolated PGlite PostgreSQL', note: 'Concurrent requests use one isolated database connection; multi-process lock stress still requires staging PostgreSQL.', results },null,2));
  await db.close();
})().catch(error => { console.error(error); process.exitCode=1; });
