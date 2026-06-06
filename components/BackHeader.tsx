"use client";
import Link from "next/link";

export default function BackHeader({ title, back = "/" }: { title: string; back?: string }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <Link href={back} className="text-blue-500 text-2xl leading-none">‹</Link>
      <h1 className="text-xl font-bold text-gray-800">{title}</h1>
    </div>
  );
}
