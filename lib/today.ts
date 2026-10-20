// 「今日」は必ず日本時間で判定する。
// new Date().toISOString() はUTCなので、JSTの朝9時までは前日の日付になり、
// 「昨日終わった試合がグレーにならない」「過去の当番が未来扱いになる」といった
// 時間帯依存の不整合が出る。Vercelのサーバー側もUTCなので共通で使う。
export function todayJst(): string {
  // sv-SE ロケールは YYYY-MM-DD 形式を返す
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
}
