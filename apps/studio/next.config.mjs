/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@recall/ui"],
   webpack: (config) => {
    config.externals = [...(config.externals || []), "pino-pretty"];
    return config;
  },
};

export default nextConfig;
