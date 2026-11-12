// 把 .env.local 读进环境变量（搜索配置在库里，要库地址、服务端密钥和解密钥匙；模型要助理的配置），不打印值
import fs from 'node:fs';

for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, '');
}
