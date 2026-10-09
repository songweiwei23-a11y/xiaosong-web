export const dynamic = 'force-dynamic'

/**
 * 保活（2026-10-05）。工作台开着时每隔一会儿打一下，让浏览器到服务器的连接一直是活的。
 *
 * 线上：用户线路（走代理）上，页面闲几分钟后空闲连接会被悄悄掐掉；再点「带去下一步」「保存」，
 * 浏览器拿死连接去发，请求一个都到不了服务器（日志一条都没有），页面报网络断了。
 * 不查库、不验登录，只回一个空响应，开销可以忽略。
 */
export function GET() {
  return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })
}
