"use client";

import { useEffect, useState } from "react";
import StatusBadge from "@/components/StatusBadge";

const ADMIN_TOKEN_KEY = "hyfin_admin_token";

interface Applicant {
  id: string;
  name: string;
  phone: string;
  email: string;
  major: string;
  grade: string;
  status: string;
  evaluations: { score: number }[];
}

export default function InterviewsPage() {
  const token = typeof window !== "undefined" ? sessionStorage.getItem(ADMIN_TOKEN_KEY) ?? "" : "";
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [interviewDate, setInterviewDate] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/admin/applications?status=DOC_PASS", { headers: { "x-admin-token": token } });
      const interviewRes = await fetch("/api/admin/applications?status=INTERVIEW", { headers: { "x-admin-token": token } });
      const [docPass, interview] = await Promise.all([res.json(), interviewRes.json()]);
      setApplicants([...docPass, ...interview]);
      setLoading(false);
    })();
  }, []);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(applicants.map((a) => a.id)));
  const clearAll = () => setSelectedIds(new Set());

  const promoteToInterview = async (id: string) => {
    await fetch(`/api/admin/applications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-admin-token": token },
      body: JSON.stringify({ status: "INTERVIEW" }),
    });
    window.location.reload();
  };

  const sendInterviewEmail = async () => {
    if (!interviewDate.trim()) return alert("면접 일시를 입력해 주세요.");
    if (selectedIds.size === 0) return alert("대상자를 선택해 주세요.");
    setSending(true);
    const res = await fetch("/api/admin/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-token": token },
      body: JSON.stringify({ applicantIds: Array.from(selectedIds), type: "INTERVIEW", interviewDate }),
    });
    const data = await res.json();
    setSending(false);
    alert(`발송 완료: ${data.success}/${data.total}명 성공`);
  };

  const avgScore = (evals: { score: number }[]) =>
    evals.length ? (evals.reduce((s, e) => s + e.score, 0) / evals.length).toFixed(1) : "-";

  const interviewCandidates = applicants.filter((a) => a.status === "INTERVIEW");
  const docPassPending = applicants.filter((a) => a.status === "DOC_PASS");

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">면접 관리</h1>
        <p className="text-sm text-gray-500 mt-1">면접 대상자 지정 및 면접 안내 발송</p>
      </div>

      {/* 면접 일정 설정 */}
      <div className="section-card mb-6">
        <h2 className="section-title">면접 안내 이메일 발송</h2>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="label text-xs">면접 일시</label>
            <input className="input text-sm" value={interviewDate} onChange={(e) => setInterviewDate(e.target.value)} placeholder="예) 2025년 3월 8일(토) 오후 2시, 한양대학교 경영관 105호" />
          </div>
          <div className="flex gap-2">
            <button onClick={selectAll} className="btn-secondary text-xs">전체 선택</button>
            <button onClick={clearAll} className="btn-secondary text-xs">선택 해제</button>
            <button onClick={sendInterviewEmail} disabled={sending} className="btn-primary text-sm">
              {sending ? "발송 중..." : `면접 안내 발송 (${selectedIds.size}명)`}
            </button>
          </div>
        </div>
      </div>

      {/* 면접 대상자 */}
      <div className="section-card mb-6">
        <h2 className="section-title">면접 대상자 ({interviewCandidates.length}명)</h2>
        {loading ? (
          <p className="text-sm text-gray-400">불러오는 중...</p>
        ) : interviewCandidates.length === 0 ? (
          <p className="text-sm text-gray-400">면접 대상자가 없습니다.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 w-8"><input type="checkbox" onChange={(e) => e.target.checked ? interviewCandidates.forEach((a) => toggleSelect(a.id)) : clearAll()} /></th>
                <th className="text-left py-2 font-medium text-gray-500">이름</th>
                <th className="text-left py-2 font-medium text-gray-500">학과</th>
                <th className="text-left py-2 font-medium text-gray-500">연락처</th>
                <th className="text-left py-2 font-medium text-gray-500">이메일</th>
                <th className="text-left py-2 font-medium text-gray-500">평균 점수</th>
                <th className="text-left py-2 font-medium text-gray-500">상태</th>
              </tr>
            </thead>
            <tbody>
              {interviewCandidates.map((a) => (
                <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2"><input type="checkbox" checked={selectedIds.has(a.id)} onChange={() => toggleSelect(a.id)} /></td>
                  <td className="py-2 font-medium">{a.name}</td>
                  <td className="py-2 text-gray-600">{a.major}</td>
                  <td className="py-2 text-gray-600">{a.phone}</td>
                  <td className="py-2 text-gray-600">{a.email}</td>
                  <td className="py-2 text-amber-600 font-medium">★ {avgScore(a.evaluations)}</td>
                  <td className="py-2"><StatusBadge status={a.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 서류 합격자 (아직 면접 미지정) */}
      {docPassPending.length > 0 && (
        <div className="section-card">
          <h2 className="section-title">서류 합격자 - 면접 미지정 ({docPassPending.length}명)</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 font-medium text-gray-500">이름</th>
                <th className="text-left py-2 font-medium text-gray-500">학과</th>
                <th className="text-left py-2 font-medium text-gray-500">평균 점수</th>
                <th className="text-left py-2 font-medium text-gray-500">액션</th>
              </tr>
            </thead>
            <tbody>
              {docPassPending.map((a) => (
                <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2 font-medium">{a.name}</td>
                  <td className="py-2 text-gray-600">{a.major}</td>
                  <td className="py-2 text-amber-600 font-medium">★ {avgScore(a.evaluations)}</td>
                  <td className="py-2">
                    <button onClick={() => promoteToInterview(a.id)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                      면접 대상 지정 →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
