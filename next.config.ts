import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  // For a GitHub project page (username.github.io/repo-name), set NEXT_PUBLIC_BASE_PATH=/repo-name
  // For a user/org page (username.github.io), leave this unset
  basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? '',
  images: { unoptimized: true },
};

export default nextConfig;
