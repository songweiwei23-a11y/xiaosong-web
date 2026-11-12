'use client'

import { DeepDivePage } from '@/components/positioning/DeepDivePage'

/**
 * 内容定位 = 六维地基里「内容定位」那一维的深挖。
 * 解决的是"长期发什么、怎么排"，而不是单条选题——选题有它自己的板块。
 */
export default function ContentPositioningPage() {
  return (
    <DeepDivePage
      focus="content"
      taskType="内容定位"
      title="内容定位"
      subtitle="把「长期发什么」排成结构：内容类型怎么配比、做哪几个能持续的系列、前 30 条按什么节奏走。"
      bullets={[
        '按账号阶段给出内容配比，并逐条说明为什么是这个比例',
        '设计 3-4 个能记住、能持续做的内容系列，撑不住 30 集的会直接说',
        '给出这个号可以长期挖的选题来源，每个配一个具体例子',
        '排出前 30 条的节奏和验收标准，并指出哪些方向明确不该碰',
      ]}
      generatingHint="正在排内容结构…"
    />
  )
}
