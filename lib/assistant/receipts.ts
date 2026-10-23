/**
 * 助理的操作回执与声明核对（升级方案 A1 / A2 / A4，2026-10-22）。
 *
 *   回执：写类工具执行后，由工具的结果生成（不由模型生成），界面上显示成卡片；能撤销的带一个撤销做法。
 *   声明核对：回答里出现「已改到」「已记下」「已删除」这类完成说法时，本轮必须有对应的成功回执。
 *             找不到就把这一句改写成「没有完成：原因」。只用规则，不再调用模型，省成本，也不会被模型自己改口。
 *   资料核对：用了知识库却没有在回答里写出资料名，就在末尾注明「这次主要是一般经验」。
 *
 * 这个文件只有纯逻辑，服务端和测试都能用。
 */

export type ReceiptKind =
  | 'todo.add'
  | 'todo.update'
  | 'todo.complete'
  | 'note.add'
  | 'memory.add'
  | 'memory.update'
  | 'memory.forget'
  | 'ambient.play'
  | 'ambient.stop'
  | 'page.open'
  | 'todo.delete'
  | 'profile.update'
  | 'work.status'
  | 'knowledge.hits'
  | 'board.done'
  | 'work.progress';

/** 撤销的做法：界面点「撤销」时，用用户自己的 Cookie 调用对应接口 */
export type UndoSpec =
  | { type: 'todo_delete'; id: string }
  | { type: 'todo_patch'; id: string; body: { content?: string; dueAt?: string | null; done?: boolean } }
  | { type: 'note_delete'; id: string };

export interface ActionReceipt {
  kind: ReceiptKind;
  /** 有没有真的做成。失败的回执也要给界面看，用户能知道这次没有做成 */
  ok: boolean;
  /** 给用户看的一句话，例如「已新增待办：「交稿」，到期 10 月 28 日」 */
  text: string;
  undo?: UndoSpec;
  /** 知识库回执：这次查到的资料名（只用来核对，不显示） */
  docs?: string[];
}

/** 只用来核对、不在界面上显示的回执 */
export const SILENT_RECEIPT_KINDS: readonly ReceiptKind[] = ['knowledge.hits'];

interface ClaimRule {
  id: string;
  /** 这一句里出现的完成说法 */
  say: RegExp;
  /** 同时还要出现的词（缩小范围，免得误伤别的句子） */
  also?: RegExp;
  /** 出现这些词就不算（例如「已记下待办」归待办，不归记忆） */
  unless?: RegExp;
  /** 本轮有其中任何一条成功回执，这句话才算数 */
  need: ReceiptKind[];
  /** 没有回执时，改写成的原因（给用户看） */
  reason: string;
}

export const CLAIM_RULES: readonly ClaimRule[] = [
  {
    id: 'todo-add',
    say: /(已经?|已)[^。！？\n]{0,8}(记下|记好|记进|记在|添加|新增|加进|加到)[^。！？\n]{0,12}待办|待办[^。！？\n]{0,10}已经?[^。！？\n]{0,6}(记下|记好|记进|添加|新增)/,
    need: ['todo.add'],
    reason: '待办没有记进去，请再说一次要记的事',
  },
  {
    id: 'todo-update',
    // 「改到周五」「推迟到明天」这类带日期的才算待办改期；「改为某某名称」是档案，不归这里
    say: /已经?(改到|挪到|推迟到|延期到)[^。！？\n]{0,8}(周|星期|号|日|明天|后天|下周|今天|\d)|已经?(修改好|改好了)[^。！？\n]{0,6}(待办|计划|任务)|(已经?|已)[^。！？\n]{0,8}(修改|调整|更新)[^。！？\n]{0,6}(待办|计划|任务)/,
    need: ['todo.update'],
    reason: '待办没有改动，请再说一次要改的内容',
  },
  {
    id: 'todo-complete',
    say: /(已经?|已)[^。！？\n]{0,6}(标记完成|标为完成|标成完成|勾掉|标完成|划掉)/,
    need: ['todo.complete'],
    reason: '待办没有标记完成',
  },
  {
    id: 'todo-delete',
    say: /(已经?|已)[^。！？\n]{0,6}(删除|删掉|移除|去掉|清掉)[^。！？\n]{0,8}(待办|计划|任务|这条|那条)/,
    // 「去掉那条待办的日期」是改日期，不是删待办（黄金集误判，2026-10-22）
    unless: /日期|到期|时间|截止/,
    need: ['todo.delete'],
    reason: '删除要你在页面上点确认，这次还没有删',
  },
  {
    id: 'memory-add',
    // 「已记下」单独说太含糊（待办、笔记也常这么说），只有带上记忆相关的词，才当成记忆的说法
    say: /(已经?|已)(记住|记着|记好)|(已经?|已)记下[^。！？\n]{0,12}(偏好|记忆|习惯|要求)/,
    unless: /待办|笔记|备忘/,
    need: ['memory.add', 'memory.update'],
    reason: '这件事没有记进助理的记忆',
  },
  {
    id: 'memory-forget',
    say: /(已经?|已)[^。！？\n]{0,4}(忘掉|忘了|删掉|删除)[^。！？\n]{0,8}(记忆|那条|这件事|这条)/,
    need: ['memory.forget'],
    reason: '忘掉要你在页面上点「确定忘掉」，还没有忘掉',
  },
  {
    id: 'ambient-play',
    say: /(已经?|已)[^。！？\n]{0,4}(播放|开始播放|打开|开启|放起来)/,
    also: /白噪音|白噪声|雨声|咖啡|篝火|翻书|海浪|声音|环境音|专注/,
    // 「已停止播放」是停的说法，不是播放的说法
    unless: /停止|停了|关掉|关了|暂停|不再/,
    need: ['ambient.play'],
    reason: '声音没有打开',
  },
  {
    id: 'ambient-stop',
    say: /(已经?|已)[^。！？\n]{0,4}(停止|停了|关掉|关了|暂停)/,
    also: /声音|白噪音|播放|环境音|专注/,
    need: ['ambient.stop'],
    reason: '声音没有停下来',
  },
  {
    id: 'note-add',
    say: /(已经?|已)[^。！？\n]{0,6}(记到|存进|存到|记下|存成|记成)[^。！？\n]{0,6}(笔记|备忘)/,
    need: ['note.add'],
    reason: '笔记没有存下来',
  },
  {
    id: 'page-open',
    say: /(已经?|已)[^。！？\n]{0,4}(打开|跳转到|转到)[^。！？\n]{0,6}(页面|板块|那个页)/,
    need: ['page.open'],
    reason: '页面没有打开',
  },
  {
    id: 'profile-update',
    // 说法要宽：「已改为」「已建好」「已生效」这些也算声称做完了（2026-10-23 黄金集里模型常这样说）
    say: /(已经?|已)[^。！？\n]{0,6}(新建|创建|修改|更新|保存|改好|改为|改成|建好|生效)[^。！？\n]{0,6}(档案|账号信息|名称|行业)/,
    need: ['profile.update'],
    reason: '档案没有改动，需要你在页面上确认',
  },
  {
    id: 'work-status',
    say: /(已经?|已)[^。！？\n]{0,6}(标记|标为|设为|记为)[^。！？\n]{0,6}(已拍|已发布|已拍摄|拍完|发布了)/,
    need: ['work.status'],
    reason: '作品状态没有改动，需要你在页面上确认',
  },
  {
    id: 'work-progress',
    say: /(已经?|已)[^。！？\n]{0,6}(作品|这条作品|这个作品)[^。！？\n]{0,8}(标记|标为|设为|改为|改成)[^。！？\n]{0,6}(做完|完成|没做完|未完成)/,
    need: ['work.progress'],
    reason: '作品进度没有改动，需要你在页面上确认',
  },
  {
    // 板块的产出只能在老板确认开跑、板块跑完之后才有；对话里说「已经生成好了」一定是假的
    id: 'board-claim',
    say: /(已经?|已)[^。！？\n]{0,6}(生成|写好|做好|做完|完成|出了|跑完|拍好)[^。！？\n]{0,8}(选题|脚本|标题|分镜|方向|规划|审稿|计划)/,
    need: ['board.done'],
    reason: '板块还没有跑，要老板确认开跑后才会生成',
  },
];

function matches(rule: ClaimRule, sentence: string): boolean {
  if (!rule.say.test(sentence)) return false;
  if (rule.also && !rule.also.test(sentence)) return false;
  if (rule.unless && rule.unless.test(sentence)) return false;
  return true;
}

export interface ClaimCheck {
  answer: string;
  /** 被改写的规则编号（只记编号，不记用户的话） */
  rewritten: string[];
}

/**
 * 逐句核对完成说法。句子里的完成说法在本轮找不到成功回执，就把这一句换成「没有完成：原因」。
 * 句子保留末尾的标点，所以段落结构不变。
 */
export function checkClaims(answer: string, receipts: readonly ActionReceipt[]): ClaimCheck {
  if (!answer) return { answer, rewritten: [] };
  const verified = new Set(receipts.filter((r) => r.ok).map((r) => r.kind));
  const rewritten: string[] = [];
  const out = answer.split(/(?<=[。！？\n])/).map((part) => {
    const tail = /[。！？\n]$/.test(part) ? part.slice(-1) : '';
    const sentence = tail ? part.slice(0, -1) : part;
    const broken = CLAIM_RULES.find((rule) => matches(rule, sentence) && !rule.need.some((kind) => verified.has(kind)));
    if (!broken) return part;
    rewritten.push(broken.id);
    return `（没有完成：${broken.reason}）${tail}`;
  });
  return { answer: out.join(''), rewritten };
}

/** 本轮查过的资料名（来自知识库回执） */
export function knowledgeDocs(receipts: readonly ActionReceipt[]): string[] {
  return [...new Set(receipts.filter((r) => r.kind === 'knowledge.hits').flatMap((r) => r.docs ?? []))];
}

/**
 * 用了知识库，但回答里没有写出任何一篇资料的名字：在末尾注明这次主要是一般经验。
 * 没有用知识库的，原样返回。
 */
export function checkKnowledgeUse(answer: string, docs: readonly string[]): { answer: string; uncited: boolean } {
  if (!docs.length || !answer.trim()) return { answer, uncited: false };
  if (docs.some((doc) => answer.includes(doc))) return { answer, uncited: false };
  return {
    answer: `${answer}\n\n（注：知识库里的资料这次没有直接用到，以上主要是一般经验，不是资料里的原话。）`,
    uncited: true,
  };
}
