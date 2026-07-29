// 同じリポジトリから保護者用と子供用(閲覧専用)の2つをデプロイしているため、
// ホーム画面で見分けられるようアイコンの色を分ける。
// 保護者用=グリーン / 子供用=オレンジ
export const VIEW_ONLY = process.env.NEXT_PUBLIC_VIEW_ONLY === "true";

export const APP_ICON_180 = VIEW_ONLY ? "/icon-kids-180.png" : "/icon-180.png";
export const APP_ICON_512 = VIEW_ONLY ? "/icon-kids-512.png" : "/icon-512.png";
export const APP_THEME_COLOR = VIEW_ONLY ? "#c2410c" : "#166534";
