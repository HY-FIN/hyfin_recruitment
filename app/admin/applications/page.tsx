"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import StatusBadge from "@/components/StatusBadge";

interface HyfinUser {
  id: string;
  role: "ADMIN" | "STAFF";
  title?: string;
}

interface Evaluation {
  id: string;
  staffName: string;
  docScore: number | null;
  docComment: string | null;
  personalQuestion: string | null;
  interviewScore: number | null;
  interviewComment: string | null;
}

interface Applicant {
  id: string;
  name: string;
  phone: string;
  birthDate: string;
  email: string;
  address: string;
  university: string;
  grade: string;
  major: string;
  gpa: string;
  subMajor?: string;
  graduationPlan?: string;
  careers: string;
  essay1: string;
  essay2: string;
  essay3: string;
  essay4: string;
  status: string;
  appliedAt: string;
  receiptEmailSent: boolean;
  docEmailSent: boolean;
  interviewEmailSent: boolean;
  finalEmailSent: boolean;
  interviewPreferences: string;
  evaluations: Evaluation[];
}

const STATUS_OPTIONS = [
  { value: "", label: "전체" },
  { value: "PENDING", label: "검토 대기" },
  { value: "DOC_PASS", label: "서류 합격" },
  { value: "DOC_FAIL", label: "서류 불합격" },
  { value: "INTERVIEW", label: "면접 대상" },
  { value: "FINAL_PASS", label: "최종 합격" },
  { value: "FINAL_FAIL", label: "최종 불합격" },
];

type SortKey = "appliedAt" | "name" | "gpa" | "avgDocScore" | "avgInterviewScore";

function avgDocScore(evals: Evaluation[]): number | null {
  const scored = evals.filter((e) => e.docScore != null);
  if (scored.length === 0) return null;
  return scored.reduce((s, e) => s + (e.docScore ?? 0), 0) / scored.length;
}

function avgInterviewScore(evals: Evaluation[]): number | null {
  const scored = evals.filter((e) => e.interviewScore != null);
  if (scored.length === 0) return null;
  return scored.reduce((s, e) => s + (e.interviewScore ?? 0), 0) / scored.length;
}

export default function ApplicationsPage() {
  const router = useRouter();
  const [user, setUser] = useState<HyfinUser | null>(null);
  const [token, setToken] = useState("");
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [filtered, setFiltered] = useState<Applicant[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("appliedAt");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser = sessionStorage.getItem("hyfin_user");
    const savedToken = sessionStorage.getItem("hyfin_token");
    if (!savedUser || !savedToken) {
      router.replace("/admin");
      return;
    }
    setUser(JSON.parse(savedUser));
    setToken(savedToken);
  }, [router]);

  const fetchAll = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    const res = await fetch("/api/admin/applications", {
      headers: { "x-admin-token": token },
    });
    const data = await res.json();
    setApplicants(data);
    setLoading(false);
  }, [token]);

  useEffect(() => {
    if (token) fetchAll();
  }, [token, fetchAll]);

  useEffect(() => {
    let result = [...applicants];
    if (statusFilter) {
      if (statusFilter === "DOC_PASS") {
        result = result.filter((a) => ["DOC_PASS","INTERVIEW","FINAL_PASS","FINAL_FAIL"].includes(a.status));
      } else {
        result = result.filter((a) => a.status === statusFilter);
      }
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.email.toLowerCase().includes(q) ||
          a.major.toLowerCase().includes(q)
      );
    }
    result.sort((a, b) => {
      if (sortKey === "appliedAt") return new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime();
      if (sortKey === "name") return a.name.localeCompare(b.name);
      if (sortKey === "gpa") return parseFloat(b.gpa) - parseFloat(a.gpa);
      if (sortKey === "avgDocScore") return (avgDocScore(b.evaluations) ?? -1) - (avgDocScore(a.evaluations) ?? -1);
      if (sortKey === "avgInterviewScore") return (avgInterviewScore(b.evaluations) ?? -1) - (avgInterviewScore(a.evaluations) ?? -1);
      return 0;
    });
    setFiltered(result);
  }, [statusFilter, search, sortKey, applicants]);

  const changeStatus = async (id: string, status: string) => {
    await fetch(`/api/admin/applications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-admin-token": token },
      body: JSON.stringify({ status }),
    });
    await fetchAll();
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">지원자 관리</h1>
          <p className="text-sm text-gray-500 mt-1">전체 지원자 정보 시트</p>
        </div>
      </div>

      {/* 필터/정렬/검색 */}
      <div className="flex gap-3 mb-4">
        <input
          className="input text-sm w-56"
          placeholder="이름, 이메일, 학과 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="input text-sm w-36"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select
          className="input text-sm w-40"
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
        >
          <option value="appliedAt">제출일 순</option>
          <option value="name">이름 순</option>
          <option value="gpa">GPA 순</option>
          <option value="avgDocScore">서류평균 순</option>
          <option value="avgInterviewScore">면접평균 순</option>
        </select>
        <span className="text-sm text-gray-400 self-center">{filtered.length}명</span>
      </div>

      {/* 시트 테이블 */}
      {loading ? (
        <p className="text-sm text-gray-400">불러오는 중...</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {[
                  "제출일자", "이름", "전화번호", "이메일", "학과", "학년", "GPA",
                  "접수메일", "서류합불", "서류평균", "내평가", "면접시간제출", "최종합불", "면접평균", "평가하러가기"
                ].map((col) => (
                  <th key={col} className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 whitespace-nowrap">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={15} className="text-center py-10 text-sm text-gray-400">지원자가 없습니다.</td>
                </tr>
              ) : (
                filtered.map((a) => {
                  const docAvg = avgDocScore(a.evaluations);
                  const intAvg = avgInterviewScore(a.evaluations);
                  const myEval = a.evaluations.find((e) => e.staffName === user?.id);
                  const prefSubmitted = a.interviewPreferences !== "[]" && a.interviewPreferences !== "";

                  return (
                    <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                      <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">
                        {new Date(a.appliedAt).toLocaleString("ko-KR", { year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", hour12:false })}
                      </td>
                      <td className="px-3 py-2.5 font-medium text-gray-900">{a.name}</td>
                      <td className="px-3 py-2.5 text-gray-600">{a.phone}</td>
                      <td className="px-3 py-2.5 text-gray-600 max-w-[140px] truncate">{a.email}</td>
                      <td className="px-3 py-2.5 text-gray-600">{a.major}</td>
                      <td className="px-3 py-2.5 text-gray-600">{a.grade}</td>
                      <td className="px-3 py-2.5 text-gray-600">{a.gpa}</td>
                      <td className="px-3 py-2.5 text-center">
                        {a.receiptEmailSent ? <span className="text-green-600">✓</span> : <span className="text-gray-300">-</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        {user?.role === "ADMIN" ? (
                          <select
                            className="text-xs border border-gray-200 rounded px-1.5 py-1 bg-white"
                            value={["INTERVIEW","FINAL_PASS","FINAL_FAIL"].includes(a.status) ? "DOC_PASS" : a.status}
                            onChange={(e) => changeStatus(a.id, e.target.value)}
                          >
                            <option value="PENDING">검토 대기</option>
                            <option value="DOC_PASS">서류 합격</option>
                            <option value="DOC_FAIL">서류 불합격</option>
                          </select>
                        ) : (
                          <StatusBadge status={a.status} />
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-amber-600 font-medium whitespace-nowrap">
                        {docAvg != null ? `★ ${docAvg.toFixed(1)}` : "-"}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {myEval?.docScore != null
                          ? <span className="text-blue-600 font-medium">★ {myEval.docScore}</span>
                          : <span className="text-gray-300">-</span>}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {prefSubmitted ? <span className="text-green-600">✓</span> : <span className="text-gray-300">-</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        {a.status === "DOC_FAIL" ? (
                          <span className="text-xs text-red-500 font-medium">최종 탈락</span>
                        ) : a.status === "PENDING" ? (
                          <span className="text-gray-300 text-xs">미확정</span>
                        ) : user?.role === "ADMIN" ? (
                          <select
                            className="text-xs border border-gray-200 rounded px-1.5 py-1 bg-white"
                            value={["INTERVIEW","FINAL_PASS","FINAL_FAIL"].includes(a.status) ? a.status : "INTERVIEW"}
                            onChange={(e) => changeStatus(a.id, e.target.value)}
                          >
                            <option value="INTERVIEW">면접 대상</option>
                            <option value="FINAL_PASS">최종 합격</option>
                            <option value="FINAL_FAIL">최종 불합격</option>
                          </select>
                        ) : (
                          <StatusBadge status={a.status} />
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-purple-600 font-medium whitespace-nowrap">
                        {intAvg != null ? `★ ${intAvg.toFixed(1)}` : "-"}
                      </td>
                      <td className="px-3 py-2.5">
                        <button
                          onClick={() => router.push(`/admin/applications/${a.id}`)}
                          className="text-xs text-white bg-hyfin-blue hover:bg-blue-800 px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap"
                        >
                          평가하러가기 →
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
