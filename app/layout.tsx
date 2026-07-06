import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import AppLayout from "@/components/AppLayout";

export const metadata: Metadata = {
  title: "マネジメントApp",
  description: "サッカークラブ公式戦費用管理",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
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
