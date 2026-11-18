import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readAssistantConfig } from '@/lib/assistant/config';
import { callAssistantLlm } from '@/lib/assistant/llm';
import { finalizeTopicBatch, parseTopicOverlap, primaryTopicElement, topicCountInRequest } from '@/lib/topic-delivery';
import { splitTopicSections, type TopicSection } from '@/lib/topic-library';
import { anchorDirectionDraft, directionAnglesPrompt, directionTopicContext, planDirectionTopics, selectTopicAngles } from '@/lib/direction-topic-plan';

vi.mock('@/lib/assistant/config', () => ({ readAssistantConfig: vi.fn() }));
vi.mock('@/lib/assistant/llm', () => ({ callAssistantLlm: vi.fn() }));

const topic = (title: string, body: string): TopicSection => ({ title, body });
const batch = (...topics: TopicSection[]) => topics.map(({ title, body }, index) => '## 选题' + (index + 1) + '：' + title + '\n' + body).join('\n\n');
const decision = (raw: string) => ({ content: [{ type: 'text' as const, text: raw }], stop_reason: 'end_turn' });

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(readAssistantConfig).mockReturnValue({ baseUrl: 'https://example.invalid', apiKey: 'fixture', model: 'fixture' });
});

describe('选题交付前查重', () => {
  const history = topic('前后对比看铰链', '拍同一副铰链松动前后的柜门开合');
  const rewrite = topic('柜门关不严的原因', '拍原来松动的那副铰链调整前后如何开合');
  const fresh = topic('抽屉满载拉起来顺不顺', '拍同一个抽屉分别空载和放入实物时的拉动');
  const replacement = topic('层板高度调整演示', '拍移动层板前后分别能不能放入高瓶');

  it('追问中取实际要求的条数，兼容中文和全角数字', () => {
    expect(topicCountInRequest('再给我二十条')).toBe(20);
    expect(topicCountInRequest('再来１２条')).toBe(12);
    expect(topicCountInRequest('这版有3条，我想换一批')).toBeUndefined();
  });

  it('成稿只能扩写入选的策划，擅自补写的内容不能绕过取材核对', async () => {
    const ctx = directionTopicContext('修书工作室', undefined, '仅有一本旧书、一把尺和一张步骤卡')!;
    const plan = { title: '看旧书的装线', element: 'nostalgia', material: '旧书', question: '这本书怎么装线', shoot: '镜头跟着装线走', payoff: '看清实际装线' };
    expect(directionAnglesPrompt(ctx, [plan], 5)).toContain('本轮写 1 条');
    const draft = anchorDirectionDraft(batch(topic('【P1】看旧书的装线', '**视频目的**：了解装线'), topic('【补】用尺看裂口', '**爆款元素**：成本｜测量裂口'), topic('【补】怎么按步骤卡检查', '**爆款元素**：人群｜翻步骤卡。\n**执行要点**：顾客全都欢呼。')), [plan]);
    vi.mocked(callAssistantLlm).mockImplementation(async (_cfg, req) => {
      if (req.system.includes('事实审核')) {
        expect(String(req.messages[0].content)).not.toContain('顾客全都欢呼');
        return decision('{"duplicates":[],"invalid":[]}');
      }
      return decision('{"duplicates":[]}');
    });
    const result = await finalizeTopicBatch(draft, [], 2, async () => '', { directionSeed: true, topicContext: ctx });
    expect(splitTopicSections(result.text).map(t => t.title)).toEqual(['看旧书的装线']);
    expect(result.checked).toBe(true);
  });

  it('较早的失实稿不能占用后来合格版本的同一标题或拍法', async () => {
    const ctx = directionTopicContext('纸本预约', undefined, '店主留着一页纸本预约')!;
    const rejected = topic('预约怎样记在纸上', '**爆款元素**：人群｜先拍预约本。\n**执行要点**：店主拿出修过三百本的证明。');
    const valid = topic(rejected.title, '**爆款元素**：人群｜请店主现场演示一笔预约。');
    vi.mocked(callAssistantLlm).mockImplementation(async (_cfg, req) => decision(req.system.includes('事实审核')
      ? '{"duplicates":[],"invalid":["B1"]}' : '{"duplicates":[{"candidate":"B2","sameAs":"B1"}]}'));
    const result = await finalizeTopicBatch(batch(rejected, valid), [], 1, async () => '', { directionSeed: true, topicContext: ctx });
    expect(splitTopicSections(result.text)).toEqual([valid]);
  });

  it('本轮被退稿的题允许在补稿中纠错，已交付的历史仍参与查重', async () => {
    const rejected = topic('旧书怎么量', '**爆款元素**：成本｜我修过三百本');
    const valid = topic(rejected.title, '**爆款元素**：成本｜用尺量旧书的裂口，现场记录。');
    const ctx = directionTopicContext('旧书', undefined, '有尺和旧书')!;
    vi.mocked(callAssistantLlm).mockResolvedValue(decision('{"duplicates":[],"invalid":[]}'));
    const refill = vi.fn(async () => batch(valid));
    const result = await finalizeTopicBatch(batch(rejected), [history], 1, refill, { directionSeed: true, topicContext: ctx });
    expect(refill).toHaveBeenCalledWith(expect.objectContaining({ avoid: [history], blocked: [rejected] }));
    expect(splitTopicSections(result.text)).toEqual([valid]);
  });

  it('用正文识别换标题的历史撞题，只补写撞题位置，保留新角度', async () => {
    vi.mocked(callAssistantLlm)
      .mockResolvedValueOnce(decision('{"duplicates":[{"candidate":1,"sameAs":"H1"}]}'))
      .mockResolvedValueOnce(decision('{"duplicates":[]}'));
    const refill = vi.fn(async () => batch(replacement));
    const result = await finalizeTopicBatch(batch(rewrite, fresh), [history], 2, refill);
    expect(refill).toHaveBeenCalledOnce();
    expect(refill.mock.calls[0]).toEqual([expect.objectContaining({ count: 1, blocked: [rewrite] })]);
    expect(splitTopicSections(result.text)).toEqual([replacement, fresh]);
    expect(result).toMatchObject({ count: 2, checked: true, removed: 1, replaced: 1 });
    const judgeInput = vi.mocked(callAssistantLlm).mock.calls[0][1].messages[0].content;
    expect(judgeInput).toContain(history.body);
    expect(judgeInput).toContain(rewrite.body);
  });

  it('补写还撞本批时只交付已通过的题', async () => {
    vi.mocked(callAssistantLlm)
      .mockResolvedValueOnce(decision('{"duplicates":[{"candidate":"B2","sameAs":"B1"}]}'))
      .mockResolvedValueOnce(decision('{"duplicates":[{"candidate":1,"sameAs":"H1"}]}'));
    const refill = vi.fn(async () => batch(replacement));
    const result = await finalizeTopicBatch(batch(fresh, rewrite), [history], 2, refill);
    expect(splitTopicSections(result.text)).toEqual([fresh]);
    expect(result).toMatchObject({ count: 1, requested: 2, removed: 1, replaced: 0 });
  });

  it('按方向出题时向查重模型提供具体取材动作和脚本推进', async () => {
    const a = topic('菜单上少了一个字', '**🅰 打法**\n用菜单遮住配料，按实物核对。\n**核心问题与观众价值**：店员从哪看出差别？\n**取材与内容推进**：\n- 先展示菜单，再拍打开保温桶。\n**4️⃣ 脚本结构**\n从柜台特写转到锅边实录。');
    vi.mocked(callAssistantLlm).mockResolvedValue(decision('{"duplicates":[]}'));
    await finalizeTopicBatch(batch(a, fresh), [], 2, async () => '', { directionSeed: true });
    const input = String(vi.mocked(callAssistantLlm).mock.calls[0][1].messages[0].content);
    expect(input).toContain('用菜单遮住配料');
    expect(input).toContain('先展示菜单，再拍打开保温桶');
    expect(input).toContain('从柜台特写转到锅边实录');
  });

  it('从备选切口优先取不同的八大元素，过滤只换名字的同问题或同动作', () => {
    const angle = { material: '柜台菜单和店内实物', payoff: '看清点单时怎么选' };
    const raw = JSON.stringify({ angles: [
      { ...angle, element: 'cost', question: '哪种组合最少排一次队？', shoot: '按相同订单分别计时' },
      { ...angle, element: 'cost', question: '哪种组合最少排一次队？', shoot: '拍顾客从入口到收银' },
      { ...angle, element: 'contrast', question: '哪两款点心用的工具不同？', shoot: '分别实拍在同一台面成形' },
      { ...angle, element: 'curious', question: '为什么盘底有印记？', shoot: '把印记翻到镜头前并追到压模' },
      { ...angle, element: 'people', question: '上班路上怎么买早餐？', shoot: '按相同订单分别计时' },
      { ...angle, element: 'cost', question: '多带一份怎么打包省事？', shoot: '记录两袋怎么拎上地铁' },
    ] });
    expect(selectTopicAngles(raw, ['cost', 'contrast', 'curious', 'people'], 4).map(({ element }) => element))
      .toEqual(['cost', 'contrast', 'curious', 'cost']);
  });

  it('兼容栏目标题后再重复写爆款元素标签的成稿', () => {
    expect(primaryTopicElement(topic('旧菜单', '**1️⃣ 爆款元素**\n\n**爆款元素**：怀旧｜对着旧菜单找留下的菜名'))).toBe('nostalgia');
  });

  it('地基上同一个镜头流程换元素也淘汰，成稿不能覆盖选定素材与主元素', () => {
    const common = { anchor: '乙店菜单的独特点单方式', material: '乙店旧菜单', payoff: '在旧菜单上看到曾经的点单方式' };
    const angles = selectTopicAngles(JSON.stringify({ angles: [
      { ...common, title: '旧菜单上为什么分两行', element: 'nostalgia', question: '以前咸浆和点心怎么点', shoot: '拍旧菜单上的两行文字，请店员讲点单方式', evidenceKey: '乙店旧菜单', actionKey: '店员读旧菜单' },
      { ...common, title: '这张老菜单竟有两行', element: 'curious', question: '外地人能不能看懂旧菜单', shoot: '让店员看旧菜单再念出两行', evidenceKey: '乙店旧菜单', actionKey: '店员读旧菜单' },
      { ...common, title: '第一次点早餐怎么读老菜单', element: 'curious', question: '哪项需要另外点', shoot: '用手机扫描旧菜单上的价格栏', evidenceKey: '乙店旧菜单', actionKey: '标出价格栏' },
    ] }), ['nostalgia', 'curious'], 2);
    expect(angles).toHaveLength(1);
    const draft = anchorDirectionDraft('## 选题1：旧菜单上为什么分两行\n\n**爆款元素**：反差｜两地顾客大比拼\n\n**取材与内容推进**：路人采访\n\n**视频目的**：流量型', angles);
    expect(draft).toContain('怀旧｜在旧菜单上看到曾经的点单方式');
    expect(draft).toContain('拍旧菜单上的两行文字');
    expect(draft).toContain('**视频目的**：流量型');
    expect(draft).not.toContain('路人采访');
    expect(splitTopicSections(anchorDirectionDraft('模型写了未匹配的标题', angles))).toEqual(splitTopicSections(anchorDirectionDraft('', angles)));
  });

  it('同一张照片可以支撑不同的可见细节和当事人的独立采访', () => {
    const sourceQuote = '有开店照片，店主可讲保存照片的经过';
    const common = { anchor: '搬店经历', material: '开店照片', evidenceKey: '开店照片', element: 'nostalgia', sourceQuote, parallel: false };
    const angles = [
      { ...common, title: '照片里的取货桌在哪', question: '当时在哪取货', shoot: '放大照片找到桌子', actionKey: '放大照片', payoff: '看清取货桌的位置' },
      { ...common, title: '这张照片是怎么留下的', question: '搬店时怎么留下的', shoot: '请店主讲保存经过', actionKey: '采访店主', payoff: '听到保存照片的亲历' },
    ];
    expect(selectTopicAngles(JSON.stringify({ angles }), ['nostalgia'], 2, sourceQuote).map(a => a.title)).toEqual(angles.map(a => a.title));
  });

  it('策划复核可以修正标题前提，淘汰整条双城拍法后才进入成稿', async () => {
    const context = directionTopicContext('开店经历', undefined, '店主搬店时留下一张开业照片。店主可演示当时记单的动作')!;
    const base = { element: 'nostalgia', anchor: '搬店时留下的物件', question: '开业照片拍了什么', material: '店主的开业照片', shoot: '实拍并看照片上的细节', payoff: '看清开业时的门店', sourceId: 'S1', evidenceKey: '开业照片', actionKey: '看照片', parallel: false };
    vi.mocked(callAssistantLlm)
      .mockResolvedValueOnce(decision(JSON.stringify({ angles: [
        { ...base, title: '搬店时唯一带走的照片' },
        { ...base, title: '同一个人怎么记两次单', sourceId: 'S2', question: '两家店如何各记一次', shoot: '分别演示两家店的记单动作', evidenceKey: '记单', actionKey: '演示记单' },
      ] })))
      .mockResolvedValueOnce(decision('{"edits":[{"id":1,"title":"开店照片里拍到了什么"},{"id":2,"drop":true}]}'));
    const angles = await planDirectionTopics(context, 2, []);
    expect(angles.map(({ title, sourceQuote }) => ({ title, sourceQuote }))).toEqual([{ title: '开店照片里拍到了什么', sourceQuote: '店主搬店时留下一张开业照片' }]);
  });

  it('两地工作经历可作为单人背景，只有一张照片的说法需要事实依据', async () => {
    const context = directionTopicContext('小店搬迁', undefined, '这位店员在两地工作过，有一张开店照片可以拍。')!;
    const valid = topic('照片里的取货桌在哪', '**爆款元素**：怀旧｜请在两地工作过的店员指出照片中的位置');
    const unsupported = topic('搬店时唯一带走的旧照片', '**爆款元素**：反差｜请店员拿出照片');
    vi.mocked(callAssistantLlm).mockResolvedValue(decision('{"duplicates":[],"invalid":[]}'));
    const result = await finalizeTopicBatch(batch(valid, unsupported), [], 2, async () => '', { directionSeed: true, topicContext: context });
    expect(splitTopicSections(result.text)).toEqual([valid]);
  });

  it('先选能独立成片的实物与动作，再选仍有新证据的对照', () => {
    const material = '店里保留了旧招牌、纸本预约记录和开业照片。';
    const base = { anchor: '搬店前后的门店日常', payoff: '让观众看到物件原样', sourceQuote: '店里保留了旧招牌' };
    const candidates = [
      { ...base, title: '把所有旧物摆一起讲变化', element: 'contrast', question: '旧物有哪些共同变化', material: '旧招牌和纸本预约记录', shoot: '展示两件旧物再对照现用工具', evidenceKey: '旧招牌、预约记录', actionKey: '两地店并排讲变化', parallel: true },
      { ...base, title: '翻出旧招牌', element: 'nostalgia', question: '招牌上能认出哪个街名', material: '现存的旧招牌', shoot: '翻转旧招牌，拍背面的店名', evidenceKey: '旧招牌', actionKey: '翻招牌读字', parallel: false },
      { ...base, title: '手写预约怎么记', element: 'people', question: '一笔预约怎么填', material: '纸本预约记录', shoot: '手部跟拍店主填写示例', evidenceKey: '预约记录', actionKey: '手写一笔预约', parallel: false },
      { ...base, title: '门口的旧照片', element: 'curious', question: '照片拍到哪些东西', material: '开业当天的照片', shoot: '放大旧照片检查画面', evidenceKey: '开业照片', actionKey: '放大照片找细节', parallel: false, sourceQuote: '店里保留了开业录像' },
    ];
    expect(selectTopicAngles(JSON.stringify({ angles: candidates }), ['contrast', 'nostalgia', 'people', 'curious'], 3, material).map(({ title }) => title))
      .toEqual(['翻出旧招牌', '手写预约怎么记']);
  });

  it('审核服务漏报时也剔除标题中素材没有的年限', async () => {
    const draft = topic('这家店还在用20年前的菜单', '**爆款元素**：怀旧｜拍店家留存的旧菜单');
    const ctx = directionTopicContext('地方早点里的变化', undefined, '店家保留了一张旧菜单，年份未知')!;
    vi.mocked(callAssistantLlm).mockResolvedValue(decision('{"duplicates":[],"invalid":[]}'));
    const opening = topic('从旧菜单找店里的变化', '**爆款元素**：怀旧｜拍店家留存的旧菜单\n**脚本结构**\n开篇：先给十年前的菜单拍一张特写。');
    const result = await finalizeTopicBatch(batch(draft, opening), [], 2, async () => '', { directionSeed: true, topicContext: ctx });
    expect(result).toMatchObject({ count: 0, removed: 2, checked: true });
  });

  it('保留能拍出元素的选题，拦住同一主元素挤满整批和模型识别的假看点', async () => {
    const keyed = (title: string, element: string, body: string) => topic(title, `**爆款元素**：${element}｜${body}`);
    const a = keyed('菜单里的两种称重方式', '成本', '记录相同预算买到什么');
    const b = keyed('什么时候排队最省时间', '成本', '用手机分别记录实际等待');
    const c = keyed('带两份走怎么少拿一只袋子', '成本', '试过两种包装后记录整理的动作');
    const fake = keyed('客人尝完当场笑出声', '人群', '给没有采访的顾客预写反应');
    const d = keyed('赶车的人怎样拿早餐不洒', '人群', '演示单手拿票和端稳容器');
    const e = keyed('翻过盘子才看到的花纹', '奇葩', '实拍模具留下的印记');
    const f = keyed('先看同一套工具做出的两样早餐', '反差', '用同样机位拍两款现有样品');
    const ctx = directionTopicContext('本地早餐如何点和做', undefined, '一名店员和现有样品')!;
    vi.mocked(callAssistantLlm)
      .mockResolvedValueOnce(decision('{"duplicates":[]}'))
      .mockResolvedValueOnce(decision('{"duplicates":[],"invalid":["B4"]}'))
      .mockResolvedValueOnce(decision('{"duplicates":[]}'))
      .mockResolvedValueOnce(decision('{"duplicates":[]}'))
      .mockResolvedValueOnce(decision('{"duplicates":[],"invalid":[]}'));
    const refill = vi.fn(async () => batch(e, f));
    const result = await finalizeTopicBatch(batch(a, b, c, fake, d), [], 5, refill, { directionSeed: true, topicContext: ctx });
    expect(result).toMatchObject({ count: 5, checked: true, removed: 2, replaced: 2 });
    expect(splitTopicSections(result.text)).toEqual([a, b, e, f, d]);
    expect(refill).toHaveBeenCalledWith(expect.objectContaining({ blocked: [c, fake] }));
  });

  it('内容查重不可用时仍剔除标点变化的重复，并如实标注核对状态', async () => {
    vi.mocked(callAssistantLlm).mockResolvedValue(decision('没有可解析的数据'));
    const result = await finalizeTopicBatch(batch(topic(history.title + '！', rewrite.body), fresh), [history], 2, async () => batch(replacement));
    expect(splitTopicSections(result.text)).toEqual([fresh]);
    expect(result.checked).toBe(false);
    expect(parseTopicOverlap('{"duplicates":[{"candidate":1,"sameAs":"B1"}]}', 2, 0)).toBeNull();
    expect(parseTopicOverlap('{"duplicates":[{"candidate":"B3","sameAs":"B6"}],"invalid":["B2"]}', 7, 0, true)).toEqual([5, 1]);
    expect(parseTopicOverlap('{"duplicates":[{"candidate":"B3","sameAs":"B1"}]}', 2, 0)).toBeNull();
    expect(parseTopicOverlap('```json\n{"duplicates":[],"invalid":["B2"]}\n```\n说明：{仅供核对}', 2, 0, true)).toEqual([1]);
  });

  it('方向题审核报错时只剔除禁用的两地模板，保留独立题作草稿', async () => {
    const invalid = topic('南乐老板怎么记单，郑州店主怎么记单', '**爆款元素**：反差｜让两地老板分别演示');
    const safe = topic('翻到招牌背面找街名', '**爆款元素**：怀旧｜拍一块实际在场的旧木招牌');
    const ctx = directionTopicContext('地方门店留下的老物件', undefined, '店里保留一块写有街名的旧木招牌。')!;
    vi.mocked(callAssistantLlm).mockRejectedValue(new Error('timeout'));
    const refill = vi.fn(async () => '');
    const result = await finalizeTopicBatch(batch(invalid, safe), [], 2, refill, { directionSeed: true, topicContext: ctx });
    expect(result).toMatchObject({ count: 1, checked: false, removed: 1 });
    expect(splitTopicSections(result.text)).toEqual([safe]);
    expect(refill).not.toHaveBeenCalled();
  });

  it('历史双城模板不误杀基于单件现有物料的独立题', async () => {
    const old = topic('南乐老板怎么记单，郑州店主怎么记单', '拍两地老板分别演示记单。');
    const next = topic('翻开纸本预约的第一页', '**爆款元素**：怀旧｜实拍遮住姓名的旧预约本');
    const ctx = directionTopicContext('门店记单习惯', undefined, '现店有一页遮住姓名的旧预约本。')!;
    vi.mocked(callAssistantLlm).mockResolvedValue(decision('{"duplicates":[],"invalid":[]}'));
    const result = await finalizeTopicBatch(batch(next), [old], 1, async () => '', { directionSeed: true, topicContext: ctx });
    expect(result).toMatchObject({ count: 1, checked: true });
    for (const call of vi.mocked(callAssistantLlm).mock.calls) {
      expect(String(call[1].messages[0].content)).not.toContain(old.title);
    }
  });

  it('第二轮补题避开上一轮已经接受的素材和动作', async () => {
    const a = topic('模具怎么放进制作台', '**爆款元素**：奇葩｜实拍旧模具的位置和用法');
    const b = topic('旧菜单上的点单写法', '**爆款元素**：怀旧｜读出菜单原字');
    const c = topic('这道工序实际花多久', '**爆款元素**：成本｜用手机记录一次实际操作');
    const ctx = directionTopicContext('本地早餐怎么做和点', undefined, '可拍旧模具、旧菜单和实际操作')!;
    vi.mocked(callAssistantLlm).mockResolvedValue(decision('{"duplicates":[],"invalid":[]}'));
    const refill = vi.fn().mockResolvedValueOnce(batch(b)).mockResolvedValueOnce(batch(b, c));
    const result = await finalizeTopicBatch(batch(a), [], 3, refill, { directionSeed: true, topicContext: ctx });
    expect(refill).toHaveBeenNthCalledWith(2, expect.objectContaining({ avoid: [a, b] }));
    expect(result).toMatchObject({ checked: true, count: 3, replaced: 2 });
    expect(splitTopicSections(result.text)).toEqual([a, b, c]);
  });

  it('原稿和各轮补题合计只留一条有授权的双城对照', async () => {
    const ctx = directionTopicContext('地域差异方向', '南北/地域差异', '本轮明确要求南乐和郑州两地按同一标准实测对比')!;
    const original = topic('南乐老板怎么记单，郑州老板怎么记单', '**爆款元素**：反差｜按同一标准拍两地老板');
    const extra = topic('南乐店主怎么摆货，郑州店主怎么摆货', '**爆款元素**：人群｜记录两地店主分别演示');
    const independent = topic('旧招牌背面写的是什么', '**爆款元素**：怀旧｜翻看旧招牌');
    vi.mocked(callAssistantLlm).mockResolvedValue(decision('{"duplicates":[],"invalid":[]}'));
    const refill = vi.fn().mockResolvedValueOnce(batch(extra)).mockResolvedValueOnce(batch(independent));
    const result = await finalizeTopicBatch(batch(original), [], 2, refill, { directionSeed: true, topicContext: ctx });
    expect(splitTopicSections(result.text)).toEqual([original, independent]);
  });

  it('已发生的从业年限和成交数量须有素材，现场计时仍然可做', async () => {
    const ctx = directionTopicContext('修复前如何观察旧书', undefined, '只提供两本旧书、装订步骤卡和计时器，没有年份或历史修复量')!;
    const experience = topic('这本书怎么修？我修了20年都看这一步', '**爆款元素**：头牌｜翻看步骤卡');
    const volume = topic('修过三百本，才知道旧书第一眼看哪', '**爆款元素**：怀旧｜展示旧书');
    const measured = topic('穿线要多久？把计时器打开再看', '**爆款元素**：成本｜现场计时，结果以现场为准');
    vi.mocked(callAssistantLlm).mockResolvedValue(decision('{"duplicates":[],"invalid":[]}'));
    const result = await finalizeTopicBatch(batch(experience, volume, measured), [], 3, async () => '', { directionSeed: true, topicContext: ctx });
    expect(splitTopicSections(result.text)).toEqual([measured]);
  });

  it('方向批次里三条同句式只换名词时，确定性拦截模板重复', async () => {
    const a = topic('南乐人去郑州买菜被价格震惊', '**爆款元素**：反差｜拍两地菜价实物');
    const b = topic('南乐人去郑州吃早餐被份量震惊', '**爆款元素**：奇葩｜拍两地早餐实物');
    const c = topic('南乐人去郑州坐公交被规矩震惊', '**爆款元素**：人群｜拍两地乘车过程');
    const fresh = topic('方言叫法不同引发误会', '**爆款元素**：好奇｜记录两地真实对话');
    vi.mocked(callAssistantLlm).mockResolvedValue(decision('{"duplicates":[]}'));
    const refill = vi.fn(async () => batch(fresh));
    const result = await finalizeTopicBatch(batch(a, b, c), [], 3, refill, { directionSeed: true });
    expect(refill).toHaveBeenCalledOnce();
    expect(result.removed).toBe(2);
    expect(result.count).toBe(2);
    expect(splitTopicSections(result.text)).toEqual([a, fresh]);
  });
  it('未授权地域平行结构时，标题和正文中的两地同角色模板都被拦截', async () => {
    const titleParallel = topic('南乐老板做 A，郑州老板做 B', '**爆款元素**：反差｜比较两家店');
    const bodyParallel = topic('两个老板的真实选择', '**爆款元素**：人群｜让南乐老板分别做A，再让郑州老板各自做B，然后投票');
    const fresh = topic('旧招牌背面还留着什么字', '**爆款元素**：怀旧｜翻看旧招牌背面逐字记录街名');
    const ctx = directionTopicContext('地域生活差异', '南北/地域差异', '用户没有要求两地对照')!;
    vi.mocked(callAssistantLlm).mockResolvedValue(decision('{"duplicates":[],"invalid":[]}'));
    const refill = vi.fn(async () => batch(fresh));
    const result = await finalizeTopicBatch(batch(titleParallel, bodyParallel), [], 2, refill, { directionSeed: true, topicContext: ctx });
    expect(refill).toHaveBeenCalled();
    expect(result.removed).toBeGreaterThanOrEqual(1);
    expect(splitTopicSections(result.text)).not.toContain(titleParallel);
    expect(splitTopicSections(result.text)).not.toContain(bodyParallel);
  });

  it('混合经营者称呼仍识别为同一地域平行骨架', async () => {
    const variants = [
      topic('南乐店主怎么招呼熟客，郑州老板怎么招呼熟客', '**爆款元素**：人群｜南乐店主做A，郑州老板做B'),
      topic('南乐主理人怎么记单，郑州摊主怎么记单', '**爆款元素**：成本｜两地经营者分别演示'),
    ];
    const ctx = directionTopicContext('地域生活差异', '南北/地域差异', '没有要求两地直接对照')!;
    vi.mocked(callAssistantLlm).mockResolvedValue(decision('{"duplicates":[],"invalid":[]}'));
    const refill = vi.fn(async () => batch(topic('翻看旧招牌背面', '**爆款元素**：怀旧｜记录旧物细节')));
    const result = await finalizeTopicBatch(batch(...variants), [], 2, refill, { directionSeed: true, topicContext: ctx });
    expect(result.removed).toBe(2);
    expect(splitTopicSections(result.text)).not.toEqual(expect.arrayContaining(variants));
  });

  it('明确否定两地对照时不会误开授权', () => {
    for (const text of [
      '本轮未要求南乐和郑州两地实测对比',
      '本轮不要做南乐和郑州的直接对照',
      '用户明确不需要双城比较',
    ]) {
      expect(directionTopicContext('地域差异方向', '南北/地域差异', text)?.allowParallelComparison).toBe(false);
    }
  });

  it('档案和引用中的旧授权不生效，只有当前输入可开启双城对照', () => {
    const facts = '参考历史：本次明确要求南乐与郑州两地直接对照。现店留着两张旧照片。';
    const setup = (current: string) => directionTopicContext('旧物和门店变化', undefined, facts, [], [], current);
    expect(setup('再来两个有关旧照片的新选题')?.allowParallelComparison).toBe(false);
    expect(setup('本轮明确要求做一条南乐和郑州两地实测对照')?.allowParallelComparison).toBe(true);
  });

  it('方向上下文缺失时仍 fail-closed 拦截窄定义地域平行题', async () => {
    const parallel = topic('南乐老板A郑州老板B', '**爆款元素**：反差｜两地老板分别演示');
    const fresh = topic('旧招牌背面有什么字', '**爆款元素**：怀旧｜逐字记录旧物');
    vi.mocked(callAssistantLlm).mockResolvedValue(decision('{"duplicates":[]}'));
    const refill = vi.fn(async () => batch(fresh));
    const result = await finalizeTopicBatch(batch(parallel), [], 1, refill, { directionSeed: true });
    expect(refill).toHaveBeenCalled();
    expect(splitTopicSections(result.text)).toEqual([fresh]);
  });

  it('明确授权时五条最多保留一条地域平行题，第二条必须补成独立题', async () => {
    const ctx = directionTopicContext('地域差异方向', '南北/地域差异', '本轮明确要求南乐和郑州两地按同一标准实测对比')!;
    const parallelA = topic('南乐老板A郑州老板B', '**爆款元素**：反差｜按同一标准拍两地老板');
    const parallelB = topic('南乐店主A郑州老板B', '**爆款元素**：反差｜两地经营者分别做事');
    const independent = [
      topic('翻看旧招牌背面', '**爆款元素**：怀旧｜记录旧招牌上的字'),
      topic('预约本一笔怎么记', '**爆款元素**：人群｜跟拍填写一笔预约'),
      topic('旧照片里有什么细节', '**爆款元素**：奇葩｜放大照片逐处观察'),
    ];
    vi.mocked(callAssistantLlm).mockResolvedValue(decision('{"duplicates":[],"invalid":[]}'));
    const replacement = topic('制作台一个动作花多久', '**爆款元素**：成本｜记录一次动作耗时');
    const refill = vi.fn(async () => batch(replacement));
    const result = await finalizeTopicBatch(batch(parallelA, parallelB, ...independent), [], 5, refill, { directionSeed: true, topicContext: ctx });
    const delivered = splitTopicSections(result.text);
    expect(result.checked).toBe(true);
    expect(result.count).toBe(5);
    expect(delivered.filter((item) => /南乐.*(?:老板|店主).*郑州.*(?:老板|店主)/.test(item.title)).length).toBe(1);
    expect(delivered.some((item) => item.title === parallelA.title)).toBe(true);
    expect(refill).toHaveBeenCalled();
  });

  it('同一地基下爆款元素不同、内容各自成立时可以同时交付', async () => {
    const a = topic('旧招牌背面还留着哪个街名', '**爆款元素**：怀旧｜翻看旧招牌背面逐字记录街名');
    const b = topic('本地早餐的叫法从哪来', '**爆款元素**：奇葩｜采访一位店员讲一道菜名的来历');
    const c = topic('同一制作台上的关键动作是什么', '**爆款元素**：成本｜实拍一道本地做法并记录一个动作要花多久');
    const context = directionTopicContext('地域差异：本地生活用词和做法', '南北/地域差异', '旧招牌、店员、制作台与师傅均可拍')!;
    expect(context.foundation).toContain('用户没有明确要求两地实测/直接对照');
    vi.mocked(callAssistantLlm).mockResolvedValue(decision('{"duplicates":[],"invalid":[]}'));
    const result = await finalizeTopicBatch(batch(a, b, c), [], 3, async () => '', { directionSeed: true, topicContext: context });
    expect(result.checked).toBe(true);
    expect(splitTopicSections(result.text)).toEqual([a, b, c]);
  });
  it('只有本轮明确要求两地实测/对照时才允许一个平行角度', () => {
    expect(directionTopicContext('地域差异方向', '南北/地域差异', '用两个城市的真实资料，但不需要两地实测对比')?.allowParallelComparison).toBe(false);
    const explicit = directionTopicContext('地域差异方向', '南北/地域差异', '本轮明确要求南乐和郑州两地按同一标准实测对比')!;
    const defaultContext = directionTopicContext('地域差异方向', '南北/地域差异', '用户只要地域方向')!;
    expect(explicit.allowParallelComparison).toBe(true);
    expect(defaultContext.allowParallelComparison).toBe(false);
    const make = (parallel: boolean, title: string) => ({
      element: 'contrast', title, question: '两地相同物件有哪些区别', material: '两地同类物件', shoot: '按同一标准逐项比较同类物件', payoff: '看见差异', parallel,
      anchor: '地域差异', evidenceKey: '同类物件', actionKey: '同标准比较', sourceQuote: '同类物件都在现场',
    });
    const raw = JSON.stringify({ angles: [make(true, '同一物件两地有什么不同')] });
    expect(selectTopicAngles(raw, ['contrast'], 1, '同类物件都在现场', false)).toHaveLength(0);
    expect(selectTopicAngles(raw, ['contrast'], 1, '同类物件都在现场', explicit.allowParallelComparison)).toHaveLength(1);
  });
});
