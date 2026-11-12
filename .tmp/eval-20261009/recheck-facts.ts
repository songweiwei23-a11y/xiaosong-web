import fs from 'node:fs';
import { unsupportedFacts } from '@/lib/quality-checks';
import { stripSelfCert } from '@/lib/self-cert';
const dir='docs/开物全板块实测_20261009/原始输出';
for (const f of fs.readdirSync(dir).filter(f=>f.endsWith('.md'))) {
  const t=stripSelfCert(fs.readFileSync(`${dir}/${f}`,'utf8').split('\n---\n').slice(1).join('\n---\n'));
  const id=f.slice(0,2); const prompt=fs.existsSync(`docs/开物全板块实测_20261009/提示词/${id}.txt`)?fs.readFileSync(`docs/开物全板块实测_20261009/提示词/${id}.txt`,'utf8'):'';
  const light = id==='01'||id==='08';
  const r=unsupportedFacts(t, prompt, { light });
  console.log(`== ${f}  ${r.length} 条`); r.forEach(x=>console.log('   '+x.slice(0,120)));
}
