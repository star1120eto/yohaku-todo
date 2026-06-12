import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "余白 ToDo",
  description: "余白を大切にする、静かなToDoアプリ",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "余白 ToDo",
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
    <html lang="ja">
      <body className="font-sans text-[15px] leading-relaxed">{children}</body>
    </html>
  );
}
