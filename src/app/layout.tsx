// src/app/layout.tsx
import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

const grotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-grotesk",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Cogniterra",
  description: "Walk the math. A playable atlas of how machines learn.",
};

export const viewport: Viewport = {
  themeColor: "#05070a",
  viewportFit: "cover",
};

/*
 * Static-export CSP. Everything is same-origin (next/font self-hosts the fonts).
 * - 'unsafe-inline' on script-src: the exported RSC payload is inline <script>; without a
 *   server there is no per-request nonce. External script loads are still blocked.
 * - 'wasm-unsafe-eval': Rapier compiles its physics engine from WebAssembly.
 */
const EXPORT_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self' data: blob:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join("; ");

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${jetbrains.variable} ${grotesk.variable}`}>
      <head>
        {process.env.STATIC_EXPORT === "1" && <meta httpEquiv="Content-Security-Policy" content={EXPORT_CSP} />}
        <meta name="referrer" content="strict-origin-when-cross-origin" />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
