import fs from 'node:fs';
import { unsupportedFacts } from '@/lib/quality-checks';
const j = JSON.parse(fs.readFileSync('docs/创作质量同类修复_20261007/Dify发布后复测_20261008/正式模型验收.json', 'utf8'));
for (const r of j.results) {
  const known = '用户尚未采访，不编造采访答案';
  const now = unsupportedFacts(r.answer || '', known);
  console.log(`== ${r.id}  原来 ${r.factFlags.length} 条 → 现在 ${now.length} 条`);
  for (const f of now) console.log('   ' + f.slice(0, 110));
}
