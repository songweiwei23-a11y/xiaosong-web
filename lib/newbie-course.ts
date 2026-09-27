/**
 * 抖音新手课：给压根不了解抖音的小白，建立基本认识、知道正确的创作路径。
 *
 * 写的时候守三条：
 *   - 说人话：不用"完播率阈值""算法权重"这种词，要用就当场解释
 *   - 不夸大：抖音不公开推荐规则，讲机制的地方写明"这是创作者普遍总结的经验"
 *   - 学完就动手：每一课最后都有一个"去试试"，直达开物对应的板块
 */

export interface Lesson {
  id: string;
  /** 第几课 */
  no: number;
  title: string;
  /** 一句话讲清这课学什么 */
  hook: string;
  /** 大概几分钟读完 */
  minutes: number;
  /** 要点：每条一句话 */
  points: { head: string; body: string }[];
  /** 一个小测验（闯关版用；答对才过关） */
  quiz: { q: string; options: string[]; answer: number; why: string };
  /** 学完去试试 */
  action: { label: string; href: string };
}

export const LESSONS: Lesson[] = [
  {
    id: 'how-feed-works',
    no: 1,
    title: '抖音是怎么把你的视频推给陌生人的',
    hook: '新号 0 粉丝也能上热门——前提是你知道它看什么',
    minutes: 3,
    points: [
      { head: '先推一小批人试试', body: '你一发布，抖音会先把视频推给一小批可能感兴趣的人，不管你有没有粉丝。' },
      { head: '这批人的反应决定下一步', body: '看完的人多、点赞评论转发多，就推给更大一批人；反应平平，就停在这里。' },
      { head: '所以前 3 秒最要命', body: '刷到你的人如果 3 秒内划走，后面拍得再好也没人看到。开头必须一下抓住人。' },
      { head: '新号和老号机会一样', body: '推荐看的是这条视频本身好不好，不是你粉丝多不多。这是普通人能做起来的原因。' },
    ],
    quiz: {
      q: '一个 0 粉丝的新号发的视频，会有人看到吗？',
      options: ['不会，没粉丝就没人看', '会，抖音会先推给一小批人试试', '要先花钱投流才有人看'],
      answer: 1,
      why: '抖音会先推给一小批人，反应好再推给更多人。这是创作者普遍总结的规律（平台不公开具体规则）。',
    },
    action: { label: '看看开物怎么写开头', href: '/dashboard/growth?tab=opening' },
  },
  {
    id: 'anatomy',
    no: 2,
    title: '一条能火的短视频，由哪几块组成',
    hook: '拆开看其实就三块：抓人的开头、有用的中间、让人互动的结尾',
    minutes: 3,
    points: [
      { head: '开头 3 秒：钩子', body: '一句让人想看下去的话，比如一个反常识的结论、一个戳中痛点的问题。' },
      { head: '中间：给干货或讲故事', body: '要么让人学到东西，要么让人有情绪（好笑、感动、解气），别光打广告。' },
      { head: '结尾：让人留下点什么', body: '一句引导评论的问题、一个"关注看下期"，互动越多推得越远。' },
      { head: '新手先拍 15～60 秒', body: '越短越容易看完。先把短的拍好，再慢慢拉长。' },
    ],
    quiz: {
      q: '下面哪个开头最容易让人看下去？',
      options: ['大家好，欢迎来到我的店', '同样 15 块一碗面，凭什么他家天天排队？', '今天给大家介绍一下我们的产品'],
      answer: 1,
      why: '它抛出一个让人好奇的问题，刷到的人会想知道答案。前两种一听就是广告，很容易被划走。',
    },
    action: { label: '让开物帮你写一条完整脚本', href: '/dashboard/script' },
  },
  {
    id: 'path',
    no: 3,
    title: '小白正确的创作路径：先想清楚，再开拍',
    hook: '大多数人一上来就拍，拍了十条没人看就放弃了。顺序错了',
    minutes: 4,
    points: [
      { head: '① 定位：你是谁、拍给谁看', body: '比如"县城面馆老板，拍给附近想吃好面的人"。定位清楚，推荐才会推给对的人。' },
      { head: '② 选题：拍什么', body: '从顾客最常问的问题、最在意的点出发，一次想十个，挑最想拍的。' },
      { head: '③ 脚本：说什么、怎么拍', body: '写好开头、中间、结尾，再排好镜头。照着拍，不用现场想。' },
      { head: '④ 拍摄和发布', body: '手机就够。发布时配好标题、封面和话题。' },
      { head: '⑤ 看数据、找方向', body: '哪条看的人多、看完的人多，下一批就多拍那个方向。然后回到第②步，循环。' },
    ],
    quiz: {
      q: '刚开始做短视频，第一步应该做什么？',
      options: ['先买好的相机和灯', '先想清楚自己是谁、拍给谁看', '先拍 30 条再说'],
      answer: 1,
      why: '定位决定了推荐推给谁。定位不清，拍得再多，推给的也可能是不相干的人。',
    },
    action: { label: '去做账号定位', href: '/dashboard/positioning' },
  },
  {
    id: 'shooting',
    no: 4,
    title: '手机就能拍：新手拍摄的 5 件事',
    hook: '不用买设备，把这 5 件小事做对，画面就比大多数人干净',
    minutes: 3,
    points: [
      { head: '光：脸朝着窗户', body: '白天对着窗户拍，脸上的光最均匀。别背对窗户，会拍成黑脸。' },
      { head: '声：找安静的地方', body: '声音比画面更重要。关掉风扇空调，有条件用一个几十块的领夹麦。' },
      { head: '竖着拍', body: '抖音是竖屏，横着拍的视频两边会是黑边，看着不舒服。' },
      { head: '稳：用个支架', body: '手机支架几块钱，画面不晃，看的人才不累。' },
      { head: '背景干净', body: '拍之前扫一眼背景，把乱七八糟的东西挪开。店里拍就收拾一下桌面。' },
    ],
    quiz: {
      q: '在店里拍口播，下面哪个做法最对？',
      options: ['背对着门口的光拍，显得有氛围', '脸朝着光、找安静的角落、竖着拍', '横着拍，画面更宽'],
      answer: 1,
      why: '脸朝光才看得清、安静才听得清、竖屏才占满手机屏幕。',
    },
    action: { label: '先出一份分镜，照着拍', href: '/dashboard/storyboard' },
  },
  {
    id: 'publish',
    no: 5,
    title: '发布这一步，很多人白白浪费了',
    hook: '拍完就发？标题、封面、话题、时间，每一样都影响有没有人看',
    minutes: 3,
    points: [
      { head: '标题：说清楚这条讲什么', body: '让人一眼知道看了能得到什么。开物的「标题封面」可以一次给你好几个。' },
      { head: '封面：一句大字 + 清楚的画面', body: '在主页上，别人是先看封面再决定点不点。' },
      { head: '话题：加 2～3 个相关的', body: '比如 #县城美食 #面馆，帮抖音知道该推给谁。' },
      { head: '时间：挑你的顾客有空刷手机的时候', body: '比如餐饮在饭点前一两个小时发，上班族的内容在晚上发。' },
      { head: '门店记得加定位', body: '加上店铺位置，附近的人更容易刷到，看完能直接找过来。' },
    ],
    quiz: {
      q: '一家面馆想让附近的人刷到，发布时最不能忘的是？',
      options: ['加上店铺定位', '发很长的文案', '一天发十条'],
      answer: 0,
      why: '定位能让视频更多地推给附近的人，看完能直接找到店。',
    },
    action: { label: '去起一个好标题', href: '/dashboard/title' },
  },
  {
    id: 'data-and-traps',
    no: 6,
    title: '看懂数据，避开新手最常踩的坑',
    hook: '数据不是用来焦虑的，是告诉你下一条该怎么拍',
    minutes: 4,
    points: [
      { head: '先看两个数', body: '播放量（多少人刷到）和完播率（多少人看完）。完播率低，说明开头或节奏要改。' },
      { head: '坑 1：数据不好就删', body: '删了也不会让账号变好，还丢了能复盘的样本。留着，找原因。' },
      { head: '坑 2：搬运别人的视频', body: '抖音能认出来，搬运的不给推荐，还可能被处罚。' },
      { head: '坑 3：一天发很多条低质量的', body: '不如一周三条认真做的。质量比数量重要。' },
      { head: '坑 4：说大话', body: '"全网最低""包治百病"这类说法违反广告法和平台规则，会被限流甚至封号。' },
    ],
    quiz: {
      q: '发了一条视频，播放量很低，最好的做法是？',
      options: ['马上删掉重发', '留着，看看是开头还是内容的问题，下一条改进', '去买点播放量'],
      answer: 1,
      why: '删视频和买量都解决不了问题。找到原因、下一条改进，才会越做越好。',
    },
    action: { label: '开始 7 天起号计划', href: '/dashboard#launch-plan' },
  },
];

export const COURSE_TOTAL = LESSONS.length;
export const COURSE_MINUTES = LESSONS.reduce((s, l) => s + l.minutes, 0);

/** 过了几关，夹在 0~总关数之间；脏数据当 0 */
export function clampPassed(v: unknown): number {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.min(COURSE_TOTAL, Math.max(0, n)) : 0;
}

/**
 * 过第 no 关之后，一共过了几关。
 * 只能按顺序过：第 no 关必须是已解锁的（前面都过了）；重复过已经过的关不减少进度。
 * 跳关（比如直接过第 5 关）不算——返回原进度。
 */
export function passLevel(passed: number, no: number): number {
  const cur = clampPassed(passed);
  if (!Number.isInteger(no) || no < 1 || no > COURSE_TOTAL) return cur;
  if (no > cur + 1) return cur;
  return Math.max(cur, no);
}

export const graduated = (passed: number) => clampPassed(passed) >= COURSE_TOTAL;
