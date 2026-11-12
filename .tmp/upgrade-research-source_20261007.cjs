const fs = require('node:fs');
let s = fs.readFileSync('lib/free-chat-web.ts', 'utf8');
const a = s.indexOf('const MAX_SOURCES = 6;'), b = s.indexOf('type Dependencies = {');
let shared = s.slice(a,b).replace('const MAX_SOURCES = 6;\r\n','').replace('const MAX_SOURCES = 6;\n','')
 .replace('const MAX_TOTAL_CHARS = 32_000;\r\n','').replace('const MAX_TOTAL_CHARS = 32_000;\n','')
 .replace('now = Date.now()): SearchHit[]','now = Date.now(), maxSources = 6): SearchHit[]').replace('.slice(0, MAX_SOURCES)', '.slice(0, maxSources)');
shared = shared.replace('    if (needsDouyinGuide(question) && !DOUYIN_OFFICIAL.includes(u.hostname.toLowerCase())) return;', `    if (needsDouyinGuide(question) && !DOUYIN_OFFICIAL.includes(u.hostname.toLowerCase())) return;
    // 登录入口及餐饮达人手册不能证明家居商家的推荐机制。
    if (/\\/(?:p\\/)?login(?:\\/|$)/i.test(u.pathname)) return;
    const nonFoodMerchant = /衣柜|定制家居|家装|建材|装修|家具/.test(question);
    if (nonFoodMerchant && /美食|餐饮|探店达人/.test(hit.title) && !/家居|家装|建材/.test(hit.title)) return;`);
fs.writeFileSync('lib/web-source-quality.ts', `/** 共享检索质量逻辑：匹配来源、去重、官方文档发现和问题相关原文节选。 */
import type { SearchHit } from './ali-search';
import { fetchPage } from './page-fetch';
import { extractMainText } from './html-text';
import { buildWebQuery } from './web-query';

${shared}`);
s = s.slice(0,a) + s.slice(b);
s = s.replace("import { buildWebQuery } from './web-query';", `import { freeChatWebQuery, pickFreeChatSources, readOfficialDocumentation, relevantWebText } from './web-source-quality';
export { freeChatWebQuery, pickFreeChatSources, readOfficialDocumentation, relevantWebText } from './web-source-quality';`)
 .replace('type Dependencies = {', `const MAX_TOTAL_CHARS = 32_000;
const needsDouyinGuide = (question: string) => /抖音/.test(question) && /本地生活|获客|商家/.test(question);

type Dependencies = {`);
fs.writeFileSync('lib/free-chat-web.ts',s);
s=fs.readFileSync('lib/research-runner.ts','utf8')
 .replace("import { extractMainText } from '@/lib/html-text';", "import { extractMainText } from '@/lib/html-text';\nimport { freeChatWebQuery, pickFreeChatSources, readOfficialDocumentation } from '@/lib/web-source-quality';")
 .replace('const r = await search(query, config!, { topK: 8 });', `const w = freeChatWebQuery(query);
          const r = await search(w.query, config!, { topK: 8, way: 'pro-fetch', rewrite: !/site:/i.test(w.query), today: w.today });`)
 .replace('const candidates = pickCandidates(hits, new Set(), want + 3);', `const sourceQuestion = \`\${job.topic} \${q.q}\`;
        const official = await readOfficialDocumentation(sourceQuestion, open);
        const officialUrls = new Set(official.map(h => h.url));
        const w = freeChatWebQuery(sourceQuestion);
        const ranked = pickFreeChatSources([...official, ...hits], sourceQuestion, w.recencyDays, Date.now(), want + 3);
        const candidates = pickCandidates(ranked, new Set(), want + 3);`)
 .replace('            const page = await open(h.url).catch', `            // 已读到的官方正文不再重复请求；其余正文失败才保留搜索摘录。
            if (officialUrls.has(h.url)) return { h, title: h.title, content: h.content.slice(0, 15_000), fetched: 'full', published: h.published, collected_at: new Date().toISOString() };
            const page = await open(h.url).catch`)
 .replace('const text = page.ok ? extractMainText(page.html) : null;', "const text = page.ok ? (/text\\/(?:plain|markdown)/i.test(page.contentType) ? { text: page.html.trim(), title: '', published: '' } : extractMainText(page.html)) : null;");
fs.writeFileSync('lib/research-runner.ts',s);
s=fs.readFileSync('lib/research.ts','utf8')
 .replace("import { todayCN } from '@/lib/web-query';", "import { todayCN } from '@/lib/web-query';\nimport { relevantWebText } from '@/lib/web-source-quality';")
 .replace('export function sourceBlock(rows: SourceRow[], depth: ResearchDepth): string {', "export function sourceBlock(rows: SourceRow[], depth: ResearchDepth, question = ''): string {")
 .replace('${r.content.slice(0, cap)}', '${relevantWebText(r.content, question, cap)}')
 .replace('${sourceBlock(p.rows, p.depth)}', '${sourceBlock(p.rows, p.depth, p.question)}');
fs.writeFileSync('lib/research.ts',s);
