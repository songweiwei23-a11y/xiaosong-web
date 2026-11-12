const fs = require('fs');
const raw = fs.readFileSync('app/dashboard/breakdown/page.tsx', 'utf8');
const re = /\/\*[\s\S]*?\*\//g;
let m;
while ((m = re.exec(raw))) {
  if (m[0].length > 400) {
    const line = raw.slice(0, m.index).split('\n').length;
    console.log('big block at line', line, 'length', m[0].length, JSON.stringify(m[0].slice(0, 60)), '...', JSON.stringify(m[0].slice(-60)));
  }
}
