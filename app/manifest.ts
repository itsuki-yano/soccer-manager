import type { MetadataRoute } from "next";
import { APP_ICON_180, APP_ICON_512, APP_THEME_COLOR } from "@/lib/appIcon";

// ホーム画面から起動したときにブラウザのバーを出さずアプリのように表示する
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "マネジメントApp",
    short_name: "マネジメント",
    description: "サッカークラブ公式戦費用管理",
    start_url: "/",
    display: "standalone",
    background_color: "#f9fafb",
    theme_color: APP_THEME_COLOR,
    icons: [
      { src: APP_ICON_512, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: APP_ICON_180, sizes: "180x180", type: "image/png" },
    ],
  };
}
