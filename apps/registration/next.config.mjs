/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*",
      },
    ],
  },
  transpilePackages: ["@recallnet/ui", "@recallnet/fonts"],
  async rewrites() {
    // Use proxy when we have a separate API base URL (both dev and prod)
    // This eliminates cross-origin cookie issues on mobile by making all API calls same-origin
    if (process.env.NEXT_PUBLIC_API_BASE_URL) {
      console.log(`🔄 [NEXT.JS] Setting up API proxy: /backend-api/* → ${process.env.NEXT_PUBLIC_API_BASE_URL}/*`);
      return [
        {
          source: '/backend-api/:path*',
          destination: `${process.env.NEXT_PUBLIC_API_BASE_URL}/:path*`,
        },
      ];
    }
    return [];
  },
};

export default nextConfig;
