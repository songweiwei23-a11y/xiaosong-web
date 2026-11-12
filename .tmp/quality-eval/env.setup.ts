// 只从 .env.local 读取测试需要的四个变量，不打印值。
import fs from 'node:fs';

const KEYS = ['DIFY_API_KEY', 'DIFY_BASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && KEYS.includes(m[1]) && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, '');
}
