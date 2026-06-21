import type { Metadata, Viewport } from "next";
import { Noto_Sans_JP, Zen_Old_Mincho } from "next/font/google";
import "./globals.css";

// 本文: 源ノ角ゴシック JP(= Noto Sans JP)。既定は Light(300)。
// ロゴの欧文ワードマークのみ落ち着いた明朝を使用。
const sans = Noto_Sans_JP({
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
  // 再読み込み時のダークモードのちらつきを防ぐため、描画前にクラスを付与する
  const themeScript = `(function(){try{var t=localStorage.getItem('yohaku:theme')||'system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');}catch(e){}})();`;
  return (
    <html lang="ja" className={`${sans.variable} ${serif.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="font-sans font-light text-[15px] leading-relaxed">
        {children}
      </body>
    </html>
  );
}
