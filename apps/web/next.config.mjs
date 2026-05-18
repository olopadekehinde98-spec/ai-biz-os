/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@ai-biz-os/shared'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },

};

export default nextConfig;
