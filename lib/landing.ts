/**
 * 首页首屏「一句话开始」用的数据和规则。
 *
 * 首屏是给完全不懂的小白的：他说一句自己是做什么的（或点一个行业），
 * 当场看到开物给这一行写的选题和开头第一句，再点"领取邀请码体验"。
 */
import { SUPPORT_WECHAT } from '@/lib/config/contact';

/**
 * 首页所有"去注册"的按钮都走这个地址：直接打开注册页。
 *
 * 2026-10-04 产品方：注册必须用邀请码，首页不再自动带公开体验码（原来带的是 START26），
 * 想要邀请码必须找管理员。那个公开码由 supabase/migrations/20261004_revoke_public_trial_code.sql 作废。
 * 管理员单独发给某个人的注册链接仍然可以带码（/login?mode=register&code=XXXX），登录页会自动填好。
 */
export const REGISTER_URL = '/login?mode=register';

/** 注册页提示：邀请码找谁要 */
export const INVITE_CONTACT = `注册需要邀请码。加客服微信 ${SUPPORT_WECHAT}（手机同号）领取。`;

export interface IndustrySample {
  id: string;
  name: string;
  /** 这一行的人会怎么介绍自己（输入框的提示语轮播用） */
  who: string;
  /** 认这一行的关键词：访客打的字里出现就算 */
  keywords: string[];
  topics: string[];
  hook: string;
}

/*
 * 样例是示意（页面上标明）。写的时候守两条：
 *   - 像真的会火的选题：具体、有反差、有人话，不写空话
 *   - 不承诺收益：只讲"被看见""有人来"，不写"月入多少"
 * 以后拿开物真实生成的结果替换，替换时只改这里。
 */
export const INDUSTRY_SAMPLES: IndustrySample[] = [
  {
    id: 'food',
    name: '餐饮',
    who: '我在县城开了家面馆',
    keywords: ['面', '饭', '餐', '菜', '火锅', '烧烤', '奶茶', '咖啡', '小吃', '烘焙', '蛋糕', '卤', '粉', '饺', '包子', '早点', '厨', '食'],
    topics: ['同样 15 块一碗面，凭什么他家天天排队', '凌晨四点起锅熬汤，老板说这碗面不赚钱', '外地人来县城必吃的面，本地人却没吃过'],
    hook: '你吃的骨汤面，可能根本没熬过骨头',
  },
  {
    id: 'beauty',
    name: '美容美发',
    who: '我开了家理发店',
    keywords: ['理发', '美发', '发型', '美容', '美甲', '美睫', '纹', '护肤', '皮肤', '造型', '染', '烫', '头发'],
    topics: ['剪了 15 年头发，这 3 种发型我劝你别剪', '同样是烫发，为什么有人显年轻有人显老', '200 块和 800 块的烫发，差在哪一步'],
    hook: '你每次说「随便剪剪」，理发师心里都在叹气',
  },
  {
    id: 'cloth',
    name: '服装',
    who: '我在商场有个女装店',
    keywords: ['服装', '女装', '男装', '童装', '衣', '裤', '裙', '鞋', '穿搭', '包'],
    topics: ['小个子别买长大衣，这样穿显高 10 厘米', '一件白 T 穿出 5 种风格，老板亲自示范', '同一件衬衫，换个塞法就是两种身材'],
    hook: '这件衣服挂在店里没人看，穿上身三天卖空',
  },
  {
    id: 'edu',
    name: '教培',
    who: '我是小学数学老师',
    keywords: ['老师', '教', '培训', '辅导', '数学', '语文', '英语', '作文', '课', '书法', '钢琴', '舞蹈', '美术', '学'],
    topics: ['孩子数学总粗心？不是马虎，是这一步没教对', '三年级是分水岭，这 3 个信号家长要注意', '应用题读不懂，问题不在数学在语文'],
    hook: '你家孩子写作业磨蹭，可能不是懒',
  },
  {
    id: 'shop',
    name: '门店零售',
    who: '我开了家水果店',
    keywords: ['水果', '超市', '便利', '零售', '花店', '母婴', '五金', '药店', '茶叶', '酒', '特产', '批发', '门店', '店'],
    topics: ['水果店老板不会告诉你的挑西瓜方法', '同样的苹果，为什么价格差一倍', '每天卖剩的水果去哪了？今天带你看'],
    hook: '挑西瓜别再拍了，看这一个地方就够',
  },
  {
    id: 'mom',
    name: '宝妈副业',
    who: '我是全职宝妈，想试试短视频',
    keywords: ['宝妈', '带娃', '全职', '妈妈', '副业', '在家', '孩子'],
    topics: ['带娃三年，孩子睡着后的一小时我在做什么', '宝妈做短视频，第一条拍什么最容易', '不露脸也能拍的 5 种视频，宝妈亲测'],
    hook: '孩子睡着以后的那一小时，是我自己的',
  },
];

/**
 * 访客打了一句话，认成哪一行。
 *
 * 按关键词命中的个数算，最多的那行胜；"店"这种太泛的词只在别的行都没中时才算数
 * （它排在门店零售的最后，而"面馆"这种会先被餐饮的"面"命中）。
 * 一个都没中返回 null——页面上说清楚"这是 XX 的样例，注册后按你的行业写"，不硬猜。
 */
export function matchIndustry(text: string): IndustrySample | null {
  const s = text.trim();
  if (!s) return null;
  let best: IndustrySample | null = null;
  let bestScore = 0;
  for (const ind of INDUSTRY_SAMPLES) {
    const score = ind.keywords.reduce((n, k) => n + (k !== '店' && s.includes(k) ? 1 : 0), 0);
    if (score > bestScore) {
      best = ind;
      bestScore = score;
    }
  }
  if (best) return best;
  return /店/.test(s) ? INDUSTRY_SAMPLES.find((i) => i.id === 'shop')! : null;
}
