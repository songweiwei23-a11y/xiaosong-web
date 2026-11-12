const fs=require('node:fs');
const text=fs.readFileSync('/var/www/xiaosong-web/.env.local','utf8');
for(const name of ['ALI_SEARCH_API_KEY','ALI_SEARCH_ENDPOINT','SEARCH_KEY_ENCRYPTION_SECRET']) {
  const row=text.split(/\r?\n/).find(l=>l.startsWith(name+'='));
  console.log(name+': '+(row&&row.slice(name.length+1).trim()?'configured':'absent'));
}
