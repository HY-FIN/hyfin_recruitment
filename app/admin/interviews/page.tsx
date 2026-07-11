"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

interface HyfinUser {
  id: string;
  role: "ADMIN" | "STAFF";
  title?: string;
}

interface SlotApplicant {
  id: string;
  name: string;
  major: string;
  status: string;
  docResult: string | null;
  interviewPreferences: string;
}

interface InterviewSlot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  maxCount: number;
  applicants: SlotApplicant[];
}

interface Evaluation {
  id: string;
  staffName: string;
  interviewScore: number | null;
  interviewComment: string | null;
  personalQuestion: string | null;
}

interface ApplicantDetail {
  id: string;
  name: string;
  major: string;
  status: string;
  evaluations: Evaluation[];
}

interface CommonQuestion {
  id: string;
  day: number;
  questions: string;
  location: string | null;
}

interface FinalQuestion {
  question: string;
}

const DATE_LABELS: Record<string, string> = {
  "2026-08-18": "8/18 (화)",
  "2026-08-19": "8/19 (수)",
  "2026-08-20": "8/20 (목)",
};

export default function InterviewsPage() {
  const router = useRouter();
  const [user, setUser] = useState<HyfinUser | null>(null);
  const [token, setToken] = useState("");

  const [slots, setSlots] = useState<InterviewSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState<InterviewSlot | null>(null);

  // 면접 평가 (null = 점수 미선택)
  const [slotApplicantDetails, setSlotApplicantDetails] = useState<Record<string, ApplicantDetail>>({});
  const [interviewScores, setInterviewScores] = useState<Record<string, number | null>>({});
  const [interviewComments, setInterviewComments] = useState<Record<string, string>>({});
  const [savingEval, setSavingEval] = useState<Record<string, boolean>>({});
  // 미저장 변경이 있는 지원자 id — fetch 응답이 사용자 입력을 덮어쓰지 않도록 추적
  const dirtyRef = useRef<Set<string>>(new Set());
  // 늦게 도착한 fetch 응답이 다른 슬롯 상태를 덮어쓰지 않도록 현재 선택 슬롯 추적
  const selectedSlotIdRef = useRef<string | null>(null);

  // 공통질문
  const [commonQuestions, setCommonQuestions] = useState<CommonQuestion[]>([]);
  const [editingCQ, setEditingCQ] = useState<null | { day: number; questions: string[]; location: string }>(null);
  const [showCQModal, setShowCQModal] = useState(false);

  // 슬롯 배정 (ADMIN)
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignSlot, setAssignSlot] = useState<InterviewSlot | null>(null);
  const [allInterviewApplicants, setAllInterviewApplicants] = useState<SlotApplicant[]>([]);
  const [assignLoading, setAssignLoading] = useState(false);

  // 최종 개인질문 (슬롯 상세 뷰, 조회는 전체 · 편집은 ADMIN)
  const [finalQuestions, setFinalQuestions] = useState<Record<string, string>>({});

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

  const fetchSlots = useCallback(async () => {
    if (!token) return [];
    setLoading(true);
    const res = await fetch("/api/admin/interview-slots", {
      headers: { "x-admin-token": token },
    });
    const data = await res.json();
    setSlots(data);
    setLoading(false);
    return data;
  }, [token]);

  const fetchCommonQuestions = useCallback(async () => {
    if (!token) return;
    const res = await fetch("/api/admin/common-questions", {
      headers: { "x-admin-token": token },
    });
    const data = await res.json();
    setCommonQuestions(data);
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchSlots();
      fetchCommonQuestions();
    }
  }, [token, fetchSlots, fetchCommonQuestions]);

  // 슬롯 클릭 시 지원자 상세 + 최종개인질문 로드
  const selectSlot = async (slot: InterviewSlot) => {
    setSelectedSlot(slot);
    selectedSlotIdRef.current = slot.id;
    if (!token) return;

    // 각 지원자 상세 로드
    const details: Record<string, ApplicantDetail> = {};
    const scores: Record<string, number | null> = {};
    const comments: Record<string, string> = {};
    const fqs: Record<string, string> = {};

    await Promise.all(
      slot.applicants.map(async (a) => {
        const res = await fetch(`/api/admin/applications/${a.id}`, {
          headers: { "x-admin-token": token },
        });
        const detail = await res.json();
        details[a.id] = detail;

        // 내 면접 평가 로드 (저장된 평가가 없으면 미선택 상태 유지)
        const myEval = detail.evaluations?.find(
          (e: Evaluation) => e.staffName === (user?.id ?? "")
        );
        scores[a.id] = myEval?.interviewScore ?? null;
        comments[a.id] = myEval?.interviewComment ?? "";

        // 최종 개인질문
        const fqRes = await fetch(`/api/admin/final-questions/${a.id}`, {
          headers: { "x-admin-token": token },
        });
        const fqData: FinalQuestion | null = await fqRes.json();
        fqs[a.id] = fqData?.question ?? "";
      })
    );

    // 응답 도착 시점에 다른 슬롯이 선택돼 있으면 반영하지 않음
    if (selectedSlotIdRef.current !== slot.id) return;

    setSlotApplicantDetails(details);
    // 미저장(dirty) 입력은 서버값으로 덮어쓰지 않고 보존
    setInterviewScores((prev) => {
      const next = { ...scores };
      for (const id of dirtyRef.current) {
        if (id in prev) next[id] = prev[id];
      }
      return next;
    });
    setInterviewComments((prev) => {
      const next = { ...comments };
      for (const id of dirtyRef.current) {
        if (id in prev) next[id] = prev[id];
      }
      return next;
    });
    setFinalQuestions(fqs);
  };

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
        // 점수 미선택 시 interviewScore를 보내지 않음 (API가 null은 무시하고 코멘트만 저장)
        ...(score != null ? { interviewScore: score } : {}),
        interviewComment: comment,
      }),
    });
    setSavingEval((prev) => ({ ...prev, [applicantId]: false }));
    if (res.ok) {
      dirtyRef.current.delete(applicantId);
      alert("면접 평가가 저장되었습니다.");
    } else {
      alert("면접 평가 저장에 실패했습니다. 다시 시도해주세요.");
    }
  };

  // 슬롯 날짜별 그룹핑
  const dates = [...new Set(slots.map((s) => s.date))].sort();
  const slotsByDate: Record<string, InterviewSlot[]> = {};
  for (const s of slots) {
    if (!slotsByDate[s.date]) slotsByDate[s.date] = [];
    slotsByDate[s.date].push(s);
  }

  // 공통질문 수정 모달
  const openCQModal = (day: number) => {
    const cq = commonQuestions.find((q) => q.day === day);
    const qs = cq ? (JSON.parse(cq.questions) as string[]) : [];
    setEditingCQ({
      day,
      questions: qs.length > 0 ? qs : [""],
      location: cq?.location ?? "",
    });
    setShowCQModal(true);
  };

  const saveCQ = async () => {
    if (!editingCQ || !token) return;
    const filtered = editingCQ.questions.filter((q) => q.trim() !== "");
    await fetch("/api/admin/common-questions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-admin-token": token },
      body: JSON.stringify({ day: editingCQ.day, questions: filtered, location: editingCQ.location }),
    });
    setShowCQModal(false);
    fetchCommonQuestions();
    alert("공통질문이 저장되었습니다.");
  };

  // 슬롯 배정 모달
  const openAssignModal = async (slot: InterviewSlot) => {
    setAssignSlot(slot);
    setAssignLoading(true);
    setShowAssignModal(true);

    // INTERVIEW_READY 단계 지원자 전체 로드
    const res = await fetch("/api/admin/applications?stage=INTERVIEW_READY", {
      headers: { "x-admin-token": token },
    });
    const data = await res.json();
    setAllInterviewApplicants(data);
    setAssignLoading(false);
  };

  const assignApplicant = async (slotId: string, applicantId: string) => {
    await fetch(`/api/admin/interview-slots/${slotId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-admin-token": token },
      body: JSON.stringify({ applicantId, action: "assign" }),
    });
    const updatedSlots = await fetchSlots();
    const updated = updatedSlots.find((s: InterviewSlot) => s.id === slotId);
    if (updated) setAssignSlot(updated);
  };

  const unassignApplicant = async (slotId: string, applicantId: string) => {
    await fetch(`/api/admin/interview-slots/${slotId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-admin-token": token },
      body: JSON.stringify({ applicantId, action: "unassign" }),
    });
    const updatedSlots = await fetchSlots();
    const updated = updatedSlots.find((s: InterviewSlot) => s.id === slotId);
    if (updated) setAssignSlot(updated);
  };

  // 슬롯에 배정되지 않은 INTERVIEW 지원자 필터
  const assignedIds = new Set(slots.flatMap((s) => s.applicants.map((a) => a.id)));
  const unassignedApplicants = allInterviewApplicants.filter((a) => !assignedIds.has(a.id));

  // 해당 슬롯의 날짜로 면접일(day: 1/2/3) 계산
  const getDayNumber = (date: string): number => {
    const dateList = dates;
    const idx = dateList.indexOf(date);
    return idx >= 0 ? idx + 1 : 1;
  };

  const getCommonQuestionsForSlot = (slot: InterviewSlot): string[] => {
    const day = getDayNumber(slot.date);
    const cq = commonQuestions.find((q) => q.day === day);
    return cq ? (JSON.parse(cq.questions) as string[]) : [];
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">면접 관리</h1>
          <p className="text-sm text-gray-500 mt-1">면접 캘린더 및 면접 평가</p>
        </div>
        {user?.role === "ADMIN" && (
          <div className="flex gap-2">
            <button
              onClick={() => router.push("/admin/interviews/auto-assign")}
              className="btn-primary text-xs"
            >
              면접 시간 자동 배치 해보기
            </button>
            {[1, 2, 3].map((day) => (
              <button
                key={day}
                onClick={() => openCQModal(day)}
                className="btn-secondary text-xs"
              >
                Day{day} 공통질문 수정
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">불러오는 중...</p>
      ) : slots.length === 0 ? (
        <div className="section-card text-center py-10">
          <p className="text-gray-500 mb-3">면접 슬롯이 없습니다.</p>
          {user?.role === "ADMIN" && (
            <p className="text-sm text-gray-400">
              <a href="/api/admin/seed" className="text-blue-600 underline" target="_blank">
                /api/admin/seed
              </a>
              에서 초기 데이터를 생성해 주세요.
            </p>
          )}
        </div>
      ) : (
        <div className="flex gap-6">
          {/* 면접 캘린더 그리드 */}
          <div className="flex-1">
            <div className="section-card">
              <h2 className="section-title">면접 캘린더</h2>
              <div className={`grid gap-3`} style={{ gridTemplateColumns: `repeat(${dates.length}, 1fr)` }}>
                {dates.map((date) => (
                  <div key={date}>
                    <div className="text-sm font-bold text-hyfin-blue mb-2 text-center">
                      {DATE_LABELS[date] ?? date}
                    </div>
                    <div className="space-y-2">
                      {(slotsByDate[date] ?? []).map((slot) => {
                        const isFull = slot.applicants.length >= slot.maxCount;
                        const isSelected = selectedSlot?.id === slot.id;
                        return (
                          <button
                            key={slot.id}
                            onClick={() => selectSlot(slot)}
                            className={`w-full text-left p-3 rounded-xl border-2 transition ${
                              isSelected
                                ? "border-hyfin-blue bg-blue-50"
                                : isFull
                                ? "border-gray-200 bg-gray-50 hover:border-gray-300"
                                : "border-gray-200 bg-white hover:border-blue-300"
                            }`}
                          >
                            <p className="text-xs font-semibold text-gray-700">
                              {slot.startTime} ~ {slot.endTime}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {slot.applicants.length}/{slot.maxCount}명
                            </p>
                            <div className="mt-1 space-y-0.5">
                              {slot.applicants.map((a) => (
                                <p key={a.id} className="text-xs text-gray-800 font-medium">
                                  {a.name}
                                </p>
                              ))}
                            </div>
                            {isFull && (
                              <p className="text-xs text-red-500 font-medium mt-1">마감</p>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {user?.role === "ADMIN" && (
                      <div className="mt-2 space-y-1">
                        {(slotsByDate[date] ?? []).map((slot) => (
                          <button
                            key={slot.id}
                            onClick={() => openAssignModal(slot)}
                            className="w-full text-xs text-blue-600 hover:text-blue-800 text-center py-0.5"
                          >
                            {slot.startTime} 배정 수정
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 슬롯 상세 뷰 */}
          {selectedSlot && (
            <div className="w-[480px] flex-shrink-0">
              <div className="section-card">
                <h2 className="section-title">
                  {DATE_LABELS[selectedSlot.date] ?? selectedSlot.date}{" "}
                  {selectedSlot.startTime}~{selectedSlot.endTime} 면접
                </h2>

                {/* 공통질문 */}
                {(() => {
                  const qs = getCommonQuestionsForSlot(selectedSlot);
                  if (qs.length === 0) return null;
                  return (
                    <div className="mb-4 bg-yellow-50 rounded-xl p-4">
                      <p className="text-xs font-bold text-yellow-800 mb-2">
                        Day{getDayNumber(selectedSlot.date)} 공통질문
                      </p>
                      <ol className="space-y-1">
                        {qs.map((q, i) => (
                          <li key={i} className="text-xs text-yellow-900">
                            {i + 1}. {q}
                          </li>
                        ))}
                      </ol>
                    </div>
                  );
                })()}

                {selectedSlot.applicants.length === 0 ? (
                  <p className="text-sm text-gray-400 py-4 text-center">배정된 지원자가 없습니다.</p>
                ) : (
                  <div className="space-y-5">
                    {selectedSlot.applicants.map((sa) => {
                      const detail = slotApplicantDetails[sa.id];
                      const myScore = interviewScores[sa.id] ?? null;
                      const myComment = interviewComments[sa.id] ?? "";
                      const fq = finalQuestions[sa.id];
                      const saving = savingEval[sa.id] ?? false;

                      // 면접 평가 표시 범위
                      const visibleEvals = detail?.evaluations?.filter((e: Evaluation) => {
                        if (user?.role === "ADMIN") return true;
                        return e.staffName === user?.id;
                      }) ?? [];

                      return (
                        <div key={sa.id} className="border border-gray-200 rounded-xl p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <p className="font-semibold text-gray-900">{sa.name}</p>
                              <p className="text-xs text-gray-500">{sa.major}</p>
                            </div>
                          </div>

                          {/* 최종 개인질문 */}
                          {fq && (
                            <div className="mb-3 bg-purple-50 rounded-lg p-3">
                              <p className="text-xs font-bold text-purple-800 mb-1">최종 개인질문</p>
                              <p className="text-xs text-purple-900">{fq}</p>
                            </div>
                          )}

                          {/* 내 면접 평가 입력 */}
                          <div className="space-y-2 mb-3">
                            <label className="label text-xs">면접 점수 (1~5점)</label>
                            <div className="flex gap-1.5">
                              {[1, 2, 3, 4, 5].map((s) => (
                                <button
                                  key={s}
                                  onClick={() => {
                                    dirtyRef.current.add(sa.id);
                                    setInterviewScores((prev) => ({ ...prev, [sa.id]: s }));
                                  }}
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
                              onChange={(e) => {
                                dirtyRef.current.add(sa.id);
                                setInterviewComments((prev) => ({
                                  ...prev,
                                  [sa.id]: e.target.value,
                                }));
                              }}
                              placeholder="면접 코멘트 (선택)"
                            />
                            <button
                              onClick={() => saveInterviewEval(sa.id)}
                              disabled={saving}
                              className="btn-primary text-xs px-3 py-1.5"
                            >
                              {saving ? "저장 중..." : "평가 저장"}
                            </button>
                          </div>

                          {/* 다른 운영진 평가 (ADMIN만) */}
                          {visibleEvals.filter((e: Evaluation) => e.interviewScore != null).length > 0 && (
                            <div className="border-t border-gray-100 pt-3 space-y-2">
                              {visibleEvals
                                .filter((e: Evaluation) => e.interviewScore != null)
                                .map((e: Evaluation) => (
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
          )}
        </div>
      )}

      {/* 공통질문 수정 모달 */}
      {showCQModal && editingCQ && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl">
            <h3 className="text-lg font-bold text-hyfin-blue mb-4">
              Day{editingCQ.day} 공통질문 수정
            </h3>
            <div className="mb-3">
              <label className="label text-xs">면접 장소</label>
              <input
                className="input text-sm"
                value={editingCQ.location}
                onChange={(e) => setEditingCQ({ ...editingCQ, location: e.target.value })}
                placeholder="예: 한양대학교 경영관 401호"
              />
            </div>
            <div className="space-y-2 mb-4">
              {editingCQ.questions.map((q, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    className="input text-sm flex-1"
                    value={q}
                    onChange={(e) => {
                      const newQs = [...editingCQ.questions];
                      newQs[i] = e.target.value;
                      setEditingCQ({ ...editingCQ, questions: newQs });
                    }}
                    placeholder={`질문 ${i + 1}`}
                  />
                  <button
                    onClick={() => {
                      const newQs = editingCQ.questions.filter((_, idx) => idx !== i);
                      setEditingCQ({ ...editingCQ, questions: newQs.length > 0 ? newQs : [""] });
                    }}
                    className="text-red-400 hover:text-red-600 text-lg px-2"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                onClick={() =>
                  setEditingCQ({ ...editingCQ, questions: [...editingCQ.questions, ""] })
                }
                className="btn-secondary text-xs"
              >
                + 질문 추가
              </button>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowCQModal(false)} className="btn-secondary text-sm">
                취소
              </button>
              <button onClick={saveCQ} className="btn-primary text-sm">
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 슬롯 배정 모달 (ADMIN) */}
      {showAssignModal && assignSlot && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl shadow-xl max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-hyfin-blue mb-1">
              면접 슬롯 배정
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              {DATE_LABELS[assignSlot.date] ?? assignSlot.date} {assignSlot.startTime}~{assignSlot.endTime}
              {" "}({assignSlot.applicants.length}/{assignSlot.maxCount}명)
            </p>

            {/* 현재 배정된 지원자 */}
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">현재 배정</h4>
              {assignSlot.applicants.length === 0 ? (
                <p className="text-sm text-gray-400">없음</p>
              ) : (
                <div className="space-y-1">
                  {assignSlot.applicants.map((a) => (
                    <div key={a.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                      <span className="text-sm font-medium">
                        {a.name}
                        <span className="text-xs text-gray-500 ml-1">({a.major})</span>
                      </span>
                      <button
                        onClick={() => unassignApplicant(assignSlot.id, a.id)}
                        className="text-red-400 hover:text-red-600 text-xs"
                      >
                        해제
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 배정 가능한 지원자 */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">
                배정 가능 (서류합격 · 미배정)
              </h4>
              {assignLoading ? (
                <p className="text-sm text-gray-400">불러오는 중...</p>
              ) : unassignedApplicants.length === 0 ? (
                <p className="text-sm text-gray-400">배정 가능한 지원자가 없습니다.</p>
              ) : (
                <div className="space-y-1 max-h-60 overflow-y-auto">
                  {unassignedApplicants.map((a) => {
                    const prefs: string[] = JSON.parse(a.interviewPreferences || "[]");
                    const preferred = prefs.includes(assignSlot.id);
                    return (
                      <div
                        key={a.id}
                        className={`flex items-center justify-between rounded-lg px-3 py-2 ${
                          preferred ? "bg-green-50 border border-green-200" : "bg-gray-50"
                        }`}
                      >
                        <span className="text-sm font-medium">
                          {a.name}
                          <span className="text-xs text-gray-500 ml-1">({a.major})</span>
                          {preferred && (
                            <span className="ml-1 text-xs text-green-600 font-medium">가능</span>
                          )}
                        </span>
                        <button
                          onClick={() => assignApplicant(assignSlot.id, a.id)}
                          disabled={assignSlot.applicants.length >= assignSlot.maxCount}
                          className="text-blue-600 hover:text-blue-800 text-xs disabled:text-gray-400"
                        >
                          배정
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-end mt-4">
              <button
                onClick={() => {
                  setShowAssignModal(false);
                  fetchSlots();
                }}
                className="btn-primary text-sm"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
