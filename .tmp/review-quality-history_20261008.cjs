const fs = require('node:fs');
const {createClient} = require('@supabase/supabase-js');
for (const line of fs.readFileSync('.env.local','utf8').split(/\r?\n/)) { const m=line.match(/^([A-Z_][A-Z_0-9]*)=(.*)$/); if(m)process.env[m[1]]=m[2].trim().replace(/^["']|["']$/g,''); }
const dir='.tmp/quality-regression_20261008';fs.mkdirSync(dir,{recursive:true});
(async()=>{
  const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
  const {data,error}=await db.auth.admin.listUsers({page:1,perPage:1000});if(error)throw Error('Owner lookup failed');
  const owner=data.users.find(u=>u.email==='song.weiwei23@gmail.com');if(!owner)throw Error('Owner unavailable; no other account read');
  const h=await db.from('script_history').select('id,input_data,result,created_at').eq('user_id',owner.id).eq('task_type','审稿优化').order('created_at',{ascending:false}).limit(6);
  if(h.error)throw Error('Review history failed');
  fs.writeFileSync(dir+'/owner-review-history.private.json',JSON.stringify(h.data,null,2),{mode:0o600});
  const profileId=h.data?.[0]?.input_data?.profileId;
  if(profileId){const p=await db.from('user_profiles').select('*').eq('user_id',owner.id).eq('id',profileId).maybeSingle();if(!p.error)fs.writeFileSync(dir+'/owner-review-profile.private.json',JSON.stringify(p.data,null,2),{mode:0o600});
    const c=await db.from('dify_conversations').select('conversation_id,updated_at,task_type').eq('user_id',owner.id).eq('scope_key',profileId).maybeSingle();if(!c.error)fs.writeFileSync(dir+'/owner-review-conversation.private.json',JSON.stringify(c.data,null,2),{mode:0o600});
  }
  console.log(JSON.stringify(h.data.map((r,i)=>({index:i,createdAt:r.created_at,draftChars:r.input_data?.draftContent?.length,duration:r.input_data?.duration,scriptType:r.input_data?.scriptType})),null,2));
})().catch(()=>{console.error('Read-only review diagnostic failed; no credentials logged');process.exitCode=1;});
