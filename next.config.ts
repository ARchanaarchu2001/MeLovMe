import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Runs as a Node.js server (`npm run build && npm start`): login, checkout
  // and orders need the server and MongoDB
  trailingSlash: true,
  images: {
    // Images in /public are pre-optimised WebP
    unoptimized: true,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
