"use client";
import { useEffect, useState } from "react";
import BackHeader from "@/components/BackHeader";

type Log = { time: string; ip: string; device: string; method: string; path: string };

const RESOURCE_LABEL: { test: RegExp; label: string }[] = [
  { test: /^\/api\/matches/, label: "試合・合宿" },
  { test: /^\/api\/drivers/, label: "配車当番" },
  { test: /^\/api\/practices/, label: "通常練習" },
  { test: /^\/api\/bucket-duties/, label: "バケツ当番" },
  { test: /^\/api\/duty-swaps/, label: "当番変更" },
  { test: /^\/api\/coach-expenses/, label: "コーチ飲食費" },
  { test: /^\/api\/parents/, label: "選手マスタ" },
  { test: /^\/api\/fee-payments/, label: "費用徴収" },
  { test: /^\/api\/fees/, label: "費用" },
  { test: /^\/api\/equipment/, label: "備品" },
  { test: /^\/api\/memos/, label: "備忘録" },
  { test: /^\/api\/links/, label: "BANDトーク" },
  { test: /^\/api\/settings/, label: "設定" },
];

function actionLabel(method: string, path: string): string {
  const res = RESOURCE_LABEL.find((r) => r.test.test(path))?.label ?? path.replace(/^\/api\//, "");
  if (/settlement-status/.test(path)) return `${res}の精算ステータス変更`;
  const verb = method === "POST" ? "追加・更新" : method === "PUT" ? "更新" : method === "PATCH" ? "更新" : method === "DELETE" ? "削除" : method;
  return `${res}を${verb}`;
}

function deviceLabel(ua: string): string {
  if (!ua) return "不明";
  const os = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android"
    : /Macintosh|Mac OS/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : "その他";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox"
    : /Safari\//.test(ua) ? "Safari" : "";
  return browser ? `${os} / ${browser}` : os;
}

function fmt(t: string): string {
  if (!t) return "";
  const d = new Date(t);
  if (isNaN(d.getTime())) return t;
  return d.toLocaleString("ja-JP", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function AuditPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/audit").then((r) => r.json()).then((d) => {
      setLogs(Array.isArray(d) ? d : []);
      setLoading(false);
    });
  }, []);

  return (
    <main className="max-w-lg md:max-w-4xl mx-auto px-4 md:px-8 pt-16 md:pt-8 pb-8">
      <BackHeader title="操作履歴" back="/settings" />
      <p className="text-xs text-gray-400 mb-3">データが変更されるたびに記録されます（新しい順・最大300件）。</p>

      {loading && <div className="text-center text-gray-400 py-12">読み込み中...</div>}
      {!loading && logs.length === 0 && <div className="text-center text-gray-400 py-12">記録がありません</div>}

      <div className="grid gap-2">
        {logs.map((l, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 p-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-medium text-gray-800">{actionLabel(l.method, l.path)}</div>
              <div className="text-xs text-gray-400 mt-0.5">{deviceLabel(l.device)}　IP: {l.ip || "不明"}</div>
            </div>
            <div className="text-xs text-gray-500 whitespace-nowrap shrink-0">{fmt(l.time)}</div>
          </div>
        ))}
      </div>
    </main>
  );
}
