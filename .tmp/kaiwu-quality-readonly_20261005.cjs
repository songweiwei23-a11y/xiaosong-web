const fs=require('fs');
for(const line of fs.readFileSync('.env.local','utf8').split(/\r?\n/)){const m=line.match(/^([A-Z_][A-Z_0-9]*)=(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].trim().replace(/^(['"])(.*)\1$/,'$2');}
(async()=>{
const result={time:new Date().toISOString(),build:fs.readFileSync('.next/BUILD_ID','utf8').trim(),researchEnvKeyPresent:!!process.env.ALI_SEARCH_API_KEY};
const url=process.env.NEXT_PUBLIC_SUPABASE_URL+'/rest/v1/app_secrets?select=name,updated_at&name=eq.ali_web_search';
const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
try{const response=await fetch(url,{headers:{apikey:key,Authorization:'Bearer '+key},signal:AbortSignal.timeout(15000)});const rows=await response.json();result.researchSecretRowPresent=Array.isArray(rows)&&rows.length>0;result.queryStatus=response.status;result.updatedAt=Array.isArray(rows)?rows[0]?.updated_at:null;}catch{result.error='metadata query failed';}
console.log(JSON.stringify(result));
})();
