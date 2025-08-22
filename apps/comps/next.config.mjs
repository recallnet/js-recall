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
  transpilePackages: ["@recallnet/ui2", "@recallnet/fonts"],
};

export default nextConfig;
