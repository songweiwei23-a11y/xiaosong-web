import { PageHeader } from "@/components/workspace/PageHeader";
import { SUPPORT_WECHAT } from "@/lib/config/contact";

/*
 * 使用说明（2026-10-17）：参考资料，放在侧栏「账户」组里，随时查。
 * 「新手课堂」讲的是抖音怎么推荐、怎么拍，这里讲的是开物每个板块干什么、怎么接着做、额度和常见问题。
 * 数字和名称都从代码里核对过（lib/config/plans、侧栏、各板块页面），改了功能要同步改这里。
 */

const FLOW = [
  { title: "进门", body: "用管理员发来的邀请链接打开，或粘贴门票码。没有邀请就加客服微信索要。" },
  { title: "建账号档案", body: "在「前采建档」把录音整理成档案，或在「个人档案」里直接填。档案是后面所有板块的依据，写得越具体，结果越准。" },
  { title: "定地基（可选，推荐）", body: "「账号定位」「商业定位」「内容定位」能把账号方向定下来，之后各板块都会参照它。" },
  { title: "从创作方向开始", body: "在「创作方向」选目的（比如引流到店、涨粉、立人设），挑一个方向。" },
  { title: "接着往下做", body: "结果下方可以勾选想带去的内容，直接跳到选题、脚本、审稿、分镜、标题等板块，不用复制粘贴。" },
];

const BOARDS: { group: string; items: { name: string; what: string }[] }[] = [
  {
    group: "总览",
    items: [
      { name: "工作台", what: "首页。接着上次没做完的、导入文案审稿、今天拍什么。" },
      { name: "新手课堂", what: "6 关学会抖音怎么推荐、怎么拍、怎么发。每关有个小挑战，答对拿星星、攒徽章。" },
      { name: "素材库", what: "各板块收藏的好内容，按分类找，随时拿去继续创作。" },
      { name: "创作进度", what: "每条内容做到哪一步：待拍摄、拍没拍、发没发。" },
    ],
  },
  {
    group: "内容创作",
    items: [
      { name: "内容规划", what: "先定这个月发几条、怎么配比、分哪几个方向。" },
      { name: "创作方向", what: "按你的目的挑能达到目的的方向和思路。" },
      { name: "拆解爆款", what: "传一条视频（或贴文字），拆成结构、镜头和可以借鉴的地方。" },
      { name: "跨行业二创", what: "把别的行业的爆款结构迁移到你的账号上。" },
      { name: "选题策划", what: "按方向生成一批可以直接拍的选题。" },
      { name: "脚本生成", what: "把选中的选题写成口播和台词。" },
      { name: "分镜脚本", what: "把脚本拆成镜头表，写清景别、时长和拍摄要点。" },
      { name: "审稿优化", what: "给已有的稿子打分、列问题、给出优化稿。" },
      { name: "标题封面", what: "生成标题和封面上的文字。" },
    ],
  },
  {
    group: "账号运营",
    items: [
      { name: "前采建档", what: "把前采记录整理成账号档案，确认后写入。" },
      { name: "账号定位", what: "从六个方面定下账号的地基。" },
      { name: "商业定位", what: "账号靠什么赚钱，怎么成交。" },
      { name: "内容定位", what: "账号长期拍什么内容。" },
      { name: "创作简报", what: "把定位翻译成各板块能直接用的写作指令。" },
      { name: "行业建议", what: "按目的和阶段给一套打法。" },
      { name: "起号", what: "新号前几条怎么拍、前三秒怎么说。" },
      { name: "成交理由", what: "整理客户为什么选你，会逐条打分。" },
      { name: "个人档案", what: "查看和修改账号档案。" },
    ],
  },
  {
    group: "助手与资料",
    items: [
      { name: "自由对话", what: "什么都能问：联网查资料、读图片和文档、出方案，会员还能做深度研究。" },
      { name: "知识库", what: "查编导方法和案例，来自五个专题库。" },
    ],
  },
  {
    group: "账户",
    items: [
      { name: "我的账户", what: "查看账号和套餐信息。" },
      { name: "会员中心", what: "看套餐、剩余额度，开通或续费。" },
      { name: "使用说明", what: "就是这一页。" },
    ],
  },
];

const QUOTA = [
  { plan: "免费版", price: "0 元", each: "每个板块 5 次（自由对话、知识库各 10 次；前采建档、拆解爆款、跨行业二创各 3 次）", web: "3 次，一次性体验，用完不重置", deep: "不提供" },
  { plan: "基础会员", price: "49 元/月", each: "每个功能 50 次/月", web: "20 次/月", deep: "不提供" },
  { plan: "专业会员", price: "99 元/月", each: "每个功能 120 次/月", web: "60 次/月", deep: "10 份/月" },
  { plan: "高频会员", price: "199 元/月", each: "每个功能 300 次/月", web: "150 次/月", deep: "30 份/月" },
];

const FAQ = [
  {
    q: "页面提示「这是邀请制的产品」，怎么进？",
    a: "开物需要邀请。打开管理员发给你的邀请链接，或者粘贴门票码；没有的话加客服微信索要。",
  },
  {
    q: "忘记密码怎么办？",
    a: `目前没有自助找回功能，加客服微信 ${SUPPORT_WECHAT}，核实身份后会重置密码。`,
  },
  {
    q: "退出登录后，再打开首页要重新进门？",
    a: "是的。退出会让这台电脑的首页通行失效，需要重新凭邀请链接或门票码进门。共用电脑的话，用完记得退出。",
  },
  {
    q: "结果里出现「有 N 处可能踩禁忌」是什么意思？",
    a: "系统按平台红线和你所在行业的禁忌词扫了一遍，列出了可能违规的说法。发布前改掉。能继续对话的板块，点「让 AI 改掉」直接修改；其他板块点「复制修改要求」，粘贴给 AI 即可。",
  },
  {
    q: "结果里出现「这几处请核对」是什么意思？",
    a: "这几处是资料里找不到出处的价格、百分比、顾客见证、经营承诺或地名。它不判断真假，只提醒你核对；确认有依据就保留，没有就删掉或改成【待确认】。",
  },
  {
    q: "文案里的【待确认】【换成你的真实……】要怎么处理？",
    a: "这些是系统故意留给你填的空。资料里没有的数字、经历、价格，系统不会替你编。把真实情况填进去再用。",
  },
  {
    q: "脚本的时长怎么定？",
    a: "默认「AI 推荐」：优先把内容写精彩，时长只作参考，不会因为要短而删掉精彩的部分。如果需要固定时长，在脚本页手动选择，系统会按那个时长控制字数。",
  },
  {
    q: "自由对话里的「联网」怎么用？",
    a: "三档：按需联网（问到新闻、股价、天气、政策规则这类要查的事，会自动搜，每次用 1 次额度）；本轮联网（不管问什么，这一轮都搜，用 1 次）；关闭联网。时效性强的问题，建议直接选「本轮联网」。",
  },
  {
    q: "拆解一条视频要等多久？",
    a: "一条 3 分钟的视频大约要 5 分钟。画面和声音的处理在浏览器里完成，这一步请先别关闭或刷新页面；进入 AI 拆解之后，离开页面结果也会存进历史。",
  },
  {
    q: "生成的结果不满意怎么办？",
    a: "可以在结果下方继续对话，告诉它哪里要改；或者换一个方向、换一个目的重新生成。",
  },
  {
    q: "手机上怎么用？",
    a: "左上角的 ☰ 按钮打开菜单。结果在表单下面，生成后会自动滚到结果区。",
  },
];

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8 lg:py-7">
      <PageHeader title="使用说明" subtitle="开物每个板块干什么、怎么接着做、额度怎么算、遇到提示怎么办。" />

      <section className="glass-panel mb-5 rounded-2xl p-5">
        <h2 className="mb-3 text-[16px] font-semibold text-foreground">第一次用：照着这五步走</h2>
        <ol className="space-y-3">
          {FLOW.map((step, i) => (
            <li key={step.title} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[12px] font-semibold text-primary">{i + 1}</span>
              <div>
                <p className="text-[14px] font-medium text-foreground">{step.title}</p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="glass-panel mb-5 rounded-2xl p-5">
        <h2 className="mb-1 text-[16px] font-semibold text-foreground">每个板块是干什么的</h2>
        <p className="mb-4 text-[12.5px] text-muted-foreground">侧栏里的顺序和这里一致。板块之间可以互相带过去，结果下方的勾选就是带过去的内容。</p>
        <div className="space-y-5">
          {BOARDS.map((g) => (
            <div key={g.group}>
              <p className="mb-2 text-[12px] font-medium uppercase tracking-wider text-muted-foreground/80">{g.group}</p>
              <ul className="divide-y divide-border/60">
                {g.items.map((b) => (
                  <li key={b.name} className="grid gap-1 py-2.5 sm:grid-cols-[7rem_1fr] sm:gap-4">
                    <span className="text-[14px] font-medium text-foreground">{b.name}</span>
                    <span className="text-[13px] leading-relaxed text-muted-foreground">{b.what}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="glass-panel mb-5 rounded-2xl p-5">
        <h2 className="mb-1 text-[16px] font-semibold text-foreground">额度与会员</h2>
        <p className="mb-4 text-[12.5px] text-muted-foreground">
          会员按月计算，本期没用完的次数到期清零，不累计。免费版是一次性体验额度，用完不重置。具体开通与续费在「会员中心」。
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-left text-[13px]">
            <thead>
              <tr className="border-b border-border/60 text-[12px] text-muted-foreground">
                <th className="py-2 pr-3 font-normal">套餐</th>
                <th className="py-2 pr-3 font-normal">价格</th>
                <th className="py-2 pr-3 font-normal">每个板块</th>
                <th className="py-2 pr-3 font-normal">联网搜索</th>
                <th className="py-2 font-normal">深度研究</th>
              </tr>
            </thead>
            <tbody>
              {QUOTA.map((q) => (
                <tr key={q.plan} className="border-b border-border/40 align-top">
                  <td className="py-2.5 pr-3 font-medium text-foreground">{q.plan}</td>
                  <td className="py-2.5 pr-3 text-foreground">{q.price}</td>
                  <td className="py-2.5 pr-3 text-muted-foreground">{q.each}</td>
                  <td className="py-2.5 pr-3 text-muted-foreground">{q.web}</td>
                  <td className="py-2.5 text-muted-foreground">{q.deep}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="glass-panel mb-5 rounded-2xl p-5">
        <h2 className="mb-4 text-[16px] font-semibold text-foreground">常见问题</h2>
        <div className="space-y-4">
          {FAQ.map((f) => (
            <div key={f.q}>
              <p className="text-[14px] font-medium text-foreground">{f.q}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="glass-panel rounded-2xl p-5">
        <h2 className="mb-2 text-[16px] font-semibold text-foreground">还有问题</h2>
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          加客服微信 <span className="select-all font-medium text-foreground">{SUPPORT_WECHAT}</span>，说清楚你在哪个板块、遇到了什么，方便更快定位。
        </p>
      </section>
    </div>
  );
}
