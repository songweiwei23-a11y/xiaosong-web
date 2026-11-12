import fs from 'node:fs';
import {askDify} from '../lib/dify-task';
for(const line of fs.readFileSync('.env.local','utf8').split(/\r?\n/)){const m=line.match(/^([A-Z_][A-Z_0-9]*)=(.*)$/);if(m)process.env[m[1]]=m[2].trim().replace(/^(['"])(.*)\1$/,'$2');}
const root='docs/全板块质量修复_20261008/正式模型对照';
async function run(id:string){
 const query='【本轮内容落实规则】\n'+fs.readFileSync(`${root}/${id}_after_输入.txt`,'utf8');
 fs.writeFileSync(`${root}/${id}_规则分支输入.txt`,query);const start=Date.now();
 const r=await askDify(query,`kaiwu-repair-synthetic-20261008-mode-${id}`,'内容事实边界 创作方法',{signal:AbortSignal.timeout(240000)});
 fs.writeFileSync(`${root}/${id}_规则分支结果.json`,JSON.stringify({...r,elapsedMs:Date.now()-start},null,2));
 if(r.ok)fs.writeFileSync(`${root}/${id}_规则分支输出.md`,r.text);
 console.log(JSON.stringify({id,ok:r.ok,elapsedMs:Date.now()-start}));
}
Promise.allSettled([run('knowledge'),run('brief')]).then(rs=>{for(const r of rs)if(r.status==='rejected')console.error(String(r.reason));});
