"use client";

import { useState } from "react";

interface BackupFile {
  name: string;
  webViewLink: string;
}

interface BackupResult {
  success: true;
  timestamp: string;
  counts: Record<string, number>;
  files: BackupFile[];
}

const COUNT_LABELS: Record<string, string> = {
  applicants: "지원자",
  evaluations: "평가",
  interviewSlots: "면접 슬롯",
  commonQuestions: "공통 질문",
  finalQuestions: "개별 질문",
  notificationLogs: "알림 로그",
};

export default function BackupPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BackupResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runBackup = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const token = sessionStorage.getItem("hyfin_token");
      const res = await fetch("/api/admin/backup", {
        method: "POST",
        headers: { "x-admin-token": token ?? "" },
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setResult(data as BackupResult);
      } else {
        setError(data.error ?? `백업에 실패했습니다. (HTTP ${res.status})`);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">백업</h1>
        <p className="text-sm text-gray-500 mt-1">
          현재 데이터베이스를 구글 드라이브에 백업합니다.
        </p>
      </div>

      <div className="section-card max-w-2xl">
        <p className="text-sm text-gray-600 leading-relaxed">
          JSON 전체 덤프 + 지원자 CSV 두 파일이 지정된 드라이브 폴더에 업로드됩니다.
        </p>

        <button
          onClick={runBackup}
          disabled={loading}
          className="btn-primary mt-5"
        >
          {loading ? "백업 중..." : "드라이브에 백업하기"}
        </button>

        {error && (
          <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm font-semibold text-red-700">백업 실패</p>
            <p className="text-sm text-red-600 mt-1 break-all">{error}</p>
          </div>
        )}

        {result && (
          <div className="mt-5 rounded-lg border border-green-200 bg-green-50 px-4 py-4">
            <p className="text-sm font-semibold text-green-700">백업 완료</p>
            <p className="text-xs text-gray-500 mt-1">백업 시각: {result.timestamp}</p>

            <div className="mt-3 space-y-2">
              {result.files.map((f) => (
                <div
                  key={f.name}
                  className="flex items-center justify-between gap-3 rounded-md bg-white border border-green-100 px-3 py-2"
                >
                  <span className="text-sm text-gray-700 truncate">{f.name}</span>
                  {f.webViewLink && (
                    <a
                      href={f.webViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-hyfin-blue hover:underline shrink-0"
                    >
                      열기
                    </a>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-4">
              <p className="text-xs font-semibold text-gray-500 mb-2">백업된 레코드 수</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(result.counts).map(([key, count]) => (
                  <span
                    key={key}
                    className="badge bg-gray-100 text-gray-700"
                  >
                    {COUNT_LABELS[key] ?? key}: {count}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
