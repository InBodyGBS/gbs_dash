import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // 운영 빌드 차단 방지 — dev/CI 단계에서는 여전히 ESLint 가 동작.
    // React 19 의 일부 룰(예: react-hooks/set-state-in-effect)이 과도하게 엄격해 빌드를 막는 케이스 회피.
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self'",
              "connect-src 'self' https://*.supabase.co https://api.supabase.com wss://*.supabase.co https://generativelanguage.googleapis.com https://api.resend.com",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
