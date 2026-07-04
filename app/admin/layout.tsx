"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface HyfinUser {
  id: string;
  role: "ADMIN" | "STAFF";
  title?: string;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<HyfinUser | null>(null);

  useEffect(() => {
    const saved = sessionStorage.getItem("hyfin_user");
    if (!saved) {
      // 로그인 페이지 자체에서는 리다이렉트 하지 않음
      if (pathname !== "/admin") {
        router.replace("/admin");
      }
      return;
    }
    setUser(JSON.parse(saved));
  }, [pathname, router]);

  const logout = () => {
    sessionStorage.removeItem("hyfin_user");
    sessionStorage.removeItem("hyfin_token");
    router.push("/admin");
  };

  // 로그인 페이지는 레이아웃 없이 렌더링
  if (pathname === "/admin") {
    return <>{children}</>;
  }

  const navItems = [
    { href: "/admin/dashboard", label: "대시보드", icon: "📊", adminOnly: false },
    { href: "/admin/applications", label: "지원자 관리", icon: "📋", adminOnly: false },
    { href: "/admin/interviews", label: "면접 관리", icon: "🎤", adminOnly: false },
    { href: "/admin/notifications", label: "메일 발송", icon: "📧", adminOnly: true },
    { href: "/admin/backup", label: "백업", icon: "💾", adminOnly: true },
  ];

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* 사이드바 */}
      <aside className="w-56 bg-hyfin-blue text-white flex flex-col fixed top-0 left-0 h-full z-10">
        <div className="px-5 py-5 border-b border-blue-800">
          <p className="text-xs text-blue-300 font-medium">HYFIN 운영진</p>
          <h1 className="text-lg font-bold mt-0.5">리크루팅 관리</h1>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            if (item.adminOnly && user?.role !== "ADMIN") return null;
            const active =
              pathname === item.href ||
              (item.href !== "/admin/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                  active
                    ? "bg-white/15 text-white"
                    : "text-blue-200 hover:bg-white/10 hover:text-white"
                }`}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* 사용자 정보 + 로그아웃 */}
        <div className="px-5 py-4 border-t border-blue-800">
          {user && (
            <div className="mb-3">
              <p className="text-sm font-semibold text-white">{user.id}</p>
              <p className="text-xs text-blue-300">
                {user.title ? `${user.title} ` : ""}
                <span className={`font-medium ${user.role === "ADMIN" ? "text-yellow-300" : "text-blue-300"}`}>
                  ({user.role === "ADMIN" ? "관리자" : "운영진"})
                </span>
              </p>
            </div>
          )}
          <button
            onClick={logout}
            className="w-full text-left text-xs text-blue-300 hover:text-white transition py-1"
          >
            로그아웃
          </button>
        </div>
      </aside>

      {/* 메인 콘텐츠 */}
      <main className="flex-1 ml-56 min-h-screen">{children}</main>
    </div>
  );
}
