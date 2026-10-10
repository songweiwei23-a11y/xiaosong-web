/**
 * 限流用的客户端 IP。代理把真实来源追加在 X-Forwarded-For 的最右边，
 * 左边的部分由客户端自己写，能随便伪造，不能拿来当限流的 key。
 */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const last = forwarded.split(',').map((s) => s.trim()).filter(Boolean).pop();
    if (last) return last;
  }
  return request.headers.get('x-real-ip')?.trim() || 'unknown';
}
