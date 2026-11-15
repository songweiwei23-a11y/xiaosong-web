import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readAssistantConfig } from '@/lib/assistant/config';
import { callAssistantLlm } from '@/lib/assistant/llm';
import { finalizeTopicBatch, parseTopicOverlap, primaryTopicElement, topicCountInRequest } from '@/lib/topic-delivery';
import { splitTopicSections, type TopicSection } from '@/lib/topic-library';
import { anchorDirectionDraft, directionTopicContext, selectTopicAngles } from '@/lib/direction-topic-plan';

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


  it('同一对城市的老板平行陈述不能换个经营事件就再次交付', async () => {
    const refund = topic('南乐老板店里东西卖贵了，会主动退给客人；郑州老板店里东西卖贵了，客人不说就不退吗？', '**爆款元素**：反差｜两位老板分别演示退款');
    const naming = topic('南乐老板给店取名，会问“街坊好不好记”；郑州老板给店取名，会问“网上好不好搜”', '**爆款元素**：人群｜对照两地老板的话术');
    const price = topic('两家店怎么定价', '**爆款元素**：成本｜对照两个老板的报价过程\n**开篇钩子**：郑州店主先算成本，南乐老板先问老客');
    const actual = topic('旧招牌留下了哪个街名', '**爆款元素**：怀旧｜店主把招牌翻到背面读出旧地址');
    const ctx = directionTopicContext('南乐和郑州的街边小店', undefined, '一块旧招牌和一位店主')!;
    vi.mocked(callAssistantLlm).mockResolvedValue(decision('{"duplicates":[],"invalid":[]}'));
    const result = await finalizeTopicBatch(batch(refund, naming, price, actual), [], 4, async () => '', { directionSeed: true, topicContext: ctx });
    expect(result).toMatchObject({ count: 1, removed: 3 });
    expect(splitTopicSections(result.text)).toEqual([actual]);
  });
});
