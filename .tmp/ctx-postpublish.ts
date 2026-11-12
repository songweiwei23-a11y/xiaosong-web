import fs from 'node:fs';
const j = JSON.parse(fs.readFileSync('docs/创作质量同类修复_20261007/Dify发布后复测_20261008/正式模型验收.json', 'utf8'));
const show = (id: string, keys: string[]) => { const a = j.results.find((r: any) => r.id === id).answer as string; for (const k of keys) { const i = a.indexOf(k); console.log(`[${id}] ${k}: ` + (i < 0 ? '无' : a.slice(Math.max(0, i - 50), i + 40).replace(/\n/g, '⏎'))); } };
show('script_interview', ['问了一圈']);
show('regenerate_same', ['我问了一条街', '我问了一圈', '采访了X家', '每家答案都不一样', '有人说回暖', '每天少了200', '90%的店主']);
show('title_interview', ['问了这条街5家店', '感受居然不一样', '完播率低于40%']);
show('direction_single', ['我问了这条街上7家', '问了几家老板']);
