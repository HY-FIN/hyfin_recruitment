"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
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

interface SlotInfo {
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
  email: string;
  grade: string;
  major: string;
  gpa: string;
  stage: string;
  docResult: string | null;
  finalResult: string | null;
  appliedAt: string;
  evaluations: Evaluation[];
  interviewSlot: SlotInfo | null;
  finalQuestion: string | null;
}

interface CommonQuestion {
  id: string;
  day: number;
  questions: string; // JSON string array
}

const DATE_LABELS: Record<string, string> = {
  "2026-08-19": "8/19 (수)",
  "2026-08-20": "8/20 (목)",
  "2026-08-21": "8/21 (금)",
};

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

export default function InterviewSlotDetailPage() {
  const router = useRouter();
  const params = useParams<{ slotId: string }>();
  const slotId = params.slotId;

  const [user, setUser] = useState<HyfinUser | null>(null);
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [slot, setSlot] = useState<SlotInfo | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [dayNumber, setDayNumber] = useState<number | null>(null);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [commonQuestions, setCommonQuestions] = useState<CommonQuestion[]>([]);

  // 면접 평가 입력 (null = 점수 미선택 — 3으로 폴백하지 않음)
  const [interviewScores, setInterviewScores] = useState<Record<string, number | null>>({});
  const [interviewComments, setInterviewComments] = useState<Record<string, string>>({});
  const [savingEval, setSavingEval] = useState<Record<string, boolean>>({});

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

  useEffect(() => {
    if (!token || !slotId) return;
    const currentUser: HyfinUser | null = JSON.parse(sessionStorage.getItem("hyfin_user") ?? "null");

    const load = async () => {
      setLoading(true);
      const [slotsRes, sheetRes] = await Promise.all([
        fetch("/api/admin/interview-slots", { headers: { "x-admin-token": token } }),
        fetch("/api/admin/questions-sheet", { headers: { "x-admin-token": token } }),
      ]);
      const slotsData: SlotInfo[] = await slotsRes.json();
      const sheetData: { applicants: Applicant[]; commonQuestions: CommonQuestion[] } = await sheetRes.json();

      const found = slotsData.find((s) => s.id === slotId) ?? null;
      if (!found) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setSlot(found);

      // 슬롯 전체 날짜 정렬 인덱스로 Day 계산
      const dates = [...new Set(slotsData.map((s) => s.date))].sort();
      const idx = dates.indexOf(found.date);
      setDayNumber(idx >= 0 ? idx + 1 : 1);

      const slotApplicants = sheetData.applicants.filter((a) => a.interviewSlot?.id === slotId);
      setApplicants(slotApplicants);
      setCommonQuestions(sheetData.commonQuestions);

      // 내 기존 면접 평가 프리로드
      const scores: Record<string, number | null> = {};
      const comments: Record<string, string> = {};
      for (const a of slotApplicants) {
        const myEval = a.evaluations.find((e) => e.staffName === currentUser?.id);
        scores[a.id] = myEval?.interviewScore ?? null;
        comments[a.id] = myEval?.interviewComment ?? "";
      }
      setInterviewScores(scores);
      setInterviewComments(comments);
      setLoading(false);
    };
    load();
  }, [token, slotId]);

  const saveInterviewEval = async (applicantId: string) => {
    if (!token) return;
    const score = interviewScores[applicantId] ?? null;
    const comment = interviewComments[applicantId] ?? "";
    if (score == null && comment.trim() === "") {
      alert("면접 점수를 선택해주세요.");
      return;
    }
    setSavingEval((prev) => ({ ...prev, [applicantId]: true }));
    const res = await fetch("/api/admin/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-token": token },
      body: JSON.stringify({
        applicantId,
        ...(score != null ? { interviewScore: score } : {}),
        interviewComment: comment,
      }),
    });
    setSavingEval((prev) => ({ ...prev, [applicantId]: false }));
    if (res.ok) {
      alert("면접 평가가 저장되었습니다.");
    } else {
      alert("면접 평가 저장에 실패했습니다. 다시 시도해주세요.");
    }
  };

  const dayQuestions: string[] = (() => {
    if (dayNumber == null) return [];
    const cq = commonQuestions.find((q) => q.day === dayNumber);
    return cq ? (JSON.parse(cq.questions || "[]") as string[]) : [];
  })();

  if (loading) {
    return (
      <div className="p-8">
        <p className="text-sm text-gray-400">불러오는 중...</p>
      </div>
    );
  }

  if (notFound || !slot) {
    return (
      <div className="p-8">
        <button
          onClick={() => router.push("/admin/interviews")}
          className="text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          ← 면접 캘린더
        </button>
        <div className="section-card text-center py-10">
          <p className="text-gray-500">슬롯을 찾을 수 없습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* 헤더 */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => router.push("/admin/interviews")}
          className="text-sm text-gray-500 hover:text-gray-700 whitespace-nowrap"
        >
          ← 면접 캘린더
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {DATE_LABELS[slot.date] ?? slot.date} {slot.startTime}~{slot.endTime} 면접
          </h1>
          <p className="text-sm text-gray-500 mt-1">{applicants.length}/{slot.maxCount}명</p>
        </div>
      </div>

      {/* Day 공통질문 */}
      {dayQuestions.length > 0 && (
        <div className="mb-6 bg-yellow-50 rounded-xl p-4">
          <p className="text-xs font-bold text-yellow-800 mb-2">Day{dayNumber} 공통질문</p>
          <ol className="space-y-1">
            {dayQuestions.map((q, i) => (
              <li key={i} className="text-xs text-yellow-900">
                {i + 1}. {q}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* 지원자 정보 테이블 (읽기 전용) */}
      <div className="section-card mb-6">
        <h2 className="section-title">지원자 정보</h2>
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
              {applicants.length === 0 ? (
                <tr>
                  <td colSpan={19} className="text-center py-10 text-sm text-gray-400">배정된 지원자가 없습니다.</td>
                </tr>
              ) : (
                applicants.map((a) => {
                  const docAvg = avgDocScore(a.evaluations);
                  const intAvg = avgInterviewScore(a.evaluations);
                  const myEval = a.evaluations.find((e) => e.staffName === user?.id);
                  const myPersonalQ = myEval?.personalQuestion ?? null;

                  return (
                    <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50 transition align-top">
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
                        <DocResultBadge result={a.docResult as "PASS" | "FAIL" | null} />
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
                        <FinalResultBadge result={a.finalResult as "PASS" | "FAIL" | null} />
                      </td>
                      <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">
                        {a.interviewSlot
                          ? `${a.interviewSlot.date} ${a.interviewSlot.startTime}~${a.interviewSlot.endTime}`
                          : <span className="text-gray-300">미배정</span>}
                      </td>
                      <td className="px-3 py-2.5 max-w-[220px]">
                        {dayQuestions.length === 0 ? (
                          <span className="text-gray-300 text-xs">없음</span>
                        ) : (
                          <ol className="space-y-1 list-none">
                            {dayQuestions.map((q, i) => (
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
      </div>

      {/* 면접 평가 카드 */}
      <div className="section-card">
        <h2 className="section-title">면접 평가</h2>
        {applicants.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">배정된 지원자가 없습니다.</p>
        ) : (
          <div className="space-y-5">
            {applicants.map((a) => {
              const myScore = interviewScores[a.id] ?? null;
              const myComment = interviewComments[a.id] ?? "";
              const saving = savingEval[a.id] ?? false;

              const visibleEvals = a.evaluations.filter((e) => {
                if (e.interviewScore == null) return false;
                if (user?.role === "ADMIN") return true;
                return e.staffName === user?.id;
              });

              return (
                <div key={a.id} className="border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-semibold text-gray-900">{a.name}</p>
                      <p className="text-xs text-gray-500">{a.major} · {a.grade}</p>
                    </div>
                  </div>

                  {/* 내 면접 평가 입력 */}
                  <div className="space-y-2 mb-3">
                    <label className="label text-xs">면접 점수 (1~5점)</label>
                    <div className="flex gap-1.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <button
                          key={s}
                          onClick={() =>
                            setInterviewScores((prev) => ({ ...prev, [a.id]: s }))
                          }
                          className={`w-8 h-8 rounded-lg text-xs font-bold transition ${
                            myScore === s
                              ? "bg-hyfin-blue text-white"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                    <textarea
                      className="textarea text-xs min-h-[60px]"
                      value={myComment}
                      onChange={(e) =>
                        setInterviewComments((prev) => ({ ...prev, [a.id]: e.target.value }))
                      }
                      placeholder="면접 코멘트 (선택)"
                    />
                    <button
                      onClick={() => saveInterviewEval(a.id)}
                      disabled={saving}
                      className="btn-primary text-xs px-3 py-1.5"
                    >
                      {saving ? "저장 중..." : "평가 저장"}
                    </button>
                  </div>

                  {/* 다른 평가자 평가 (ADMIN은 전원, STAFF는 본인만) */}
                  {visibleEvals.length > 0 && (
                    <div className="border-t border-gray-100 pt-3 space-y-2">
                      {visibleEvals.map((e) => (
                        <div key={e.id} className="bg-gray-50 rounded-lg p-2">
                          <div className="flex justify-between mb-0.5">
                            <span className="text-xs font-medium text-gray-700">
                              {e.staffName}
                              {e.staffName === user?.id && (
                                <span className="ml-1 text-blue-600">(나)</span>
                              )}
                            </span>
                            <span className="text-xs font-bold text-amber-600">
                              ★ {e.interviewScore}
                            </span>
                          </div>
                          {e.interviewComment && (
                            <p className="text-xs text-gray-500">{e.interviewComment}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
