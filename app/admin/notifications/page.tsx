"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import StatusBadge from "@/components/StatusBadge";

interface HyfinUser {
  id: string;
  role: "ADMIN" | "STAFF";
  title?: string;
}

interface NotificationLogItem {
  type: string;
  success: boolean;
}

interface Applicant {
  id: string;
  name: string;
  email: string;
  major: string;
  stage: string;
  docResult: string | null;
  finalResult: string | null;
  notifications?: NotificationLogItem[];
}

interface SendResult {
  success: number;
  failCount: number;
  total: number;
  failedIds: string[];
  dbErrorIds: string[];
  alreadySentIds: string[];
  untriedIds: string[];
  aborted: boolean;
}

interface SendProgress {
  done: number;
  total: number;
}

interface CommonQuestion {
  id: string;
  day: number;
  questions: string;
  location: string | null;
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

  const [commonQuestions, setCommonQuestions] = useState<CommonQuestion[]>([]);

  const [docSending, setDocSending] = useState(false);
  const [interviewSending, setInterviewSending] = useState(false);
  const [finalSending, setFinalSending] = useState(false);

  const [docResult, setDocResult] = useState<SendResult | null>(null);
  const [interviewResult, setInterviewResult] = useState<SendResult | null>(null);
  const [finalResult, setFinalResult] = useState<SendResult | null>(null);

  const [docProgress, setDocProgress] = useState<SendProgress | null>(null);
  const [interviewProgress, setInterviewProgress] = useState<SendProgress | null>(null);
  const [finalProgress, setFinalProgress] = useState<SendProgress | null>(null);

  const [previewModal, setPreviewModal] = useState<{ subject: string; html: string; title: string } | null>(null);

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
      setLoading(false);
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

    const cqRes = await fetch("/api/admin/common-questions", {
      headers: { "x-admin-token": token },
    });
    const cqData = await cqRes.json();
    setCommonQuestions(cqData);

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

  // 면접 장소 등록 여부 확인
  const hasAllLocations = commonQuestions.length > 0 && commonQuestions.every((cq) => cq.location && cq.location.trim() !== "");

  // 각 섹션 대상자
  const docApplicants = applicants.filter((a) => a.stage === "DOC_COMPLETED");
  const interviewApplicants = applicants.filter((a) => a.stage === "INTERVIEW_READY");
  const finalApplicants = applicants.filter(
    (a) => a.stage === "INTERVIEW_SET" && a.finalResult !== null
  );

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

  // 발송 이력이 있는 지원자 수 (최근 5건 로그 기준 — 발송 전 경고용)
  const countLocalAlreadySent = (ids: string[], type: string) => {
    const idSet = new Set(ids);
    return applicants.filter(
      (a) => idSet.has(a.id) && a.notifications?.some((n) => n.type === type && n.success)
    ).length;
  };

  const BATCH_SIZE = 25;

  const sendInBatches = async (
    ids: string[],
    type: string,
    onProgress: (p: SendProgress) => void
  ): Promise<SendResult> => {
    let successCount = 0;
    let failCount = 0;
    const failedIds: string[] = [];
    const dbErrorIds: string[] = [];
    const alreadySentIds = new Set<string>();
    let attempted = 0;

    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = ids.slice(i, i + BATCH_SIZE);
      try {
        const res = await fetch("/api/admin/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-admin-token": token },
          body: JSON.stringify({ applicantIds: batch, type }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        for (const r of (data.results ?? []) as Array<{ id?: string; success: boolean; dbError?: boolean }>) {
          if (r.success) {
            successCount++;
            if (r.dbError && r.id) dbErrorIds.push(r.id);
          } else {
            failCount++;
            if (r.id) failedIds.push(r.id);
          }
        }
        for (const id of (data.alreadySent ?? []) as string[]) alreadySentIds.add(id);

        attempted += batch.length;
        onProgress({ done: attempted, total: ids.length });
      } catch (err) {
        console.error("배치 발송 요청 실패:", err);
        return {
          success: successCount,
          failCount,
          total: ids.length,
          failedIds,
          dbErrorIds,
          alreadySentIds: Array.from(alreadySentIds),
          untriedIds: ids.slice(attempted),
          aborted: true,
        };
      }
    }

    return {
      success: successCount,
      failCount,
      total: ids.length,
      failedIds,
      dbErrorIds,
      alreadySentIds: Array.from(alreadySentIds),
      untriedIds: [],
      aborted: false,
    };
  };

  const sendDoc = async () => {
    if (docSelectedIds.size === 0) return alert("발송 대상자를 선택해 주세요.");
    const ids = Array.from(docSelectedIds);
    const already = countLocalAlreadySent(ids, "DOC_RESULT");
    const warn = already > 0 ? `\n주의: 이 중 ${already}명은 이미 발송된 이력이 있습니다.` : "";
    if (!confirm(`${ids.length}명에게 서류 결과 메일을 발송하시겠습니까?${warn}`)) return;
    setDocSending(true);
    setDocResult(null);
    setDocProgress({ done: 0, total: ids.length });
    const result = await sendInBatches(ids, "DOC_RESULT", setDocProgress);
    setDocResult(result);
    // stage 전환으로 목록에서 사라진 인원의 ID가 선택에 남아 재발송되는 것을 방지
    setDocSelectedIds(new Set());
    setDocProgress(null);
    setDocSending(false);
    fetchAll();
  };

  const sendInterview = async () => {
    if (interviewSelectedIds.size === 0) return alert("발송 대상자를 선택해 주세요.");
    const ids = Array.from(interviewSelectedIds);
    const already = countLocalAlreadySent(ids, "INTERVIEW");
    const warn = already > 0 ? `\n주의: 이 중 ${already}명은 이미 발송된 이력이 있습니다.` : "";
    if (!confirm(`${ids.length}명에게 면접 안내 메일을 발송하시겠습니까?${warn}`)) return;
    setInterviewSending(true);
    setInterviewResult(null);
    setInterviewProgress({ done: 0, total: ids.length });
    const result = await sendInBatches(ids, "INTERVIEW", setInterviewProgress);
    setInterviewResult(result);
    setInterviewSelectedIds(new Set());
    setInterviewProgress(null);
    setInterviewSending(false);
    fetchAll();
  };

  const sendFinal = async () => {
    if (finalSelectedIds.size === 0) return alert("발송 대상자를 선택해 주세요.");
    const ids = Array.from(finalSelectedIds);
    const already = countLocalAlreadySent(ids, "FINAL_RESULT");
    const warn = already > 0 ? `\n주의: 이 중 ${already}명은 이미 발송된 이력이 있습니다.` : "";
    if (!confirm(`${ids.length}명에게 최종 결과 메일을 발송하시겠습니까?${warn}`)) return;
    setFinalSending(true);
    setFinalResult(null);
    setFinalProgress({ done: 0, total: ids.length });
    const result = await sendInBatches(ids, "FINAL_RESULT", setFinalProgress);
    setFinalResult(result);
    setFinalSelectedIds(new Set());
    setFinalProgress(null);
    setFinalSending(false);
    fetchAll();
  };

  const openPreview = async (type: string, passed?: boolean) => {
    const params = new URLSearchParams({ type });
    if (passed !== undefined) params.set("passed", String(passed));
    const res = await fetch(`/api/admin/email-preview?${params}`, {
      headers: { "x-admin-token": token },
    });
    const data = await res.json();
    const titles: Record<string, string> = {
      RECEIPT: "접수 확인 메일",
      DOC_RESULT_PASS: "서류 합격 메일",
      DOC_RESULT_FAIL: "서류 불합격 메일",
      INTERVIEW: "면접 안내 메일",
      FINAL_RESULT_PASS: "최종 합격 메일",
      FINAL_RESULT_FAIL: "최종 불합격 메일",
    };
    const titleKey = passed === undefined ? type : `${type}_${passed ? "PASS" : "FAIL"}`;
    setPreviewModal({ ...data, title: titles[titleKey] ?? type });
  };

  const nameOf = (id: string) => applicants.find((a) => a.id === id)?.name ?? id;

  // 응답 유실 시 서버는 발송을 완료했을 수 있으므로, 재선택 전에 최신 발송 이력을
  // 다시 조회해 이미 성공 발송된 인원은 제외한다 (중복 발송 방어)
  const reselectFailed = async (
    retryIds: string[],
    type: string,
    setSelected: (ids: Set<string>) => void
  ) => {
    let latest = applicants;
    try {
      const res = await fetch("/api/admin/applications", {
        headers: { "x-admin-token": token },
      });
      if (res.ok) {
        const data = (await res.json()) as Applicant[];
        setApplicants(data);
        latest = data;
      }
    } catch (err) {
      console.error("발송 이력 재조회 실패 — 현재 데이터 기준으로 진행:", err);
    }
    const sentIds = new Set(
      latest
        .filter((a) => a.notifications?.some((n) => n.type === type && n.success))
        .map((a) => a.id)
    );
    const toSelect = retryIds.filter((id) => !sentIds.has(id));
    const excluded = retryIds.length - toSelect.length;
    setSelected(new Set(toSelect));
    if (excluded > 0) {
      alert(`${excluded}명은 발송 이력이 확인되어 재선택에서 제외했습니다.`);
    }
  };

  const ResultBanner = ({
    result,
    type,
    onReselect,
  }: {
    result: SendResult;
    type: string;
    onReselect: (ids: Set<string>) => void;
  }) => {
    const retryIds = [...result.failedIds, ...result.untriedIds];
    const allOk = !result.aborted && result.failCount === 0;
    return (
      <div
        className={`rounded-xl p-3 mb-3 text-sm font-medium ${
          allOk ? "bg-green-50 text-green-700" : "bg-yellow-50 text-yellow-700"
        }`}
      >
        <p>
          {result.aborted ? "발송 중단" : "발송 완료"}: {result.total}명 중 {result.success}명 성공
          {result.failCount > 0 && ` (${result.failCount}명 실패)`}
        </p>
        {result.failedIds.length > 0 && (
          <p className="mt-1 font-normal">
            실패: {result.failedIds.map(nameOf).join(", ")}
          </p>
        )}
        {result.dbErrorIds.length > 0 && (
          <p className="mt-1 font-normal text-orange-700">
            메일은 발송됐으나 상태 기록 실패: {result.dbErrorIds.map(nameOf).join(", ")}
          </p>
        )}
        {result.alreadySentIds.length > 0 && (
          <p className="mt-1 font-normal">
            {result.alreadySentIds.length}명은 이전에 이미 발송된 이력이 있습니다:{" "}
            {result.alreadySentIds.map(nameOf).join(", ")}
          </p>
        )}
        {result.aborted && (
          <p className="mt-1 font-normal text-red-600">
            네트워크 오류로 발송이 중단되었습니다. {result.total - result.untriedIds.length}명까지
            시도했으며, {result.untriedIds.length}명은 시도하지 못했습니다. 중단된 배치는 응답만
            유실되고 실제로는 발송됐을 수 있으니, 재발송 전 발송 이력을 확인해 주세요.
          </p>
        )}
        {retryIds.length > 0 && (
          <button
            onClick={() => reselectFailed(retryIds, type, onReselect)}
            className="btn-secondary text-xs mt-2"
          >
            실패자만 다시 선택 ({retryIds.length}명)
          </button>
        )}
      </div>
    );
  };

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
                  서류 결과 확정(DOC_COMPLETED) 대상자에게 합격/불합격 결과를 이메일로 발송합니다.
                </p>
                <div className="flex gap-2 mt-2">
                  <button onClick={() => openPreview("DOC_RESULT", true)} className="text-xs text-blue-600 hover:underline">
                    합격 예시 보기
                  </button>
                  <span className="text-xs text-gray-300">|</span>
                  <button onClick={() => openPreview("DOC_RESULT", false)} className="text-xs text-blue-600 hover:underline">
                    불합격 예시 보기
                  </button>
                </div>
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

            {docResult && (
              <ResultBanner result={docResult} type="DOC_RESULT" onReselect={setDocSelectedIds} />
            )}

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
                      <StatusBadge status={a.stage} />
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
              {docSending
                ? `발송 중... ${docProgress ? `${docProgress.done}/${docProgress.total}` : ""}`
                : `서류 결과 발송 (${docSelectedIds.size}명)`}
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
                  면접 대기(INTERVIEW_READY) 대상자에게 배정된 면접 일시와 장소를 발송합니다. 면접 일시는 각 지원자의 배정 슬롯에서 자동으로 가져옵니다.
                </p>
                <div className="mt-2">
                  <button onClick={() => openPreview("INTERVIEW")} className="text-xs text-blue-600 hover:underline">
                    예시 메일 보기
                  </button>
                </div>
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

            {interviewResult && (
              <ResultBanner
                result={interviewResult}
                type="INTERVIEW"
                onReselect={setInterviewSelectedIds}
              />
            )}

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
                      {a.stage === "INTERVIEW_SET" && (
                        <span className="text-xs text-green-600 font-medium">✓ 발송됨</span>
                      )}
                      <StatusBadge status={a.stage} />
                    </div>
                  </label>
                ))}
              </div>
            )}

            {!hasAllLocations && (
              <p className="text-sm text-red-500 font-medium mb-2">
                ⚠ 아직 면접 장소가 등록되지 않았습니다. 면접 관리 탭에서 공통질문 수정 시 장소를 입력해 주세요.
              </p>
            )}
            <button
              onClick={sendInterview}
              disabled={interviewSending || interviewSelectedIds.size === 0 || !hasAllLocations}
              className="btn-primary text-sm"
            >
              {interviewSending
                ? `발송 중... ${interviewProgress ? `${interviewProgress.done}/${interviewProgress.total}` : ""}`
                : `면접 일정 발송 (${interviewSelectedIds.size}명)`}
            </button>
          </div>

          {/* 섹션 3: 최종 결과 메일 */}
          <div className="section-card">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
              <div>
                <h2 className="text-base font-bold text-hyfin-blue">
                  3. 최종 결과 메일
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  최종 결과가 확정된 대상자에게 합격/불합격 결과를 이메일로 발송합니다.
                </p>
                <div className="flex gap-2 mt-2">
                  <button onClick={() => openPreview("FINAL_RESULT", true)} className="text-xs text-blue-600 hover:underline">
                    합격 예시 보기
                  </button>
                  <span className="text-xs text-gray-300">|</span>
                  <button onClick={() => openPreview("FINAL_RESULT", false)} className="text-xs text-blue-600 hover:underline">
                    불합격 예시 보기
                  </button>
                </div>
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

            {finalResult && (
              <ResultBanner
                result={finalResult}
                type="FINAL_RESULT"
                onReselect={setFinalSelectedIds}
              />
            )}

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
                      {a.stage === "FINISHED" && (
                        <span className="text-xs text-green-600 font-medium">✓ 발송됨</span>
                      )}
                      <StatusBadge status={a.stage} />
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
              {finalSending
                ? `발송 중... ${finalProgress ? `${finalProgress.done}/${finalProgress.total}` : ""}`
                : `최종 결과 발송 (${finalSelectedIds.size}명)`}
            </button>
          </div>
        </div>
      )}

      {previewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <p className="text-xs text-gray-500 mb-0.5">예시 메일 미리보기</p>
                <p className="font-bold text-gray-900">{previewModal.title}</p>
                <p className="text-xs text-gray-500 mt-1">제목: {previewModal.subject}</p>
              </div>
              <button
                onClick={() => setPreviewModal(null)}
                className="text-gray-400 hover:text-gray-700 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-hidden p-4">
              <iframe
                srcDoc={previewModal.html}
                className="w-full h-[500px] border border-gray-200 rounded-lg bg-white"
                sandbox="allow-same-origin"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
