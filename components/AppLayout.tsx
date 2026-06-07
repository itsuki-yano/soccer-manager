"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV_ITEMS = [
  { href: "/matches",        icon: "⚽", label: "試合・合宿管理" },
  { href: "/coach-expenses", icon: "🧃", label: "コーチ飲食費" },
  { href: "/parents",        icon: "👟", label: "選手マスタ" },
  { href: "/export",         icon: "📊", label: "Excel出力" },
  { href: "/equipment",      icon: "🎒", label: "備品管理" },
  { href: "/fees",           icon: "💰", label: "費用徴収管理" },
  { href: "/memo",           icon: "📝", label: "備忘録" },
  { href: "/settings",       icon: "⚙️",  label: "設定" },
];

function Sidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  return (
    <div className="flex flex-col h-full bg-white">
      {/* ロゴ */}
      <Link
        href="/"
        onClick={onClose}
        className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 hover:bg-gray-50 transition-colors"
      >
        <span className="text-3xl">⚽</span>
        <div>
          <div className="font-bold text-gray-800 text-sm leading-tight">マネジメントApp</div>
          <div className="text-xs text-gray-400 mt-0.5">トラヴェッソ 5年生</div>
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
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-800"
              }`}
            >
              <span className="text-xl w-7 text-center flex-shrink-0">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {active && (
                <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
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
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      {/* ─── PC用サイドバー（md以上で常に表示）─── */}
      <aside className="hidden md:flex flex-col w-64 fixed left-0 top-0 h-screen border-r border-gray-200 z-30 shadow-sm">
        <Sidebar />
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
            <Sidebar onClose={() => setMobileOpen(false)} />
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
