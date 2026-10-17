import { PageHeader } from "@/components/workspace/PageHeader";
import { SUPPORT_WECHAT } from "@/lib/config/contact";

/*
 * 使用说明（2026-10-17，第二版）：写「用户怎么操作」——点哪里、填什么、出来什么、下一步去哪个板块。
 * 不讲后台怎么判断，只讲用户看得见、点得到的东西。
 * 名称、按钮文字、数字都对照过代码（各板块页面、lib/config/plans、结果区组件）；改了界面要同步改这里。
 * tests/help-page-20261017.test.ts 会核对侧栏板块名、价格、额度。
 */

type Step = { title: string; where: string; fill: string; get: string; next: string };

/** 第一次用：照着做一遍，就把开物用顺了 */
const FIRST_RUN: Step[] = [
  {
    title: "进门",
    where: "用管理员发来的邀请链接打开，或在进门页粘贴门票码。",
    fill: "没有邀请就加客服微信索要。",
    get: "进入工作台。",
    next: "个人档案",
  },
  {
    title: "把账号资料填进去",
    where: "侧栏「个人档案」直接填；或者用「前采建档」，把前采记录整理成档案。",
    fill: "个人档案分 6 块：账号基础、目标受众、内容定位、竞争策略、资源配置、变现路径。不知道的就留空，系统不会替你编。",
    get: "一份账号档案。之后每个板块都会读它，所以这一步写得越具体，后面的结果越准。",
    next: "账号定位",
  },
  {
    title: "定账号的地基",
    where: "侧栏「账号定位」，生成一份可执行的定位方案。",
    fill: "补充信息里写你想突出什么、不想做什么，例如「希望突出本地属性，不想做泛流量」。",
    get: "这个号是什么、给谁看、凭什么让人信。",
    next: "创作简报",
  },
  {
    title: "把定位翻成写作指令",
    where: "侧栏「创作简报」，点生成。",
    fill: "可以补一句这阵子的重点，例如「这阵子主攻餐饮客户，口吻再放松一点」。",
    get: "一段各板块能直接用的写作指令。选题、脚本都会照它写。",
    next: "内容规划",
  },
  {
    title: "定这个月发几条",
    where: "侧栏「内容规划」。",
    fill: "填上个月实际发了几条、这个月想发几条；选填这个月的重点（比如中旬上新、月底店庆）和不想拍的内容。",
    get: "15～20 个方向，每个带本月条数和节奏。条数为 0 的是备选，本月先不拍。",
    next: "创作方向（勾选想做的方向）",
  },
  {
    title: "说清楚为了什么拍",
    where: "侧栏「创作方向」。",
    fill: "第一项选这条视频的目的（可多选），也可以另写想达到的目的；第二项写你的想法，例如「想拍老板每天凌晨去市场挑肉」。",
    get: "按档案铺开的方向和思路，并推荐一个最好的。勾选想做的那个。",
    next: "选题策划",
  },
  {
    title: "出一批能拍的选题",
    where: "侧栏「选题策划」，顶部选「⚡ 快速模式」（用已存的档案和定位，最省事）。",
    fill: "快速模式不用再填账号信息。想手动定每一项，就切到「🎨 自定义」。内容方向、打法、爆款元素按需要选；进阶设置是选填的。",
    get: "一批可以直接拍的选题。勾选你想拍的几条。",
    next: "开篇设计或脚本生成",
  },
  {
    title: "想好开头怎么说",
    where: "侧栏「起号」，切到「开篇钩子」标签。",
    fill: "从选题带过来的会自动填入。也可以贴上你现有的开头，让它指出问题并给替代开头。",
    get: "每种开法各给一条，挑一条带走。挑中的开头会成为脚本的开头。",
    next: "脚本生成",
  },
  {
    title: "写成能照着念的稿子",
    where: "侧栏「脚本生成」。",
    fill: "基础设置里的选题、时长（默认「AI 推荐」）、结构；创意设计里的店名、主打、卖点（写真实的，资料里没有的别编）。",
    get: "一份口播稿（可以一键复制纯文案，直接贴进提词器）和拍摄建议。",
    next: "审稿优化、分镜脚本、标题封面",
  },
  {
    title: "审、拆、起标题，然后拍",
    where: "审稿：侧栏「审稿优化」。分镜：「分镜脚本」。标题：「标题封面」。",
    fill: "审稿时贴稿子，在「个人要求」里写你的硬要求（优先级最高，例如「扩到 60 秒左右」「第二段价格改成 19.9 元」「开头那句保留」）。",
    get: "审稿意见和优化稿；镜头表（景别、运镜、画面、时长）；几个标题方案，并附封面大字建议。",
    next: "创作进度",
  },
  {
    title: "拍完、发完，把数据录回来",
    where: "侧栏「创作进度」。",
    fill: "作品卡片上把状态改成「已拍摄」「已发布」。已发布的点「录入数据」，填播放、完播、咨询、平台和观察时长。",
    get: "待拍摄清单。数据录得越多，之后选题和方向会越贴合这个号的真实表现。",
    next: "回到选题策划，开始下一轮",
  },
];

/** 板块怎么配合：按阶段分五条线，每条线里的板块按这个顺序用 */
const LANES: { title: string; when: string; flow: string[]; note: string }[] = [
  {
    title: "地基（做一次，之后偶尔更新）",
    when: "刚开始、或者账号的业务变了的时候",
    flow: ["前采建档", "个人档案", "账号定位", "创作简报"],
    note: "前采建档是可选的入口：前采记录整理成档案以后，档案才是所有板块的依据。商业定位、内容定位需要时再做；行业建议存好一套打法后，各创作板块都照它执行；成交理由保存后，脚本会自动带上。",
  },
  {
    title: "规划（每月、每个阶段）",
    when: "决定这个月拍什么方向的时候",
    flow: ["内容规划", "创作方向", "选题策划"],
    note: "先定这个月几条、分哪几个方向，再对每个方向说清为了什么拍，最后出选题。三步都是「勾选想要的，带去下一步」。",
  },
  {
    title: "创作（每一条视频）",
    when: "选定一个选题，开始写",
    flow: ["起号（开篇钩子）", "脚本生成", "审稿优化", "分镜脚本", "标题封面"],
    note: "审稿和分镜可以来回走：审完改了稿子，再拆分镜；分镜拍的时候发现台词不顺，再回审稿。标题封面最后做，它依据的是定稿的开头。",
  },
  {
    title: "借鉴（找灵感、学爆款）",
    when: "看到别人的爆款，想学它的结构",
    flow: ["拆解爆款", "跨行业二创", "选题策划 / 脚本生成"],
    note: "拆解报告里有 5 个变现方向，每个都带着二创结构。选中以后整份报告带去跨行业二创，换成你的行业来写。",
  },
  {
    title: "执行与复盘（拍完以后）",
    when: "视频已经拍了、发了",
    flow: ["创作进度", "录入数据", "回到选题策划"],
    note: "待拍摄的清单在创作进度里。录的数据会参考到之后的选题和方向，所以数据录越真，之后的建议越准。",
  },
];

/** 结果带去下一步：怎么点、带过去的是什么 */
const HANDOFF: { title: string; body: string }[] = [
  {
    title: "一键带去下一个板块（「继续创作」）",
    body: "在结果正文的底部找到「继续创作」，点开后列出推荐的下一步板块，点哪个就带过去。带过去的是正文、你这次的设置（目的、人群、时长、选中的开头和选题）以及参考材料，不用复制粘贴。推荐的排在前面，比如拆解完推荐「跨行业二创」「选题策划」。",
  },
  {
    title: "批量带去：先勾选，再去下一步",
    body: "内容规划、创作方向、选题策划这类「出一批」的板块，结果里每一条前面都有勾选框。勾中几条，再点「带去」或「继续创作」，只有勾中的会过去，没勾的留在原来的结果里。",
  },
  {
    title: "带去定位类板块和成交理由",
    body: "账号定位、商业定位、内容定位、创作简报、成交理由没有正文框。带进来的内容会填进它们的「补充说明」或「店铺特色」里，并且整段参与分析。",
  },
  {
    title: "复制、下载、纯文案",
    body: "「复制」复制整份结果；「下载」保存成文件；「复制纯文案」只复制要念的话（脚本、审稿稿里有「纯文字文案」一节时才出现），可以直接贴进提词器。",
  },
  {
    title: "在结果上直接改（画布改稿）",
    body: "结果可以直接在页面上修改。改过的会存成新的一版，之后「复制」「下载」「继续创作」都用最新一版；结果上方会提示「这是在画布里改过的第 N 版」。想回到原稿，看历史记录即可。",
  },
  {
    title: "接着说要改哪里（「继续对话」）",
    body: "有「继续对话」按钮的板块，可以接着说哪里不对、要怎么改，AI 在上一版的基础上改，不用从头写要求。自由对话里所有回答都可以这样接着问。",
  },
  {
    title: "找回以前的结果（「历史」）",
    body: "拆解、跨行业二创、内容规划、创作方向、选题、标题、审稿、分镜、脚本等板块，页面里都有「历史记录」折叠区，点开能找回以前生成的结果。创作进度里能看到每条内容做到哪一步。",
  },
];

/** 每个板块：做什么、怎么用、填什么、得到什么、接下来去哪。name 与侧栏一致 */
type Board = { name: string; href: string; what: string; steps: string[]; fill?: string[]; get: string; next: string[] };
const GUIDE: { group: string; intro?: string; boards: Board[] }[] = [
  {
    group: "总览",
    boards: [
      {
        name: "工作台",
        href: "/dashboard",
        what: "首页。看今天拍什么、接着上次没做完的、跟着 7 天计划走。",
        steps: [
          "进来先看「今天拍什么」：有待拍摄的内容就直接去拍；没有，就先定一条今天能拍的选题。",
          "「7 天起号计划」按天勾选完成，每天一件小事。",
          "新手课卡片在首页，没学完可以随时点进去。",
        ],
        get: "今天的待办。",
        next: ["创作进度（有待拍的）", "选题策划（没有待拍的）"],
      },
      {
        name: "新手课堂",
        href: "/dashboard/course",
        what: "6 关学会抖音怎么推荐、怎么拍、怎么发。",
        steps: [
          "在地图上点亮着的那一关，先上滑读要点卡片。",
          "读完点「读完了，答一题过关」，答对就过关。",
          "过关后可以玩一个小挑战，判断题或排顺序，全对再多拿一颗星。",
          "每关末尾的「去试试」直接跳到对应的板块。",
        ],
        get: "过关进度、星星和徽章。星星存在账号里，换设备也能看到。",
        next: ["每关末尾的「去试试」"],
      },
      {
        name: "素材库",
        href: "/dashboard/library",
        what: "存各板块收藏的好内容，按分类找，随时拿去继续创作。",
        steps: [
          "在任何板块的结果底部点「收藏」，内容就进了素材库。",
          "分三类看：真实素材（你自己记下的真事）、认可的好稿（你点过「认可为好稿」的）、AI 建议（各板块生成后收藏的）。",
          "也可以按板块看：选题、脚本、分镜、审稿稿、标题封面、开篇钩子、方向思路、拆解、定位、成交理由等。",
          "搜标题或全文找东西；选中后点「继续创作」带去下一步。",
        ],
        fill: ["真实素材要先写「客户问题」（必填），再写原话、你做了什么、真实结果、可拍画面。没有的写「没有」，不要编。"],
        get: "一个能反复用的素材仓库。",
        next: ["选题策划（客户问题、原话）", "脚本生成（认可的好稿）"],
      },
      {
        name: "创作进度",
        href: "/dashboard/works",
        what: "每条内容做到哪一步：创作中、待拍摄、已拍摄、已发布。",
        steps: [
          "顶部筛选：创作中、待拍摄（内容做完、标题封面也出了的会在这里）、已拍摄、已发布、全部。",
          "拍完在卡片上改成「已拍摄」；发布后改成「已发布」。",
          "已发布的作品点「录入数据」，填播放、完播、咨询、平台和观察时长。",
          "数据多的话，可以把后台的作品数据表格复制粘贴进来：按标题对到已发布的作品，先预览，确认后再保存。",
          "每条作品可以记「计划发布」的日期（首页「本周要发」据此提醒），以及素材放在哪（网盘或草稿链接，或一句说明）。视频文件本身不进开物。",
        ],
        fill: ["录入数据时，观察时长写你真正看的天数，越真越有用。样本少时系统不会下结论，要积累几条同类作品才会参考比较。"],
        get: "拍摄清单和每条作品的数据。",
        next: ["选题策划（参考数据）", "创作方向（参考数据）"],
      },
      {
        name: "月报",
        href: "/dashboard/report",
        what: "一个月发了几条、播放和完播怎样、下个月计划。可以打印或存为 PDF 发给客户。",
        steps: [
          "在「月报」顶部选月份，默认是上个月。",
          "页面直接列出：拍摄完成、发布、合计播放、完播中位数、表现最好的一条、下个月计划。",
          "点「打印 / 存为 PDF」，侧栏和按钮不会出现在打印结果里。",
        ],
        fill: ["数字都从作品和它录的数据里算出来，没有模型参与。没录的地方写的是「未录」，不是 0。"],
        get: "一页可以直接发给客户或老板的月度报告。",
        next: ["下个月的创作进度（排计划）"],
      },
      {
        name: "对标 & 热点",
        href: "/dashboard/benchmark",
        what: "记下你看到的对标账号作品数据和热点线索。开物不去抓取任何平台的数据，全部是你自己录的。",
        steps: [
          "先加对标账号：名字必填，平台、主页链接、备注可以不填。",
          "在账号下面记作品：标题必填，发布日期、播放、完播率按你看到的填，没看到的留空。",
          "热点线索：写清楚是什么，有链接和看到的日期更好。",
        ],
        fill: ["留空的数字显示为「未填」，不会当成 0 参与汇总。"],
        get: "看清对标账号的平均播放、完播中位数和表现最好的作品，选题时可以参照。",
        next: ["选题策划（用这些数字和热点挑方向）"],
      },
    ],
  },
  {
    group: "内容创作",
    intro: "这一组是一条视频的主线：规划 → 方向 → 借鉴 → 选题 → 脚本 → 分镜 → 审稿 → 标题。",
    boards: [
      {
        name: "内容规划",
        href: "/dashboard/content-plan",
        what: "定这个月发几条、各类内容怎么配比、分哪几个方向。",
        steps: [
          "第 1 项：填上个月实际发了几条。系统里记录的已发布作品数会当作参考显示出来。",
          "第 2 项：填这个月想发几条。",
          "第 3 项（选填）：写这个月的重点，比如「中旬上新一批沙发」「月底店庆」；也写不想拍的，比如「不想拍成甩卖降价」。",
          "选账号：按哪个账号来做规划。",
          "点生成，得到 15～20 个方向。勾选想做的方向，点带去下一步。",
        ],
        get: "每个方向带本月条数和节奏。条数为 0 的是备选，本月先不拍。",
        next: ["创作方向", "选题策划", "脚本生成"],
      },
      {
        name: "创作方向",
        href: "/dashboard/direction",
        what: "说清这条视频为了什么，按档案铺开方向和思路，推荐一个最好的。",
        steps: [
          "第 1 项：选这条视频的目的，可多选。想要的目的不在列表里，就在下面写「另外想达到的目的」。",
          "第 2 项：写你的想法，例如「想拍老板每天凌晨去市场挑肉」。",
          "第 3 项（选填）：条件。不选就按档案来。",
          "第 4 项：出几个方向、每个写多细。",
          "点生成，勾选想做的方向，点带去下一步。",
        ],
        fill: ["如果是从内容规划带过来的，页面上会有「要拓展的方向（来自…）」，直接在那个方向上展开，不用重新选目的。"],
        get: "几个方向，每个带思路和推荐理由；其中一个被标为最好的。",
        next: ["选题策划", "脚本生成", "起号（开篇钩子）"],
      },
      {
        name: "拆解爆款",
        href: "/dashboard/breakdown",
        what: "传一条爆款视频，逐镜头拆出它为什么火、你能学走什么，并给 5 个变现方向。",
        steps: [
          "上传视频：mp4 格式，100MB 以内。超过 3 分钟只拆前 3 分钟，开头最决定留不留人，所以前 3 分钟足够。",
          "补充信息（选填，填了拆得更准）：行业、你想看什么（比如「开头怎么留人」）、点赞数据。点赞是粉丝的几倍才算真爆，填上会更准。",
          "点开始拆解。一条 3 分钟的视频大约要 5 分钟。",
          "拆的时候请别关页面或刷新。离开页面结果也会存进历史，回来在历史记录里找。",
          "拆完看报告：逐镜头的拆解、开头前 2 秒和前 5 秒、5 个变现方向（每个都带二创结构）。",
        ],
        fill: [
          "视频不上传：画面在你的浏览器里截图，截图和口播交给 AI 分析，不保存视频。抖音里点「分享 → 保存本地」就能拿到视频。",
          "没有视频也能用：切到文字模式，贴已有的文案或方案，只做文字分析。画面和声音只有上传视频才能分析。",
        ],
        get: "逐镜头的拆解报告和 5 个可以选的变现方向。",
        next: ["跨行业二创（整份报告带过去）", "选题策划", "审稿优化"],
      },
      {
        name: "跨行业二创",
        href: "/dashboard/remix",
        what: "借别的行业爆款的开篇、结构、拍法，换成你自己的行业来拍。",
        steps: [
          "原片：贴原片的文字（最多约 1.4 万字），或从拆解报告带入；填原片是什么行业。",
          "借哪几层：开篇、结构、拍法等，可多选。",
          "出几个、怎么拉开、写多深。",
          "裂变方式：1:1 复刻，或按拆解的知识裂变（换成你的素材）。",
          "二创到哪家店：写你的行业，以及老板不想出镜、想推哪个新品之类的注意事项。",
          "选填：目的、时长、要哪些产出。",
        ],
        get: "几份二创方案，每份都能单独带去下一步。",
        next: ["审稿优化", "分镜脚本", "选题策划"],
      },
      {
        name: "选题策划",
        href: "/dashboard/topic",
        what: "结合账号定位和爆款元素，一次给出多条可直接拍的选题。",
        steps: [
          "顶部两种模式：「⚡ 快速模式」用已存的档案和定位，不用再填账号信息；「🎨 自定义」手动填所有字段（账号阶段、粉丝量级等）。",
          "内容方向、打法（四大脚本或起号 36 计）、爆款元素，按需要选。",
          "进阶设置（选填）：3 个关键词、想参考的同赛道账号、见过的爆款选题、账号特色和禁忌、其他要求。",
          "输出设置里定几条，点生成。",
          "勾选想拍的选题，点带去下一步。",
        ],
        get: "一批选题，每条有标题和拍摄思路。",
        next: ["开篇设计（起号）", "脚本生成"],
      },
      {
        name: "脚本生成",
        href: "/dashboard/script",
        what: "把选题写成能照着念的口播稿，并附拍摄建议。",
        steps: [
          "基础设置：选题（从选题页带入，或自己写）、时长（默认「AI 推荐」）、视频结构。",
          "目标定位：这条视频的目的和人群。",
          "创意设计：店铺名、主打产品、核心卖点、特色服务、价格信息。",
          "专业控制、成交理由、账号定位、补充说明：都是选填的，需要时再展开。",
          "点生成，得到口播稿和拍摄建议。满意就复制纯文案，不满意就继续对话说清哪里改。",
        ],
        fill: [
          "时长：默认「AI 推荐」，写到 1 分 30 秒～1 分 40 秒（口播约 450～500 字），内容讲透，不为凑时长注水。要别的长度，就在这里手动选秒数，系统会按你选的时长写（口播控制在这个时长的 90%～100%）。",
          "价格、数字、经历：写真实的。稿子里的【待确认】和【换成你的真实……】是故意留的空，填上真实情况再用。",
        ],
        get: "口播稿、拍摄建议，以及可以一键复制的纯文案。",
        next: ["审稿优化", "分镜脚本", "标题封面"],
      },
      {
        name: "分镜脚本",
        href: "/dashboard/storyboard",
        what: "把口播拆成可以拍的镜头表：景别、运镜、画面、时长和字幕。",
        steps: [
          "脚本内容：从脚本或审稿页带入，也可以直接粘贴。",
          "拍摄设置：按页面上的选项选（拍摄条件、人员等）。",
          "补充说明（选填）：例如「需要航拍镜头、避免快速剪辑」。",
          "点生成，照着镜头表一个镜头一个镜头拍。",
        ],
        get: "镜头表：每个镜头的景别、运镜、画面、时长和字幕，可以复制。",
        next: ["标题封面", "创作进度（拍完后）"],
      },
      {
        name: "审稿优化",
        href: "/dashboard/review",
        what: "逐项指出问题、给改写建议；可以对照同赛道的爆款做差距分析。",
        steps: [
          "待审脚本：粘贴要审的稿子，或从脚本页带入。",
          "个人要求（优先级最高）：写你的硬要求，例如「扩到 60 秒左右」「第二段价格改成 19.9 元」「开头那句保留不要改」。",
          "基础信息：时长，例如「45 秒」「2 分半」。",
          "审稿维度（选填，默认全选）和优化目标。",
          "需要对照时，粘贴一条同赛道的爆款脚本作参考。",
          "点生成，看打分、问题和优化稿。",
        ],
        get: "6 个维度的打分（满分 100，显示为 10 分制）、逐条问题和改写建议，以及优化后的完整稿。",
        fill: ["结果下方可能出现「这几处请核对」：资料里找不到出处的价格、百分比、顾客见证、承诺或地名。确认有依据就保留；没有就删掉，或改成【待确认】。也可以点「按资料修正」，系统只改这几句。"],
        next: ["分镜脚本", "标题封面", "选题策划"],
      },
      {
        name: "标题封面",
        href: "/dashboard/title",
        what: "一次给出多个标题方案做对比，并附封面上的大字建议。",
        steps: [
          "脚本或创作参考：粘贴脚本；从其他板块跳转过来的会自动带入。",
          "基础信息：主题、目标人群。",
          "标题风格：按需要选。",
          "点生成，挑一个标题，看封面大字建议（4～6 个字，和标题互补，不重复标题）。",
        ],
        get: "多个标题方案和封面大字建议，可以复制。",
        next: ["脚本生成（需要改开头时）", "审稿优化"],
      },
    ],
  },
  {
    group: "账号运营",
    intro: "这一组是账号的地基和打法。前面几步做好，后面每个板块都更准。",
    boards: [
      {
        name: "前采建档",
        href: "/dashboard/interview",
        what: "把前采记录（问答、和客户的聊天、录音转写）整理成账号档案。",
        steps: [
          "把文字粘贴进来，或上传 .docx、.txt 文件（10MB 以内）。录音先用飞书妙记、讯飞听见等转成文字，再贴进来。",
          "点提取，大约一分钟。提取时可以先去别的页面，结果会存进历史记录，回来接着看。",
          "逐项核对：每一项都标着原文依据。有疑问的看一眼，按建议改、确认没问题、或者不填。",
          "有疑问的没核对完，不能写入档案。发现哪里不对，可以直接跟 AI 说，它改完再合进来。",
          "选择写入新档案或已有档案，写入后会直接引导你去做账号定位。",
        ],
        fill: ["手机号、身份证号不会进档案。"],
        get: "写入档案的信息，以及保存好的前采原文和要点。",
        next: ["账号定位"],
      },
      {
        name: "个人档案",
        href: "/dashboard/profiles",
        what: "账号的全部资料，全站共用。改一次，各板块都会带上。",
        steps: [
          "6 块：账号基础、目标受众（含目标人群的兴趣）、内容定位、竞争策略、资源配置、变现路径。",
          "每一项直接填。不确定的留空，比乱填好。",
          "改了档案，之后新生成的结果会用新的资料；已经生成的结果不会变。",
          "页面下面是「我的创作偏好」：系统从你改稿、收藏、已拍已发的内容里，学到你的表达习惯。「生效」的会自动带进写稿类板块；「观察中」的还不生效。不想要的点「不要学这条」。",
        ],
        get: "一份完整的账号档案，和你的创作偏好卡。",
        next: ["账号定位"],
      },
      {
        name: "账号定位",
        href: "/dashboard/positioning",
        what: "基于档案生成一份可执行的定位方案：这个号是什么、给谁看、凭什么让人信。",
        steps: [
          "先确认档案里的关键信息是对的，缺的先去个人档案补。",
          "补充信息：希望突出什么、不想做什么。",
          "点生成。历史定位里能打开以前的版本对比。",
        ],
        get: "定位方案。",
        next: ["创作简报（推荐）", "内容定位（需要时）", "选题策划"],
      },
      {
        name: "商业定位",
        href: "/dashboard/business-positioning",
        what: "把「靠什么赚钱」拆到能执行：卖什么、卖多少钱、客人从刷到视频到付钱要走哪几步、凭什么信你。",
        steps: ["确认档案里的产品和价格，点生成，按出来的路径看每一步。"],
        get: "卖什么、价格区间、成交路径、信任依据。",
        next: ["成交理由", "选题策划"],
      },
      {
        name: "内容定位",
        href: "/dashboard/content-positioning",
        what: "把「长期发什么」排成结构：内容类型怎么配比、做哪几个能持续的系列、前 30 条按什么节奏走。",
        steps: ["确认账号定位，点生成，按系列和节奏去做选题。"],
        get: "内容类型配比、系列清单、前 30 条的节奏。",
        next: ["选题策划", "起号"],
      },
      {
        name: "创作简报",
        href: "/dashboard/creative-brief",
        what: "把定位翻成各板块能直接用的写作指令：怎么写、口吻怎样、重点是什么。",
        steps: [
          "补充这阵子的重点，例如「这阵子主攻餐饮客户、口吻再放松一点」。",
          "点生成。页面也允许自己写，写完保存即可。",
        ],
        fill: ["简报是写法上的指令，不是事实。事实（价格、年限、店名）以档案为准。"],
        get: "一段写作指令，选题、脚本等板块会照它写。",
        next: ["选题策划", "脚本生成"],
      },
      {
        name: "行业建议",
        href: "/dashboard/industry-advice",
        what: "按你的行业和目标，给一套打法。",
        steps: [
          "填现状：例如「发了 12 条，最好的一条 3000 播放，非关注播放占比低，来咨询的基本是老客户转介绍」。",
          "填目标：例如「两个月内非关注播放破 1 万，主页访问稳定在每天 50 次以上」。",
          "点生成，看打法；满意就存好。",
        ],
        get: "一套按阶段排好的打法。存好以后，各创作板块都照它执行。",
        next: ["创作方向", "内容规划"],
      },
      {
        name: "起号",
        href: "/dashboard/growth",
        what: "新号前几条怎么拍、前三秒怎么说。有两个标签：起号方案、开篇钩子。",
        steps: [
          "起号方案：填老板是否愿意出镜、能拍的时间（例如「这阵子只有周末能拍」），点生成，得到前几条的拍法。",
          "开篇钩子：从选题带过来的会自动填入；也可以写一个问题（例如「为什么我们家 60 多的自助敢用鲜切牛肉」）；或者贴现有的开头，让它指出问题在哪、给替代开头。",
          "每种开法各给一条，挑一条带走。挑中的开头会自动带进脚本。",
        ],
        get: "前几条的拍法，或一组可以选的开头。",
        next: ["脚本生成", "审稿优化"],
      },
      {
        name: "成交理由",
        href: "/dashboard/deal-reason",
        what: "AI 判断 17 个成交理由哪些适用于你，按账号分别保存，并同步进档案。",
        steps: [
          "店铺信息：店名、卖点（一行一条）、目标客群（例如「周边 3 公里上班族」）。",
          "选择要用的成交理由，勾选即可。",
          "点分析，看每条为什么适用或不适用，保存。",
        ],
        get: "保存好的成交理由。之后脚本生成会自动带上。",
        next: ["脚本生成", "选题策划"],
      },
    ],
  },
  {
    group: "助手与资料",
    boards: [
      {
        name: "自由对话",
        href: "/dashboard/free-chat",
        what: "什么都能问：查资料、读图片和文档、出方案，会员还能做深度研究。",
        steps: [
          "直接输入问题。Enter 发送，Shift+Enter 换行。",
          "联网模式（输入框旁边）：「按需联网」只在要查资料、问新闻时自动搜，每次扣 1 次联网额度；「本轮联网」这一轮一定搜，扣 1 次；「关闭联网」就只凭已有内容回答。问新闻、价格、政策这类时效性强的，选「本轮联网」更稳。",
          "上传图片或文档：一次最多 6 个，每个 10MB 以内，让它一起分析。",
          "出方案：先给大纲，你确认后写完整方案，可以下载 Word 或 PDF。",
          "深度研究（专业会员、高频会员）：它会上网读几十个网页，整理成带出处的报告。这是单独计次的。",
        ],
        get: "回答，可以接着问、接着改。对话和附件保存在云端，下次打开还在。",
        next: ["审稿优化", "脚本生成", "选题策划"],
      },
      {
        name: "知识库",
        href: "/dashboard/knowledge",
        what: "查编导的专业知识和方法，来自五个专题库。",
        steps: [
          "在「提问」里写问题，例如「如何设计开头的强冲突？」。",
          "「缩小范围」里可以选专题，结果会更准。",
          "「常见问题」里是大家常问的，先看看有没有你要的。",
        ],
        get: "带来源的知识回答。",
        next: ["选题策划", "脚本生成"],
      },
    ],
  },
  {
    group: "账户",
    boards: [
      {
        name: "我的账户",
        href: "/dashboard/account",
        what: "看会员状态、我的订单、修改密码，或注销账号。",
        steps: [
          "会员状态里有到期时间和剩余天数。",
          "我的订单里能看到付款后的审核状态。",
          "修改密码：如果当前密码是客服重置过的，就填临时密码。",
          "注销账号会删除档案、作品、历史、对话、素材库、订单记录和上传的文件，无法恢复，已开通的会员也不退款。确认前请三思。",
        ],
        get: "账号的状态和操作。",
        next: ["会员中心"],
      },
      {
        name: "会员中心",
        href: "/dashboard/membership",
        what: "看套餐、看额度、开通或续费。",
        steps: [
          "选套餐，用支付宝或微信扫码付款。",
          "付完在页面上传付款截图，我们核对后开通。开通不是即时到账，请耐心等待。",
          "开通后在「我的账户」里能看到到期时间。",
          "有问题加客服微信，说清楚是哪一步。",
        ],
        fill: ["虚拟商品开通后不支持无理由退款。购买前有疑问，先问清楚再买。"],
        get: "会员生效，额度回满。",
        next: ["我的账户"],
      },
      {
        name: "使用说明",
        href: "/dashboard/help",
        what: "就是这一页。",
        steps: ["忘了某个板块怎么用，就在这里找它的名字，按步骤来。"],
        get: "—",
        next: [],
      },
    ],
  },
];

/** 常见场景：从哪一步开始、按什么顺序走 */
const SCENARIOS: { title: string; route: string[]; note: string }[] = [
  {
    title: "新号，从零开始",
    route: ["个人档案或前采建档", "账号定位", "创作简报", "内容规划", "创作方向", "选题策划", "起号（开篇钩子）", "脚本生成", "审稿优化", "分镜脚本", "标题封面", "创作进度"],
    note: "按顺序做一遍。地基做完，后面每一步才有依据。",
  },
  {
    title: "看到一条爆款，想学它的结构",
    route: ["拆解爆款", "跨行业二创", "审稿优化", "分镜脚本", "标题封面"],
    note: "拆解报告里选中一个变现方向，整份带去跨行业二创。审稿时在「个人要求」里写上你的硬要求。",
  },
  {
    title: "门店有活动（店庆、上新）要拍一条",
    route: ["内容规划（填这个月的重点）", "创作方向（目的选引流到店一类）", "选题策划", "脚本生成（填活动信息）", "审稿优化", "分镜脚本"],
    note: "活动的价格、时间要写真实的。资料里没有的，留【待确认】，别让系统替你编。",
  },
  {
    title: "手里已经有一版稿子",
    route: ["审稿优化（贴稿子，写个人要求）", "看「这几处请核对」，逐条确认", "分镜脚本", "标题封面"],
    note: "直接从审稿开始，不用重新做选题。改完的稿子可以在结果上直接改，改的版本会保存。",
  },
  {
    title: "只想改开头或起标题",
    route: ["起号（开篇钩子，贴现有开头）", "标题封面"],
    note: "开篇钩子可以诊断现有开头，给替代开头；挑中的开头会自动带进后面的标题。",
  },
  {
    title: "想查一件事，或者不知道做什么",
    route: ["自由对话（选「本轮联网」查最新信息）", "知识库（查编导方法）"],
    note: "需要的东西找到了，再带去选题或脚本。",
  },
];

/** 额度（数字与 lib/config/plans 一致；测试会核对） */
const QUOTA = [
  { plan: "免费版", price: "0 元", each: "每个板块 5 次（自由对话、知识库各 10 次；前采建档、拆解爆款、跨行业二创各 3 次）", web: "3 次，一次性体验，用完不重置", deep: "不提供" },
  { plan: "基础会员", price: "49 元/月", each: "每个功能 50 次/月", web: "20 次/月", deep: "不提供" },
  { plan: "专业会员", price: "99 元/月", each: "每个功能 120 次/月", web: "60 次/月", deep: "10 份/月" },
  { plan: "高频会员", price: "199 元/月", each: "每个功能 300 次/月", web: "150 次/月", deep: "30 份/月" },
];

const QUOTA_NOTES = [
  "一次生成扣 1 次对应板块的额度。没生成出来（失败、中断）不扣。同一次生成不会重复扣。",
  "带去下一步本身不扣次数。到了新板块点生成，才扣那个板块的额度。",
  "账号定位、商业定位、内容定位、创作简报共用「定位」额度；脚本生成、起号（起号方案、开篇钩子）共用「脚本」额度。",
  "知识库单独计次：免费 10 次，基础 100 次/月，专业 300 次/月，高频 600 次/月。",
  "联网搜索（自由对话里的联网）和深度研究各自单独计次，不占创作额度。",
  "会员按月计费，每期一个月。当期没用完的次数到期清零，不累计到下一期；续费开新一期，额度回满。免费版是一次性体验额度，不按月重置。",
];

/** 常见问题：只讲用户看得见的 */
const FAQ: { q: string; a: string }[] = [
  {
    q: "我该从哪一步开始？",
    a: "第一次用，就照「第一次用：照着做」从个人档案做起。已经有稿子，直接去审稿优化。只想找灵感，先去拆解爆款或知识库。",
  },
  {
    q: "以前生成的结果在哪里找？",
    a: "每个板块页面里都有「历史记录」折叠区，点开能找回以前的结果。创作进度里能看到每条内容做到哪一步；收藏过的在素材库；自由对话的记录在对话列表里。",
  },
  {
    q: "结果不满意，怎么改？",
    a: "三种办法：一是在结果上「继续对话」，说清哪里要改（有这个按钮的板块）；二是在「个人要求」或「补充说明」里写清楚，再点生成；三是换一个方向、目的或选题重新来。注意：重新生成会再扣一次额度。",
  },
  {
    q: "点了生成，一直转圈怎么办？",
    a: "一般一分钟左右出结果；拆解一条视频要几分钟。转圈时不要刷新页面，可以去别的页面，结果生成好会存进历史记录。过了很久还没有，先去历史记录看一下是不是已经有了，没有再重新点一次。",
  },
  {
    q: "提示「额度已用完」怎么办？",
    a: "看「会员中心」里的额度表。免费版是一次性体验额度，用完不重置；会员按期清零，续费开新一期。",
  },
  {
    q: "结果里「这几处请核对」是什么意思？",
    a: "这几处是资料里找不到出处的价格、百分比、顾客见证、承诺或地名。系统不判断真假，只提醒你核对：确认有依据就保留，没有就删掉或改成【待确认】。",
  },
  {
    q: "结果里「有 N 处可能踩禁忌」怎么办？",
    a: "系统按平台红线和你所在行业的禁忌词扫了一遍，列出可能违规的说法，发布前改掉。能继续对话的板块，点「让 AI 改掉」直接修改；其他板块点「复制修改要求」，粘贴给 AI 即可。",
  },
  {
    q: "稿子里的【待确认】【换成你的真实……】是什么？",
    a: "这是系统故意留给你填的空。资料里没有的数字、经历、价格，系统不会替你编。把真实情况填进去再用。",
  },
  {
    q: "脚本的时长怎么定？",
    a: "默认「AI 推荐」，写到 1 分 30 秒～1 分 40 秒，口播约 450～500 字。要别的长度，就在脚本生成的基础设置里手动选秒数，系统会按你选的时长写。",
  },
  {
    q: "拆解爆款时，视频上传失败或者太大？",
    a: "只收 mp4，100MB 以内。超过 3 分钟只拆前 3 分钟。上传时别关页面。也可以切到文字模式，只贴文案来分析。",
  },
  {
    q: "提示网络错误（比如 Failed to fetch）？",
    a: "先点提示里的重试。多次失败就换个网络再试，网络不稳定时，大段文字和文件最容易断。",
  },
  {
    q: "我改了档案，结果怎么没变？",
    a: "已经生成的结果不会变。改完档案后，重新生成的结果才会用新资料。",
  },
  {
    q: "前采建档的结果不对，怎么改？",
    a: "在逐项核对的时候，直接跟 AI 说哪里不对，它改完再合进来。也可以写入之后，到个人档案里直接改。",
  },
  {
    q: "自由对话的「联网」怎么选？",
    a: "按需联网：只在要查资料、问新闻时自动搜，每次扣 1 次联网额度。本轮联网：这一轮一定搜，扣 1 次。关闭联网：只凭已有内容回答。问最新的新闻、价格、政策，选「本轮联网」。",
  },
  {
    q: "手机上怎么用？",
    a: "左上角的 ☰ 按钮打开菜单。结果在表单下面，生成后会自动滚到结果区。",
  },
  {
    q: "退出登录后，再打开首页要重新进门？",
    a: "是的。退出会让这台电脑的首页通行失效，需要重新凭邀请链接或门票码进门。共用电脑的话，用完记得退出。",
  },
  {
    q: "忘记密码怎么办？",
    a: `目前没有自助找回功能，加客服微信 ${SUPPORT_WECHAT}，核实身份后会重置密码。`,
  },
];

const SECTIONS = [
  { id: "first-run", label: "第一次用" },
  { id: "lanes", label: "板块怎么配合" },
  { id: "handoff", label: "结果怎么带去下一步" },
  { id: "guide", label: "每个板块怎么用" },
  { id: "scenarios", label: "常见场景" },
  { id: "quota", label: "额度与会员" },
  { id: "faq", label: "常见问题" },
];

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8 lg:py-7">
      <PageHeader title="使用说明" subtitle="每个板块怎么点、填什么、出来什么，下一步去哪个板块。照着做一遍，就能把开物用顺。" />

      <nav aria-label="本页目录" className="glass-panel mb-5 flex flex-wrap gap-2 rounded-2xl p-4">
        {SECTIONS.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="rounded-full border border-border/70 px-3 py-1 text-[12.5px] text-muted-foreground hover:text-foreground">
            {s.label}
          </a>
        ))}
      </nav>

      <section id="first-run" className="glass-panel scroll-mt-20 mb-5 rounded-2xl p-5">
        <h2 className="text-[17px] font-semibold text-foreground">第一次用：照着做</h2>
        <p className="mb-4 mt-1 text-[12.5px] text-muted-foreground">
          这十步是一个新号从头到尾的顺序。已经做过的跳过就行；每一步都写了点哪里、填什么、会得到什么、下一步去哪。
        </p>
        <ol className="space-y-4">
          {FIRST_RUN.map((s, i) => (
            <li key={s.title} className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[12.5px] font-semibold text-primary">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[14.5px] font-medium text-foreground">{s.title}</p>
                <dl className="mt-1.5 space-y-1 text-[13px] leading-relaxed text-muted-foreground">
                  <div><dt className="inline font-medium text-foreground/80">在哪：</dt> <dd className="inline">{s.where}</dd></div>
                  <div><dt className="inline font-medium text-foreground/80">填什么：</dt> <dd className="inline">{s.fill}</dd></div>
                  <div><dt className="inline font-medium text-foreground/80">得到：</dt> <dd className="inline">{s.get}</dd></div>
                  <div><dt className="inline font-medium text-foreground/80">下一步：</dt> <dd className="inline">{s.next}</dd></div>
                </dl>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section id="lanes" className="glass-panel scroll-mt-20 mb-5 rounded-2xl p-5">
        <h2 className="text-[17px] font-semibold text-foreground">板块怎么配合</h2>
        <p className="mb-4 mt-1 text-[12.5px] text-muted-foreground">
          板块分五条线，每条线里的顺序就是推荐的用法。箭头后面的板块，前面的结果会带过去。跨线也可以：比如拆解完的报告直接去二创，不必先回到地基。
        </p>
        <div className="space-y-4">
          {LANES.map((lane) => (
            <div key={lane.title} className="rounded-xl border border-border/60 p-4">
              <p className="text-[14px] font-semibold text-foreground">{lane.title}</p>
              <p className="mt-0.5 text-[12.5px] text-muted-foreground">什么时候用：{lane.when}</p>
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                {lane.flow.map((name, i) => (
                  <span key={name} className="flex items-center gap-1.5">
                    <span className="rounded-lg bg-foreground/[0.06] px-2.5 py-1 text-[12.5px] text-foreground">{name}</span>
                    {i < lane.flow.length - 1 && <span className="text-[12px] text-muted-foreground">→</span>}
                  </span>
                ))}
              </div>
              <p className="mt-2.5 text-[13px] leading-relaxed text-muted-foreground">{lane.note}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="handoff" className="glass-panel scroll-mt-20 mb-5 rounded-2xl p-5">
        <h2 className="text-[17px] font-semibold text-foreground">结果怎么带去下一步</h2>
        <p className="mb-4 mt-1 text-[12.5px] text-muted-foreground">
          板块之间不用复制粘贴。下面是结果页上每个按钮的用法。
        </p>
        <div className="space-y-4">
          {HANDOFF.map((h) => (
            <div key={h.title}>
              <p className="text-[14px] font-medium text-foreground">{h.title}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{h.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="guide" className="glass-panel scroll-mt-20 mb-5 rounded-2xl p-5">
        <h2 className="text-[17px] font-semibold text-foreground">每个板块怎么用</h2>
        <p className="mb-4 mt-1 text-[12.5px] text-muted-foreground">
          点板块名展开。每个板块都写了：怎么用（按顺序点）、填什么、得到什么、接下来去哪。侧栏的顺序和这里一致。
        </p>
        <div className="space-y-6">
          {GUIDE.map((g) => (
            <div key={g.group}>
              <p className="text-[12px] font-medium uppercase tracking-wider text-muted-foreground/80">{g.group}</p>
              {g.intro && <p className="mt-1 text-[12.5px] text-muted-foreground">{g.intro}</p>}
              <div className="mt-2 space-y-2">
                {g.boards.map((b) => (
                  <details key={b.name} className="group rounded-xl border border-border/60 open:bg-foreground/[0.02]">
                    <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3">
                      <span className="text-[14.5px] font-medium text-foreground">{b.name}</span>
                      <span className="min-w-0 flex-1 truncate text-[12.5px] text-muted-foreground">{b.what}</span>
                      <span className="shrink-0 text-[12px] text-muted-foreground transition-transform group-open:rotate-90">›</span>
                    </summary>
                    <div className="space-y-3 border-t border-border/60 px-4 pb-4 pt-3 text-[13px] leading-relaxed">
                      <p className="text-muted-foreground">{b.what}</p>
                      <div>
                        <p className="mb-1 font-medium text-foreground/85">怎么用</p>
                        <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
                          {b.steps.map((s) => (
                            <li key={s}>{s}</li>
                          ))}
                        </ol>
                      </div>
                      {b.fill && (
                        <div>
                          <p className="mb-1 font-medium text-foreground/85">注意</p>
                          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                            {b.fill.map((f) => (
                              <li key={f}>{f}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <p className="text-muted-foreground">
                        <span className="font-medium text-foreground/85">得到：</span>
                        {b.get}
                      </p>
                      {b.next.length > 0 && (
                        <p className="text-muted-foreground">
                          <span className="font-medium text-foreground/85">接下来：</span>
                          {b.next.join("、")}
                        </p>
                      )}
                      <a href={b.href} className="inline-flex text-[12.5px] font-medium text-primary underline underline-offset-4">
                        打开「{b.name}」
                      </a>
                    </div>
                  </details>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="scenarios" className="glass-panel scroll-mt-20 mb-5 rounded-2xl p-5">
        <h2 className="text-[17px] font-semibold text-foreground">常见场景怎么走</h2>
        <p className="mb-4 mt-1 text-[12.5px] text-muted-foreground">不知道从哪里开始，就找和你眼下情况最接近的一条，照箭头走。</p>
        <div className="space-y-4">
          {SCENARIOS.map((s) => (
            <div key={s.title} className="rounded-xl border border-border/60 p-4">
              <p className="text-[14px] font-semibold text-foreground">{s.title}</p>
              <ol className="mt-2 space-y-1 text-[13px] text-muted-foreground">
                {s.route.map((r, i) => (
                  <li key={r} className="flex gap-2">
                    <span className="shrink-0 text-foreground/60">{i + 1}.</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-2.5 text-[12.5px] leading-relaxed text-muted-foreground">{s.note}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="quota" className="glass-panel scroll-mt-20 mb-5 rounded-2xl p-5">
        <h2 className="mb-1 text-[17px] font-semibold text-foreground">额度与会员</h2>
        <p className="mb-4 text-[12.5px] text-muted-foreground">
          下面的数字是每个板块的上限。开通与续费在「会员中心」。
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
        <ul className="mt-4 list-disc space-y-1.5 pl-5 text-[13px] leading-relaxed text-muted-foreground">
          {QUOTA_NOTES.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </section>

      <section id="faq" className="glass-panel scroll-mt-20 mb-5 rounded-2xl p-5">
        <h2 className="mb-4 text-[17px] font-semibold text-foreground">常见问题</h2>
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
        <h2 className="mb-2 text-[17px] font-semibold text-foreground">还有问题</h2>
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          加客服微信 <span className="select-all font-medium text-foreground">{SUPPORT_WECHAT}</span>，说清楚你在哪个板块、点了哪个按钮、看到了什么提示，最好附一张截图，方便更快定位。
        </p>
      </section>
    </div>
  );
}
