/** @type {import('next').NextConfig} */
const nextConfig = {
  compiler: {
    // 生产构建移除 console，保留 error/warn 便于线上排查
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
  // 说明：本应用为同源调用（前端与 API 同域），无需开放跨域。
  // 如未来确有跨域需求，请将允许来源收敛为具体域名白名单，切勿使用"*"。
  async headers() {
    /*
     * 安全响应头原来只加在 /api/* 上，页面一个都没有——
     * 体检时从外网实测 http://站点/ 的响应，五个常见安全头全缺。
     * 页面才是用户真正打开的东西，点击劫持、MIME 嗅探防的都是页面。
     *
     * 这里只放不会改变页面行为的几个。另外两个故意没加：
     *   - Strict-Transport-Security：站点目前还是纯 HTTP，浏览器会忽略它；
     *     等域名和证书到位再加，否则证书一出问题就会把用户锁在门外。
     *   - Content-Security-Policy：Next.js 的内联脚本和 Tailwind 的内联样式
     *     都要专门开口子，配错了整站白屏。要加得先在本地逐页验证过。
     */
    const baseline = [
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