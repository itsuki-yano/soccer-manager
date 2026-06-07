"use client";
import Link from "next/link";

export default function BackHeader({ title, back = "/" }: { title: string; back?: string }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      {/* スマホのみ戻るボタン表示（PCはサイドバーで移動） */}
      <Link href={back} className="text-blue-500 text-2xl leading-none md:hidden">‹</Link>
      <h1 className="text-xl md:text-2xl font-bold text-gray-800">{title}</h1>
    </div>
  );
}
