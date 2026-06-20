"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

const NAV_ITEMS = [
  { href: "/matches",        icon: "⚽", label: "試合・合宿管理" },
  { href: "/practices",      icon: "🏃", label: "通常練習" },
  { href: "/duty-roster",   icon: "📅", label: "当番一覧" },
  { href: "/roles",          icon: "📋", label: "役割予定" },
  { href: "/coach-expenses", icon: "🧃", label: "コーチ飲食費" },
  { href: "/parents",        icon: "👟", label: "選手マスタ" },
  { href: "/export",         icon: "📊", label: "Excel出力" },
  { href: "/equipment",      icon: "🎒", label: "備品管理" },
  { href: "/fees",           icon: "💰", label: "費用徴収管理" },
  { href: "/memo",           icon: "📝", label: "備忘録" },
  { href: "/settings",       icon: "⚙️",  label: "設定" },
];

function Sidebar({ onClose, logoUrl, teamName }: { onClose?: () => void; logoUrl?: string; teamName?: string }) {
  const pathname = usePathname();
  return (
    <div className="flex flex-col h-full bg-white">
      {/* ロゴ */}
      <Link
        href="/"
        onClick={onClose}
        className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 hover:bg-gray-50 transition-colors"
      >
        <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center bg-gray-50 flex-shrink-0">
          {logoUrl ? (
            <Image src={logoUrl} alt="ロゴ" width={40} height={40} className="w-full h-full object-contain" />
          ) : (
            <span className="text-2xl">⚽</span>
          )}
        </div>
        <div>
          <div className="font-bold text-gray-800 text-sm leading-tight">マネジメントApp</div>
          <div className="text-xs text-gray-400 mt-0.5">{teamName || "トラヴェッソ 5年生"}</div>
        </div>
      </Link>

      {/* ナビゲーション */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1 text-sm font-medium transition-colors ${
                active
                  ? "bg-stone-100 text-stone-800"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-800"
              }`}
            >
              <span className="text-xl w-7 text-center flex-shrink-0">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {active && (
                <span className="w-2 h-2 bg-stone-700 rounded-full flex-shrink-0" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* フッター */}
      <div className="px-5 py-3 border-t border-gray-100">
        <p className="text-xs text-gray-400">Powered by Vercel</p>
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [logoUrl, setLogoUrl] = useState("");
  const [teamName, setTeamName] = useState("");
  const pathname = usePathname();

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then((d) => {
      setLogoUrl(d.logoUrl ?? "");
      setTeamName(d.teamName ?? "");
    });
  }, []);

  return (
    <div className="flex min-h-screen">
      {/* ─── PC用サイドバー（md以上で常に表示）─── */}
      <aside className="hidden md:flex flex-col w-64 fixed left-0 top-0 h-screen border-r border-gray-200 z-30 shadow-sm">
        <Sidebar logoUrl={logoUrl} teamName={teamName} />
      </aside>

      {/* ─── スマホ用ドロワー ─── */}
      {mobileOpen && (
        <>
          {/* オーバーレイ */}
          <div
            className="fixed inset-0 bg-black/40 z-40 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
          {/* ドロワー本体 */}
          <div className="fixed left-0 top-0 h-full w-72 z-50 shadow-2xl md:hidden">
            <Sidebar onClose={() => setMobileOpen(false)} logoUrl={logoUrl} teamName={teamName} />
          </div>
        </>
      )}

      {/* ─── スマホ用ハンバーガーボタン ─── */}
      <button
        className="fixed top-3 left-3 z-30 md:hidden bg-white rounded-xl shadow-sm border border-gray-200 p-2.5 active:bg-gray-50"
        onClick={() => setMobileOpen(true)}
        aria-label="メニューを開く"
      >
        <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* ─── メインコンテンツ ─── */}
      <main className="flex-1 md:ml-64 min-w-0">
        {children}
      </main>
    </div>
  );
}
