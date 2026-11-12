import fs from 'node:fs';
import ts from 'typescript';
import { topicReference, carriesScript, carriedIntent, intentBlock, continuationRules } from '../lib/creation-continuation';
import { wantsNewTopics } from '../lib/topic-library';
import { describeExecutionConstraints } from '../lib/creator-context';
import { viralElementPrompt, VIRAL_ELEMENTS, viralElementById } from '../lib/viral-elements';
import { mixPromptBlock } from '../lib/content-mix';
import { rolesGuide, roleBrief } from '../lib/content-roles';
import { tacticBrief, tacticsBlockedBy } from '../lib/growth-standards';
import { routeAssignment, ROUTES_GUIDE, tacticIndex } from '../lib/creative-routes';
import { taboosPromptBlock } from '../lib/taboos';
import { creationSettingsBlock } from '../lib/creation-settings';
import { ALL_DEAL_REASONS } from '../app/dashboard/topic/constants';
import { topicSourceRules, topicDesignStandards, topicRoutePrompt, topicDesignFinalCheck, topicPreferredTactic } from '../lib/topic-design';

export function buildActualTopicPrompt(pagePath: string, libraryPath: string, context: Record<string, unknown>, prior: string[], includeServer = true) {
  const page = fs.readFileSync(pagePath, 'utf8');
  const start = page.indexOf('let query =');
  const end = page.indexOf('const response = await fetchGeneration("/api/dify/stream"', start);
  if (start < 0 || end < 0) throw new Error('Prompt extraction boundaries not found');
  const scope = { ...context, topicReference, carriesScript, carriedIntent, intentBlock, continuationRules,
    describeExecutionConstraints, viralElementPrompt, VIRAL_ELEMENTS, viralElementById, mixPromptBlock,
    rolesGuide, roleBrief, tacticBrief, tacticsBlockedBy, routeAssignment, ROUTES_GUIDE, tacticIndex,
    taboosPromptBlock, creationSettingsBlock, ALL_DEAL_REASONS, topicSourceRules, topicDesignStandards, topicRoutePrompt, topicDesignFinalCheck, topicPreferredTactic,
    setMixUsed: () => {}, extractRelevantPositioningInfo: (s: string) => s,
  };
  const code = ts.transpileModule('function build() {\n' + page.slice(start, end) + '\nreturn query;\n}', {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  const query = new Function(...Object.keys(scope), code + '\nreturn build();')(...Object.values(scope));
  if (!includeServer) return query + creationSettingsBlock(context.currentSettings as any);
  const library = ts.createSourceFile(libraryPath, fs.readFileSync(libraryPath, 'utf8'), ts.ScriptTarget.Latest, true);
  const fn = library.statements.find(s => ts.isFunctionDeclaration(s) && s.name?.text === 'buildNoRepeatBlock');
  if (!fn) throw new Error('No repeat function not found');
  const noRepeatJs = ts.transpileModule(fn.getText(library).replace(/^export\s+/, ''), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  const noRepeat = new Function('NO_REPEAT_LIMIT', noRepeatJs + '\nreturn buildNoRepeatBlock;')(100);
  // Same ordering as the browser request and stream API, including both settings blocks.
  const developSelected = typeof context.sourceReference === 'string' && !!context.sourceReference.trim()
    && !wantsNewTopics(typeof context.personalRequirement === 'string' ? context.personalRequirement : '');
  return query + creationSettingsBlock(context.currentSettings as any) + noRepeat(prior, { developSelected })
    + creationSettingsBlock(context.currentSettings as any)
    + '\n本轮以当前带入的原稿、当前版本和这些设置为准；历史中的其他选题、方案、人群和时长不得替换本轮选择。旧 AI 稿不是已核实经营事实。';
}

export function fixture() {
  const source = '### 方向1：国庆前后门店生意与老板真实感受\n视频目的：流量型；目标观众：全国实体店老板及关注县城消费的人。\n核心思路：走访同一商业街的不同门店，问每家店老板国庆期间与节后生意有什么变化、哪些具体事让他们有这种感受。保留不同回答，不替老板编经历。\n怎么拍：手机街访；每家短采访，征得同意后拍店内与老板真实回答。通过同一问题的不同答案和具体追问呈现前后差异。\n可拍的选题示例：国庆前后门店客流对比；老板说忙与闲的真实感受；生意变化是否只是节假日因素。\n尚未采访，没有账本、收入数字或已知答案，不能先写成已发生发现。';
  const root = '我想拍国庆前后门店生意对比，去问每家店老板的真实感受。围绕这个核心问题做成熟、具体、有采访深度的选题，让全国实体店老板愿意看和讨论，不做卖课或代运营获客广告，不编造采访答案。';
  const settings = { topic: '国庆前后门店生意与老板真实感受', direction: '问同一条街不同门店老板的实际生意变化和感受', userIntent: root,
    focusContent: source, purpose: '流量型', audience: '全国实体店老板及关注县城消费的人', personnel: '一人', device: '手机和领夹麦', notes: '短访谈；没有采访结果，不预设营收、时间数字和情绪' };
  return {
    topicCount: 5, topicType: '流量型选题', sourceReference: topicReference({ sourceContent: source, originContent: root, settings }),
    sourceFrom: '创作方向', incomingSetup: { sourceContent: source, originContent: root, settings }, currentSettings: settings,
    selectedProfile: { profile_name: '合成验收·县城编导', equipment: ['手机', '领夹麦'], team_size: '一人全包', account_track: ['短视频代运营'], account_platform: ['抖音'] },
    mode: 'quick', topicContext: '账号是县城编导，目标是拍真实门店采访吸引实体店老板；不卖课、不推销。',
    customModeContext: '', accountStage: '刚起号，定位未确定', fansLevel: '0-1000', avgViewsInput: '',
    selectedPlatforms: ['抖音'], selectedTracks: ['短视频代运营'], selectedContentTypes: [], selectedStyles: [],
    positioningExtra: '', selectedElements: [], selectedDealReasons: [], topicRole: '流量型', resolvedMix: {},
    personalRequirement: settings.direction, keyword1: settings.topic, keyword2: '', keyword3: '',
    benchmarkAccounts: '', viralCases: '', difficulty: '中等创意', withHook: true, tactic: '', route: '两种都出', routeExplicit: false,
  };
}

