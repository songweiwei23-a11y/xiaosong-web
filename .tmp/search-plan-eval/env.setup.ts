// 只从 .env.local 读模型相关的几个变量，不打印值
import fs from 'node:fs';

const KEYS = ['ASSISTANT_API_KEY', 'ASSISTANT_API_BASE_URL', 'ASSISTANT_MODEL', 'ASSISTANT_CHEAP_MODEL', 'SEARCH_PLAN_MODEL'];
for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && KEYS.includes(m[1]) && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, '');
}
