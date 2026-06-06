"use client";
import Link from "next/link";

const menu = [
  { href: "/matches", label: "公式戦管理", icon: "⚽", desc: "試合登録・配車当番の設定" },
  { href: "/coach-expenses", label: "コーチ飲食費", icon: "🧃", desc: "飲み物代・食事代の管理" },
  { href: "/parents", label: "保護者マスタ", icon: "👨‍👩‍👧", desc: "保護者・選手名の登録" },
  { href: "/export", label: "Excel出力", icon: "📊", desc: "精算書をダウンロード" },
  { href: "/settings", label: "設定", icon: "⚙️", desc: "チーム名・ガソリン単価" },
];

export default function Home() {
  return (
    <main className="max-w-lg mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <div className="text-4xl mb-2">⚽</div>
        <h1 className="text-2xl font-bold text-gray-800">配車精算アプリ</h1>
        <p className="text-gray-500 text-sm mt-1">トラヴェッソ 5年生</p>
      </div>
      <div className="grid gap-3">
        {menu.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center gap-4 active:bg-gray-50 transition-colors"
          >
            <span className="text-3xl">{item.icon}</span>
            <div>
              <div className="font-semibold text-gray-800">{item.label}</div>
              <div className="text-sm text-gray-500">{item.desc}</div>
            </div>
            <span className="ml-auto text-gray-400 text-xl">›</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
