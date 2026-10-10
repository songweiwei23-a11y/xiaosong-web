/** @type {import('next').NextConfig} */
const nextConfig = {
  compiler: {
    // 生产构建移除 console，保留 error/warn 便于线上排查
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
  // 说明：本应用为同源调用（前端与 API 同域），无需开放跨域。
  // 如未来确有跨域需求，请将允许来源收敛为具体域名白名单，切勿使用"*"。
  async headers() {
    const isDev = process.env.NODE_ENV !== 'production';
    /*
     * 脚本允许内联：Next.js 的水合脚本是内联的，收紧到 nonce 需要改渲染链路。
     * 其余来源收死：外部脚本、外部 iframe、对象标签一律不许加载。
     * 开发模式额外放开 eval 与 HMR 的 websocket。
     */
    const csp = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "media-src 'self' blob: https:",
      `connect-src 'self' https://*.supabase.co wss://*.supabase.co${isDev ? ' ws: wss:' : ''}`,
      "worker-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
    ].join('; ');

    const baseline = [
      // 站点已全程 HTTPS：告诉浏览器下次直接用 https，防止中间人降级
      { key: 'Strict-Transport-Security', value: 'max-age=2592000' },
      { key: 'Content-Security-Policy', value: csp },
      // 别按内容猜 MIME 类型，防止把上传的文件当脚本执行
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      // 跳到外站时不要把完整路径带过去
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      // 不许被别的站套进 iframe（点击劫持）
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      // 这个产品不用摄像头、麦克风、定位，一律关掉
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    ];

    return [
      { source: '/:path*', headers: baseline },
      { source: '/api/:path*', headers: baseline },
    ];
  },
};

module.exports = nextConfig;