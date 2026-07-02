"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface HyfinUser {
  id: string;
  role: "ADMIN" | "STAFF";
  title?: string;
}

interface Applicant {
  id: string;
  name: string;
  stage: string;
  docResult: string | null;
  finalResult: string | null;
  major: string;
  grade: string;
  studentId: string;
  gpa: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<HyfinUser | null>(null);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser = sessionStorage.getItem("hyfin_user");
    const token = sessionStorage.getItem("hyfin_token");
    if (!savedUser || !token) {
      router.replace("/admin");
      return;
    }
    const u = JSON.parse(savedUser) as HyfinUser;
    setUser(u);

    (async () => {
      try {
        const res = await fetch("/api/admin/applications", {
          headers: { "x-admin-token": token },
        });
        if (!res.ok) {
          sessionStorage.removeItem("hyfin_user");
          sessionStorage.removeItem("hyfin_token");
          router.replace("/admin");
          return;
        }
        const data = await res.json();
        setApplicants(data);
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  // 통계 계산
  const total = applicants.length;
  const docReviewing = applicants.filter((a) => ["DOC_REVIEWING", "DOC_COMPLETED"].includes(a.stage)).length;
  const docPass = applicants.filter((a) => a.docResult === "PASS").length;
  const docFail = applicants.filter((a) => a.docResult === "FAIL").length;
  const interviewCount = applicants.filter((a) =>
    ["INTERVIEW_READY", "INTERVIEW_SET"].includes(a.stage)
  ).length;
  const finalPass = applicants.filter((a) => a.finalResult === "PASS").length;

  const statCards = [
    { label: "전체 지원자", value: total, color: "bg-blue-50 text-blue-700" },
    { label: "서류 평가 중", value: docReviewing, color: "bg-indigo-50 text-indigo-700" },
    { label: "서류 합격", value: docPass, color: "bg-green-50 text-green-700" },
    { label: "서류 불합격", value: docFail, color: "bg-red-50 text-red-600" },
    { label: "면접 진행", value: interviewCount, color: "bg-purple-50 text-purple-700" },
    { label: "최종 합격", value: finalPass, color: "bg-emerald-50 text-emerald-700" },
  ];

  const menuItems = [
    { href: "/admin/applications", icon: "📋", title: "지원자 관리", desc: "서류 평가 및 합불 처리", adminOnly: false },
    { href: "/admin/interviews", icon: "🎤", title: "면접 관리", desc: "면접 캘린더 및 면접 평가", adminOnly: false },
    { href: "/admin/notifications", icon: "📧", title: "메일 발송", desc: "접수 확인, 합불 결과 발송", adminOnly: true },
  ];

  // 학과별 분포
  const majorMap: Record<string, number> = {};
  applicants.forEach((a) => {
    majorMap[a.major] = (majorMap[a.major] ?? 0) + 1;
  });
  const majorEntries = Object.entries(majorMap).sort((a, b) => b[1] - a[1]);
  const majorMax = majorEntries[0]?.[1] ?? 1;

  // 학년별 분포
  const gradeMap: Record<string, number> = {};
  applicants.forEach((a) => {
    gradeMap[a.grade] = (gradeMap[a.grade] ?? 0) + 1;
  });
  const gradeEntries = Object.entries(gradeMap).sort((a, b) => a[0].localeCompare(b[0]));
  const gradeMax = gradeEntries[0]?.[1] ?? 1;

  // 평균 GPA
  const validGpas = applicants.map((a) => parseFloat(a.gpa)).filter((g) => !isNaN(g));
  const avgGpa = validGpas.length > 0
    ? (validGpas.reduce((s, g) => s + g, 0) / validGpas.length).toFixed(2)
    : "-";

  // 전형 단계 퍼널
  const funnelSteps = [
    { label: "접수", count: total },
    { label: "서류 합격", count: docPass },
    { label: "면접 진행", count: interviewCount },
    { label: "최종 합격", count: finalPass },
  ];
  const funnelMax = funnelSteps[0]?.count ?? 1;

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>
        <p className="text-sm text-gray-500 mt-1">HYFIN 8기 리크루팅 현황</p>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">불러오는 중...</p>
      ) : (
        <>
          {/* 현황 카드 */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            {statCards.map((card) => (
              <div key={card.label} className={`rounded-xl p-5 ${card.color}`}>
                <p className="text-sm font-medium opacity-70">{card.label}</p>
                <p className="text-3xl font-bold mt-1">{card.value}</p>
              </div>
            ))}
          </div>

          {/* 지원자 통계 */}
          {total > 0 && (
            <div className="section-card mb-8">
              <h2 className="text-base font-bold text-gray-900 mb-5">지원자 통계</h2>

              <div className="grid grid-cols-3 gap-6">
                {/* 전형 퍼널 */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-3">전형 단계별 현황</p>
                  <div className="space-y-2">
                    {funnelSteps.map((step) => {
                      const pct = funnelMax > 0 ? Math.round((step.count / funnelMax) * 100) : 0;
                      return (
                        <div key={step.label}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-600">{step.label}</span>
                            <span className="font-semibold text-gray-800">{step.count}명</span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-hyfin-blue rounded-full transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                    <span>평균 GPA</span>
                    <span className="font-semibold text-gray-800">{avgGpa}</span>
                  </div>
                </div>

                {/* 학과별 분포 */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-3">학과별 지원자</p>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {majorEntries.map(([major, count]) => {
                      const pct = Math.round((count / majorMax) * 100);
                      return (
                        <div key={major}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-600 truncate max-w-[130px]">{major}</span>
                            <span className="font-semibold text-gray-800 ml-1">{count}명</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-indigo-400 rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 학년별 분포 */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-3">학년별 지원자</p>
                  <div className="space-y-2">
                    {gradeEntries.map(([grade, count]) => {
                      const pct = Math.round((count / gradeMax) * 100);
                      return (
                        <div key={grade}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-600">{grade}</span>
                            <span className="font-semibold text-gray-800">{count}명</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-amber-400 rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {total > 0 && (
                    <div className="mt-4 pt-3 border-t border-gray-100 space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">서류 합격률</span>
                        <span className="font-semibold text-green-600">
                          {docPass + docFail > 0 ? Math.round((docPass / (docPass + docFail)) * 100) : "-"}%
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">최종 합격률</span>
                        <span className="font-semibold text-emerald-600">
                          {interviewCount > 0 ? Math.round((finalPass / interviewCount) * 100) : "-"}%
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 바로가기 */}
          <div className="grid grid-cols-3 gap-4">
            {menuItems.map((item) => {
              if (item.adminOnly && user?.role !== "ADMIN") return null;
              return (
                <button
                  key={item.href}
                  onClick={() => router.push(item.href)}
                  className="section-card text-left hover:shadow-md transition cursor-pointer"
                >
                  <p className="text-2xl mb-2">{item.icon}</p>
                  <h3 className="font-semibold text-gray-900">{item.title}</h3>
                  <p className="text-sm text-gray-500 mt-1">{item.desc}</p>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
