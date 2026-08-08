/** @type {import('next').NextConfig} */
const nextConfig = {
  // 说明：本应用为同源调用（前端与 API 同域），无需开放跨域。
  // 如未来确有跨域需求，请将允许来源收敛为具体域名白名单，切勿使用 "*"。
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
