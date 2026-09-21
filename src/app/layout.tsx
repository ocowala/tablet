import type { Metadata, Viewport } from "next";
import { Newsreader } from "next/font/google";

import "./globals.css";

const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["300", "400"],
  style: ["normal", "italic"],
  variable: "--font-newsreader",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tablet",
  description: "One text a day, read slowly.",
  manifest: "/manifest.webmanifest",
  icons: { icon: [{ url: "/icon.svg", type: "image/svg+xml" }] },
  appleWebApp: { capable: true, title: "Tablet", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F8F7F6" },
    { media: "(prefers-color-scheme: dark)", color: "#111110" },
  ],
};

/** Applies the saved appearance before first paint so the page never flashes. */
const themeScript = `
try {
  var t = localStorage.getItem("tablet.theme");
  if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
  var s = localStorage.getItem("tablet.size");
  if (s) document.documentElement.style.setProperty("--reading-size", s + "px");
} catch (e) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={newsreader.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
