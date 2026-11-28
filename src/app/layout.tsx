// src/app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Geist, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

// Display face for world names only: an observatory-plate serif against a quiet sans.
const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Cogniterra",
  description: "A cosmic observatory of how machines learn. Four worlds, each one a piece of the math you can touch.",
};

export const viewport: Viewport = {
  themeColor: "#050508",
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
    <html lang="en" className={`${jetbrains.variable} ${geist.variable} ${serif.variable}`}>
      <head>
        {process.env.STATIC_EXPORT === "1" && <meta httpEquiv="Content-Security-Policy" content={EXPORT_CSP} />}
        <meta name="referrer" content="strict-origin-when-cross-origin" />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
