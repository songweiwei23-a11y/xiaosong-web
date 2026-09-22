'use client'

import { DeepDivePage } from '@/components/positioning/DeepDivePage'

/**
 * 商业定位 = 六维地基里「变现定位」那一维的深挖。
 * 独立成一页，但会继承账号定位的结果，不让用户重填一遍。
 */
export default function BusinessPositioningPage() {
  return (
    <DeepDivePage
      focus="business"
      taskType="商业定位"
      title="商业定位"
      subtitle="把「靠什么赚钱」拆到能执行：卖什么、卖多少钱、客人从刷到视频到付钱要走哪几步、凭什么信你。"
      bullets={[
        '列出现在就能卖的产品或服务，以及各自的客单价和决策难度',
        '把成交路径一步步拆开，标明每一步会流失什么人',
        '给出能拍成画面的信任证据清单，没有的会告诉你怎么攒',
        '排出变现型内容的占比和方向，以及起步阶段怎么定价',
      ]}
      generatingHint="正在拆解变现路径…"
    />
  )
}
