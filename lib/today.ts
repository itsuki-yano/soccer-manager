// 「今日」は必ず日本時間で判定する。
// new Date().toISOString() はUTCなので、JSTの朝9時までは前日の日付になり、
// 「昨日終わった試合がグレーにならない」「過去の当番が未来扱いになる」といった
// 時間帯依存の不整合が出る。Vercelのサーバー側もUTCなので共通で使う。
export function todayJst(): string {
  // sv-SE ロケールは YYYY-MM-DD 形式を返す
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
}

// UTCで保存されたISO日時を、日本時間の YYYY/MM/DD にして表示する。
// Sheetsには new Date().toISOString()（UTC）で書かれている列があり、
// そのまま slice(0,10) すると早朝の記録が前日の日付に見えてしまう。
export function jstDateLabel(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10).replace(/-/g, "/");
  return d.toLocaleDateString("ja-JP", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
  });
}
