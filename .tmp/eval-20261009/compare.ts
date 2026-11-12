// 修复前 / 修复后各 3 轮：用同一份（修好后的）核对规则统一量，输出每轮指标 + 全部命中明细供人工复核
import fs from 'node:fs';
import { unsupportedFacts } from '@/lib/quality-checks';
import { stripSelfCert } from '@/lib/self-cert';

const ROUNDS: Array<[string, string]> = [
  ['修复前1', 'docs/开物全板块实测_20261009'],
  ['修复前2', 'docs/开物修复前后对比_20261009/修复前_第2轮'],
  ['修复前3', 'docs/开物修复前后对比_20261009/修复前_第3轮'],
  ['修复后1', 'docs/开物修复前后对比_20261009/修复后_第1轮'],
  ['修复后2', 'docs/开物修复前后对比_20261009/修复后_第2轮'],
  ['修复后3', 'docs/开物修复前后对比_20261009/修复后_第3轮'],
];
// 档案事实被换说法 / 用户说不要的被违背：直接在成稿里找
const MEANING = [
  { name: '15年说成店龄', re: /1\s*5\s*年(?:的)?老店|开了\s*1\s*5\s*年|十五年(?:的)?老店/ },
  { name: '六大品类写成具体家具', re: /六大品类[^。\n]{0,20}(?:沙发|茶几|床垫|餐桌|衣柜)/ },
  { name: '阜南', re: /阜南/ },
];
const DONT = /(?<!不|别|不是|不想|不要|不做|避免|不搞|不拍|不走|拒绝|而非|不当)(?:甩卖|清仓|跳楼价|大降价|降价促销|亏本卖)/;
const out: string[] = [];
const table: string[] = [];
for (const [name, dir] of ROUNDS) {
  const raw = `${dir}/原始输出`;
  if (!fs.existsSync(raw)) { table.push(`${name}: 没有数据`); continue; }
  let fabBoards = 0, hits = 0, meaning = 0, dont = 0;
  const times: Record<string, string> = {};
  out.push(`\n######## ${name}`);
  for (const f of fs.readdirSync(raw).filter((f) => /^\d\d_.*\.md$/.test(f)).sort()) {
    const file = fs.readFileSync(`${raw}/${f}`, 'utf8');
    const head = file.match(/用时 (\d+) 秒，(\d+) 字/);
    const id = f.slice(0, 2);
    if (['06', '10', '04'].includes(id) && head) times[id] = `${head[1]}s/${head[2]}字`;
    const body = stripSelfCert(file.split('\n---\n').slice(1).join('\n---\n'));
    const promptFile = `${dir}/提示词/${id}.txt`;
    const known = fs.existsSync(promptFile) ? fs.readFileSync(promptFile, 'utf8') : '';
    // 拆解（04）在分析别人的稿子；画布改写（08）、自动修正（16）只改原稿——它们的原稿事实不算
    const r = unsupportedFacts(body, known, { light: id === '01' || id === '08' }).filter((x) => !x.startsWith('模型自称'));
    const mm = MEANING.filter((m) => m.re.test(body)).map((m) => m.name);
    const dd = id >= '07' && id <= '15' && DONT.test(body) ? [body.match(DONT)![0]] : [];
    if (r.length) fabBoards++;
    hits += r.length; meaning += mm.length; dont += dd.length;
    out.push(`== ${f} ${head ? `${head[1]}s ${head[2]}字` : ''}  核对${r.length} 换说法${mm.join('、') || 0} 违背不要${dd.join('、') || 0}`);
    r.forEach((x) => out.push(`   ${x.slice(0, 140)}`));
  }
  table.push(`${name}: 有编造提醒的板块 ${fabBoards}/16，提醒共 ${hits} 条，档案换说法 ${meaning}，违背不要 ${dont}，定位 ${times['06'] ?? '-'}，选题 ${times['10'] ?? '-'}，拆解 ${times['04'] ?? '-'}`);
}
fs.writeFileSync('.tmp/eval-20261009/compare-detail.txt', out.join('\n'));
console.log(table.join('\n'));
