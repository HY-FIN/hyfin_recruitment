"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import StatusBadge from "@/components/StatusBadge";

interface HyfinUser {
  id: string;
  role: "ADMIN" | "STAFF";
  title?: string;
}

interface Evaluation {
  id: string;
  staffName: string;
  docScore: number | null;
  docComment: string | null;
  personalQuestion: string | null;
  interviewScore: number | null;
  interviewComment: string | null;
}

interface Applicant {
  id: string;
  name: string;
  phone: string;
  birthDate: string;
  email: string;
  address: string;
  university: string;
  grade: string;
  major: string;
  gpa: string;
  subMajor?: string;
  graduationPlan?: string;
  careers: string;
  essay1: string;
  essay2: string;
  essay3: string;
  essay4: string;
  status: string;
  appliedAt: string;
  receiptEmailSent: boolean;
  docEmailSent: boolean;
  interviewEmailSent: boolean;
  finalEmailSent: boolean;
  interviewPreferences: string;
  evaluations: Evaluation[];
}

const STATUS_OPTIONS = [
  { value: "", label: "전체" },
  { value: "PENDING", label: "검토 대기" },
  { value: "DOC_PASS", label: "서류 합격" },
  { value: "DOC_FAIL", label: "서류 불합격" },
  { value: "INTERVIEW", label: "면접 대상" },
  { value: "FINAL_PASS", label: "최종 합격" },
  { value: "FINAL_FAIL", label: "최종 불합격" },
];

const STATUS_TRANSITIONS: Record<string, { value: string; label: string }[]> = {
  PENDING: [
    { value: "DOC_PASS", label: "서류 합격" },
    { value: "DOC_FAIL", label: "서류 불합격" },
  ],
  DOC_PASS: [
    { value: "INTERVIEW", label: "면접 대상" },
    { value: "DOC_FAIL", label: "서류 불합격" },
  ],
  INTERVIEW: [
    { value: "FINAL_PASS", label: "최종 합격" },
    { value: "FINAL_FAIL", label: "최종 불합격" },
  ],
  DOC_FAIL: [{ value: "PENDING", label: "검토 대기로 되돌리기" }],
  FINAL_PASS: [],
  FINAL_FAIL: [{ value: "INTERVIEW", label: "면접 대상으로 되돌리기" }],
};

type SortKey = "appliedAt" | "name" | "gpa" | "avgScore";

function avgDocScore(evals: Evaluation[]): number | null {
  const scored = evals.filter((e) => e.docScore != null);
  if (scored.length === 0) return null;
  return scored.reduce((s, e) => s + (e.docScore ?? 0), 0) / scored.length;
}

export default function ApplicationsPage() {
  const router = useRouter();
  const [user, setUser] = useState<HyfinUser | null>(null);
  const [token, setToken] = useState("");
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [filtered, setFiltered] = useState<Applicant[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("appliedAt");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Applicant | null>(null);
  const [activeTab, setActiveTab] = useState<"info" | "essays" | "eval">("info");

  // 평가 입력 상태
  const [docScore, setDocScore] = useState<number>(3);
  const [docComment, setDocComment] = useState("");
  const [personalQuestion, setPersonalQuestion] = useState("");
  const [saving, setSaving] = useState(false);

  // 최종 개인질문 (ADMIN)
  const [finalQuestion, setFinalQuestion] = useState("");
  const [finalQuestionOriginal, setFinalQuestionOriginal] = useState("");
  const [savingFinal, setSavingFinal] = useState(false);

  useEffect(() => {
    const savedUser = sessionStorage.getItem("hyfin_user");
    const savedToken = sessionStorage.getItem("hyfin_token");
    if (!savedUser || !savedToken) {
      router.replace("/admin");
      return;
    }
    setUser(JSON.parse(savedUser));
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

  useEffect(() => {
    let result = [...applicants];
    if (statusFilter) result = result.filter((a) => a.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.email.toLowerCase().includes(q) ||
          a.major.toLowerCase().includes(q)
      );
    }
    result.sort((a, b) => {
      if (sortKey === "appliedAt") return new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime();
      if (sortKey === "name") return a.name.localeCompare(b.name);
      if (sortKey === "gpa") return parseFloat(b.gpa) - parseFloat(a.gpa);
      if (sortKey === "avgScore") {
        const aAvg = avgDocScore(a.evaluations) ?? -1;
        const bAvg = avgDocScore(b.evaluations) ?? -1;
        return bAvg - aAvg;
      }
      return 0;
    });
    setFiltered(result);
  }, [statusFilter, search, sortKey, applicants]);

  const openDetail = async (a: Applicant) => {
    setSelected(a);
    setActiveTab("info");
    // 내 평가 로드
    const myEval = a.evaluations.find((e) => e.staffName === user?.id);
    if (myEval) {
      setDocScore(myEval.docScore ?? 3);
      setDocComment(myEval.docComment ?? "");
      setPersonalQuestion(myEval.personalQuestion ?? "");
    } else {
      setDocScore(3);
      setDocComment("");
      setPersonalQuestion("");
    }
    // 최종 개인질문 로드 (ADMIN)
    if (user?.role === "ADMIN" && token) {
      const res = await fetch(`/api/admin/final-questions/${a.id}`, {
        headers: { "x-admin-token": token },
      });
      const data = await res.json();
      const q = data?.question ?? "";
      setFinalQuestion(q);
      setFinalQuestionOriginal(q);
    }
  };

  const changeStatus = async (id: string, status: string) => {
    await fetch(`/api/admin/applications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-admin-token": token },
      body: JSON.stringify({ status }),
    });
    await fetchAll();
    setSelected((prev) => (prev ? { ...prev, status } : null));
  };

  const saveEval = async () => {
    if (!selected || !user) return;
    setSaving(true);
    await fetch("/api/admin/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-token": token },
      body: JSON.stringify({
        applicantId: selected.id,
        docScore,
        docComment,
        personalQuestion,
      }),
    });
    await fetchAll();
    setSaving(false);
    alert("평가가 저장되었습니다.");
  };

  const saveFinalQuestion = async () => {
    if (!selected || !user || user.role !== "ADMIN") return;
    setSavingFinal(true);
    await fetch(`/api/admin/final-questions/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-admin-token": token },
      body: JSON.stringify({ question: finalQuestion }),
    });
    setFinalQuestionOriginal(finalQuestion);
    setSavingFinal(false);
    alert("최종 개인질문이 저장되었습니다.");
  };

  const careers = selected ? JSON.parse(selected.careers || "[]") : [];
  const myEvalExists = selected?.evaluations.some((e) => e.staffName === user?.id) ?? false;
  const avgScore = selected ? avgDocScore(selected.evaluations) : null;

  // 평가를 볼 수 있는 목록: ADMIN은 전체, STAFF는 본인만
  const visibleEvals = selected
    ? user?.role === "ADMIN"
      ? selected.evaluations
      : selected.evaluations.filter((e) => e.staffName === user?.id)
    : [];

  return (
    <div className="flex h-screen">
      {/* 좌측: 목록 패널 */}
      <div className="w-96 border-r border-gray-200 flex flex-col bg-white flex-shrink-0">
        <div className="p-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 mb-3">지원자 목록</h2>
          <input
            className="input mb-2 text-sm"
            placeholder="이름, 이메일, 학과 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="flex gap-2 mb-2">
            <select
              className="input text-sm flex-1"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              className="input text-sm flex-1"
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
            >
              <option value="appliedAt">제출일 순</option>
              <option value="name">이름 순</option>
              <option value="gpa">GPA 순</option>
              <option value="avgScore">평균점수 순</option>
            </select>
          </div>
          <p className="text-xs text-gray-400">{filtered.length}명</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="text-sm text-gray-400 text-center py-8">불러오는 중...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">지원자가 없습니다.</p>
          ) : (
            filtered.map((a) => {
              const avg = avgDocScore(a.evaluations);
              const myEval = a.evaluations.find((e) => e.staffName === user?.id);
              const prefSubmitted = a.interviewPreferences !== "[]" && a.interviewPreferences !== "";
              return (
                <button
                  key={a.id}
                  onClick={() => openDetail(a)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition ${
                    selected?.id === a.id ? "bg-blue-50 border-l-2 border-l-blue-500" : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm text-gray-900">{a.name}</span>
                    <StatusBadge status={a.status} />
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {a.major} · {a.grade}
                  </p>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-gray-400">{a.email}</p>
                    <div className="flex items-center gap-1.5">
                      {myEval && (
                        <span className="text-xs text-blue-600 font-medium">✓ 평가완료</span>
                      )}
                      {avg != null && (
                        <span className="text-xs text-amber-600 font-medium">
                          ★ {avg.toFixed(1)} ({a.evaluations.filter((e) => e.docScore != null).length}명)
                        </span>
                      )}
                      {prefSubmitted && (
                        <span className="text-xs text-green-600 font-medium">📅</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* 우측: 상세 패널 */}
      <div className="flex-1 overflow-y-auto">
        {!selected ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-400 text-sm">지원자를 선택하면 상세 정보가 표시됩니다.</p>
          </div>
        ) : (
          <div className="p-6">
            {/* 헤더 */}
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{selected.name}</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {selected.university} · {selected.major} · {selected.grade}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  제출: {new Date(selected.appliedAt).toLocaleDateString("ko-KR")}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={selected.status} />
                {user?.role === "ADMIN" && (
                  <div className="flex gap-2 flex-wrap">
                    {STATUS_TRANSITIONS[selected.status]?.map((t) => (
                      <button
                        key={t.value}
                        onClick={() => changeStatus(selected.id, t.value)}
                        className="btn-secondary text-xs px-3 py-1.5"
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 탭 */}
            <div className="flex gap-1 mb-5 border-b border-gray-200">
              {[
                { key: "info", label: "기본 정보" },
                { key: "essays", label: "자기소개서" },
                { key: "eval", label: `평가 (${selected.evaluations.length}명)` },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as typeof activeTab)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition -mb-px ${
                    activeTab === tab.key
                      ? "border-hyfin-blue text-hyfin-blue"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* 기본 정보 */}
            {activeTab === "info" && (
              <div className="space-y-5">
                <div className="section-card">
                  <h3 className="section-title">인적사항</h3>
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                    {[
                      ["이름", selected.name],
                      ["전화번호", selected.phone],
                      ["생년월일", selected.birthDate],
                      ["이메일", selected.email],
                      ["주소", selected.address],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt className="text-xs text-gray-400 mb-0.5">{label}</dt>
                        <dd className="font-medium text-gray-800">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
                <div className="section-card">
                  <h3 className="section-title">학적사항</h3>
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                    {[
                      ["대학", selected.university],
                      ["학년/학기", selected.grade],
                      ["주 전공", selected.major],
                      ["증명용 평점", selected.gpa],
                      ["다중/부 전공", selected.subMajor || "-"],
                      ["졸업예정", selected.graduationPlan || "-"],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt className="text-xs text-gray-400 mb-0.5">{label}</dt>
                        <dd className="font-medium text-gray-800">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
                {careers.length > 0 && careers[0]?.content && (
                  <div className="section-card">
                    <h3 className="section-title">경력사항</h3>
                    <div className="space-y-3">
                      {careers.map(
                        (c: { content: string; detail: string; period: string }, i: number) => (
                          <div key={i} className="bg-gray-50 rounded-lg p-3 text-sm">
                            <p className="font-medium">{c.content}</p>
                            <p className="text-gray-600 mt-0.5">{c.detail}</p>
                            <p className="text-gray-400 text-xs mt-0.5">{c.period}</p>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}
                <div className="section-card">
                  <h3 className="section-title">면접 희망 시간</h3>
                  {(() => {
                    const prefs = JSON.parse(selected.interviewPreferences || "[]") as string[];
                    if (prefs.length === 0) {
                      return <p className="text-sm text-gray-400">미제출</p>;
                    }
                    return (
                      <p className="text-sm text-gray-700">
                        {prefs.length}개 시간대 선택됨 (면접 관리에서 확인 가능)
                      </p>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* 자기소개서 */}
            {activeTab === "essays" && (
              <div className="space-y-5">
                {[
                  { title: "1. 지원동기와 역량 및 특기", content: selected.essay1 },
                  { title: "2. 열정을 가지고 도전하여 성취한 경험", content: selected.essay2 },
                  { title: "3. 향후 학습 및 진로 계획", content: selected.essay3 },
                  { title: "4. 최근 3년간 책임감을 가지고 임했던 활동", content: selected.essay4 },
                ].map(({ title, content }) => (
                  <div key={title} className="section-card">
                    <h3 className="section-title text-sm">{title}</h3>
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {content}
                    </p>
                    <p className="text-xs text-gray-400 mt-2 text-right">{content.length}자</p>
                  </div>
                ))}
              </div>
            )}

            {/* 평가 탭 */}
            {activeTab === "eval" && (
              <div className="space-y-5">
                {/* 내 평가 입력 */}
                <div className="section-card">
                  <h3 className="section-title">
                    내 서류 평가 입력
                    {myEvalExists && (
                      <span className="ml-2 text-xs font-normal text-green-600">✓ 저장됨</span>
                    )}
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="label text-xs">서류 점수 (1~5점)</label>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <button
                            key={s}
                            onClick={() => setDocScore(s)}
                            className={`w-10 h-10 rounded-lg text-sm font-bold transition ${
                              docScore === s
                                ? "bg-hyfin-blue text-white"
                                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                            }`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="label text-xs">코멘트 (선택)</label>
                      <textarea
                        className="textarea text-sm min-h-[80px]"
                        value={docComment}
                        onChange={(e) => setDocComment(e.target.value)}
                        placeholder="간단한 의견을 남겨주세요."
                      />
                    </div>
                    <div>
                      <label className="label text-xs">개인질문 제안 (선택)</label>
                      <textarea
                        className="textarea text-sm min-h-[60px]"
                        value={personalQuestion}
                        onChange={(e) => setPersonalQuestion(e.target.value)}
                        placeholder="면접에서 물어볼 개인질문을 제안해 주세요."
                      />
                    </div>
                    <button
                      onClick={saveEval}
                      disabled={saving}
                      className="btn-primary text-sm"
                    >
                      {saving ? "저장 중..." : "평가 저장"}
                    </button>
                  </div>
                </div>

                {/* 평균 점수 (ADMIN만) */}
                {user?.role === "ADMIN" && avgScore != null && (
                  <div className="bg-blue-50 rounded-xl px-5 py-3 text-sm font-semibold text-hyfin-blue">
                    평균 서류 점수: ★ {avgScore.toFixed(1)} / 5 (
                    {selected.evaluations.filter((e) => e.docScore != null).length}명 평가)
                  </div>
                )}

                {/* 평가 목록 */}
                {visibleEvals.length > 0 && (
                  <div className="section-card">
                    <h3 className="section-title">
                      {user?.role === "ADMIN" ? "전체 운영진 평가" : "내 평가"}
                    </h3>
                    <div className="space-y-4">
                      {visibleEvals.map((e) => (
                        <div key={e.id} className="bg-gray-50 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-semibold text-gray-800">
                              {e.staffName}
                              {e.staffName === user?.id && (
                                <span className="ml-1 text-xs text-blue-600">(나)</span>
                              )}
                            </span>
                            {e.docScore != null && (
                              <span className="text-sm font-bold text-amber-600">
                                ★ {e.docScore}
                              </span>
                            )}
                          </div>
                          {e.docComment && (
                            <p className="text-xs text-gray-600 mb-1">
                              <span className="font-medium">코멘트:</span> {e.docComment}
                            </p>
                          )}
                          {e.personalQuestion && (
                            <p className="text-xs text-purple-700 bg-purple-50 rounded p-2 mt-1">
                              <span className="font-medium">개인질문 제안:</span> {e.personalQuestion}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 최종 개인질문 (ADMIN만) */}
                {user?.role === "ADMIN" && (
                  <div className="section-card">
                    <h3 className="section-title">최종 개인질문 (관리자 확정)</h3>
                    <textarea
                      className="textarea text-sm min-h-[80px]"
                      value={finalQuestion}
                      onChange={(e) => setFinalQuestion(e.target.value)}
                      placeholder="운영진들의 제안을 참고하여 최종 개인질문을 입력해 주세요."
                    />
                    <button
                      onClick={saveFinalQuestion}
                      disabled={savingFinal || finalQuestion === finalQuestionOriginal}
                      className="btn-primary text-sm mt-3"
                    >
                      {savingFinal ? "저장 중..." : "최종 개인질문 저장"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
