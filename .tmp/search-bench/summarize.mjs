// 汇总联网基准评测：node .tmp/search-bench/summarize.mjs baseline [stage1 ...]
import fs from 'node:fs';
for (const label of process.argv.slice(2)) {
  const rows = JSON.parse(fs.readFileSync(`.tmp/search-bench/out/${label}.json`, 'utf8')).filter((r) => r.q);
  let calls = 0, failed = 0; const reasons = {};
  let srcTotal = 0, srcInWin = 0, srcDated = 0, srcRead = 0, srcLong = 0, answered = 0, timedQ = 0, timedOk = 0, ms = 0;
  const perQ = [];
  for (const r of rows) {
    for (const c of r.calls) { calls++; if (!c.ok) { failed++; reasons[c.reason] = (reasons[c.reason] || 0) + 1; } }
    ms += r.ms;
    if (r.status === 'done') answered++;
    const s = r.sources || [];
    srcTotal += s.length;
    const dated = s.filter((x) => x.ageDays !== null);
    srcDated += dated.length;
    const inWin = r.window ? dated.filter((x) => x.ageDays <= r.window).length : dated.length;
    srcInWin += r.window ? inWin : 0;
    if (r.window && r.window <= 8) { timedQ++; if (s.length && inWin / s.length >= 0.8) timedOk++; }
    srcRead += s.filter((x) => x.read.startsWith('已')).length;
    srcLong += s.filter((x) => x.chars >= 1500).length;
    perQ.push(`${r.status === 'done' ? '✓' : '✗'} [${r.cat}] ${r.q}｜搜${r.calls.length}次 失败${r.calls.filter((c) => !c.ok).length}｜来源${s.length}${r.window ? ` 窗口内${inWin}/${s.length}` : ''}｜${Math.round(r.ms / 100) / 10}s${s.length ? '｜' + s.slice(0, 3).map((x) => `${x.host}(${x.ageDays ?? '无日期'}天)`).join(' ') : r.message ? '｜' + r.message.slice(0, 40) : ''}`);
  }
  const timedSrc = rows.filter((r) => r.window).reduce((n, r) => n + (r.sources || []).length, 0);
  console.log(`\n===== ${label}：${rows.length} 问`);
  console.log(`有结果 ${answered}/${rows.length}｜搜索调用 ${calls} 次，失败 ${failed}（${JSON.stringify(reasons)}）｜平均 ${Math.round(ms / rows.length / 100) / 10} 秒`);
  console.log(`来源 ${srcTotal} 条：带日期 ${srcDated}，有时效要求的问题里落在窗口内 ${srcInWin}/${timedSrc}｜读到正文 ${srcRead}，正文≥1500字 ${srcLong}`);
  console.log(`短时效（≤8天）问题达标（来源≥80%在窗口内）：${timedOk}/${timedQ}`);
  const byEngine = {};
  for (const r of rows) for (const s of r.sources || []) byEngine[s.engine || 'ali'] = (byEngine[s.engine || 'ali'] || 0) + 1;
  console.log(`最后用上的来源出自：${JSON.stringify(byEngine)}`);
  console.log(perQ.join('\n'));
}
