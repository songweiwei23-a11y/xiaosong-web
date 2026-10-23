import type { CreatorContext } from '@/lib/creator-context';
import { creationBridgeData, creationBridgePrompt } from '@/lib/creation-bridge';
import { creationReference } from '@/lib/creation-continuation';
import { type CreationTarget } from '@/lib/creation-flow';
import { resolveCreationSettings, type CreationSettings } from '@/lib/creation-settings';
import type { HandoffPayload } from '@/lib/handoff';
import { rebuildCarry } from '@/lib/assistant/carry-shape';

/**
 * 页面收到「带去下一步」的内容以后，每个页面各自怎么用它（2026-10-23）。
 * 助理板块接着做的时候，照这里的规则取字段，效果和真人在那个页面上操作一样：
 *   - 设置：页面的 useAutoCreationSetup 用 resolveCreationSettings 把带过来的内容合并进设置（原方向、目的、拍法……）
 *   - 参考：页面把 creationReference（原始方案 + 当前版本）放进「相关参考」，或者提示词末尾的桥接段（creationBridgePrompt）
 *   - 正文：每个页面取的字段不同（审稿取 scriptContent，标题取 topic 和 scriptContent，二创取 remixSource……）
 */
export interface PageHandoff {
  /** 页面收到的那一份（按目标板块重新组装，和页面 takeHandoff 拿到的一样） */
  incoming: HandoffPayload;
  /** 页面合并进创作设置的那部分（useAutoCreationSetup 的结果） */
  settings: CreationSettings;
  /** 「相关参考」那一段：原始方案 + 当前版本（creationReference） */
  reference: string;
  /** 提示词末尾的桥接段（creationBridgePrompt）：定位、简报、成交理由、创作方向都用它 */
  bridgePrompt: string;
  /** 桥接段里带的设置（creationBridgeData 的 creationSettings）：定位、简报、成交理由用 */
  bridgeSettings: CreationSettings;
}

export function pageHandoff(carry: HandoffPayload, target: CreationTarget, context: CreatorContext): PageHandoff {
  const incoming = rebuildCarry(carry, target);
  const bridge = creationBridgeData(incoming);
  return {
    incoming,
    settings: resolveCreationSettings(incoming, context),
    reference: creationReference(incoming),
    bridgePrompt: creationBridgePrompt(incoming),
    bridgeSettings: bridge.creationSettings,
  };
}
