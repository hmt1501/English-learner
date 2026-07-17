import type { NextConfig } from "next";

// Khi deploy lên GitHub Pages, app nằm ở đường dẫn con (vd. /English-learner)
// — workflow CI đặt NEXT_PUBLIC_BASE_PATH; chạy local thì rỗng.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  assetPrefix: basePath,
  trailingSlash: true,
};

export default nextConfig;
