import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The static-generation worker pool defaults to one worker per CPU core (32 here), which
  // exceeds this machine's ~16GB of RAM once the 545-product catalogue's ~600 static routes are
  // being generated concurrently and crashes the build with an OOM. Capping it keeps peak memory
  // bounded at the cost of some build wall-clock time.
  experimental: {
    cpus: 2,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
      {
        protocol: "https",
        hostname: "fastly.picsum.photos",
      },
      {
        // S&S Activewear's product-image CDN. Product images are hotlinked directly from the
        // supplier's own CDN for now, not re-hosted on our infrastructure — see
        // catalogue-engine/README.md "What I need from you" #6 (image-redistribution rights are
        // still unconfirmed in writing; hotlinking is a lower-risk stance than rehosting until
        // that's settled).
        protocol: "https",
        hostname: "cdn.ssactivewear.com",
      },
    ],
  },
};

export default nextConfig;
