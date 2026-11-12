const fs=require('fs');
const crypto=require('crypto');
const {spawnSync}=require('child_process');
const files=[
  'lib/script-design.ts','lib/creative-craft.ts','lib/enhance-prompt.ts','lib/content-roles.ts',
  'lib/review-standards.ts','lib/quality-checker.ts','lib/direction.ts','lib/storyboard-standards.ts',
  'lib/growth-standards.ts','lib/title-standards.ts','lib/creation-settings.ts','lib/quality-checks.ts','lib/fact-fix.ts',
  'app/dashboard/script/page.tsx','app/dashboard/title/page.tsx','app/dashboard/free-chat/page.tsx',
  'app/dashboard/storyboard/page.tsx','app/dashboard/direction/page.tsx','app/dashboard/growth/page.tsx',
];
const manifest=files.map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}));
fs.writeFileSync('docs/创作质量同类修复_20261007/上线文件清单.json',JSON.stringify({time:new Date().toISOString(),files:manifest},null,2));
const r=spawnSync('tar',['-czf','.tmp/kaiwu-craft-quality_20261007.tar.gz',...files],{stdio:'inherit'});
if(r.status!==0)throw Error('Packaging failed');
console.log(JSON.stringify({files:files.length,archive:'.tmp/kaiwu-craft-quality_20261007.tar.gz'}));
