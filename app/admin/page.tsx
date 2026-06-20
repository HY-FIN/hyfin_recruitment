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

const ADMIN_TOKEN_KEY = "hyfin_admin_token";

export default function AdminDashboard() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [input, setInput] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const saved = sessionStorage.getItem(ADMIN_TOKEN_KEY);
    if (saved) {
      setToken(saved);
      fetchStats(saved);
    }
  }, []);

  const fetchStats = async (t: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/applications", {
        headers: { "x-admin-token": t },
      });
      if (!res.ok) throw new Error("인증 실패");
      const data = await res.json();
      const s: Stats = {
        total: data.length,
        pending: data.filter((a: { status: string }) => a.status === "PENDING").length,
        docPass: data.filter((a: { status: string }) => a.status === "DOC_PASS").length,
        docFail: data.filter((a: { status: string }) => a.status === "DOC_FAIL").length,
        interview: data.filter((a: { status: string }) => a.status === "INTERVIEW").length,
        finalPass: data.filter((a: { status: string }) => a.status === "FINAL_PASS").length,
        finalFail: data.filter((a: { status: string }) => a.status === "FINAL_FAIL").length,
      };
      setStats(s);
    } catch {
      setError("인증에 실패했습니다.");
      sessionStorage.removeItem(ADMIN_TOKEN_KEY);
      setToken("");
    } finally {
      setLoading(false);
    }
  };

  const login = async () => {
    sessionStorage.setItem(ADMIN_TOKEN_KEY, input);
    setToken(input);
    await fetchStats(input);
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-sm">
          <div className="text-center mb-6">
            <h1 className="text-xl font-bold text-hyfin-blue">HYFIN 운영진 로그인</h1>
            <p className="text-sm text-gray-500 mt-1">관리자 비밀번호를 입력해 주세요.</p>
          </div>
          {error && <p className="text-sm text-red-500 mb-3 text-center">{error}</p>}
          <input
            type="password"
            className="input mb-3"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && login()}
            placeholder="비밀번호"
          />
          <button onClick={login} className="btn-primary w-full">로그인</button>
        </div>
      </div>
    );
  }

  const statCards = [
    { label: "전체 지원자", value: stats?.total ?? "-", color: "bg-blue-50 text-blue-700" },
    { label: "검토 대기", value: stats?.pending ?? "-", color: "bg-gray-50 text-gray-600" },
    { label: "서류 합격", value: stats?.docPass ?? "-", color: "bg-green-50 text-green-700" },
    { label: "서류 불합격", value: stats?.docFail ?? "-", color: "bg-red-50 text-red-600" },
    { label: "면접 대상", value: stats?.interview ?? "-", color: "bg-purple-50 text-purple-700" },
    { label: "최종 합격", value: stats?.finalPass ?? "-", color: "bg-emerald-50 text-emerald-700" },
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
        <div className="grid grid-cols-3 gap-4 mb-8">
          {statCards.map((card) => (
            <div key={card.label} className={`rounded-xl p-5 ${card.color}`}>
              <p className="text-sm font-medium opacity-70">{card.label}</p>
              <p className="text-3xl font-bold mt-1">{card.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <button onClick={() => router.push("/admin/applications")} className="section-card text-left hover:shadow-md transition cursor-pointer">
          <p className="text-2xl mb-2">📋</p>
          <h3 className="font-semibold text-gray-900">지원자 관리</h3>
          <p className="text-sm text-gray-500 mt-1">서류 평가 및 합불 처리</p>
        </button>
        <button onClick={() => router.push("/admin/notifications")} className="section-card text-left hover:shadow-md transition cursor-pointer">
          <p className="text-2xl mb-2">📧</p>
          <h3 className="font-semibold text-gray-900">이메일 발송</h3>
          <p className="text-sm text-gray-500 mt-1">접수 확인, 합불 결과 발송</p>
        </button>
      </div>
    </div>
  );
}
