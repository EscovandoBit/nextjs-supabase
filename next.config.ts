import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // `pg` is a native-ish CJS driver; keep it out of the server bundle so its
  // dynamic requires resolve at runtime instead of being traced by the bundler.
  serverExternalPackages: ["pg"],
  // Left off on purpose: pagination and filters build hrefs as strings from
  // validated search params, which typed routes reject.
  typedRoutes: false,
};

export default nextConfig;
