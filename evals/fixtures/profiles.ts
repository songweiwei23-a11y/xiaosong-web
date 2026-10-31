/**
 * 测评档案（2026-11-01，整改方案阶段 0.1）：12 个行业 × 3 种档案形态 = 36 份。全部虚构，不是真实客户。
 *
 * 三种形态：
 *   full       完整档案（人设事实卡、访谈要点、卖点都有）
 *   sparse     稀疏档案（只有名字、平台、赛道、主卖什么、地区）——新用户刚建档的样子
 *   ambiguous  有歧义的档案（出镜人身份不清、品类多）——最容易让模型自己补设定
 *
 * 诱饵（decoys）：不该出现在这个档案输出里的词 = 其他行业的标志性词 + 知识库里已知的具体示例。
 * 输出里出现诱饵，就是串味；比「新出现的具体细节」更直接。
 */

export type ProfileShape = 'full' | 'sparse' | 'ambiguous';

export interface EvalIndustry {
  code: string;
  name: string;
  shape: ProfileShape;
  profile: Record<string, unknown>;
  store: { name: string; type: string; features: string; customer: string };
  viralSample: string;
  benchmarkSample: string;
  interviewNotes: string;
  /** 分镜的内容类型：food / vlog / tutorial / product / story / interview */
  storyboardType: string;
  topicPreset: string;
  /** 这个行业的标志性词：出现在别的行业的稿子里，就是串味 */
  terms: string[];
  decoys: string[];
}

type Base = Omit<EvalIndustry, 'shape' | 'decoys'>;

/** 知识库里已知会被召回的具体示例（见整改方案 Q3） */
const KB_DECOYS = ['凌晨四点我来到市场', '凌晨四点', '棚子'];

const BASES: Base[] = [
  {
    code: 'A', name: '川味餐饮（地摊串串）',
    profile: {
      profile_name: '锦园地摊串串一元火锅', account_platform: ['抖音'], account_track: ['美食烹饪', '本地服务'], account_stage: '起号期', fans_level: '0-1000',
      target_age: ['25-35岁'], target_occupation: ['白领', '宝妈'], target_region: ['南乐本地'],
      product_category: ['川味串串火锅', '川味烧烤', '川菜'],
      persona_facts: { host: '成都来的川菜厨师', role: '本人（掌勺）', origin: '成都人', yearsInTrade: '做川菜9年', yearsLocal: '来南乐半年', mainProducts: '川味串串火锅、川味烧烤、川菜', signature: '一元火锅', others: '每天下午4点出摊' },
      interview_highlights: '出镜人是成都来的川菜厨师，做川菜9年，来南乐半年；一元火锅是门店核心卖点，低门槛引流',
      content_themes: '以川味串串火锅、川味烧烤、川菜三个品类为核心，晒食材准备过程，教知识，厨师经验分享',
      unique_selling_point: '正宗川味配方，一元火锅低门槛',
    },
    store: { name: '锦园地摊串串一元火锅', type: '地摊火锅串串', features: '一元火锅、现做现售川味烧烤、下午到深夜出摊', customer: '本地白领、带孩子下班的家庭' },
    storyboardType: 'food', topicPreset: '川菜最不能省的是炒前准备',
    viralSample: '凌晨五点的菜市场，老板拎着两筐牛肉往回走。他说这一摊的料要自己挑，挑不好整锅汤都是白熬。今天我带你看他怎么选，选完你就知道为什么他的汤能喝出来。',
    benchmarkSample: '某同城美食账号（虚构样本）：标题「这家店为什么排队」，视频拍摄后厨出餐过程，开头三秒是一碗汤冒热气，结尾引导关注。',
    interviewNotes: '问：您做川菜多少年了？答：九年，在成都做了好几家店。问：怎么想到来南乐？答：朋友在这边合伙摆地摊，我就过来帮忙。问：一元火锅为什么敢这么卖？答：料要真，量要足，客人吃了还会回来。问：您最在意的是哪一步？答：炒之前的准备，调料怎么下、油温怎么控，省了后面怎么炒都补不回来。问：有没有客人特别记得的事？答：有个老顾客每周都来，说就喜欢我们的汤底不咸。',
    terms: ['串串', '一元火锅', '川味烧烤'],
  },
  {
    code: 'B', name: '大码女装（店主本人出镜）',
    profile: {
      profile_name: '阿梅大码女装店', account_platform: ['抖音'], account_track: ['时尚穿搭', '本地服务'], account_stage: '起号期', fans_level: '0-1000', target_gender: '女',
      target_age: ['25-40岁'], target_occupation: ['宝妈', '上班族'], target_region: ['县城本地'],
      product_category: ['大码女装'],
      persona_facts: { host: '店主阿梅', role: '老板本人出镜', yearsInTrade: '做大码女装6年', yearsLocal: '在本地开店3年', mainProducts: '大码连衣裙、大码外套、大码裤装', signature: '50码以上可试穿', others: '门店在县城商业街，有试衣间' },
      interview_highlights: '店主做大码女装6年，店开了3年；很多大码女生在别的店买不到合身的衣服',
      content_themes: '穿搭教学、试衣过程、大码女生的穿衣烦恼',
      unique_selling_point: '50码以上有可试穿款',
    },
    store: { name: '阿梅大码女装店', type: '女装店', features: '50码以上可试穿，门店在县城商业街', customer: '县城大码女生、宝妈' },
    storyboardType: 'product', topicPreset: '大码女生怎么挑外套不显胖',
    viralSample: '很多大码姐妹进店第一句话就是「我穿不了」。今天我不推荐衣服，我先让你站到镜子前，看看哪一个剪裁其实是在帮你。站不对，买再贵也白搭。',
    benchmarkSample: '某同城穿搭账号（虚构样本）：标题「大码女生的外套选对了三个地方」，视频在试衣间拍摄，前三秒是镜子前的转身，结尾引导到店试穿。',
    interviewNotes: '问：您做大码女装多少年了？答：六年。问：为什么做大码？答：身边的姐妹总说买不到合身的，我就自己去进货。问：客人最常问什么？答：外套显不显胖，裤子长短合不合适。问：有没有印象深的客人？答：有个宝妈试了五件，最后选的那件她说站起来很舒服。问：您觉得最难的是什么？答：每个人身材不一样，只能一个一个看。',
    terms: ['大码女装', '50码'],
  },
  {
    code: 'C', name: '本地家具店（老板本人出镜）',
    profile: {
      profile_name: '县城木工家具店', account_platform: ['抖音'], account_track: ['家居家装', '本地服务'], account_stage: '起号期', fans_level: '0-1000',
      target_age: ['28-45岁'], target_occupation: ['新婚家庭', '换房的业主'], target_region: ['县城本地'],
      product_category: ['实木家具', '布艺沙发'],
      persona_facts: { host: '老板老周', role: '老板本人出镜', yearsInTrade: '做家具12年', yearsLocal: '本地人', mainProducts: '实木餐桌椅、布艺沙发', signature: '现场看木料', others: '门店在县城，自家有木工工坊' },
      interview_highlights: '老板做家具12年，自家有木工工坊；客人常问沙发怎么挑不踩坑',
      content_themes: '选家具的常识、木料辨认、工坊过程',
      unique_selling_point: '自家工坊，木料可现场看',
    },
    store: { name: '县城木工家具店', type: '家具店', features: '实木家具，自家工坊，木料现场看', customer: '新婚家庭、换房的业主' },
    storyboardType: 'product', topicPreset: '沙发怎么挑才不踩坑',
    viralSample: '买沙发最怕的不是贵，是买回家坐三个月就塌。我今天不卖沙发，我把一块木头拿到镜头前，你看纹路，我告诉你为什么这块木料撑得住。',
    benchmarkSample: '某同城家居账号（虚构样本）：标题「别再被沙发坑了」，视频在门店拍摄，前三秒是手掰沙发扶手，结尾引导到店。',
    interviewNotes: '问：您做家具多少年了？答：十二年，木工出身。问：客人最常问什么？答：沙发到底怎么挑，布艺还是皮的，坐久了会不会塌。问：您怎么回答？答：先看木架，木架不稳什么料子都白搭；坐垫的回弹要现场试。问：有没有印象深的事？答：有对年轻夫妻来看了三次，最后说就是因为能看到木料才放心买。问：您觉得做家具最讲究什么？答：料要干透，榫头要严，别偷工减料。',
    terms: ['布艺沙发', '木工工坊', '榫头'],
  },
  {
    code: 'D', name: '社区理发店（老板本人出镜）',
    profile: {
      profile_name: '阿杰剪发', account_platform: ['抖音'], account_track: ['美发造型', '本地服务'], account_stage: '起号期', fans_level: '0-1000',
      target_age: ['20-40岁'], target_occupation: ['上班族', '学生'], target_region: ['本小区及周边'],
      product_category: ['男士剪发', '女士染烫'],
      persona_facts: { host: '店主阿杰', role: '老板本人出镜', yearsInTrade: '剪发11年', yearsLocal: '本地人', mainProducts: '男士剪发、女士染烫', signature: '剪前先聊脸型', others: '店在小区门口，两张椅子' },
      interview_highlights: '店主剪发11年，坚持剪前先聊脸型和打理习惯；客人多是附近上班族',
      content_themes: '发型和脸型的关系、日常打理、染烫前要知道的事',
      unique_selling_point: '剪前先聊脸型，按打理习惯剪',
    },
    store: { name: '阿杰剪发', type: '理发店', features: '剪前先聊脸型，店在小区门口', customer: '附近上班族、学生' },
    storyboardType: 'tutorial', topicPreset: '圆脸男生剪什么发型显脸小',
    viralSample: '你每次进理发店都说「随便剪剪」，其实理发师最怕这四个字。今天我把剪之前我会问的三件事告诉你，下次你就知道该怎么说了。',
    benchmarkSample: '某同城美发账号（虚构样本）：标题「剪头发前一定要说清这句话」，视频在店里拍，前三秒是剪刀特写，结尾引导评论自己的脸型。',
    interviewNotes: '问：您剪发多少年了？答：十一年。问：为什么剪之前要聊那么久？答：每个人打理头发的时间不一样，早上只有五分钟的人就不能剪太讲究的。问：客人最常问什么？答：自己适合什么发型，染了会不会伤头发。问：有没有印象深的客人？答：有个小伙子要去面试，剪完说终于不像学生了。',
    terms: ['剪发', '染烫', '理发'],
  },
  {
    code: 'E', name: '小学数学辅导（老师本人出镜）',
    profile: {
      profile_name: '王老师数学小班', account_platform: ['抖音'], account_track: ['教育培训', '本地服务'], account_stage: '起号期', fans_level: '0-1000',
      target_age: ['30-45岁'], target_occupation: ['小学生家长'], target_region: ['市区'],
      product_category: ['小学数学小班课'],
      persona_facts: { host: '王老师', role: '老师本人出镜', yearsInTrade: '教小学数学8年', yearsLocal: '本地人', mainProducts: '三到六年级数学小班课', signature: '错题本复盘', others: '每班不超过6人' },
      interview_highlights: '王老师教小学数学8年，小班每班不超过6人；重视错题本复盘',
      content_themes: '应用题思路、家长辅导误区、错题本怎么用',
      unique_selling_point: '小班6人以内，错题本一对一复盘',
    },
    store: { name: '王老师数学小班', type: '小学数学辅导', features: '每班不超过6人，错题本复盘', customer: '三到六年级学生的家长' },
    storyboardType: 'tutorial', topicPreset: '孩子应用题总读不懂怎么办',
    viralSample: '孩子数学总丢分，家长第一反应是「粗心」。其实我看过的错题里，大部分不是粗心，是题目根本没读懂。今天我教你一个读题的办法，回家就能试。',
    benchmarkSample: '某同城教育账号（虚构样本）：标题「三年级是数学的分水岭」，视频在教室拍，前三秒是黑板上的一道题，结尾引导私信领资料。',
    interviewNotes: '问：您教数学多少年了？答：八年。问：为什么只做小班？答：人多了顾不过来，错题没法一个一个看。问：家长最常问什么？答：孩子总粗心怎么办，要不要提前学。问：有没有印象深的学生？答：有个孩子一开始很怕应用题，后来自己会画图了。',
    terms: ['应用题', '错题本'],
  },
  {
    code: 'F', name: '母婴用品店（店员出镜）',
    profile: {
      profile_name: '暖暖母婴生活馆', account_platform: ['抖音'], account_track: ['母婴育儿', '本地服务'], account_stage: '起号期', fans_level: '0-1000', target_gender: '女',
      target_age: ['22-35岁'], target_occupation: ['新手妈妈', '孕妇'], target_region: ['县城本地'],
      product_category: ['奶粉', '纸尿裤', '婴儿洗护'],
      persona_facts: { host: '店员小周', role: '店员出镜（老板不出镜）', yearsInTrade: '在店里做了4年', yearsLocal: '本地人', mainProducts: '奶粉、纸尿裤、婴儿洗护', signature: '新手妈妈可领试用装', others: '店在县医院对面' },
      interview_highlights: '店员小周在店里做了4年，常给新手妈妈讲纸尿裤和奶粉怎么选',
      content_themes: '新手妈妈选品常识、纸尿裤尺码、婴儿洗护',
      unique_selling_point: '新手妈妈可领试用装，店员懂选品',
    },
    store: { name: '暖暖母婴生活馆', type: '母婴用品店', features: '新手妈妈可领试用装，店在县医院对面', customer: '新手妈妈、孕妇' },
    storyboardType: 'product', topicPreset: '纸尿裤尺码怎么选不红屁屁',
    viralSample: '新手妈妈最容易买错的不是奶粉，是纸尿裤的尺码。宝宝大腿上一圈红印，很多人以为是过敏，其实是尺码小了。今天我教你看三个地方。',
    benchmarkSample: '某同城母婴账号（虚构样本）：标题「新手妈妈别再买错了」，视频在货架前拍，前三秒是两包纸尿裤对比，结尾引导到店领试用。',
    interviewNotes: '问：您在店里做了多久？答：四年。问：新手妈妈最常问什么？答：纸尿裤选哪个牌子，奶粉要不要换。问：您一般怎么建议？答：先看宝宝体重和腿围，不要只看月龄。问：有没有印象深的客人？答：有个妈妈连着换了三个牌子，后来发现是尺码的问题。',
    terms: ['纸尿裤', '奶粉'],
  },
  {
    code: 'G', name: '装修设计工作室（设计师本人出镜）',
    profile: {
      profile_name: '林姐装修设计', account_platform: ['抖音'], account_track: ['家居家装', '本地服务'], account_stage: '起号期', fans_level: '0-1000',
      target_age: ['28-45岁'], target_occupation: ['刚买房的业主', '老房翻新的家庭'], target_region: ['市区'],
      product_category: ['老房翻新', '小户型设计'],
      persona_facts: { host: '设计师林姐', role: '设计师本人出镜', yearsInTrade: '做室内设计7年', yearsLocal: '本地人', mainProducts: '老房翻新、小户型设计', signature: '先量房再出图', others: '工作室有材料样板间' },
      interview_highlights: '林姐做室内设计7年，坚持先量房再出图；业主最怕装完不好用',
      content_themes: '小户型收纳、老房翻新避坑、量房时要注意什么',
      unique_selling_point: '先量房再出图，材料样板间现场看',
    },
    store: { name: '林姐装修设计', type: '装修设计工作室', features: '先量房再出图，材料样板间', customer: '刚买房的业主、老房翻新的家庭' },
    storyboardType: 'vlog', topicPreset: '小户型厨房怎么做收纳',
    viralSample: '装修最贵的不是材料，是装完才发现不好用。插座位置不对、柜门打不开、走道太窄，这些问题在图纸上就能看出来。今天我带你看一张图纸怎么找毛病。',
    benchmarkSample: '某同城家装账号（虚构样本）：标题「装修前一定要看的五个细节」，视频在毛坯房里拍，前三秒是卷尺拉开，结尾引导预约量房。',
    interviewNotes: '问：您做设计多少年了？答：七年。问：为什么一定要先量房？答：图纸上的尺寸和实际差几厘米，柜子就装不进去。问：业主最常问什么？答：小户型怎么显大，老房水电要不要全换。问：有没有印象深的业主？答：有对老夫妻，翻新完说厨房终于转得开身了。',
    terms: ['量房', '老房翻新'],
  },
  {
    code: 'H', name: '汽修店（老板本人出镜）',
    profile: {
      profile_name: '老赵汽修', account_platform: ['抖音'], account_track: ['汽车', '本地服务'], account_stage: '起号期', fans_level: '0-1000',
      target_age: ['25-50岁'], target_occupation: ['私家车主', '跑运输的司机'], target_region: ['县城及周边乡镇'],
      product_category: ['汽车保养', '钣金喷漆', '轮胎'],
      persona_facts: { host: '老板老赵', role: '老板本人出镜', yearsInTrade: '修车15年', yearsLocal: '本地人', mainProducts: '保养、钣喷、轮胎', signature: '旧件当面拆给你看', others: '店在国道边' },
      interview_highlights: '老赵修车15年，换下的旧件当面拆给车主看；车主最怕被多收钱',
      content_themes: '保养常识、哪些项目可以不做、旧件怎么判断',
      unique_selling_point: '旧件当面拆，不该换的不换',
    },
    store: { name: '老赵汽修', type: '汽修店', features: '旧件当面拆，店在国道边', customer: '私家车主、跑运输的司机' },
    storyboardType: 'tutorial', topicPreset: '保养时哪些项目可以不做',
    viralSample: '你去保养，店里说刹车片该换了，你怎么知道是真的？今天我把一副旧刹车片拆下来，告诉你看哪里就能自己判断。',
    benchmarkSample: '某同城汽车账号（虚构样本）：标题「保养别再多花冤枉钱」，视频在车间拍，前三秒是举升机升起，结尾引导评论车型。',
    interviewNotes: '问：您修车多少年了？答：十五年。问：为什么要把旧件拆给车主看？答：车主最怕被坑，看见了就放心。问：车主最常问什么？答：这个项目到底要不要做，原厂件和副厂件差多少。问：有没有印象深的事？答：有个跑运输的师傅，后来每次都从邻县开过来。',
    terms: ['刹车片', '钣喷', '汽修'],
  },
  {
    code: 'I', name: '健身私教工作室（教练本人出镜）',
    profile: {
      profile_name: '小刘私教工作室', account_platform: ['抖音'], account_track: ['运动健身', '本地服务'], account_stage: '起号期', fans_level: '0-1000',
      target_age: ['22-40岁'], target_occupation: ['上班族', '产后妈妈'], target_region: ['市区'],
      product_category: ['减脂私教', '体态矫正'],
      persona_facts: { host: '教练小刘', role: '教练本人出镜', yearsInTrade: '带私教6年', yearsLocal: '本地人', mainProducts: '减脂私教、体态矫正', signature: '第一节课先做体测', others: '工作室只有两名教练' },
      interview_highlights: '小刘带私教6年，第一节课一定先做体测；学员最怕练了没效果',
      content_themes: '减脂误区、体态问题自测、上班族怎么练',
      unique_selling_point: '先体测再定计划，两名教练小而精',
    },
    store: { name: '小刘私教工作室', type: '健身私教工作室', features: '第一节课先体测，只有两名教练', customer: '上班族、产后妈妈' },
    storyboardType: 'tutorial', topicPreset: '久坐上班族的圆肩怎么改善',
    viralSample: '很多人减肥第一件事是去跑步，结果膝盖先疼了。我带过的学员里，先改体态再减脂的，反而瘦得更稳。今天教你一个在家就能做的自测。',
    benchmarkSample: '某同城健身账号（虚构样本）：标题「别再这样练腹了」，视频在器械区拍，前三秒是错误动作示范，结尾引导预约体测。',
    interviewNotes: '问：您带私教多少年了？答：六年。问：为什么第一节课先体测？答：不知道身体是什么情况，计划就是瞎定的。问：学员最常问什么？答：多久能瘦下来，饮食要怎么控制。问：有没有印象深的学员？答：有个产后妈妈练了三个月，说抱孩子腰不疼了。',
    terms: ['私教', '体测'],
  },
  {
    code: 'J', name: '宠物洗护店（店主出镜）',
    profile: {
      profile_name: '小美宠物洗护', account_platform: ['抖音'], account_track: ['萌宠', '本地服务'], account_stage: '起号期', fans_level: '0-1000',
      target_age: ['20-35岁'], target_occupation: ['养猫养狗的年轻人'], target_region: ['市区'],
      product_category: ['猫狗洗护', '宠物美容'],
      persona_facts: { host: '店主小美', role: '老板本人出镜', yearsInTrade: '做宠物洗护5年', yearsLocal: '本地人', mainProducts: '猫狗洗护、宠物美容', signature: '洗护全程可视', others: '店里养了两只店猫' },
      interview_highlights: '小美做宠物洗护5年，洗护全程主人可以看；主人最怕宠物在店里受委屈',
      content_themes: '洗澡频率、怕水的宠物怎么洗、美容前要知道的事',
      unique_selling_point: '洗护全程可视，主人放心',
    },
    store: { name: '小美宠物洗护', type: '宠物洗护店', features: '洗护全程可视，店里有店猫', customer: '养猫养狗的年轻人' },
    storyboardType: 'vlog', topicPreset: '怕水的猫怎么洗澡不抓人',
    viralSample: '你家狗一洗澡就发抖，不是它娇气，是水温和吹风机的声音吓到它了。今天我给你看我们怎么洗一只怕水的狗，第一步就和你想的不一样。',
    benchmarkSample: '某同城宠物账号（虚构样本）：标题「洗澡前一定要先做这一步」，视频在洗护台拍，前三秒是狗狗发抖，结尾引导评论宠物品种。',
    interviewNotes: '问：您做洗护多少年了？答：五年。问：为什么要全程可视？答：主人看着放心，宠物也不容易紧张。问：主人最常问什么？答：多久洗一次，掉毛怎么办。问：有没有印象深的宠物？答：有只泰迪第一次来叫个不停，现在进门自己往洗护台上跳。',
    terms: ['宠物洗护', '洗护台', '店猫'],
  },
  {
    code: 'K', name: '山货特产（农户本人出镜）',
    profile: {
      profile_name: '老陈家果园', account_platform: ['抖音'], account_track: ['三农', '美食'], account_stage: '起号期', fans_level: '0-1000',
      target_age: ['28-50岁'], target_occupation: ['城市上班族', '注重吃得健康的家庭'], target_region: ['全国'],
      product_category: ['猕猴桃', '土蜂蜜'],
      persona_facts: { host: '果农老陈', role: '本人出镜', yearsInTrade: '种猕猴桃20年', yearsLocal: '一直住在山里', mainProducts: '猕猴桃、土蜂蜜', signature: '果园直发', others: '果园在山坡上，自家养蜂' },
      interview_highlights: '老陈种猕猴桃20年，果子从果园直接发货；顾客最怕买到催熟的',
      content_themes: '果园日常、怎么挑猕猴桃、蜂蜜怎么辨',
      unique_selling_point: '果园直发，不催熟',
    },
    store: { name: '老陈家果园', type: '山货特产', features: '果园直发，自家养蜂', customer: '城市上班族、注重吃得健康的家庭' },
    storyboardType: 'vlog', topicPreset: '猕猴桃怎么挑不酸',
    viralSample: '你买的猕猴桃放三天还是硬的，不一定是没熟，可能是摘早了。我在果园里给你看，什么样的果子才是该摘的时候。',
    benchmarkSample: '某三农账号（虚构样本）：标题「果农自己吃的是哪一种」，视频在果园拍，前三秒是掰开果子，结尾引导点链接。',
    interviewNotes: '问：您种猕猴桃多少年了？答：二十年。问：为什么要果园直发？答：放在冷库里久了味道就变了。问：顾客最常问什么？答：多久能吃，怎么放才熟得快。问：有没有印象深的顾客？答：有个城里的顾客，每年这个时候都给全家订几箱。',
    terms: ['猕猴桃', '土蜂蜜', '果园'],
  },
  {
    code: 'L', name: '儿童摄影工作室（摄影师出镜）',
    profile: {
      profile_name: '阿宁儿童摄影', account_platform: ['抖音'], account_track: ['摄影', '本地服务'], account_stage: '起号期', fans_level: '0-1000',
      target_age: ['25-38岁'], target_occupation: ['宝爸宝妈'], target_region: ['市区'],
      product_category: ['百天照', '生日照', '全家福'],
      persona_facts: { host: '摄影师阿宁', role: '摄影师本人出镜', yearsInTrade: '拍儿童照9年', yearsLocal: '本地人', mainProducts: '百天照、生日照、全家福', signature: '不催孩子笑', others: '影棚在商场三楼' },
      interview_highlights: '阿宁拍儿童照9年，拍的时候不催孩子笑；家长最怕孩子哭着拍完',
      content_themes: '孩子拍照不哭的办法、拍照前怎么准备、全家福怎么站',
      unique_selling_point: '不催孩子笑，等孩子自己放松',
    },
    store: { name: '阿宁儿童摄影', type: '儿童摄影工作室', features: '不催孩子笑，影棚在商场三楼', customer: '宝爸宝妈' },
    storyboardType: 'vlog', topicPreset: '一岁宝宝拍照总哭怎么办',
    viralSample: '很多家长带孩子拍照，最常说的一句是「笑一个」。可越催孩子越不笑。今天我给你看我是怎么等一个孩子自己笑出来的。',
    benchmarkSample: '某同城摄影账号（虚构样本）：标题「拍百天照前一定要知道」，视频在影棚拍，前三秒是宝宝的小手，结尾引导预约档期。',
    interviewNotes: '问：您拍儿童照多少年了？答：九年。问：为什么不催孩子笑？答：催出来的笑是僵的，等出来的才好看。问：家长最常问什么？答：孩子哭了怎么办，要带几套衣服。问：有没有印象深的事？答：有个孩子哭了半小时，后来抱着我们的小熊笑了，那张成了他们家最喜欢的照片。',
    terms: ['百天照', '影棚', '儿童摄影'],
  },
];

/** 稀疏档案：只留名字、平台、赛道、主卖什么、地区 */
function sparseOf(b: Base): Base {
  const p = b.profile;
  return {
    ...b,
    code: `${b.code}-s`,
    profile: {
      profile_name: p.profile_name, account_platform: p.account_platform, account_track: p.account_track,
      account_stage: p.account_stage, product_category: p.product_category, target_region: p.target_region,
    },
    interviewNotes: '',
  };
}

/** 有歧义的档案：出镜人身份不清，品类多一条不相关的副业 */
function ambiguousOf(b: Base): Base {
  const p = b.profile as Record<string, unknown> & { persona_facts?: Record<string, string>; product_category?: string[] };
  const facts = { ...(p.persona_facts ?? {}) };
  delete facts.host;
  facts.role = '有时老板出镜，有时店员出镜';
  return {
    ...b,
    code: `${b.code}-a`,
    profile: {
      ...p,
      persona_facts: facts,
      product_category: [...(p.product_category ?? []), '顺带卖一些周边小商品'],
      interview_highlights: '',
    },
  };
}

function decoysOf(b: Base, all: Base[]): string[] {
  const own = JSON.stringify(b);
  const others = all.filter((x) => x.code !== b.code).flatMap((x) => x.terms);
  return [...new Set([...KB_DECOYS, ...others])].filter((w) => !own.includes(w));
}

export const EVAL_INDUSTRIES: EvalIndustry[] = BASES.flatMap((b) => {
  const decoys = decoysOf(b, BASES);
  return [
    { ...b, shape: 'full' as const, decoys },
    { ...sparseOf(b), shape: 'sparse' as const, decoys },
    { ...ambiguousOf(b), shape: 'ambiguous' as const, decoys },
  ];
});

/** 按编号取（「A」「A-s」「A-a」）；没给就返回全部 */
export function pickIndustries(codes: string | undefined): EvalIndustry[] {
  if (!codes?.trim()) return EVAL_INDUSTRIES;
  const want = new Set(codes.split(',').map((s) => s.trim()).filter(Boolean));
  return EVAL_INDUSTRIES.filter((i) => want.has(i.code));
}

/** 输出里出现的诱饵词 */
export function decoyHits(output: string, decoys: string[]): string[] {
  return decoys.filter((w) => output.includes(w));
}
