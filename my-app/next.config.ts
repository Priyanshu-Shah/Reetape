import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...(config.externals as string[]), 'fluent-ffmpeg', '@ffmpeg-installer/ffmpeg'];
    }
    return config;
  },
  // Add any other Next.js config options here
}

export default nextConfig;
