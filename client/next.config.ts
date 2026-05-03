import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async rewrites() {
    // In production (Vercel), API_URL = deployed Express server URL
    // In development, falls back to localhost:5000 proxy
    const apiUrl = process.env.API_URL || 'http://localhost:5000';
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
