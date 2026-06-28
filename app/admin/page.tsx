"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem("hyfin_user");
    if (saved) {
      router.replace("/admin/dashboard");
    }
  }, [router]);

  const login = async () => {
    if (!id.trim() || !password.trim()) {
      setError("이름과 비밀번호를 입력해 주세요.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: id.trim(), password: password.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "로그인에 실패했습니다.");
        return;
      }
      // sessionStorage에 사용자 정보 저장
      sessionStorage.setItem("hyfin_user", JSON.stringify({ id: data.id, role: data.role, title: data.title }));
      // 토큰: btoa("이름:비밀번호")
      const token = btoa(`${id.trim()}:${password.trim()}`);
      sessionStorage.setItem("hyfin_token", token);
      router.push("/admin/dashboard");
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-hyfin-blue">HYFIN 운영진 로그인</h1>
          <p className="text-sm text-gray-500 mt-1">이름과 비밀번호를 입력해 주세요.</p>
        </div>
        {error && <p className="text-sm text-red-500 mb-3 text-center">{error}</p>}
        <div className="space-y-3">
          <div>
            <label className="label text-xs">이름</label>
            <input
              type="text"
              className="input"
              value={id}
              onChange={(e) => setId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && login()}
              placeholder="예) 한민우"
              autoFocus
            />
          </div>
          <div>
            <label className="label text-xs">비밀번호 (8자리)</label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && login()}
              placeholder="비밀번호 8자리"
            />
          </div>
          <button
            onClick={login}
            disabled={loading}
            className="btn-primary w-full mt-2"
          >
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </div>
      </div>
    </div>
  );
}
