const STATUS_MAP: Record<string, { label: string; className: string }> = {
  PENDING:     { label: "검토 대기", className: "bg-gray-100 text-gray-600" },
  DOC_PASS:    { label: "서류 합격", className: "bg-green-100 text-green-700" },
  DOC_FAIL:    { label: "서류 불합격", className: "bg-red-100 text-red-600" },
  INTERVIEW:   { label: "면접 대상", className: "bg-blue-100 text-blue-700" },
  FINAL_PASS:  { label: "최종 합격", className: "bg-emerald-100 text-emerald-700" },
  FINAL_FAIL:  { label: "최종 불합격", className: "bg-rose-100 text-rose-700" },
};

export default function StatusBadge({ status }: { status: string }) {
  const { label, className } = STATUS_MAP[status] ?? { label: status, className: "bg-gray-100 text-gray-600" };
  return (
    <span className={`badge ${className}`}>{label}</span>
  );
}
