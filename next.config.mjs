

const nextConfig = {
  images: {
    remotePatterns: [
      // Allow all HTTPS images (store CDNs vary widely)
      { protocol: "https", hostname: "**" },
      // Also allow HTTP for older store CDNs
      { protocol: "http",  hostname: "**" },
    ],
  },
};

export default nextConfig;
