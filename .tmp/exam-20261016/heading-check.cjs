// 复现 lib/quality-regression.ts 里的小节标题匹配（与源码同一条正则）
const section = (name) => new RegExp(`^\\s*#{1,4}\\s+${name}(?:[：:、\\s]|$)`);
const samples = ['## 开篇（0-5秒）', '## 开篇：0-5秒', '## 开篇', '## 衔接正文（6-20秒）', '## 开头（金钱型钩子+场景切入）', '## 开头'];
for (const s of samples) {
  const name = s.includes('开篇') ? '开篇' : s.includes('开头') ? '开头' : '衔接正文';
  console.log(JSON.stringify(s).padEnd(36), name, section(name).test(s) ? 'MATCH' : 'no match');
}
