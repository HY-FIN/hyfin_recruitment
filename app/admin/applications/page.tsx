"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import StatusBadge, { DocResultBadge, FinalResultBadge } from "@/components/StatusBadge";
import { formatPhone } from "@/lib/normalize";

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

interface InterviewSlot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  maxCount: number;
}

interface Applicant {
  id: string;
  name: string;
  phone: string;
  birthDate: string;
  email: string;
  address: string | null;
  gender: string;
  militaryStatus: string | null;
  studentId: string;
  grade: string;
  major: string;
  gpa: string;
  subMajor?: string;
  graduationPlan?: string;
  enrollmentStatus: string | null;
  careers: string;
  essay1: string;
  essay2: string;
  essay3: string;
  essay4: string;
  essay5: string | null;
  stage: string;
  docResult: string | null;
  finalResult: string | null;
  appliedAt: string;
  interviewPreferences: string;
  evaluations: Evaluation[];
  interviewSlot: InterviewSlot | null;
  finalQuestion: string | null;
}

interface CommonQuestion {
  id: string;
  day: number;
  questions: string; // JSON string array
}

const STAGE_OPTIONS = [
  { value: "", label: "전체" },
  { value: "SUBMITTED", label: "접수 완료" },
  { value: "DOC_REVIEWING", label: "서류 평가 중" },
  { value: "DOC_COMPLETED", label: "서류 결과 확정" },
  { value: "DOC_REJECTED", label: "서류 불합격" },
  { value: "INTERVIEW_READY", label: "면접 대기" },
  { value: "INTERVIEW_SET", label: "면접 일정 확정" },
  { value: "FINISHED", label: "전형 종료" },
];

type SortKey = "appliedAt" | "name" | "gpa" | "grade" | "avgDocScore" | "avgInterviewScore" | "finalResult";

// PASS → 0, FAIL 또는 서류 탈락 → 1, 미결정 → 2 (서버 저장값 기준)
function finalResultRank(a: Applicant): number {
  if (a.finalResult === "PASS") return 0;
  if (a.finalResult === "FAIL" || a.docResult === "FAIL") return 1;
  return 2;
}

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

function scoreColor(score: number): string {
  if (score < 3) return "text-red-500";
  if (score < 4) return "text-amber-500";
  if (score < 4.5) return "text-blue-600";
  return "text-green-600";
}

export default function ApplicationsPage() {
  const router = useRouter();
  const [user, setUser] = useState<HyfinUser | null>(null);
  const [token, setToken] = useState("");
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [filtered, setFiltered] = useState<Applicant[]>([]);
  const [stageFilter, setStageFilter] = useState("");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("appliedAt");
  const [loading, setLoading] = useState(true);
  const [commonQuestions, setCommonQuestions] = useState<CommonQuestion[]>([]);
  const [commonExpanded, setCommonExpanded] = useState(false);
  const [pending, setPending] = useState<Record<string, { docResult?: string; finalResult?: string }>>({});
  const [saving, setSaving] = useState(false);

  const pendingCount = Object.keys(pending).length;

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
    const res = await fetch("/api/admin/questions-sheet", {
      headers: { "x-admin-token": token },
    });
    const data = await res.json();
    setApplicants(data.applicants);
    setCommonQuestions(data.commonQuestions);
    setLoading(false);
  }, [token]);

  useEffect(() => {
    if (token) fetchAll();
  }, [token, fetchAll]);

  useEffect(() => {
    let result = [...applicants];
    if (stageFilter) {
      result = result.filter((a) => a.stage === stageFilter);
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
      if (sortKey === "grade") return a.grade.localeCompare(b.grade);
      if (sortKey === "avgDocScore") return (avgDocScore(b.evaluations) ?? -1) - (avgDocScore(a.evaluations) ?? -1);
      if (sortKey === "avgInterviewScore") return (avgInterviewScore(b.evaluations) ?? -1) - (avgInterviewScore(a.evaluations) ?? -1);
      if (sortKey === "finalResult") {
        const diff = finalResultRank(a) - finalResultRank(b);
        if (diff !== 0) return diff;
        return new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime();
      }
      return 0;
    });
    setFiltered(result);
  }, [stageFilter, search, sortKey, applicants]);

  // 즉시 PATCH 대신 로컬 pending에 쌓아뒀다가 저장 버튼으로 일괄 커밋
  const updatePending = (a: Applicant, field: "docResult" | "finalResult", value: string) => {
    setPending((prev) => {
      const next = { ...prev };
      const entry = { ...(next[a.id] ?? {}) };
      const serverValue = (field === "docResult" ? a.docResult : a.finalResult) ?? "";
      if (value === "" || value === serverValue) {
        delete entry[field];
      } else {
        entry[field] = value;
      }
      // 서류 합불이 PASS가 아니게 되면 최종 합불 select가 사라지므로 숨은 pending도 함께 제거
      if (field === "docResult") {
        const effDoc = entry.docResult ?? a.docResult ?? "";
        if (effDoc !== "PASS") delete entry.finalResult;
      }
      if (Object.keys(entry).length === 0) {
        delete next[a.id];
      } else {
        next[a.id] = entry;
      }
      return next;
    });
  };

  const savePending = async () => {
    const updates = Object.entries(pending).map(([id, changes]) => ({ id, ...changes }));
    if (updates.length === 0) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/applications/batch", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-token": token },
        body: JSON.stringify({ updates }),
      });
      if (!res.ok) throw new Error("batch save failed");
      setPending({});
      await fetchAll();
    } catch {
      alert("저장에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setSaving(false);
    }
  };

  const revertPending = () => {
    if (confirm(`변경사항 ${pendingCount}건을 모두 되돌리시겠습니까?`)) setPending({});
  };

  const confirmLeaveWithPending = () =>
    pendingCount === 0 || confirm("저장하지 않은 합불 변경사항이 있습니다. 이동하시겠습니까?");

  useEffect(() => {
    if (pendingCount === 0) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [pendingCount]);

  // 슬롯 날짜 정렬 인덱스 → Day 매핑 (전체 지원자 기준)
  const slotDates = [...new Set(
    applicants.map((a) => a.interviewSlot?.date).filter((d): d is string => !!d)
  )].sort();
  const dateToDay: Record<string, number> = {};
  slotDates.forEach((date, i) => { dateToDay[date] = i + 1; });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">지원자 관리</h1>
          <p className="text-sm text-gray-500 mt-1">전체 지원자 시트</p>
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
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
        >
          {STAGE_OPTIONS.map((o) => (
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
          <option value="grade">학년 순</option>
          <option value="avgDocScore">서류평균 순</option>
          <option value="avgInterviewScore">면접평균 순</option>
          <option value="finalResult">최종합불 순</option>
        </select>
        <span className="text-sm text-gray-400 self-center">{filtered.length}명</span>
        {pendingCount > 0 && (
          <div className="flex gap-2 ml-auto">
            <button
              onClick={revertPending}
              disabled={saving}
              className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 font-medium transition disabled:opacity-50"
            >
              {saving ? "저장 중..." : "되돌리기"}
            </button>
            <button
              onClick={savePending}
              disabled={saving}
              className="text-sm px-4 py-1.5 rounded-lg bg-hyfin-blue text-white hover:bg-blue-800 font-medium transition disabled:opacity-50"
            >
              {saving ? "저장 중..." : `변경사항 ${pendingCount}건 저장`}
            </button>
          </div>
        )}
      </div>

      {/* 공통 질문 패널 */}
      <div className="mb-4 border border-gray-200 rounded-xl overflow-hidden">
        <button
          onClick={() => setCommonExpanded((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 text-sm font-semibold text-gray-700 hover:bg-gray-100 transition"
        >
          <span>공통 질문 (면접 날짜별)</span>
          <span className="text-gray-400">{commonExpanded ? "▲" : "▼"}</span>
        </button>
        {commonExpanded && (
          <div className="p-4 grid grid-cols-3 gap-4">
            {commonQuestions.map((cq) => {
              const qs: string[] = JSON.parse(cq.questions || "[]");
              return (
                <div key={cq.id}>
                  <p className="text-xs font-semibold text-gray-500 mb-2">Day {cq.day}</p>
                  {qs.length === 0 ? (
                    <p className="text-xs text-gray-300">질문 없음</p>
                  ) : (
                    <ul className="space-y-1">
                      {qs.map((q, i) => (
                        <li key={i} className="text-xs text-gray-700 leading-relaxed">
                          {i + 1}. {q}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
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
                  "현재단계", "서류합불", "서류평균", "내서류평가", "면접평균", "내면접평가", "최종합불",
                  "면접 슬롯", "공통 질문", "최종 개인질문", "내 개인질문", "평가하러가기"
                ].map((col) => (
                  <th key={col} className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 whitespace-nowrap">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={19} className="text-center py-10 text-sm text-gray-400">지원자가 없습니다.</td>
                </tr>
              ) : (
                filtered.map((a) => {
                  const docAvg = avgDocScore(a.evaluations);
                  const intAvg = avgInterviewScore(a.evaluations);
                  const myEval = a.evaluations.find((e) => e.staffName === user?.id);
                  const rowPending = pending[a.id];
                  const effDocResult = rowPending?.docResult ?? a.docResult ?? "";
                  const effFinalResult = rowPending?.finalResult ?? a.finalResult ?? "";

                  const slotDate = a.interviewSlot?.date;
                  const day = slotDate ? dateToDay[slotDate] : undefined;
                  const cq = day !== undefined ? commonQuestions.find((q) => q.day === day) : undefined;
                  const commonQs: string[] = cq ? (JSON.parse(cq.questions || "[]") as string[]) : [];
                  const myPersonalQ = myEval?.personalQuestion ?? null;

                  return (
                    <tr key={a.id} className={`border-b border-gray-50 transition align-top ${rowPending ? "bg-amber-50" : "hover:bg-gray-50"}`}>
                      <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">
                        {new Date(a.appliedAt).toLocaleString("ko-KR", { year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", hour12:false })}
                      </td>
                      <td className="px-3 py-2.5 font-medium text-gray-900">{a.name}</td>
                      <td className="px-3 py-2.5 text-gray-600">{formatPhone(a.phone)}</td>
                      <td className="px-3 py-2.5 text-gray-600 max-w-[140px] truncate">{a.email}</td>
                      <td className="px-3 py-2.5 text-gray-600">{a.major}</td>
                      <td className="px-3 py-2.5 text-gray-600">{a.grade}</td>
                      <td className="px-3 py-2.5 text-gray-600">{a.gpa}</td>
                      <td className="px-3 py-2.5">
                        <StatusBadge status={a.stage} />
                      </td>
                      <td className="px-3 py-2.5">
                        {user?.role === "ADMIN" ? (
                          ["SUBMITTED", "DOC_REVIEWING", "DOC_COMPLETED"].includes(a.stage) ? (
                            <select
                              className={`text-xs border rounded px-1.5 py-1 bg-white ${rowPending?.docResult ? "border-amber-400" : "border-gray-200"}`}
                              value={effDocResult}
                              onChange={(e) => updatePending(a, "docResult", e.target.value)}
                            >
                              <option value="">미결정</option>
                              <option value="PASS">합격</option>
                              <option value="FAIL">불합격</option>
                            </select>
                          ) : a.docResult === "FAIL" ? (
                            <span className="text-xs font-medium text-red-500">불합격</span>
                          ) : (
                            <span className="text-xs font-medium text-green-600">합격</span>
                          )
                        ) : (
                          <DocResultBadge result={a.docResult as "PASS" | "FAIL" | null} />
                        )}
                      </td>
                      <td className="px-3 py-2.5 font-medium whitespace-nowrap">
                        {docAvg != null
                          ? <span className={scoreColor(docAvg)}>★ {docAvg.toFixed(1)}</span>
                          : <span className="text-gray-300">-</span>}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {myEval?.docScore != null
                          ? <span className="text-gray-700 font-medium">★ {myEval.docScore}</span>
                          : <span className="text-gray-300">-</span>}
                      </td>
                      <td className="px-3 py-2.5 font-medium whitespace-nowrap">
                        {intAvg != null
                          ? <span className={scoreColor(intAvg)}>★ {intAvg.toFixed(1)}</span>
                          : <span className="text-gray-300">-</span>}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {myEval?.interviewScore != null
                          ? <span className="text-gray-700 font-medium">★ {myEval.interviewScore}</span>
                          : <span className="text-gray-300">-</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        {effDocResult === "FAIL" ? (
                          <span className="text-xs font-medium text-red-500">최종 불합격</span>
                        ) : effDocResult === "PASS" && user?.role === "ADMIN" && a.stage !== "FINISHED" ? (
                          <select
                            className={`text-xs border rounded px-1.5 py-1 bg-white ${rowPending?.finalResult ? "border-amber-400" : "border-gray-200"}`}
                            value={effFinalResult}
                            onChange={(e) => updatePending(a, "finalResult", e.target.value)}
                          >
                            <option value="">미결정</option>
                            <option value="PASS">최종 합격</option>
                            <option value="FAIL">최종 불합격</option>
                          </select>
                        ) : effDocResult === "PASS" ? (
                          <FinalResultBadge result={a.finalResult as "PASS" | "FAIL" | null} />
                        ) : (
                          <span className="text-gray-300 text-xs">미확정</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">
                        {a.interviewSlot
                          ? `${a.interviewSlot.date} ${a.interviewSlot.startTime}~${a.interviewSlot.endTime}`
                          : <span className="text-gray-300">미배정</span>}
                      </td>
                      <td className="px-3 py-2.5 max-w-[220px]">
                        {commonQs.length === 0 ? (
                          <span className="text-gray-300 text-xs">없음</span>
                        ) : (
                          <ol className="space-y-1 list-none">
                            {commonQs.map((q, i) => (
                              <li key={i} className="text-xs text-gray-700 leading-relaxed">{i + 1}. {q}</li>
                            ))}
                          </ol>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-gray-700 max-w-[200px]">
                        {a.finalQuestion
                          ? <span className="text-xs leading-relaxed">{a.finalQuestion}</span>
                          : <span className="text-gray-300 text-xs">없음</span>}
                      </td>
                      <td className="px-3 py-2.5 max-w-[200px]">
                        {myPersonalQ
                          ? <span className="text-xs text-gray-700 leading-relaxed">{myPersonalQ}</span>
                          : <span className="text-gray-300 text-xs">없음</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        <button
                          onClick={() => {
                            if (!confirmLeaveWithPending()) return;
                            router.push(`/admin/applications/${a.id}`);
                          }}
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
