"use client";

import { useEffect, useState, useCallback } from "react";
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

interface CommonQuestion {
  id: string;
  day: number;
  questions: string;
  location: string | null;
}

const DATE_LABELS: Record<string, string> = {
  "2026-08-19": "8/19 (수)",
  "2026-08-20": "8/20 (목)",
  "2026-08-21": "8/21 (금)",
};

export default function InterviewsPage() {
  const router = useRouter();
  const [user, setUser] = useState<HyfinUser | null>(null);
  const [token, setToken] = useState("");

  const [slots, setSlots] = useState<InterviewSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  // 공통질문
  const [commonQuestions, setCommonQuestions] = useState<CommonQuestion[]>([]);
  const [editingCQ, setEditingCQ] = useState<null | { day: number; questions: string[]; location: string }>(null);
  const [showCQModal, setShowCQModal] = useState(false);

  // 슬롯 배정 (ADMIN)
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignSlot, setAssignSlot] = useState<InterviewSlot | null>(null);
  const [allInterviewApplicants, setAllInterviewApplicants] = useState<SlotApplicant[]>([]);
  const [assignLoading, setAssignLoading] = useState(false);

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

  const runSeed = async () => {
    if (!token) return;
    setSeeding(true);
    try {
      const res = await fetch("/api/admin/seed", {
        headers: { "x-admin-token": token },
      });
      if (res.ok) {
        alert("초기 면접 슬롯이 생성되었습니다.");
        fetchSlots();
      } else {
        alert("슬롯 생성에 실패했습니다. 다시 시도해 주세요.");
      }
    } catch {
      alert("슬롯 생성에 실패했습니다. 다시 시도해 주세요.");
    } finally {
      setSeeding(false);
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
            <button
              onClick={runSeed}
              disabled={seeding}
              className="btn-primary text-xs"
            >
              {seeding ? "생성 중..." : "초기 면접 슬롯 생성"}
            </button>
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
                        return (
                          <button
                            key={slot.id}
                            onClick={() => router.push(`/admin/interviews/${slot.id}`)}
                            className={`w-full text-left p-3 rounded-xl border-2 transition ${
                              isFull
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
