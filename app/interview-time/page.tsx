"use client";

import { useEffect, useState } from "react";

interface Slot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  maxCount: number;
  currentCount: number;
}

type Step = "identify" | "select" | "done";

const DATE_LABELS: Record<string, string> = {
  "2026-08-19": "2026년 8월 19일 (수)",
  "2026-08-20": "2026년 8월 20일 (목)",
  "2026-08-21": "2026년 8월 21일 (금)",
};

export default function InterviewTimePage() {
  const [step, setStep] = useState<Step>("identify");
  const [name, setName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [verifyError, setVerifyError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [notEligible, setNotEligible] = useState(false);

  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadSlots = async () => {
    setLoadingSlots(true);
    const res = await fetch("/api/interview-time");
    const data = await res.json();
    setSlots(data);
    setLoadingSlots(false);
  };

  const verify = async () => {
    if (!name.trim() || !studentId.trim()) {
      setVerifyError("이름과 학번을 모두 입력해 주세요.");
      return;
    }
    setVerifying(true);
    setVerifyError("");
    setNotEligible(false);

    try {
      const res = await fetch("/api/interview-time", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), studentId: studentId.trim(), verifyOnly: true }),
      });

      if (res.status === 404) {
        setVerifyError("입력하신 정보와 일치하는 지원자를 찾을 수 없습니다.");
        return;
      }
      if (res.status === 403) {
        setNotEligible(true);
        return;
      }
      if (!res.ok) {
        setVerifyError("오류가 발생했습니다. 다시 시도해 주세요.");
        return;
      }

      const data = await res.json();
      if (data.alreadySubmitted) {
        setStep("done");
        return;
      }
      await loadSlots();
      setStep("select");
    } catch {
      setVerifyError("오류가 발생했습니다. 다시 시도해 주세요.");
    } finally {
      setVerifying(false);
    }
  };

  // 이미 제출한 경우 기존 선택 표시
  useEffect(() => {
    if (step === "select" && slots.length > 0) {
      // 현재 기존 선택은 applicant의 interviewPreferences에서 가져올 수 없으므로
      // 로컬 스토리지 캐시나 별도 API 없이는 알 수 없음.
      // 여기선 일단 빈 상태로 시작 (이미 제출된 경우 덮어쓰기 가능)
    }
  }, [step, slots]);

  const toggleSlot = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const submit = async () => {
    if (selectedIds.size === 0) {
      alert("가능 시간대를 1개 이상 선택해 주세요.");
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/interview-time", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        studentId: studentId.trim(),
        slotIds: Array.from(selectedIds),
      }),
    });
    setSubmitting(false);
    if (res.ok) {
      setStep("done");
    } else {
      alert("제출 중 오류가 발생했습니다. 다시 시도해 주세요.");
    }
  };

  // 날짜별 그룹핑
  const dates = [...new Set(slots.map((s) => s.date))].sort();
  const slotsByDate: Record<string, Slot[]> = {};
  for (const s of slots) {
    if (!slotsByDate[s.date]) slotsByDate[s.date] = [];
    slotsByDate[s.date].push(s);
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center py-12 px-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-hyfin-blue">HYFIN 8기</h1>
          <p className="text-lg font-semibold text-gray-800 mt-1">면접 가능 시간 선택</p>
          <p className="text-sm text-gray-500 mt-2">
            아래 시간대 중 참석 가능한 시간을 선택해 주세요. (복수 선택 가능)
          </p>
        </div>

        {/* Step 1: 본인 확인 */}
        {step === "identify" && (
          <div className="section-card">
            <h2 className="section-title">본인 확인</h2>
            {notEligible ? (
              <div className="text-center py-6">
                <p className="text-base font-semibold text-gray-700">면접 대상자가 아닙니다.</p>
                <p className="text-sm text-gray-500 mt-2">
                  면접 안내 메일을 받으신 분만 이 페이지를 이용하실 수 있습니다.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="label text-xs">이름</label>
                  <input
                    type="text"
                    className="input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && verify()}
                    placeholder="지원서에 입력한 이름"
                  />
                </div>
                <div>
                  <label className="label text-xs">학번</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    className="input"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && verify()}
                    placeholder="지원서에 입력한 학번 (예: 2024012345)"
                  />
                </div>
                {verifyError && (
                  <p className="text-sm text-red-500">{verifyError}</p>
                )}
                <button
                  onClick={verify}
                  disabled={verifying}
                  className="btn-primary w-full"
                >
                  {verifying ? "확인 중..." : "본인 확인"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step 2: 시간 선택 */}
        {step === "select" && (
          <div className="section-card">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
              <h2 className="text-base font-bold text-hyfin-blue">
                {name} 님, 가능 시간을 선택해 주세요.
              </h2>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              여러 시간대를 선택할 수 있습니다.
            </p>

            {loadingSlots ? (
              <p className="text-sm text-gray-400 text-center py-6">불러오는 중...</p>
            ) : (
              <div className="space-y-5">
                {dates.map((date) => (
                  <div key={date}>
                    <p className="text-sm font-bold text-gray-700 mb-2">
                      {DATE_LABELS[date] ?? date}
                    </p>
                    <div className="space-y-2">
                      {(slotsByDate[date] ?? []).map((slot) => {
                        const isFull = slot.currentCount >= slot.maxCount;
                        const isSelected = selectedIds.has(slot.id);
                        return (
                          <button
                            key={slot.id}
                            onClick={() => !isFull && toggleSlot(slot.id)}
                            disabled={isFull}
                            className={`w-full text-left px-4 py-3 rounded-xl border-2 transition ${
                              isSelected
                                ? "border-hyfin-blue bg-blue-50"
                                : isFull
                                ? "border-gray-200 bg-gray-100 cursor-not-allowed opacity-60"
                                : "border-gray-200 hover:border-blue-300 bg-white"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-semibold text-gray-800">
                                {slot.startTime} ~ {slot.endTime}
                              </span>
                              <div className="flex items-center gap-2">
                                {isFull && (
                                  <span className="text-xs text-red-500 font-medium">마감</span>
                                )}
                                {isSelected && (
                                  <span className="text-xs text-hyfin-blue font-bold">✓ 선택됨</span>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 pt-4 border-t border-gray-100">
              <p className="text-sm text-gray-600 mb-3">
                선택한 시간대: {selectedIds.size > 0 ? `${selectedIds.size}개` : "없음"}
              </p>
              <button
                onClick={submit}
                disabled={submitting || selectedIds.size === 0}
                className="btn-primary w-full"
              >
                {submitting ? "제출 중..." : "가능 시간 제출"}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: 완료 */}
        {step === "done" && (
          <div className="section-card text-center py-8">
            <div className="text-4xl mb-4">✅</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">제출 완료!</h2>
            <p className="text-sm text-gray-600 mb-1">
              {name} 님의 면접 가능 시간이 접수되었습니다.
            </p>
            <p className="text-sm text-gray-500 mb-4">
              면접 일정은 별도로 안내드릴 예정입니다.
            </p>
            <p className="text-xs text-gray-400">
              가능 시간을 수정하려면 hyu.hyfin@gmail.com으로 문의해 주세요.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
