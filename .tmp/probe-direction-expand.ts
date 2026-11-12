// 真实模型探针（不扣用户次数）：线上最近一次「自由对话 → 创作方向」，按新的拓展方式出 5 个方向，看是否守住原方向
import fs from 'node:fs';
import { buildDirectionPrompt } from '@/lib/direction';
import { carriedIntent, intentBlock } from '@/lib/creation-continuation';
import { buildProfileSummary } from '@/lib/profile-summary';

const env: Record<string, string> = {};
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, ''); }
const sb = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` };
const [row] = await (await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/script_history?select=input_data&task_type=eq.${encodeURIComponent('创作方向')}&order=created_at.desc&limit=1`, { headers: sb })).json();
const input = row.input_data;
const [profile] = await (await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/user_profiles?select=*&id=eq.${input.profileId}`, { headers: sb })).json();
const content = String(input.ideas).replace(/^【来自[^】]*】\n?/, '');
const intent = intentBlock(carriedIntent({ sourceContent: content, originContent: '' }));
console.log('认出的：\n' + intent);
const query = buildDirectionPrompt({ purposes: [], formats: ['any'], onCamera: input.onCamera, count: 5, depth: 'full', profileSummary: profile ? buildProfileSummary(profile) : undefined, expand: { from: '高阶自由对话', content, intent } });

const r = await fetch('https://api.dify.ai/v1/chat-messages', {
  method: 'POST', headers: { Authorization: `Bearer ${env.DIFY_API_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ inputs: { query, search_query: '国庆后 县城消费 对比 创作方向', conversation_history: '', dealReasons: '' }, query, response_mode: 'streaming', user: 'probe-direction-expand' }),
  signal: AbortSignal.timeout(300_000),
});
let answer = ''; const reader = r.body!.getReader(); const dec = new TextDecoder(); let buf = '';
for (;;) { const { value, done } = await reader.read(); if (done) break; buf += dec.decode(value, { stream: true }); let i; while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i); buf = buf.slice(i + 1); if (!line.startsWith('data: ')) continue; try { const d = JSON.parse(line.slice(6)); if (d.event === 'message') answer += d.answer || ''; if (d.event === 'error') console.log('ERR', d.message); } catch {} } }
console.log('\nHTTP', r.status, '回答', answer.length, '字');
for (const l of answer.split('\n')) if (/^#{1,4}\s/.test(l) || /核心思路|对应目的/.test(l)) console.log(l.trim().slice(0, 170));
