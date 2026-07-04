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
  "2026-08-18": "8/18 (화)",
  "2026-08-19": "8/19 (수)",
  "2026-08-20": "8/20 (목)",
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
    if (!confirm("자동 배치 결과를 실제로 반영하시겠습니까?")) return;
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
          서류 합격자가 제출한 희망 면접 시간을 근거로 슬롯 용량을 지키며 자동 배치합니다.
          모든 서류 합격자가 희망 시간을 제출한 뒤에만 실행할 수 있습니다.
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
            <h2 className="section-title">희망 시간 제출 현황</h2>
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

          {/* 분기: 전원 제출 전 */}
          {plan.poolCount > 0 && !plan.allSubmitted && (
            <div className="rounded-xl border-2 border-yellow-300 bg-yellow-50 p-5">
              <p className="text-sm font-semibold text-yellow-800">
                ⚠️ 아직 모든 서류 합격자가 희망 면접 시간을 제출하지 않았습니다.
              </p>
              <p className="text-sm text-yellow-700 mt-1">
                전원 제출 후 자동 배치를 실행할 수 있습니다. ({plan.submittedCount}/{plan.poolCount}명 제출)
              </p>
            </div>
          )}

          {/* 분기: 전원 제출 완료 */}
          {plan.allSubmitted && (
            <>
              {plan.unassigned.length > 0 && (
                <div className="rounded-xl border-2 border-red-300 bg-red-50 p-5">
                  <p className="text-sm font-semibold text-red-800">
                    다음 지원자는 희망한 시간대가 모두 마감되었거나 유효하지 않아 배치되지 못했습니다:
                  </p>
                  <p className="text-sm text-red-700 mt-1">
                    {plan.unassigned.map((u) => `${u.name}(${u.major})`).join(", ")}
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

                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {plan.proposalBySlot.map((s) => (
                    <div
                      key={s.slotId}
                      className="border border-gray-200 rounded-xl p-4"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-bold text-hyfin-blue">
                          {DATE_LABELS[s.date] ?? s.date} {s.startTime}~{s.endTime}
                        </p>
                        <span className="text-xs text-gray-500">
                          {s.assigned.length}명 배치 · 정원 {s.maxCount}
                          {s.maxCount - s.capacity > 0 && (
                            <span className="text-gray-400">
                              {" "}(이미 확정 {s.maxCount - s.capacity}명)
                            </span>
                          )}
                        </span>
                      </div>
                      {s.assigned.length === 0 ? (
                        <p className="text-xs text-gray-400">배정 없음</p>
                      ) : (
                        <div className="space-y-1">
                          {s.assigned.map((a) => (
                            <p key={a.applicantId} className="text-xs text-gray-800">
                              <span className="font-medium">{a.name}</span>
                              <span className="text-gray-500 ml-1">({a.major})</span>
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
