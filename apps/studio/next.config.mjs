/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@recallnet/ui"],
  webpack: (config) => {
    config.externals = [...(config.externals || []), "pino-pretty"];
    return config;
  },
};

export default nextConfig;
