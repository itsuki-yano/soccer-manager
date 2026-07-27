"use client";
import { useEffect, useState } from "react";
import BackHeader from "@/components/BackHeader";

const SOURCE_URL = "https://junior-soccer.jp/sp/tokai/aichi/league/table/163446";

export default function LeagueUpdatePage() {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  const [html, setHtml] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => { setOrigin(window.location.origin); }, []);

  // 取得元サイト上で実行し、ページのHTMLをこのアプリへ送るブックマークレット
  const bookmarklet =
    `javascript:(async()=>{try{const r=await fetch('${origin}/api/league',` +
    `{method:'POST',headers:{'Content-Type':'text/plain'},body:document.documentElement.outerHTML});` +
    `const j=await r.json();alert(j.ok?'戦績を更新しました\\n'+j.leagueName:'更新できませんでした\\n'+(j.error||''));}` +
    `catch(e){alert('更新できませんでした\\n'+e);}})()`;

  async function copyBookmarklet() {
    try {
      await navigator.clipboard.writeText(bookmarklet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  async function submitHtml() {
    setSaving(true);
    setResult(null);
    try {
      const res = await fetch("/api/league", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html }),
      });
      const d = await res.json();
      if (d.ok) {
        setResult({ ok: true, message: `更新しました：${d.leagueName}（${d.teams}チーム）` });
        setHtml("");
      } else {
        setResult({ ok: false, message: d.error ?? "更新できませんでした" });
      }
    } catch (e) {
      setResult({ ok: false, message: String(e) });
    }
    setSaving(false);
  }

  return (
    <main className="max-w-lg md:max-w-3xl mx-auto px-4 md:px-8 pt-16 md:pt-8 pb-8">
      <BackHeader title="戦績を更新" />

      <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 mb-4 text-xs text-amber-800 leading-relaxed">
        元サイト（少年サッカー応援団）がアプリからの自動取得を受け付けないため、
        戦績は<b>手動で更新</b>する形になっています。下のどちらかの方法で更新してください。
      </div>

      {/* 方法1: ブックマークレット */}
      <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-4">
        <h2 className="font-bold text-gray-800 flex items-center gap-2 mb-1">
          <span className="text-xl">⭐</span>方法1：ワンタップ更新（おすすめ）
        </h2>
        <p className="text-xs text-gray-500 mb-3">
          最初に1回だけ登録すれば、次からは元サイトを開いてタップするだけで更新できます。
        </p>

        <p className="text-sm font-semibold text-gray-700 mb-1">① 下のボタンでコピー</p>
        <button
          onClick={copyBookmarklet}
          className={`w-full py-2.5 rounded-xl text-sm font-semibold mb-1 ${copied ? "bg-emerald-600 text-white" : "bg-stone-700 text-white"}`}
        >
          {copied ? "コピーしました ✓" : "更新用リンクをコピー"}
        </button>
        <p className="text-xs text-gray-400 mb-3">コピーできない場合は下の枠の文字を全選択してコピーしてください。</p>
        <textarea
          readOnly
          value={bookmarklet}
          onFocus={(e) => e.currentTarget.select()}
          className="w-full h-20 text-[10px] text-gray-500 border border-gray-200 rounded-lg p-2 bg-gray-50 mb-4"
        />

        <p className="text-sm font-semibold text-gray-700 mb-1">② ブックマークとして登録</p>
        <div className="text-xs text-gray-600 space-y-2 mb-3">
          <div>
            <p className="font-semibold text-gray-700">iPhone（Safari）</p>
            <p>このページをブックマークに追加 → ブックマーク一覧で編集 → アドレス欄を消して、コピーした文字を貼り付け → 名前を「戦績更新」に変更</p>
          </div>
          <div>
            <p className="font-semibold text-gray-700">パソコン（Chrome / Safari）</p>
            <p>ブックマークバーで右クリック →「ページを追加」→ URL欄にコピーした文字を貼り付け → 名前を「戦績更新」に変更</p>
          </div>
        </div>

        <p className="text-sm font-semibold text-gray-700 mb-1">③ 更新するとき</p>
        <p className="text-xs text-gray-600 mb-3">
          元サイトのリーグ表を開いた状態で、登録した「戦績更新」ブックマークを開くだけです。
          「戦績を更新しました」と出れば完了です。
        </p>
        <a
          href={SOURCE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-sm text-white bg-emerald-700 px-4 py-2 rounded-xl font-medium"
        >
          元サイトのリーグ表を開く ›
        </a>
      </section>

      {/* 方法2: HTML貼り付け */}
      <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <h2 className="font-bold text-gray-800 flex items-center gap-2 mb-1">
          <span className="text-xl">📋</span>方法2：貼り付けて更新
        </h2>
        <p className="text-xs text-gray-500 mb-3">
          パソコンで元サイトを開き、ページ上で右クリック →「ページのソースを表示」→ 全選択してコピーし、
          下の欄に貼り付けて更新を押してください。
        </p>
        <textarea
          value={html}
          onChange={(e) => setHtml(e.target.value)}
          placeholder="ここにページのソースを貼り付け"
          className="w-full h-28 text-xs border border-gray-200 rounded-lg p-2 mb-2"
        />
        <button
          onClick={submitHtml}
          disabled={saving || html.trim().length < 200}
          className="w-full bg-amber-600 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
        >
          {saving ? "更新中..." : "この内容で更新"}
        </button>
        {result && (
          <p className={`text-xs mt-2 ${result.ok ? "text-emerald-700" : "text-red-500"}`}>
            {result.ok ? "✓ " : "⚠️ "}{result.message}
          </p>
        )}
      </section>
    </main>
  );
}
