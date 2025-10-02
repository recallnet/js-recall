const nextConfig = {
  /* config options here */
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "storage.googleapis.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "api.paragraph.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "paragraph.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.paragraph.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
