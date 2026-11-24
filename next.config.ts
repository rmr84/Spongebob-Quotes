import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // firebase-admin is large and only used by API routes; keep it out of the bundle.
  serverExternalPackages: ['firebase-admin'],
};

export default nextConfig;
