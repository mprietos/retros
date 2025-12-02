/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "media.tenor.com", pathname: "/**" }
    ]
  },
  experimental: {
    serverActions: {
      allowedOrigins: ['*']
    }
  }
};

module.exports = nextConfig;


