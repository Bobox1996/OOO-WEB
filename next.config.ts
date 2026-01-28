import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdebmhgnxgwciwyqnhzp.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
    // Enable modern image formats for better compression
    formats: ['image/avif', 'image/webp'],
  },
};

export default nextConfig;
