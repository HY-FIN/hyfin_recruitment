"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import StatusBadge from "@/components/StatusBadge";

interface HyfinUser {
  id: string;
  role: "ADMIN" | "STAFF";
  title?: string;
}

interface Applicant {
  id: string;
  name: string;
  email: string;
  major: string;
  status: string;
  receiptEmailSent: boolean;
  docEmailSent: boolean;
  interviewEmailSent: boolean;
  finalEmailSent: boolean;
}

interface SendResult {
  success: number;
  total: number;
}

export default function NotificationsPage() {
  const router = useRouter();
  const [user, setUser] = useState<HyfinUser | null>(null);
  const [token, setToken] = useState("");
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);

  // 각 섹션 선택 상태
  const [docSelectedIds, setDocSelectedIds] = useState<Set<string>>(new Set());
  const [interviewSelectedIds, setInterviewSelectedIds] = useState<Set<string>>(new Set());
  const [finalSelectedIds, setFinalSelectedIds] = useState<Set<string>>(new Set());

  const [docSending, setDocSending] = useState(false);
  const [interviewSending, setInterviewSending] = useState(false);
  const [finalSending, setFinalSending] = useState(false);

  const [docResult, setDocResult] = useState<SendResult | null>(null);
  const [interviewResult, setInterviewResult] = useState<SendResult | null>(null);
  const [finalResult, setFinalResult] = useState<SendResult | null>(null);

  useEffect(() => {
    const savedUser = sessionStorage.getItem("hyfin_user");
    const savedToken = sessionStorage.getItem("hyfin_token");
    if (!savedUser || !savedToken) {
      router.replace("/admin");
      return;
    }
    const u = JSON.parse(savedUser) as HyfinUser;
    setUser(u);
    if (u.role !== "ADMIN") {
      // STAFF는 이 페이지 접근 불가
      return;
    }
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

  if (user && user.role !== "ADMIN") {
    return (
      <div className="p-8">
        <div className="section-card text-center py-12">
          <p className="text-lg font-semibold text-gray-600">권한이 없습니다.</p>
          <p className="text-sm text-gray-400 mt-2">메일 발송 기능은 관리자(ADMIN)만 사용할 수 있습니다.</p>
        </div>
      </div>
    );
  }

  // 각 섹션 대상자
  const docApplicants = applicants.filter((a) => ["DOC_PASS", "DOC_FAIL"].includes(a.status));
  const interviewApplicants = applicants.filter((a) => a.status === "INTERVIEW");
  const finalApplicants = applicants.filter((a) => ["FINAL_PASS", "FINAL_FAIL"].includes(a.status));

  const toggleDoc = (id: string) =>
    setDocSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleInterview = (id: string) =>
    setInterviewSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleFinal = (id: string) =>
    setFinalSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const sendDoc = async () => {
    if (docSelectedIds.size === 0) return alert("발송 대상자를 선택해 주세요.");
    if (!confirm(`${docSelectedIds.size}명에게 서류 결과 메일을 발송하시겠습니까?`)) return;
    setDocSending(true);
    setDocResult(null);
    const res = await fetch("/api/admin/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-token": token },
      body: JSON.stringify({ applicantIds: Array.from(docSelectedIds), type: "DOC_RESULT" }),
    });
    const data = await res.json();
    setDocResult({ success: data.success, total: data.total });
    setDocSending(false);
    fetchAll();
  };

  const sendInterview = async () => {
    if (interviewSelectedIds.size === 0) return alert("발송 대상자를 선택해 주세요.");
    if (!confirm(`${interviewSelectedIds.size}명에게 면접 안내 메일을 발송하시겠습니까?`)) return;
    setInterviewSending(true);
    setInterviewResult(null);
    const res = await fetch("/api/admin/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-token": token },
      body: JSON.stringify({ applicantIds: Array.from(interviewSelectedIds), type: "INTERVIEW" }),
    });
    const data = await res.json();
    setInterviewResult({ success: data.success, total: data.total });
    setInterviewSending(false);
    fetchAll();
  };

  const sendFinal = async () => {
    if (finalSelectedIds.size === 0) return alert("발송 대상자를 선택해 주세요.");
    if (!confirm(`${finalSelectedIds.size}명에게 최종 결과 메일을 발송하시겠습니까?`)) return;
    setFinalSending(true);
    setFinalResult(null);
    const res = await fetch("/api/admin/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-token": token },
      body: JSON.stringify({ applicantIds: Array.from(finalSelectedIds), type: "FINAL_RESULT" }),
    });
    const data = await res.json();
    setFinalResult({ success: data.success, total: data.total });
    setFinalSending(false);
    fetchAll();
  };

  const ResultBanner = ({ result }: { result: SendResult }) => (
    <div
      className={`rounded-xl p-3 mb-3 text-sm font-medium ${
        result.success === result.total
          ? "bg-green-50 text-green-700"
          : "bg-yellow-50 text-yellow-700"
      }`}
    >
      발송 완료: {result.total}명 중 {result.success}명 성공
      {result.success < result.total && ` (${result.total - result.success}명 실패)`}
    </div>
  );

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">메일 발송</h1>
        <p className="text-sm text-gray-500 mt-1">지원자에게 이메일을 일괄 발송합니다.</p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">불러오는 중...</p>
      ) : (
        <div className="space-y-6">
          {/* 섹션 1: 서류 결과 메일 */}
          <div className="section-card">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
              <div>
                <h2 className="text-base font-bold text-hyfin-blue">
                  1. 서류 결과 메일
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  서류 합격/불합격 대상자에게 결과를 이메일로 발송합니다.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setDocSelectedIds(new Set(docApplicants.map((a) => a.id)))}
                  className="btn-secondary text-xs"
                >
                  전체 선택
                </button>
                <button
                  onClick={() => setDocSelectedIds(new Set())}
                  className="btn-secondary text-xs"
                >
                  전체 해제
                </button>
              </div>
            </div>

            {docResult && <ResultBanner result={docResult} />}

            {docApplicants.length === 0 ? (
              <p className="text-sm text-gray-400 mb-4">대상자가 없습니다.</p>
            ) : (
              <div className="space-y-1 mb-4 max-h-64 overflow-y-auto">
                {docApplicants.map((a) => (
                  <label
                    key={a.id}
                    className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={docSelectedIds.has(a.id)}
                      onChange={() => toggleDoc(a.id)}
                      className="rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{a.name}</p>
                      <p className="text-xs text-gray-500">{a.email} · {a.major}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {a.docEmailSent && (
                        <span className="text-xs text-green-600 font-medium">✓ 발송됨</span>
                      )}
                      <StatusBadge status={a.status} />
                    </div>
                  </label>
                ))}
              </div>
            )}

            <button
              onClick={sendDoc}
              disabled={docSending || docSelectedIds.size === 0}
              className="btn-primary text-sm"
            >
              {docSending ? "발송 중..." : `서류 결과 발송 (${docSelectedIds.size}명)`}
            </button>
          </div>

          {/* 섹션 2: 면접 일정 메일 */}
          <div className="section-card">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
              <div>
                <h2 className="text-base font-bold text-hyfin-blue">
                  2. 면접 일정 메일
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  면접 대상자에게 면접 안내 및 희망 시간 선택 링크를 발송합니다.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setInterviewSelectedIds(new Set(interviewApplicants.map((a) => a.id)))}
                  className="btn-secondary text-xs"
                >
                  전체 선택
                </button>
                <button
                  onClick={() => setInterviewSelectedIds(new Set())}
                  className="btn-secondary text-xs"
                >
                  전체 해제
                </button>
              </div>
            </div>

            {interviewResult && <ResultBanner result={interviewResult} />}

            {interviewApplicants.length === 0 ? (
              <p className="text-sm text-gray-400 mb-4">대상자가 없습니다.</p>
            ) : (
              <div className="space-y-1 mb-4 max-h-64 overflow-y-auto">
                {interviewApplicants.map((a) => (
                  <label
                    key={a.id}
                    className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={interviewSelectedIds.has(a.id)}
                      onChange={() => toggleInterview(a.id)}
                      className="rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{a.name}</p>
                      <p className="text-xs text-gray-500">{a.email} · {a.major}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {a.interviewEmailSent && (
                        <span className="text-xs text-green-600 font-medium">✓ 발송됨</span>
                      )}
                      <StatusBadge status={a.status} />
                    </div>
                  </label>
                ))}
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={sendInterview}
                disabled={interviewSending || interviewSelectedIds.size === 0}
                className="btn-primary text-sm"
              >
                {interviewSending ? "발송 중..." : `면접 안내 발송 (${interviewSelectedIds.size}명)`}
              </button>
              <p className="text-xs text-gray-400">
                면접 희망 시간 선택 링크가 메일에 포함됩니다.
              </p>
            </div>
          </div>

          {/* 섹션 3: 최종 결과 메일 */}
          <div className="section-card">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
              <div>
                <h2 className="text-base font-bold text-hyfin-blue">
                  3. 최종 결과 메일
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  최종 합격/불합격 대상자에게 결과를 이메일로 발송합니다.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setFinalSelectedIds(new Set(finalApplicants.map((a) => a.id)))}
                  className="btn-secondary text-xs"
                >
                  전체 선택
                </button>
                <button
                  onClick={() => setFinalSelectedIds(new Set())}
                  className="btn-secondary text-xs"
                >
                  전체 해제
                </button>
              </div>
            </div>

            {finalResult && <ResultBanner result={finalResult} />}

            {finalApplicants.length === 0 ? (
              <p className="text-sm text-gray-400 mb-4">대상자가 없습니다.</p>
            ) : (
              <div className="space-y-1 mb-4 max-h-64 overflow-y-auto">
                {finalApplicants.map((a) => (
                  <label
                    key={a.id}
                    className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={finalSelectedIds.has(a.id)}
                      onChange={() => toggleFinal(a.id)}
                      className="rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{a.name}</p>
                      <p className="text-xs text-gray-500">{a.email} · {a.major}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {a.finalEmailSent && (
                        <span className="text-xs text-green-600 font-medium">✓ 발송됨</span>
                      )}
                      <StatusBadge status={a.status} />
                    </div>
                  </label>
                ))}
              </div>
            )}

            <button
              onClick={sendFinal}
              disabled={finalSending || finalSelectedIds.size === 0}
              className="btn-primary text-sm"
            >
              {finalSending ? "발송 중..." : `최종 결과 발송 (${finalSelectedIds.size}명)`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
