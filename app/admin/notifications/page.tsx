"use client";

import { useEffect, useState } from "react";
import StatusBadge from "@/components/StatusBadge";

const ADMIN_TOKEN_KEY = "hyfin_admin_token";

interface Applicant {
  id: string;
  name: string;
  email: string;
  major: string;
  status: string;
}

const NOTIFY_TYPES = [
  {
    value: "DOC_RESULT",
    label: "서류 결과 발송",
    desc: "서류 합격/불합격 대상자에게 결과를 이메일로 발송합니다.",
    targetStatuses: ["DOC_PASS", "DOC_FAIL"],
  },
  {
    value: "FINAL_RESULT",
    label: "최종 결과 발송",
    desc: "최종 합격/불합격 대상자에게 결과를 이메일로 발송합니다.",
    targetStatuses: ["FINAL_PASS", "FINAL_FAIL"],
  },
];

export default function NotificationsPage() {
  const token = typeof window !== "undefined" ? sessionStorage.getItem(ADMIN_TOKEN_KEY) ?? "" : "";
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState(NOTIFY_TYPES[0]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<{ success: number; total: number } | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/admin/applications", { headers: { "x-admin-token": token } });
      setApplicants(await res.json());
      setLoading(false);
    })();
  }, []);

  const targetApplicants = applicants.filter((a) => selectedType.targetStatuses.includes(a.status));

  useEffect(() => {
    setSelectedIds(new Set(targetApplicants.map((a) => a.id)));
  }, [selectedType, applicants]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const send = async () => {
    if (selectedIds.size === 0) return alert("발송 대상자를 선택해 주세요.");
    if (!confirm(`${selectedIds.size}명에게 이메일을 발송하시겠습니까?`)) return;
    setSending(true);
    setLastResult(null);
    const res = await fetch("/api/admin/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-token": token },
      body: JSON.stringify({ applicantIds: Array.from(selectedIds), type: selectedType.value }),
    });
    const data = await res.json();
    setSending(false);
    setLastResult({ success: data.success, total: data.total });
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">알림 발송</h1>
        <p className="text-sm text-gray-500 mt-1">지원자에게 이메일을 일괄 발송합니다.</p>
      </div>

      {/* 발송 유형 선택 */}
      <div className="section-card mb-6">
        <h2 className="section-title">발송 유형 선택</h2>
        <div className="grid grid-cols-2 gap-3">
          {NOTIFY_TYPES.map((type) => (
            <button
              key={type.value}
              onClick={() => setSelectedType(type)}
              className={`text-left p-4 rounded-xl border-2 transition ${selectedType.value === type.value ? "border-hyfin-blue bg-blue-50" : "border-gray-200 hover:border-gray-300"}`}
            >
              <p className={`font-semibold text-sm ${selectedType.value === type.value ? "text-hyfin-blue" : "text-gray-800"}`}>{type.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{type.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* 발송 대상 */}
      <div className="section-card mb-6">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
          <h2 className="text-base font-bold text-hyfin-blue">발송 대상 ({targetApplicants.length}명 중 {selectedIds.size}명 선택)</h2>
          <div className="flex gap-2">
            <button onClick={() => setSelectedIds(new Set(targetApplicants.map((a) => a.id)))} className="btn-secondary text-xs">전체 선택</button>
            <button onClick={() => setSelectedIds(new Set())} className="btn-secondary text-xs">전체 해제</button>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-gray-400">불러오는 중...</p>
        ) : targetApplicants.length === 0 ? (
          <p className="text-sm text-gray-400">해당하는 지원자가 없습니다.</p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {targetApplicants.map((a) => (
              <label key={a.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedIds.has(a.id)}
                  onChange={() => toggleSelect(a.id)}
                  className="rounded"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{a.name}</p>
                  <p className="text-xs text-gray-500">{a.email} · {a.major}</p>
                </div>
                <StatusBadge status={a.status} />
              </label>
            ))}
          </div>
        )}
      </div>

      {/* 발송 */}
      {lastResult && (
        <div className={`rounded-xl p-4 mb-4 text-sm font-medium ${lastResult.success === lastResult.total ? "bg-green-50 text-green-700" : "bg-yellow-50 text-yellow-700"}`}>
          발송 완료: {lastResult.total}명 중 {lastResult.success}명 성공
          {lastResult.success < lastResult.total && ` (${lastResult.total - lastResult.success}명 실패)`}
        </div>
      )}

      <button onClick={send} disabled={sending || selectedIds.size === 0} className="btn-primary">
        {sending ? "발송 중..." : `이메일 발송 (${selectedIds.size}명)`}
      </button>
    </div>
  );
}
