// 閲覧専用（子供用）モード。NEXT_PUBLIC_VIEW_ONLY=true のデプロイで有効
export const VIEW_ONLY = process.env.NEXT_PUBLIC_VIEW_ONLY === "true";

// 閲覧専用モードで表示を許可するメニュー
export const VIEW_ONLY_PATHS = ["/matches", "/practices", "/league", "/parents"];
