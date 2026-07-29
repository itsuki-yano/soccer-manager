import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import AppLayout from "@/components/AppLayout";
import { APP_ICON_180, APP_ICON_512, APP_THEME_COLOR } from "@/lib/appIcon";

export const metadata: Metadata = {
  title: "マネジメントApp",
  description: "サッカークラブ公式戦費用管理",
  // 保護者用と子供用(閲覧専用)でアイコンの色を分ける
  icons: {
    icon: [{ url: APP_ICON_512, sizes: "512x512", type: "image/png" }],
    apple: [{ url: APP_ICON_180, sizes: "180x180", type: "image/png" }],
  },
  // ホーム画面から起動したときにブラウザのバーを出さずアプリのように表示する
  appleWebApp: {
    capable: true,
    title: "マネジメント",
    statusBarStyle: "default",
  },
  // Next.jsは新名称のmobile-web-app-capableのみ出力するため、旧iOS向けに明示
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: APP_THEME_COLOR,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="bg-gray-50 min-h-screen">
        <AppLayout>{children}</AppLayout>
        <Analytics />
      </body>
    </html>
  );
}
