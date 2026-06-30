// クライアントから操作の詳細を監査ログに記録する（ベストエフォート）
export function logDetail(detail: string) {
  try {
    fetch("/api/audit/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ detail, method: "操作", path: "" }),
      keepalive: true, // 画面遷移しても送信を試みる
    }).catch(() => {});
  } catch { /* noop */ }
}
