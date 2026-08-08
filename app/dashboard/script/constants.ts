// 脚本工作台的静态配置数据（从 page.tsx 抽离）

// 脚本类型配置
export const SCRIPT_TYPES = {
  teach: { label: "教知识", desc: "教学类内容，传授技能和知识" },
  show: { label: "晒过程", desc: "展示类内容，分享经历和成果" },
  discuss: { label: "聊话题", desc: "观点类内容，表达看法和思考" },
  story: { label: "讲故事", desc: "故事类内容，讲述经历和案例" },
  ad_lead: { label: "留资获客", desc: "收集线索、加微信、留电话" },
  ad_group: { label: "团购促销", desc: "美团/抖音团购、限时优惠" },
  ad_offline: { label: "线下引流", desc: "到店核销、实体店导流" },
  ad_product: { label: "产品种草", desc: "产品推广、功能展示" },
};

export const PLATFORMS = ["抖音", "小红书", "视频号", "B站", "快手"];
export const DURATIONS = ["15秒", "30秒", "60秒", "90秒", "3-5分钟"];

// 内容创作类行业
export const CONTENT_INDUSTRIES = [
  "自媒体运营", "知识分享", "职场技能", "副业赚钱",
  "摄影摄像", "剪辑后期", "写作文案", "设计美工",
  "情感心理", "亲子育儿", "家庭教育", "学习方法",
  "读书分享", "电影解说", "音乐舞蹈", "美食烹饪",
  "旅行探店", "时尚穿搭", "美妆护肤", "健身运动",
  "数码科技", "游戏电竞", "宠物养护", "生活技巧",
];

// 广告引流类行业
export const AD_INDUSTRIES = [
  "餐饮-火锅", "餐饮-烧烤", "餐饮-小吃", "餐饮-奶茶", "餐饮-咖啡", 
  "餐饮-西餐", "餐饮-中餐", "餐饮-快餐", "餐饮-甜品",
  "美业-美容", "美业-美发", "美业-美甲", "美业-皮肤管理", "美业-医美", "美业-SPA",
  "零售-服装", "零售-鞋包", "零售-数码", "零售-家居", "零售-母婴", "零售-生鲜",
  "服务-教育培训", "服务-家政保洁", "服务-维修安装", "服务-摄影拍照",
  "娱乐-酒吧", "娱乐-KTV", "娱乐-影院", "娱乐-剧本杀", "娱乐-桌游", "娱乐-健身房",
  "住宿-酒店", "住宿-民宿", "住宿-公寓",
  "汽车-洗车", "汽车-美容", "汽车-维修", "汽车-保养",
];

export const DEAL_REASONS = [
  { id: "price", label: "💰 价格优势", desc: "性价比高、活动优惠" },
  { id: "quality", label: "⭐ 品质保证", desc: "材料好、做工精细" },
  { id: "unique", label: "🎯 独家特色", desc: "独一无二的卖点" },
  { id: "expert", label: "👨‍⚕️ 专业技术", desc: "专业团队、多年经验" },
  { id: "service", label: "🤝 服务贴心", desc: "售后完善、响应快" },
  { id: "trust", label: "💯 信誉保障", desc: "口碑好、老品牌" },
  { id: "convenient", label: "⚡ 便捷省心", desc: "位置好、流程简单" },
  { id: "result", label: "🎁 效果明显", desc: "立竿见影、可验证" },
  { id: "safe", label: "🛡️ 安全放心", desc: "资质全、有保险" },
  { id: "time", label: "⏰ 节省时间", desc: "快速高效、不耽误" },
  { id: "custom", label: "🎨 定制化", desc: "量身定做、个性化" },
  { id: "gift", label: "🎉 赠品福利", desc: "买就送、额外价值" },
  { id: "guarantee", label: "✅ 效果保证", desc: "不满意退款" },
  { id: "scarcity", label: "🔥 稀缺性", desc: "限量限时、机会难得" },
  { id: "social", label: "👥 社交认同", desc: "大家都在用、网红推荐" },
];

// 扩充的内容风格（15种）
export const STYLES = [
  "专业", "幽默", "犀利", "温暖", "励志", "治愈",
  "反转", "悬疑", "干货", "搞笑", "走心", "高冷",
  "亲切", "激情", "文艺"
];

// 扩充的目标人群（50+种）
export const TARGET_GROUPS = [
  // 按年龄
  "00后学生", "95后职场新人", "90后职场人", "85后管理层", "80后中产", "70后企业主", "银发族",
  // 按职业
  "大学生", "研究生", "白领", "金领", "创业者", "小老板", "自由职业者", "全职宝妈", "职场宝妈",
  // 按收入
  "月入3k以下", "月入3-8k", "月入8k-2w", "月入2w-5w", "月入5w+",
  // 按兴趣
  "美食爱好者", "旅行达人", "健身狂", "宠物主", "摄影师", "游戏玩家", "二次元",
  // 按身份
  "准妈妈", "新手妈妈", "二胎妈妈", "考研党", "考公党", "求职者", "技能学习者",
  // 按需求
  "自媒体人", "内容创作者", "知识博主", "副业探索者", "转行者", "斜杠青年",
  "生活方式追求者", "精致女性", "都市白领",
  "下沉市场用户", "银发族", "Z世代",
  "宠物主", "健身爱好者", "美食爱好者", "旅行爱好者"
];

// 八大爆款元素
export const BOOM_ELEMENTS = [
  { id: "cost", label: "💰 成本", desc: "价格预算相关话题" },
  { id: "crowd", label: "👥 人群", desc: "特定群体痛点" },
  { id: "celebrity", label: "⭐ 头牌", desc: "名人IP背书" },
  { id: "weird", label: "🤪 奇葩", desc: "反常识观点" },
  { id: "worst", label: "💩 最差", desc: "踩坑避雷经验" },
  { id: "contrast", label: "⚡ 反差", desc: "强烈对比冲突" },
  { id: "nostalgia", label: "📼 怀旧", desc: "回忆共鸣点" },
  { id: "hormone", label: "💕 荷尔蒙", desc: "情感情绪共鸣" },
];

// 开场钩子类型
export const HOOK_TYPES = [
  { id: "auto", label: "🤖 AI推荐", desc: "智能匹配最佳钩子" },
  { id: "money", label: "💰 金钱型", desc: "涉及利益得失" },
  { id: "mystery", label: "🎁 盲盒型", desc: "制造悬念好奇" },
  { id: "conflict", label: "⚔️ 对抗型", desc: "反常识挑战" },
  { id: "verify", label: "🔍 验证型", desc: "揭秘解密真相" },
  { id: "warm", label: "🌟 温暖型", desc: "送温暖建议" },
  { id: "emotion", label: "💗 共鸣型", desc: "情感情绪共振" },
];

// 脚本结构类型（20种）
export const SCRIPT_STRUCTURES = [
  { id: "auto", label: "🎯 AI推荐", desc: "根据内容智能选择" },
  { id: "problem", label: "📌 解题型", desc: "难题→危机→解决→步骤" },
  { id: "recommend", label: "👍 推荐型", desc: "愿景→人群→好奇→理由" },
  { id: "expose", label: "🔓 揭秘型", desc: "反常识→内幕→示范" },
  { id: "case", label: "📖 案例型", desc: "案例→拆解→复制" },
  { id: "train", label: "🚂 火车节", desc: "目标→过程→结果" },
  { id: "argue", label: "💬 论证型", desc: "观点→论据→升华" },
  { id: "story", label: "📚 故事型", desc: "现状→困境→转折→成就" },
  { id: "compare", label: "⚖️ 对比型", desc: "A vs B对比" },
  { id: "list", label: "📝 清单型", desc: "N个方法/技巧" },
  { id: "timeline", label: "⏰ 时间线型", desc: "前后变化" },
  { id: "qa", label: "❓ 问答型", desc: "Q&A解答" },
  { id: "scene", label: "🎬 情景剧型", desc: "情景再现" },
  { id: "review", label: "🔍 测评型", desc: "测试→结果" },
  { id: "challenge", label: "💪 挑战型", desc: "挑战打卡" },
  { id: "tutorial", label: "📐 教程型", desc: "步骤1→2→3" },
  { id: "reverse", label: "🔄 反转型", desc: "预期A→实际B" },
  { id: "summary", label: "📊 盘点型", desc: "年度盘点" },
  { id: "interview", label: "🎤 采访型", desc: "人物访谈" },
  { id: "observe", label: "🔬 观察型", desc: "观察→分析" },
];

// 编导思路
export const DIRECTOR_THOUGHTS = [
  { id: "emotion", label: "情绪波点设计", desc: "2-3个情绪高潮" },
  { id: "picture", label: "画面感描述", desc: "细节+动作+类比" },
  { id: "rhythm", label: "节奏控制", desc: "张弛有度不平铺" },
  { id: "ending", label: "金句结尾", desc: "≤20字可转发" },
];

export const SCENES = ["室内", "室外", "办公室", "咖啡厅", "街头", "家中"];
export const DEVICES = ["手机", "相机", "专业设备"];
export const BUDGETS = ["低成本(0-500)", "中等(500-2000)", "不限"];
