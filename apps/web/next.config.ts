import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Strict mode for catching potential issues early
  reactStrictMode: true,

  // Proxy /api requests to the Fastify backend during development
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/api/:path*`,
      },
    ]
  },
}

export default nextConfig