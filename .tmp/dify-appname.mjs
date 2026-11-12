// 只读：看本地 DIFY_API_KEY 连的是哪个应用（不打印密钥）
import fs from 'node:fs';
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).map((l) => l.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].trim().replace(/^["']|["']$/g, '')]));
const base = env.DIFY_BASE_URL || 'https://api.dify.ai/v1';
const r = await fetch(`${base}/info`, { headers: { Authorization: `Bearer ${env.DIFY_API_KEY}` } });
const j = await r.json().catch(() => ({}));
console.log(r.status, j.name, j.mode);
