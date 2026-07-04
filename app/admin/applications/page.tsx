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

interface Applicant {
  id: string;
  name: string;
  phone: string;
  birthDate: string;
  email: string;
  address: string | null;
  gender: string;
  studentId: string;
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
  stage: string;
  docResult: string | null;
  finalResult: string | null;
  appliedAt: string;
  interviewPreferences: string;
  evaluations: Evaluation[];
}

interface InterviewSlot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  maxCount: number;
}

interface CommonQuestion {
  id: string;
  day: number;
  questions: string; // JSON string array
}

interface ApplicantWithQuestions extends Applicant {
  interviewSlot: InterviewSlot | null;
  finalQuestion: string | null;
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

type SortKey = "appliedAt" | "name" | "gpa" | "grade" | "avgDocScore" | "avgInterviewScore";

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
  const [sheetTab, setSheetTab] = useState<"info" | "questions">("info");
  const [questionApplicants, setQuestionApplicants] = useState<ApplicantWithQuestions[]>([]);
  const [commonQuestions, setCommonQuestions] = useState<CommonQuestion[]>([]);
  const [questionLoading, setQuestionLoading] = useState(false);
  const [commonExpanded, setCommonExpanded] = useState(false);

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

  const fetchQuestionSheet = useCallback(async () => {
    if (!token) return;
    setQuestionLoading(true);
    const res = await fetch("/api/admin/questions-sheet", {
      headers: { "x-admin-token": token },
    });
    const data = await res.json();
    setQuestionApplicants(data.applicants);
    setCommonQuestions(data.commonQuestions);
    setQuestionLoading(false);
  }, [token]);

  useEffect(() => {
    if (token) fetchAll();
  }, [token, fetchAll]);

  useEffect(() => {
    if (sheetTab === "questions" && token) fetchQuestionSheet();
  }, [sheetTab, token, fetchQuestionSheet]);

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
      return 0;
    });
    setFiltered(result);
  }, [stageFilter, search, sortKey, applicants]);

  const changeDocResult = async (id: string, docResult: string) => {
    await fetch(`/api/admin/applications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-admin-token": token },
      body: JSON.stringify({ docResult, stage: "DOC_COMPLETED" }),
    });
    await fetchAll();
  };

  const changeFinalResult = async (id: string, finalResult: string) => {
    await fetch(`/api/admin/applications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-admin-token": token },
      body: JSON.stringify({ finalResult }),
    });
    await fetchAll();
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">지원자 관리</h1>
          <p className="text-sm text-gray-500 mt-1">전체 지원자 시트</p>
        </div>
      </div>

      {/* 탭 전환 */}
      <div className="flex gap-1 mb-5 border-b border-gray-200">
        <button
          onClick={() => setSheetTab("info")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
            sheetTab === "info"
              ? "border-hyfin-blue text-hyfin-blue"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          전체 지원자 정보 시트
        </button>
        <button
          onClick={() => setSheetTab("questions")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
            sheetTab === "questions"
              ? "border-hyfin-blue text-hyfin-blue"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          전체 지원자 질문 시트
        </button>
      </div>

      {sheetTab === "info" && (
        <>
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
                      "현재단계", "서류합불", "서류평균", "내서류평가", "면접평균", "내면접평가", "최종합불", "평가하러가기"
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

                      return (
                        <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
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
                                  className="text-xs border border-gray-200 rounded px-1.5 py-1 bg-white"
                                  value={a.docResult ?? ""}
                                  onChange={(e) => e.target.value && changeDocResult(a.id, e.target.value)}
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
                            {a.docResult === "FAIL" ? (
                              <span className="text-xs font-medium text-red-500">최종 불합격</span>
                            ) : a.docResult === "PASS" && user?.role === "ADMIN" && a.stage !== "FINISHED" ? (
                              <select
                                className="text-xs border border-gray-200 rounded px-1.5 py-1 bg-white"
                                value={a.finalResult ?? ""}
                                onChange={(e) => e.target.value && changeFinalResult(a.id, e.target.value)}
                              >
                                <option value="">미결정</option>
                                <option value="PASS">최종 합격</option>
                                <option value="FAIL">최종 불합격</option>
                              </select>
                            ) : a.docResult === "PASS" ? (
                              <FinalResultBadge result={a.finalResult as "PASS" | "FAIL" | null} />
                            ) : (
                              <span className="text-gray-300 text-xs">미확정</span>
                            )}
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
        </>
      )}

      {sheetTab === "questions" && (
        <div>
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

          {/* 질문 시트 테이블 */}
          {questionLoading ? (
            <p className="text-sm text-gray-400">불러오는 중...</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {["이름", "현재단계", "면접 슬롯", "공통 질문", "최종 개인 질문", "내 개인 질문"].map((col) => (
                      <th key={col} className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 whitespace-nowrap">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {questionApplicants.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-10 text-sm text-gray-400">지원자가 없습니다.</td>
                    </tr>
                  ) : (() => {
                    const slotDates = [...new Set(
                      questionApplicants.map((a) => a.interviewSlot?.date).filter((d): d is string => !!d)
                    )].sort();
                    const dateToDay: Record<string, number> = {};
                    slotDates.forEach((date, i) => { dateToDay[date] = i + 1; });

                    return questionApplicants.map((a) => {
                      const slotDate = a.interviewSlot?.date;
                      const day = slotDate ? dateToDay[slotDate] : undefined;
                      const cq = day !== undefined ? commonQuestions.find((q) => q.day === day) : undefined;
                      const commonQs: string[] = cq ? (JSON.parse(cq.questions || "[]") as string[]) : [];
                      const myPersonalQ = a.evaluations.find((e) => e.staffName === user?.id)?.personalQuestion ?? null;

                      return (
                        <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50 transition align-top">
                          <td className="px-3 py-2.5 font-medium text-gray-900 whitespace-nowrap">{a.name}</td>
                          <td className="px-3 py-2.5">
                            <StatusBadge status={a.stage} />
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
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
