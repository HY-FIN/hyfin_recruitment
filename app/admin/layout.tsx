"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/admin", label: "대시보드", icon: "📊" },
  { href: "/admin/applications", label: "지원자 관리", icon: "📋" },
  { href: "/admin/interviews", label: "면접 관리", icon: "🎤" },
  { href: "/admin/notifications", label: "알림 발송", icon: "📧" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* 사이드바 */}
      <aside className="w-56 bg-hyfin-blue text-white flex flex-col fixed top-0 left-0 h-full z-10">
        <div className="px-5 py-6 border-b border-blue-800">
          <p className="text-xs text-blue-300 font-medium">HYFIN 운영진</p>
          <h1 className="text-lg font-bold mt-0.5">리크루팅 관리</h1>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const active = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                  active ? "bg-white/15 text-white" : "text-blue-200 hover:bg-white/10 hover:text-white"
                }`}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="px-5 py-4 border-t border-blue-800">
          <p className="text-xs text-blue-400">HYFIN Recruitment v1.0</p>
        </div>
      </aside>

      {/* 메인 콘텐츠 */}
      <main className="flex-1 ml-56 min-h-screen">
        {children}
      </main>
    </div>
  );
}
