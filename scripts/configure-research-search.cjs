/* Run on the production server. Receives the existing Aliyun key through SSH stdin. Never logs credentials. */
const fs=require('node:fs'),crypto=require('node:crypto');
async function configure(){
  const env={...process.env};
  for(const line of fs.readFileSync('.env.local','utf8').split(/\r?\n/)){
    const m=line.match(/^([A-Z_][A-Z_0-9]*)=(.*)$/);if(m)env[m[1]]=m[2].trim().replace(/^(['"])(.*)\1$/,'$2');
  }
  const input=JSON.parse(fs.readFileSync(0,'utf8'));
  const key=typeof input.apiKey==='string'?input.apiKey.trim().replace(/^Bearer\s+/i,''):'';
  if(key.length<16||key.length>512||/\s/.test(key))throw new Error('密钥格式无效，未保存。');
  const endpoint='https://default-2te6.platform-cn-shanghai.opensearch.aliyuncs.com/v3/openapi/workspaces/default/web-search/ops-web-search-001';
  const result=await fetch(endpoint,{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({query:'公开网页联网搜索配置验证',query_rewrite:false,top_k:1,content_type:'mainText',way:'lite'}),signal:AbortSignal.timeout(25000),redirect:'error'});
  const body=await result.json().catch(()=>null);
  if(!result.ok||!body||body.error||Number(body.http_code)>=400||body.result?.status==='failed'||(body.code!=null&&!['0','200','OK','Success','success'].includes(String(body.code)))||!Array.isArray(body.result?.search_result))throw new Error('阿里云真实搜索验证失败，未保存；请检查密钥权限及账户额度。');
  const secret=env.SEARCH_KEY_ENCRYPTION_SECRET||env.DIFY_API_KEY;
  if(!secret)throw new Error('服务端加密配置缺失，未保存。');
  const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',crypto.createHash('sha256').update(secret).digest(),iv);
  const encrypted=Buffer.concat([cipher.update(key,'utf8'),cipher.final()]);
  const value=['v1',iv.toString('base64'),cipher.getAuthTag().toString('base64'),encrypted.toString('base64')].join(':');
  const supabaseKey=env.SUPABASE_SERVICE_ROLE_KEY;
  if(!supabaseKey||!env.NEXT_PUBLIC_SUPABASE_URL)throw new Error('服务端数据库配置缺失，未保存。');
  const saved=await fetch(env.NEXT_PUBLIC_SUPABASE_URL+'/rest/v1/app_secrets?on_conflict=name',{method:'POST',headers:{apikey:supabaseKey,Authorization:'Bearer '+supabaseKey,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates'},body:JSON.stringify({name:'ali_web_search',value,meta:{endpoint,verifiedAt:new Date().toISOString(),encryption:'aes-256-gcm-v1'},updated_at:new Date().toISOString()}),signal:AbortSignal.timeout(15000)});
  if(!saved.ok)throw new Error('数据库保存失败，原配置保留。');
  console.log('阿里云搜索验证成功，密钥已加密保存。约一分钟后深度研究入口会启用。');
}
configure().catch(error=>{console.error(error.message.startsWith('阿里云')||error.message.includes('未保存')||error.message.includes('保存失败')?error.message:'配置未完成，请稍后重试。');process.exitCode=1;});
