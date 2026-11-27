// next.config.ts
import type { NextConfig } from "next";

/**
 * Two build targets:
 *  - default (`next build` / `next dev`): server mode, security headers sent by Next.
 *  - STATIC_EXPORT=1: plain files in ./out for GitHub Pages. Pages can't send custom
 *    headers, so layout.tsx emits a CSP <meta> in that mode instead. frame-ancestors and
 *    X-Frame-Options can't be set from a meta tag; that gap is accepted for a public demo.
 */
const isExport = process.env.STATIC_EXPORT === "1";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

if (basePath && !/^\/[A-Za-z0-9._-]+$/.test(basePath)) {
  throw new Error(`NEXT_PUBLIC_BASE_PATH must look like "/repo-name", got "${basePath}"`);
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  basePath: basePath || undefined,
  ...(isExport
    ? { output: "export", images: { unoptimized: true }, trailingSlash: true }
    : {
        async headers() {
          return [
            {
              source: "/(.*)",
              headers: [
                { key: "X-Content-Type-Options", value: "nosniff" },
                { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
                { key: "X-Frame-Options", value: "DENY" },
                { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
              ],
            },
          ];
        },
      }),
};

export default nextConfig;
