/* Execute migration and RPC as real authenticated roles in isolated PostgreSQL. Never production. */
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { PGlite } = require('../.tmp/quota-probe/node_modules/@electric-sql/pglite');
const A='11111111-1111-4111-8111-111111111111', B='22222222-2222-4222-8222-222222222222';
const PA='33333333-3333-4333-8333-333333333333', PA2='44444444-4444-4444-8444-444444444444', PB='55555555-5555-4555-8555-555555555555';
const WA='66666666-6666-4666-8666-666666666666', WA2='77777777-7777-4777-8777-777777777777', WB='88888888-8888-4888-8888-888888888888';
(async()=>{
  const db=new PGlite();
  await db.exec(`CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS 'SELECT nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';
    CREATE ROLE authenticated; CREATE ROLE anon; GRANT USAGE ON SCHEMA auth TO authenticated,anon; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated,anon;
    CREATE TABLE user_profiles(id uuid PRIMARY KEY,user_id uuid REFERENCES auth.users(id));
    CREATE TABLE works(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid REFERENCES auth.users(id),profile_id uuid,title text,updated_at timestamptz DEFAULT now());
    CREATE TABLE script_history(id uuid PRIMARY KEY,result text);
    ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY; ALTER TABLE works ENABLE ROW LEVEL SECURITY;
    CREATE POLICY own_profiles ON user_profiles FOR ALL TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
    CREATE POLICY own_works ON works FOR ALL TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
    GRANT SELECT ON user_profiles TO authenticated; GRANT SELECT,INSERT,UPDATE,DELETE ON works TO authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated;
    INSERT INTO auth.users VALUES('${A}'),('${B}');
    INSERT INTO user_profiles VALUES('${PA}','${A}'),('${PA2}','${A}'),('${PB}','${B}');
    INSERT INTO works(id,user_id,profile_id,title) VALUES('${WA}','${A}','${PA}','原作品'),('${WA2}','${A}','${PA2}','另一档案'),('${WB}','${B}','${PB}','另一账号');
    INSERT INTO script_history VALUES(gen_random_uuid(),'历史必须保留');`);
  const sql=fs.readFileSync('supabase/migrations/20261003_creation_sessions.sql','utf8');
  await db.exec(sql); await db.exec(sql);
  // API role can inspect own snapshots but cannot update/delete immutable versions.
  await db.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${A}',false);`);
  const rpc=async(payload,branch=false,id=randomUUID())=>(await db.query('SELECT save_creation_session($1::uuid,$2::jsonb,$3::boolean) AS saved',[id,JSON.stringify(payload),branch])).rows[0].saved;
  const base={from:'审稿优化',target:'/dashboard/growth',profileId:PA,workId:WA,sourceContent:'现在的正文',originContent:'最早的原文',settings:{purpose:'人设型',audience:'本地年轻顾客',structure:'train',duration:'60秒'}};
  const inspect=async(id)=>(await db.query('SELECT creation_brief FROM works WHERE id=$1',[id])).rows[0]?.creation_brief;
  const count=async(table)=>Number((await db.query(`SELECT count(*) AS count FROM ${table}`)).rows[0].count);
  const results=[];
  const check=async(name,fn)=>{await fn();results.push({name,passed:true});};
  let first;
  await check('saves full settings and original content to snapshot and work',async()=>{
    first=await rpc(base); assert.equal(first.payload.workId,WA); assert.deepEqual(first.payload.settings,base.settings);
    assert.equal(first.payload.originContent,'最早的原文'); assert.equal((await inspect(WA)).sourceContent,'现在的正文');
  });
  await check('partial settings update inherits audience, structure and duration while changing purpose',async()=>{
    const next=await rpc({...base,from:'开篇钩子',target:'/dashboard/script',sourceContent:'选择的开头',settings:{purpose:'变现型'},originContent:'不应覆盖最早原文'});
    assert.deepEqual(next.payload.settings,{...base.settings,purpose:'变现型'});
    assert.equal(next.payload.originContent,'最早的原文'); assert.equal(next.payload.sourceContent,'选择的开头');
    assert.deepEqual((await inspect(WA)).settings,next.payload.settings);
  });
  await check('old snapshot remains immutable after later hop',async()=>{
    const old=(await db.query('SELECT payload FROM creation_sessions WHERE id=$1',[first.id])).rows[0].payload;
    assert.equal(old.sourceContent,'现在的正文'); assert.equal(old.settings.purpose,'人设型');
    await assert.rejects(db.query('UPDATE creation_sessions SET payload=$1 WHERE id=$2',[{},first.id]),/permission denied/);
    await assert.rejects(db.query('DELETE FROM creation_sessions WHERE id=$1',[first.id]),/permission denied/);
  });
  await check('foreign account profile or work id is denied, even for branch',async()=>{
    for(const branch of [false,true]) {
      await assert.rejects(rpc({...base,profileId:PB,workId:WB},branch),/profile ownership/);
      await assert.rejects(rpc({...base,workId:WB},branch),/work profile ownership/);
    }
  });
  await check('same account different profile work is denied, including branch and null-profile',async()=>{
    for(const branch of [false,true]) {
      await assert.rejects(rpc({...base,workId:WA2},branch),/work profile ownership/);
      await assert.rejects(rpc({...base,profileId:null},branch),/work profile ownership/);
    }
  });
  await check('branch creates separate work and inherits prior intent without changing parent',async()=>{
    const previous=await inspect(WA), before=await count('works');
    const branch=await rpc({...base,sourceContent:'分支版本',settings:{duration:'30秒'}},true);
    assert.notEqual(branch.payload.workId,WA); assert.equal(await count('works'),before+1);
    assert.deepEqual(await inspect(WA),previous); assert.equal(branch.payload.settings.audience,base.settings.audience);
    assert.equal(branch.payload.settings.duration,'30秒'); assert.equal(branch.payload.originContent,'最早的原文');
  });
  await check('multi-selection snapshot creates no phantom work',async()=>{
    const before=await count('works'); const {workId,...without}=base;
    const saved=await rpc({...without,topicOptions:['方案1','方案2','方案3']});
    assert.equal(await count('works'),before); assert.equal(saved.payload.workId,undefined);
    assert.equal(saved.payload.topicOptions.length,3);
  });
  await check('topic planning target never reuses or precreates work, including single input',async()=>{
    const before=await count('works'), previous=await inspect(WA);
    const saved=await rpc({...base,target:'/dashboard/topic',topic:'先规划一批选题'});
    assert.equal(saved.payload.workId,undefined); assert.equal(await count('works'),before);
    assert.deepEqual(await inspect(WA),previous); assert.equal(saved.payload.originContent,'最早的原文');
    assert.equal(saved.payload.settings.audience,'本地年轻顾客');
    const next=await rpc({...saved.payload,target:'/dashboard/script',topic:'选中单条选题'});
    assert.notEqual(next.payload.workId,WA); assert.equal(await count('works'),before+1);
  });
  await check('multi-selection branch strips original work id and leaves parent unchanged',async()=>{
    const before=await count('works'), previous=await inspect(WA);
    const saved=await rpc({...base,topicOptions:['方案1','方案2']},true);
    assert.equal(saved.payload.workId,undefined); assert.equal(await count('works'),before);
    assert.deepEqual(await inspect(WA),previous);
  });
  await check('duplicate session id rolls back attempted work update atomically',async()=>{
    const before=await inspect(WA);
    await assert.rejects(rpc({...base,sourceContent:'绝不能部分保存'},false,first.id),/request id conflict/);
    assert.deepEqual(await inspect(WA),before);
  });
  await check('lost branch response retry returns same snapshot without creating another work',async()=>{
    const id=randomUUID(), input={...base,sourceContent:'可安全重试的分支'};
    const saved=await rpc(input,true,id), before=await count('works'), sessions=await count('creation_sessions');
    const retried=await rpc(input,true,id);
    assert.deepEqual(retried,saved); assert.equal(await count('works'),before); assert.equal(await count('creation_sessions'),sessions);
    await assert.rejects(rpc(input,false,id),/request id conflict/);
  });
  await check('other account cannot reuse a global snapshot id to create orphan work',async()=>{
    await db.exec(`SELECT set_config('request.jwt.claim.sub','${B}',false)`);
    const before=await count('works');
    await assert.rejects(rpc({...base,profileId:PB,workId:WB},false,first.id),/duplicate key|request id conflict/);
    assert.equal(await count('works'),before);
    await db.exec(`SELECT set_config('request.jwt.claim.sub','${A}',false)`);
  });
  await check('explicit transaction rollback removes new work and snapshot together',async()=>{
    const before=await count('works'), sessions=await count('creation_sessions'); const {workId,...without}=base;
    await db.exec('BEGIN'); await rpc(without); await db.exec('ROLLBACK');
    assert.equal(await count('works'),before); assert.equal(await count('creation_sessions'),sessions);
  });
  await check('direct table insert cannot attach foreign work/profile or forge owner',async()=>{
    const insert=(profile,work,user=A)=>db.query('INSERT INTO creation_sessions(id,user_id,profile_id,work_id,payload) VALUES($1,$2,$3,$4,$5)',[randomUUID(),user,profile,work,{}]);
    await assert.rejects(insert(PA,WB),/row-level security/);
    await assert.rejects(insert(PB,null),/row-level security/);
    await assert.rejects(insert(PA,WA,B),/row-level security/);
  });
  await check('cross-account reads are hidden; RPC cannot update owner A work',async()=>{
    await db.exec(`SELECT set_config('request.jwt.claim.sub','${B}',false)`);
    assert.equal(await count('creation_sessions'),0);
    await assert.rejects(rpc(base),/profile ownership/);
    await db.exec(`SELECT set_config('request.jwt.claim.sub','${A}',false)`);
  });
  await check('oversized payload and malformed payload are rejected without work changes',async()=>{
    const before=await inspect(WA);
    await assert.rejects(rpc({...base,sourceContent:'x'.repeat(1600001)}),/payload too large/);
    await assert.rejects(rpc('not an object'),/invalid payload/);
    assert.deepEqual(await inspect(WA),before);
  });
  await check('anon has no snapshot or RPC privileges',async()=>{
    await db.exec('RESET ROLE; SET ROLE anon');
    await assert.rejects(db.query('SELECT * FROM creation_sessions'),/permission denied/);
    await assert.rejects(rpc(base),/permission denied/);
    await db.exec('RESET ROLE');
  });
  await check('migration rerun preserves works, snapshots and historical data',async()=>{
    const before=[await count('works'),await count('creation_sessions'),await count('script_history')];
    await db.exec(sql);
    assert.deepEqual([await count('works'),await count('creation_sessions'),await count('script_history')],before);
    assert.equal((await db.query('SELECT result FROM script_history')).rows[0].result,'历史必须保留');
  });
  console.log(JSON.stringify({passed:results.length,database:'isolated PGlite PostgreSQL',roles:'real SET ROLE authenticated/anon with RLS and auth.uid fixtures',results},null,2));
  await db.close();
})().catch(error=>{console.error(error);process.exitCode=1;});
