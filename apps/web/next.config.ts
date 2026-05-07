import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Required for Docker multi-stage standalone build
  output: 'standalone',

  // Proxy /api requests to the Fastify backend during development
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001'}/api/:path*`,
      },
    ]
  },
}

export default nextConfig