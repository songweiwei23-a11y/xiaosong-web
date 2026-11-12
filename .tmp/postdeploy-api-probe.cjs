const fs = require('node:fs');
for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z_0-9]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
}
(async () => {
  const checks = [];
  const dify = await fetch(`${process.env.DIFY_BASE_URL || 'https://api.dify.ai/v1'}/parameters`, {headers:{Authorization:`Bearer ${process.env.DIFY_API_KEY}`},signal:AbortSignal.timeout(30000)});
  const params = await dify.json();
  checks.push({name:'Dify six image/document attachments',status:dify.status,passed:dify.ok && params.file_upload?.enabled === true && params.file_upload?.number_limits === 6,types:params.file_upload?.allowed_file_types,limit:params.file_upload?.number_limits});
  for (const view of ['v_user_account_status','archive_summary']) {
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${view}?select=*&limit=1`,{headers:{apikey:process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,Authorization:`Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`},signal:AbortSignal.timeout(30000)});
    checks.push({name:`Anonymous access denied: ${view}`,status:response.status,passed:[401,403].includes(response.status)});
  }
  for (const route of ['/login','/api/creator-presets','/api/creation-sessions','/api/result-versions','/api/account/export']) {
    const response = await fetch(`http://122.51.234.155${route}`,{signal:AbortSignal.timeout(30000),redirect:'manual',...(route==='/api/result-versions'?{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}:{})});
    checks.push({name:`Production route ${route}`,status:response.status,passed:route==='/login'?response.status===200:response.status===401});
  }
  const result={time:new Date().toISOString(),checks};
  fs.writeFileSync('docs/上线接口验收_20261004.json',JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));
  if(checks.some(c=>!c.passed))process.exitCode=1;
})().catch(e=>{console.error(e.name+': '+e.message);process.exitCode=1;});
