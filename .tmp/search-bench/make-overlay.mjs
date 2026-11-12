// 把本地改过、还没部署的 lib 文件复制成评测用的覆盖层（相对引用改成 @/lib/），服务器上评测时用它们替换线上同名模块。
// 用法：node .tmp/search-bench/make-overlay.mjs ali-search free-chat-web ...
import fs from 'node:fs';
const dir = '.tmp/search-bench/overlay';
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });
const names = process.argv.slice(2);
for (const n of names) {
  const src = fs.readFileSync(`lib/${n}.ts`, 'utf8').replace(/from '\.\/([^']+)'/g, (m, p) => (names.includes(p) ? `from '@/lib/${p}'` : `from '@/lib/${p}'`));
  fs.writeFileSync(`${dir}/${n}.ts`, src, 'utf8');
}
fs.writeFileSync(`${dir}/names.json`, JSON.stringify(names));
console.log('overlay:', names.join(', '));
