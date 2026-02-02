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
  // Increase body size limit for API routes (for base64 image uploads)
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
