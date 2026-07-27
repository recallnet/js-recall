// @ts-check

/**
 * @type {import('next').NextConfig}
 **/
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
  serverExternalPackages: ["@envio-dev/hypersync-client"],
};

export default nextConfig;
