import type { MetadataRoute } from "next";

// ホーム画面から起動したときにブラウザのバーを出さずアプリのように表示する
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "マネジメントApp",
    short_name: "マネジメント",
    description: "サッカークラブ公式戦費用管理",
    start_url: "/",
    display: "standalone",
    background_color: "#f9fafb",
    theme_color: "#166534",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
