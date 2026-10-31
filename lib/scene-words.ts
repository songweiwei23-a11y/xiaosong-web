/**
 * 拍摄场地、设备字样（2026-10-31）：场地和设备决定不了内容的产出。带着这些字样的旧内容（历史方向名字、偏好条目）
 * 不再拿来接着用，否则「棚子」会被每次带进新的创作。
 */
export const SCENE_GEAR_RE = /棚|场地|外景|户外|工作室|灯光|稳定器|摄像机|设备|补光|收音/;

/**
 * 具体时段（2026-10-31）：「凌晨四点起锅」这类时间会被当成要写的场景，串到所有账号的生成里。
 * 偏好、历史这类旧内容里出现时段，不拿来接着用。
 */
export const SCENE_TIME_RE = /凌晨|清晨|早上|早晨|上午|中午|下午|傍晚|黄昏|晚上|深夜|半夜|\d{1,2}\s*点/;

/** 带具体场地、设备或时段的旧内容：不拿来接着用 */
export function hasConcreteScene(text: string): boolean {
  return SCENE_GEAR_RE.test(text) || SCENE_TIME_RE.test(text);
}
