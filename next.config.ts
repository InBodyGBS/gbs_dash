import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  eslint: {
    // 빌드 시 ESLint 경고를 오류로 처리하지 않음
    ignoreDuringBuilds: true,
  },
  typescript: {
    // 빌드 시 TypeScript 오류를 경고로 처리
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
