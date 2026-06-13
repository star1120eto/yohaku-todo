import type { Metadata, Viewport } from "next";
import { Zen_Kaku_Gothic_New, Zen_Old_Mincho } from "next/font/google";
import "./globals.css";

// 本文: 端正で読みやすいゴシック。見出し/ロゴ: 落ち着いた明朝。
const sans = Zen_Kaku_Gothic_New({
  weight: ["300", "400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
  preload: false,
});

const serif = Zen_Old_Mincho({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-serif",
  preload: false,
});

export const metadata: Metadata = {
  title: "Yohaku ToDo",
  description: "余白を大切にする、静かなToDoアプリ",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Yohaku ToDo",
  },
};

export const viewport: Viewport = {
  themeColor: "#f5f3f0",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" className={`${sans.variable} ${serif.variable}`}>
      <body className="font-sans text-[15px] leading-relaxed">{children}</body>
    </html>
  );
}
