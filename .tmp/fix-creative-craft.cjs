const fs = require('fs');
const path = require('path');
const backup = '.tmp/craft-fix-baseline_20261007';
function edit(file, change) {
  const before = fs.readFileSync(file, 'utf8');
  const target = path.join(backup, file);
  if (!fs.existsSync(target)) { fs.mkdirSync(path.dirname(target), {recursive:true}); fs.writeFileSync(target, before); }
  let body = before.replace(/\r\n/g, '\n');
  function replace(a,b) { if (!body.includes(a)) throw new Error(`Missing anchor ${file}: ${a.slice(0,70)}`); body=body.replace(a,b); }
  function section(a,b,value) { const start=body.indexOf(a), end=body.indexOf(b,start); if(start<0||end<0)throw new Error(`Missing section ${file}`); body=body.slice(0,start)+value+body.slice(end); }
  change(replace,section,()=>body);
  fs.writeFileSync(file, body);
}
edit('app/dashboard/script/page.tsx', (r) => {
  r('import { enhancePromptWithMCNStandards }', 'import { buildAdaptiveScriptPrompt } from "@/lib/script-design";\nimport { enhancePromptWithMCNStandards }');
  r('Boolean(incomingSetup && !autoSetup.settings.scriptType && !scriptTypePicked)', 'Boolean(!autoSetup.settings.scriptType && !scriptTypePicked)');
  r("purpose: scriptRole === '自动' && incomingSetup ? autoSetup.settings.purpose : effectiveRole", "purpose: scriptRole === '自动' ? autoSetup.settings.purpose : effectiveRole");
  r('const query = isAd ? `', `const query = autoScriptType ? buildAdaptiveScriptPrompt({
        topic, platform, duration: isAiDuration ? 'AI推荐' : finalDuration,
        context: profileInfo + positioningInfo,
        source: [originContent, autoSetup.settings.focusContent].filter(Boolean).join('\\n\\n'),
        requirements: additionalInfo,
        settings: currentSettings,
        structureGuide: scriptStructure !== 'auto' ? structureGuide : undefined,
        hookGuide: openingLine.trim() ? undefined : hookType !== 'auto' ? hookGuide : undefined,
        tacticGuide: tactic && tactic !== AUTO_TACTIC ? tacticSection : undefined,
      }) : isAd ? \``);
  r('evaluateScriptQualityStrict(fullResult)', 'evaluateScriptQualityStrict(fullResult, { adaptive: true })');
  r('结尾行动指令**只要一个**，按上面"结尾行动指令"来，说清楚做什么', '仅在用户目的需要互动或转化时设计一个行动指令；否则自然收束，不强加关注、私信或到店');
  r('全片只担这一个目的，不要顺手把另外两种也塞进来', '按用户明确目的执行；混合目的按原要求保留，不为分类擅自删掉其中一个，也不新增营销目标');
  r('视频目的（${effectiveRole}）、目标用户、核心痛点、主钩子、情绪推进、唯一的结尾行动指令', '用户目的、目标用户、核心问题、主切口、信息递进、适合本条的自然收束或行动');
  r('- 按说话的自然停顿分段，一句一行；结尾金句也写进去（不加"金句"两个字，也不加引号）', '- 按说话的自然停顿分段，一句一行；有自然收束原句就保留，不强写金句');
  r('2. 结尾必须单独成行输出一句金句，格式示例：**金句**：“完整句子”（X字）\n   - 金句正文控制在8-20字，用中文或英文双引号包裹，独立成行，不要和台词混在同一段', '2. 结尾按内容自然收束；有适合摘出的原句才标注金句，不强制字数，不编感悟');
  r('4. 至少标注3处情绪波点（可用 ⚡😰😓💕🤝 等符号或“波点”字样）', '4. 按真实信息和情绪变化提示节奏，不凑情绪波点数量；采访、记录不预设受访者的情绪或回答');
  r('2. 开场要有悬念、反常识或情感共鸣\n3. 中段按${effectiveRole}的写法走：${effectiveRole === \'流量型\' ? \'观点和论据，给情绪价值，覆盖面要广\' : effectiveRole === \'人设型\' ? \'真实经历里的"那一刻"，细节验证\' : \'落在一个成交理由上，晒过程或教知识，先给价值\'}\n4. 结尾只要一个行动指令：${ROLE_SPECS[effectiveRole].cta}', '2. 开场清楚点出当前议题或现场切口，正文能够兑现；不为制造冲突改变主题\n3. 中段沿用户目的与材料逐层展开；采访写主问、追问与证据，不编未知回答\n4. 结尾自然收束；用户需要互动或转化时才设计一个与目的对应的行动');
  r('6. 突出价格优势和稀缺性（限时/限量）', '6. 价格、优惠和限时限量仅使用用户已确认信息；未提供就不用，不编福利或经营承诺');
  r('✅ 性价比：开场"人均80块"、中段对比"比隔壁便宜30%"\n✅ 品质保证：展示"现切羊肉"镜头、老板介绍"30年传承"\n✅ 老板好：结尾"老板说报我名字打9折"', '✅ 性价比：引用已确认价格或真实可拍的产品信息，无资料不写数字\n✅ 品质保证：拍摄用户确实提供的制作过程，不虚构年限或认证\n✅ 老板好：使用已提供的真实服务行为，不编折扣承诺');
});
edit('lib/enhance-prompt.ts', (r) => {
  r('第1秒：必须有冲突/悬念/利益点/反常识之一\n- 第2秒：放大冲突或制造好奇\n- 第3秒：给出承诺或引发期待', '尽早交代观众关心的具体问题、动作或现场信息；不强制每秒一句话\n- 悬念、冲突、利益点与反常识只在材料确实支持时使用，不预设反转\n- 开头许下的内容要由正文兑现，采访尚无答案时以问题切入');
  r('- 结尾：金句 + **一个**行动指令（${cta}）', '- 结尾：按用户目的自然收束；确需互动或转化时才采用一个行动（候选：${cta}），不强加营销');
  r('- 开场钩子（0-X秒）：钩子类型标注 + 波点标注', '- 开场（0-X秒）：清楚而有吸引力的切口；钩子与情绪提示按内容需要标注');
  r('- 情绪高潮（X-X秒）：⚡最强波点标注\n- 结尾收口（X-${duration}）：金句（≤20字）+ 一个行动指令', '- 信息递进：按材料和内容形式推进，不预设情绪高潮\n- 结尾收口（X-${duration}）：兑现当前问题；有适合的金句才用，行动指令按用户目的决定');
  r('- [ ] 第1秒是钩子吗？\n- [ ] 有3个情绪波点吗？', '- [ ] 开头是否切中核心问题，正文是否兑现？\n- [ ] 信息与真实情绪是否自然递进，而非凑波点数量？');
  r('- [ ] 结尾有金句和行动指令吗？', '- [ ] 结尾是否符合原意，没有多余金句或营销动作？');
  r('结尾是不是只要了一个动作（关注或评论）？', '结尾是否符合当前目的，不强加关注或评论？');
  r('结尾是不是只要了一个动作（关注或看主页）？', '结尾是否自然、真实，不强加关注或看主页？');
});
edit('lib/content-roles.ts', (r) => {
  r("'先从稿子本身判断它是**流量型**、**人设型**还是**变现型**，再查目的、结构、结尾指令三者是否一致：'", "'先读取用户明确目的和带入的连续设置，再从稿子核对是否一致；未标目的才参考流量型、人设型、变现型，混合目的保留，不强制归类：'");
  r("'先从主题判断这条是**流量型**、**人设型**还是**变现型**（一条只担一个目的），再按对应的要求来：'", "'已带入的用户目的、人群、主线优先，不从主题重新定目的；没有明确目的时才参考下列类型选择表达，混合目的完整保留：'");
  r('结构该是 ${names} 这类；结尾只要${s.cta}；常见的错是${s.pitfalls}', '结构可参考 ${names}；结尾动作仅在用户需要时参考${s.cta}；不能因没有CTA或不套骨架就判不合格');
});
edit('lib/direction.ts', (r) => {
  r('（可以有一两个方向用别的形式，但要说明为什么）', '（按用户选定的形式执行；只有用户明确允许其他形式时才增加候选）');
  r('目的不同、思路不同、拍法不同，不能是同一个方向换个说法', '全部服务用户原定目的，在子议题、对象、材料、思路或拍法上拉开，不能只是换个说法；用户只给一个目的就不增加其他目的，多目的按用户明确要求兼顾');
});
edit('lib/storyboard-standards.ts', (r,s) => {
  s('const RHYTHM_GUIDE =', '\n/**', `const RHYTHM_GUIDE = \`### 景别节奏：跟着内容与信息走

先判断当前内容是采访、真实记录、口播、演示还是剧情，再选择镜头语言，不把快切、特写和情绪高潮当作所有内容的标准。
- **开场（0-3秒）**：需要交代门店、街道与比较环境时可以用全景或远景；需要看清动作或表情时用近景、特写。一个持续有信息的镜头也可以抓住观众，不规定镜头数量。
- **展开段**：镜头提供台词之外的证据；采访保留完整问题、回答与必要停顿，不用快切制造不存在的情绪。
- **重要段落**：只有真实细节、变化或情绪需要强调时才用特写和节奏变化；没有高潮就不制造高潮。
- **收尾**：跟随原稿收束，不另加励志结论、成交或反转。
**镜头时长**：按台词、动作和信息所需时间分配。快节奏短片可以参考2-4秒切镜；访谈、持续演示、观察记录允许更长的镜头，不强制前3秒切两镜或6秒内切镜。说明长镜头保留了哪些信息，别为满足数字拆坏问答。\`;
`);
  r('## 🎬 分镜方法论（判断依据，不是可选项）', '## 🎬 分镜方法论（按当前形式选用，用户明确拍法优先）');
  r('- 特写占比：X%（应 ≤ 25%）', '- 特写占比：X%（按内容需要说明，不以固定比例压过证据和表达）');
  r('- 最长镜头：Xs（超过 6s 需说明画面里在持续发生什么）', '- 最长镜头：Xs（说明保留的回答、动作或信息，不能为了切镜破坏内容）');
  r('- 开场 3 秒内镜头数：X 个（应 ≥ 2）', '- 开场 3 秒内镜头数：X 个（据实统计，不设最低数量）');
});
edit('lib/growth-standards.ts', (r) => {
  r('给 ${count} 条，每条用一张不同的卡。', '最多给 ${count} 条候选，每条切入同一核心议题；优先适合当前材料的卡，不为凑数量换主题或编事实。');
  r('- **每条用不同的计**，不要六条都是同一个套路', '- **多样性服务于适配性**：允许同一机制的不同成熟表达，不强凑六种卡；用户手选的每张卡要回应，不适用时说明理由并给同主线替代，不能编素材去适配');
});
edit('app/dashboard/free-chat/page.tsx', (r) => {
  r('import ', 'import { regenerationPrompt } from "@/lib/script-design";\nimport ');
  r('`【请换个角度重新回答这个问题，不要和上一版重复】\\n${asked}`', 'regenerationPrompt(asked)');
  r('// 重新生成：会话记忆里已经有上一版回答了，明确要它换个角度，不然常常原样再来一遍', '// 重新生成提升同一主线的质量；换角度只由用户明确要求。');
});
edit('app/dashboard/title/page.tsx', (r) => {
  r('const TITLE_TYPES = [', 'const TITLE_TYPES = [\n  { value: "auto", label: "AI推荐", desc: "按原稿选择", example: "沿原意选择最合适的标题", icon: "✨" },');
  r('const TITLE_FORMULAS = [', 'const TITLE_FORMULAS = [\n  { value: "auto", label: "AI推荐", example: "按内容和证据选择公式", icon: "✨" },');
  r('const KEYWORD_STRATEGIES = [', 'const KEYWORD_STRATEGIES = [\n  { value: "auto", label: "AI推荐", desc: "按内容与平台", example: "不强塞热点词", icon: "✨" },');
  r('useState("suspense")', 'useState("auto")'); r('useState("number-action")', 'useState("auto")'); r('useState("search")', 'useState("auto")');
  r("s.titleType! : 'question'", "s.titleType! : 'auto'"); r("s.titleFormula! : 'why-reason'", "s.titleFormula! : 'auto'"); r("s.keywordStrategy! : 'search'", "s.keywordStrategy! : 'auto'");
  r('|| "悬念式"', '|| "AI推荐"');
});
edit('lib/title-standards.ts', (r) => {
  r('parts.push(`- 标题类型：${p.titleTypeLabel}`);', "parts.push(p.titleTypeLabel === 'AI推荐' ? '- 标题类型：按当前主线与材料自动选择，不默认套疑问、冲突或营销类型' : `- 标题类型（用户明确选择）：${p.titleTypeLabel}`);");
  r('parts.push(`- 使用公式：${p.titleFormulaLabel}`);', "parts.push(p.titleFormulaValue === 'auto' ? '- 使用公式：按当前内容选择，可直接清楚表达，不默认套为什么或意外原因' : `- 使用公式（用户明确选择）：${p.titleFormulaLabel}`);");
  r("parts.push('照着这个结构写，但每个标题都要跟本次主题强相关，不要套用示例里的行业。');", "parts.push('公式只管表达，不改变核心问题；材料不支持反转、原因或结果时，不虚构它们去套公式，说明取舍并给同主线可用表达。不要套用示例里的行业和数字。');");
  r("parts.push('## ⚙️ 本次要求');", "parts.push('## ⚙️ 本次要求');\n  parts.push('所有标题都承接同一具体主线、人群、立场与事实状态。尚未采访或观察时，用问题/计划式表达，不将假设写成已证实结论；不得为标题承诺的效果补编正文。');");
});
console.log('Creative craft files updated; baseline retained.');
