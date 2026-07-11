"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface HyfinUser {
  id: string;
  role: "ADMIN" | "STAFF";
  title?: string;
}

interface AssignedApplicant {
  applicantId: string;
  name: string;
  major: string;
  grade: string;
}

interface ProposalSlot {
  slotId: string;
  date: string;
  startTime: string;
  endTime: string;
  maxCount: number;
  capacity: number;
  assigned: AssignedApplicant[];
}

interface PlanResponse {
  poolCount: number;
  submittedCount: number;
  allSubmitted: boolean;
  proposalBySlot: ProposalSlot[];
  unassigned: AssignedApplicant[];
}

const DATE_LABELS: Record<string, string> = {
  "2026-08-19": "8/19 (수)",
  "2026-08-20": "8/20 (목)",
  "2026-08-21": "8/21 (금)",
};

export default function AutoAssignPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [authChecked, setAuthChecked] = useState(false);

  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [applying, setApplying] = useState(false);
  const [applyMsg, setApplyMsg] = useState("");

  useEffect(() => {
    const savedUser = sessionStorage.getItem("hyfin_user");
    const savedToken = sessionStorage.getItem("hyfin_token");
    if (!savedUser || !savedToken) {
      router.replace("/admin");
      return;
    }
    const parsed: HyfinUser = JSON.parse(savedUser);
    if (parsed.role !== "ADMIN") {
      router.replace("/admin");
      return;
    }
    setToken(savedToken);
    setAuthChecked(true);
  }, [router]);

  const fetchPlan = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/interview-auto-assign", {
        headers: { "x-admin-token": token },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "불러오기에 실패했습니다.");
        setPlan(null);
      } else {
        setPlan(data);
      }
    } catch {
      setError("불러오기에 실패했습니다.");
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    if (token) fetchPlan();
  }, [token, fetchPlan]);

  const apply = async () => {
    if (!token) return;
    const confirmMsg =
      plan && !plan.allSubmitted
        ? "아직 전원이 제출하지 않았습니다. 제출한 지원자만 배치를 반영합니다. 계속하시겠습니까?"
        : "자동 배치 결과를 실제로 반영하시겠습니까?";
    if (!confirm(confirmMsg)) return;
    setApplying(true);
    setApplyMsg("");
    setError("");
    try {
      const res = await fetch("/api/admin/interview-auto-assign", {
        method: "POST",
        headers: { "x-admin-token": token },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "반영에 실패했습니다.");
      } else {
        setApplyMsg(`반영되었습니다 (${data.assignedCount}명 배치)`);
        await fetchPlan();
      }
    } catch {
      setError("반영에 실패했습니다.");
    }
    setApplying(false);
  };

  if (!authChecked) return null;

  const percent =
    plan && plan.poolCount > 0
      ? Math.round((plan.submittedCount / plan.poolCount) * 100)
      : 0;

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link
          href="/admin/interviews"
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          ← 면접 관리로 돌아가기
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">면접 시간 자동 배치</h1>
        <p className="text-sm text-gray-500 mt-1">
          서류 합격자가 제출한 면접 가능 시간을 근거로 슬롯 용량을 지키며 자동 배치합니다.
          전원 제출 전이라도 제출한 지원자만으로 배치·반영할 수 있으며, 미제출자는 제외됩니다.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">불러오는 중...</p>
      ) : error && !plan ? (
        <div className="section-card">
          <p className="text-sm text-red-500">{error}</p>
        </div>
      ) : plan ? (
        <div className="space-y-6">
          {/* 진행률 */}
          <div className="section-card">
            <h2 className="section-title">가능 시간 제출 현황</h2>
            {plan.poolCount === 0 ? (
              <p className="text-sm text-gray-400">서류 합격자가 없습니다.</p>
            ) : (
              <>
                <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                  <div
                    className="bg-hyfin-blue h-4 rounded-full transition-all"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  서류 합격자 {plan.poolCount}명 중 {plan.submittedCount}명 제출 ({percent}%)
                </p>
              </>
            )}
          </div>

          {/* 전원 제출 전 안내 (정보성): 기능은 막지 않는다 */}
          {plan.poolCount > 0 && !plan.allSubmitted && (
            <div className="rounded-xl border-2 border-yellow-300 bg-yellow-50 p-5">
              <p className="text-sm font-semibold text-yellow-800">
                ⚠️ 아직 모든 서류 합격자가 가능 시간을 제출하지 않았습니다 ({plan.submittedCount}/{plan.poolCount}명 제출).
              </p>
              <p className="text-sm text-yellow-700 mt-1">
                미제출자는 이번 배치에서 제외됩니다. 그래도 제출한 지원자만으로 배치·반영할 수 있습니다.
              </p>
            </div>
          )}

          {/* 배치 제안 + 반영: 서류 합격자가 있으면 항상 표시 */}
          {plan.poolCount > 0 && (
            <>
              {plan.unassigned.length > 0 && (
                <div className="rounded-xl border-2 border-red-300 bg-red-50 p-5">
                  <p className="text-sm font-semibold text-red-800">
                    다음 지원자는 가능하다고 선택한 시간대가 모두 마감되었거나 유효하지 않아 배치되지 못했습니다:
                  </p>
                  <p className="text-sm text-red-700 mt-1">
                    {plan.unassigned
                      .map((u) => `${u.name}(${u.major}${u.grade ? ` · ${u.grade}` : ""})`)
                      .join(", ")}
                  </p>
                </div>
              )}

              <div className="section-card">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="section-title mb-0">배치 제안</h2>
                  <button
                    onClick={apply}
                    disabled={applying}
                    className="btn-primary text-sm disabled:opacity-50"
                  >
                    {applying ? "반영 중..." : "반영하기"}
                  </button>
                </div>

                {applyMsg && (
                  <p className="text-sm text-green-600 font-medium mb-3">{applyMsg}</p>
                )}
                {error && <p className="text-sm text-red-500 mb-3">{error}</p>}

                {(() => {
                  const proposalDates = [
                    ...new Set(plan.proposalBySlot.map((s) => s.date)),
                  ].sort();
                  const slotsByDate: Record<string, ProposalSlot[]> = {};
                  for (const s of plan.proposalBySlot) {
                    (slotsByDate[s.date] ??= []).push(s);
                  }
                  return (
                    <div
                      className="grid gap-4"
                      style={{
                        gridTemplateColumns: `repeat(${proposalDates.length}, minmax(0, 1fr))`,
                      }}
                    >
                      {proposalDates.map((date) => (
                        <div key={date}>
                          <div className="text-sm font-bold text-hyfin-blue mb-2 text-center">
                            {DATE_LABELS[date] ?? date}
                          </div>
                          <div className="space-y-2">
                            {(slotsByDate[date] ?? []).map((s) => (
                              <div
                                key={s.slotId}
                                className="border border-gray-200 rounded-xl p-3"
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <p className="text-xs font-semibold text-gray-700">
                                    {s.startTime}~{s.endTime}
                                  </p>
                                  <span className="text-[11px] text-gray-500">
                                    {s.assigned.length}명 · 정원 {s.maxCount}
                                  </span>
                                </div>
                                {s.maxCount - s.capacity > 0 && (
                                  <p className="text-[11px] text-gray-400 mb-1">
                                    이미 확정 {s.maxCount - s.capacity}명
                                  </p>
                                )}
                                {s.assigned.length === 0 ? (
                                  <p className="text-xs text-gray-400">배정 없음</p>
                                ) : (
                                  <div className="space-y-0.5">
                                    {s.assigned.map((a) => (
                                      <p
                                        key={a.applicantId}
                                        className="text-xs text-gray-800"
                                      >
                                        <span className="font-medium">{a.name}</span>
                                        <span className="text-gray-500 ml-1">
                                          ({a.major}
                                          {a.grade ? ` · ${a.grade}` : ""})
                                        </span>
                                      </p>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
