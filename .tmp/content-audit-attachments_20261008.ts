import fs from 'node:fs';
import { askDify } from './content-audit-production_20261008/lib/dify-task';
for(const line of fs.readFileSync('.env.local','utf8').split(/\r?\n/)){const m=line.match(/^([A-Z_][A-Z_0-9]*)=(.*)$/);if(m)process.env[m[1]]=m[2].trim().replace(/^(['"])(.*)\1$/,'$2');}
const dir='docs/全创作板块实测_20261008';
const user='kaiwu-platform-audit-synthetic-20261008-attachments';
const report:any={scope:'正式Dify附件通道，两个明确的功能测试文件，不含客户资料；不覆盖网站上传、存储和限额界面',files:[],time:new Date().toISOString()};
async function main(){
 const files:any[]=[];
 for(const [name,type] of [['正文识别测试.txt','document'],['视觉识别测试.png','image']]){
  const form=new FormData();form.append('file',new Blob([fs.readFileSync('docs/chat-capability-fixtures/'+name)]),name);form.append('user',user);
  const res=await fetch((process.env.DIFY_BASE_URL||'https://api.dify.ai/v1')+'/files/upload',{method:'POST',headers:{Authorization:'Bearer '+process.env.DIFY_API_KEY},body:form,signal:AbortSignal.timeout(60000)});const data=await res.json();if(!res.ok||!data.id)throw Error('Attachment upload HTTP '+res.status);
  report.files.push({name,type,status:res.status});files.push({id:data.id,type});
 }
 const start=Date.now();const result=await askDify('【高阶自由对话】本轮附件是功能验收合成素材。请回答：文本里的项目暗号与预算金额是什么？图片从左到右有哪些颜色？只回答这三个问题；看不清或读不到时明确说明。',user,'附件识别测试',{files,signal:AbortSignal.timeout(180000)});
 report.ok=result.ok;report.elapsedMs=Date.now()-start;report.answer=result.ok?result.text:result.message;if(result.ok)report.usage=result.completion.usage;
 fs.writeFileSync(dir+'/附件模型通道实测.json',JSON.stringify(report,null,2));console.log(JSON.stringify({...report,usage:undefined}));
}
main().catch(e=>{report.error=e.message;fs.writeFileSync(dir+'/附件模型通道实测.json',JSON.stringify(report,null,2));console.error(e.name+': '+e.message);process.exitCode=1;});
