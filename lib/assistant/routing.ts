import type { AssistantConfig } from './config';

/**
 * 成本分层（升级方案 G2）：简单意图（查待办、白噪音、额度这类一句话的事）改用便宜模型，复杂的留给主模型。
 * 只有配置了 ASSISTANT_CHEAP_MODEL 才会分流；没配就全部用主模型。
 * 注意：便宜模型的工具调用质量要先用黄金测试集（tests/assistant-golden）跑过再打开，否则宁可不开。
 */

const SIMPLE = /待办|额度|白噪音|白噪声|播放|停止|声音|雨声|咖啡|篝火|记一下|记下|提醒|要做什么|有什么要做|改到|删掉|标记完成|笔记|今天的安排|简报/;
/** 碰到这些词，就是要动脑子的事（选题、脚本、审稿、方法、分析），不分流 */
const HEAVY = /选题|脚本|审稿|方法|怎么|为什么|写|拍|分析|定位|热点|最新|帮我想/;

export function isSimpleIntent(message: string): boolean {
  const m = message.trim();
  return m.length > 0 && m.length <= 40 && SIMPLE.test(m) && !HEAVY.test(m);
}

/** 这一条消息用哪个模型：返回配置（可能换了模型名）和是否分流了 */
export function pickModel(cfg: AssistantConfig, cheapModel: string | null, message: string): { cfg: AssistantConfig; cheap: boolean } {
  if (cheapModel && cheapModel !== cfg.model && isSimpleIntent(message)) {
    return { cfg: { ...cfg, model: cheapModel }, cheap: true };
  }
  return { cfg, cheap: false };
}
