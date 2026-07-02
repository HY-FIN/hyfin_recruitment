const STATUS_MAP: Record<string, { label: string; className: string }> = {
  SUBMITTED:       { label: "접수 완료",  className: "bg-gray-100 text-gray-600" },
  DOC_REVIEWING:   { label: "서류 평가 중", className: "bg-blue-100 text-blue-700" },
  DOC_COMPLETED:   { label: "서류 결과 확정",  className: "bg-indigo-100 text-indigo-700" },
  DOC_REJECTED:    { label: "서류 불합격",      className: "bg-red-100 text-red-600" },
  INTERVIEW_READY: { label: "면접 대기",        className: "bg-amber-100 text-amber-700" },
  INTERVIEW_SET:   { label: "면접 일정 확정",  className: "bg-purple-100 text-purple-700" },
  FINISHED:        { label: "전형 종료",  className: "bg-green-100 text-green-700" },
};

export default function StatusBadge({ status }: { status: string }) {
  const { label, className } = STATUS_MAP[status] ?? { label: status, className: "bg-gray-100 text-gray-600" };
  return (
    <span className={`badge ${className}`}>{label}</span>
  );
}

export function DocResultBadge({ result }: { result: "PASS" | "FAIL" | null }) {
  if (!result) return <span className="text-gray-300 text-xs">미결정</span>;
  return result === "PASS"
    ? <span className="text-xs font-medium text-green-600">합격</span>
    : <span className="text-xs font-medium text-red-500">불합격</span>;
}

export function FinalResultBadge({ result }: { result: "PASS" | "FAIL" | null }) {
  if (!result) return <span className="text-gray-300 text-xs">미결정</span>;
  return result === "PASS"
    ? <span className="text-xs font-medium text-emerald-600 font-bold">최종 합격</span>
    : <span className="text-xs font-medium text-rose-600 font-bold">최종 불합격</span>;
}
