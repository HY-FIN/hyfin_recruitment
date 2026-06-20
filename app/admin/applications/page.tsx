"use client";

import { useEffect, useState } from "react";
import StatusBadge from "@/components/StatusBadge";

const ADMIN_TOKEN_KEY = "hyfin_admin_token";

interface Evaluation {
  id: string;
  staffName: string;
  score: number;
  comment?: string;
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
  PENDING:     [{ value: "DOC_PASS", label: "서류 합격" }, { value: "DOC_FAIL", label: "서류 불합격" }],
  DOC_PASS:    [{ value: "INTERVIEW", label: "면접 대상" }, { value: "DOC_FAIL", label: "서류 불합격" }],
  INTERVIEW:   [{ value: "FINAL_PASS", label: "최종 합격" }, { value: "FINAL_FAIL", label: "최종 불합격" }],
  DOC_FAIL:    [{ value: "PENDING", label: "검토 대기로 되돌리기" }],
  FINAL_PASS:  [],
  FINAL_FAIL:  [{ value: "INTERVIEW", label: "면접 대상으로 되돌리기" }],
};

export default function ApplicationsPage() {
  const token = typeof window !== "undefined" ? sessionStorage.getItem(ADMIN_TOKEN_KEY) ?? "" : "";
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [filtered, setFiltered] = useState<Applicant[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Applicant | null>(null);
  const [staffName, setStaffName] = useState("");
  const [score, setScore] = useState<number>(3);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"info" | "essays" | "eval">("info");

  const fetchAll = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/applications", { headers: { "x-admin-token": token } });
    const data = await res.json();
    setApplicants(data);
    setFiltered(data);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  useEffect(() => {
    let result = applicants;
    if (statusFilter) result = result.filter((a) => a.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((a) =>
        a.name.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        a.major.toLowerCase().includes(q)
      );
    }
    setFiltered(result);
  }, [statusFilter, search, applicants]);

  const openDetail = (a: Applicant) => {
    setSelected(a);
    setActiveTab("info");
    const myEval = a.evaluations.find((e) => e.staffName === staffName);
    if (myEval) {
      setScore(myEval.score);
      setComment(myEval.comment ?? "");
    } else {
      setScore(3);
      setComment("");
    }
  };

  const changeStatus = async (id: string, status: string) => {
    await fetch(`/api/admin/applications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-admin-token": token },
      body: JSON.stringify({ status }),
    });
    await fetchAll();
    setSelected((prev) => prev ? { ...prev, status } : null);
  };

  const saveEval = async () => {
    if (!selected || !staffName.trim()) return alert("이름을 입력해 주세요.");
    setSaving(true);
    await fetch("/api/admin/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-token": token },
      body: JSON.stringify({ applicantId: selected.id, staffName, score, comment }),
    });
    await fetchAll();
    setSaving(false);
    alert("평가가 저장되었습니다.");
  };

  const avgScore = (evals: Evaluation[]) =>
    evals.length ? (evals.reduce((s, e) => s + e.score, 0) / evals.length).toFixed(1) : "-";

  const careers = selected ? JSON.parse(selected.careers || "[]") : [];

  return (
    <div className="flex h-screen">
      {/* 목록 패널 */}
      <div className="w-96 border-r border-gray-200 flex flex-col bg-white">
        <div className="p-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 mb-3">지원자 목록</h2>
          <input
            className="input mb-2 text-sm"
            placeholder="이름, 이메일, 학과 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="input text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <p className="text-xs text-gray-400 mt-2">{filtered.length}명</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="text-sm text-gray-400 text-center py-8">불러오는 중...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">지원자가 없습니다.</p>
          ) : (
            filtered.map((a) => (
              <button
                key={a.id}
                onClick={() => openDetail(a)}
                className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition ${selected?.id === a.id ? "bg-blue-50 border-l-2 border-l-blue-500" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm text-gray-900">{a.name}</span>
                  <StatusBadge status={a.status} />
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{a.major} · {a.grade}</p>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-gray-400">{a.email}</p>
                  {a.evaluations.length > 0 && (
                    <span className="text-xs text-amber-600 font-medium">★ {avgScore(a.evaluations)} ({a.evaluations.length}명)</span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* 상세 패널 */}
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
                <p className="text-sm text-gray-500 mt-0.5">{selected.university} · {selected.major} · {selected.grade}</p>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={selected.status} />
                <div className="flex gap-2">
                  {STATUS_TRANSITIONS[selected.status]?.map((t) => (
                    <button key={t.value} onClick={() => changeStatus(selected.id, t.value)} className="btn-secondary text-xs px-3 py-1.5">
                      {t.label}
                    </button>
                  ))}
                </div>
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
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition -mb-px ${activeTab === tab.key ? "border-hyfin-blue text-hyfin-blue" : "border-transparent text-gray-500 hover:text-gray-700"}`}
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
                {careers.length > 0 && careers[0].content && (
                  <div className="section-card">
                    <h3 className="section-title">경력사항</h3>
                    <div className="space-y-3">
                      {careers.map((c: { content: string; detail: string; period: string }, i: number) => (
                        <div key={i} className="bg-gray-50 rounded-lg p-3 text-sm">
                          <p className="font-medium">{c.content}</p>
                          <p className="text-gray-600 mt-0.5">{c.detail}</p>
                          <p className="text-gray-400 text-xs mt-0.5">{c.period}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{content}</p>
                    <p className="text-xs text-gray-400 mt-2 text-right">{content.length}자</p>
                  </div>
                ))}
              </div>
            )}

            {/* 평가 */}
            {activeTab === "eval" && (
              <div className="space-y-5">
                {/* 평가 입력 */}
                <div className="section-card">
                  <h3 className="section-title">내 평가 입력</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="label text-xs">이름 (운영진)</label>
                      <input className="input text-sm" value={staffName} onChange={(e) => setStaffName(e.target.value)} placeholder="본인 이름을 입력하세요" />
                    </div>
                    <div>
                      <label className="label text-xs">점수 (1~5점)</label>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <button
                            key={s}
                            onClick={() => setScore(s)}
                            className={`w-10 h-10 rounded-lg text-sm font-bold transition ${score === s ? "bg-hyfin-blue text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="label text-xs">코멘트 (선택)</label>
                      <textarea className="textarea text-sm min-h-[80px]" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="간단한 의견을 남겨주세요." />
                    </div>
                    <button onClick={saveEval} disabled={saving} className="btn-primary text-sm">
                      {saving ? "저장 중..." : "평가 저장"}
                    </button>
                  </div>
                </div>

                {/* 기존 평가 목록 */}
                {selected.evaluations.length > 0 && (
                  <div className="section-card">
                    <h3 className="section-title">운영진 평가 현황</h3>
                    <div className="mb-3 text-sm font-semibold text-hyfin-blue">
                      평균 점수: ★ {avgScore(selected.evaluations)} / 5
                    </div>
                    <div className="space-y-3">
                      {selected.evaluations.map((e) => (
                        <div key={e.id} className="bg-gray-50 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium">{e.staffName}</span>
                            <span className="text-sm font-bold text-amber-600">★ {e.score}</span>
                          </div>
                          {e.comment && <p className="text-xs text-gray-600">{e.comment}</p>}
                        </div>
                      ))}
                    </div>
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
