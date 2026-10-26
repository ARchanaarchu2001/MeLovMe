import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Loads the translations set up in src/i18n/request.ts
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

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

export default withNextIntl(nextConfig);
