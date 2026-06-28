"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Stats {
  total: number;
  pending: number;
  docPass: number;
  docFail: number;
  interview: number;
  finalPass: number;
  finalFail: number;
}

interface HyfinUser {
  id: string;
  role: "ADMIN" | "STAFF";
  title?: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<HyfinUser | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser = sessionStorage.getItem("hyfin_user");
    const token = sessionStorage.getItem("hyfin_token");
    if (!savedUser || !token) {
      router.replace("/admin");
      return;
    }
    const u = JSON.parse(savedUser) as HyfinUser;
    setUser(u);

    (async () => {
      try {
        const res = await fetch("/api/admin/applications", {
          headers: { "x-admin-token": token },
        });
        if (!res.ok) {
          sessionStorage.removeItem("hyfin_user");
          sessionStorage.removeItem("hyfin_token");
          router.replace("/admin");
          return;
        }
        const data = await res.json();
        setStats({
          total: data.length,
          pending: data.filter((a: { status: string }) => a.status === "PENDING").length,
          docPass: data.filter((a: { status: string }) => a.status === "DOC_PASS").length,
          docFail: data.filter((a: { status: string }) => a.status === "DOC_FAIL").length,
          interview: data.filter((a: { status: string }) => a.status === "INTERVIEW").length,
          finalPass: data.filter((a: { status: string }) => a.status === "FINAL_PASS").length,
          finalFail: data.filter((a: { status: string }) => a.status === "FINAL_FAIL").length,
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const statCards = [
    { label: "전체 지원자", value: stats?.total ?? "-", color: "bg-blue-50 text-blue-700" },
    { label: "검토 대기", value: stats?.pending ?? "-", color: "bg-gray-50 text-gray-600" },
    { label: "서류 합격", value: stats?.docPass ?? "-", color: "bg-green-50 text-green-700" },
    { label: "서류 불합격", value: stats?.docFail ?? "-", color: "bg-red-50 text-red-600" },
    { label: "면접 대상", value: stats?.interview ?? "-", color: "bg-purple-50 text-purple-700" },
    { label: "최종 합격", value: stats?.finalPass ?? "-", color: "bg-emerald-50 text-emerald-700" },
  ];

  const menuItems = [
    {
      href: "/admin/applications",
      icon: "📋",
      title: "지원자 관리",
      desc: "서류 평가 및 합불 처리",
      adminOnly: false,
    },
    {
      href: "/admin/interviews",
      icon: "🎤",
      title: "면접 관리",
      desc: "면접 캘린더 및 면접 평가",
      adminOnly: false,
    },
    {
      href: "/admin/notifications",
      icon: "📧",
      title: "메일 발송",
      desc: "접수 확인, 합불 결과 발송",
      adminOnly: true,
    },
  ];

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>
        <p className="text-sm text-gray-500 mt-1">HYFIN 8기 리크루팅 현황</p>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">불러오는 중...</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4 mb-8">
            {statCards.map((card) => (
              <div key={card.label} className={`rounded-xl p-5 ${card.color}`}>
                <p className="text-sm font-medium opacity-70">{card.label}</p>
                <p className="text-3xl font-bold mt-1">{card.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-4">
            {menuItems.map((item) => {
              if (item.adminOnly && user?.role !== "ADMIN") return null;
              return (
                <button
                  key={item.href}
                  onClick={() => router.push(item.href)}
                  className="section-card text-left hover:shadow-md transition cursor-pointer"
                >
                  <p className="text-2xl mb-2">{item.icon}</p>
                  <h3 className="font-semibold text-gray-900">{item.title}</h3>
                  <p className="text-sm text-gray-500 mt-1">{item.desc}</p>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
