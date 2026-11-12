/** Dify message_replace 是完整替换；其余完成/节点事件不能当作正文追加。 */
export function applyChatAnswer(current: string, event: { event?: string; answer?: unknown }): string {
  if (typeof event.answer !== 'string') return current;
  if (event.event === 'message_replace') return event.answer;
  if (event.event === 'message' || event.event === 'agent_message') return current + event.answer;
  return current;
}
