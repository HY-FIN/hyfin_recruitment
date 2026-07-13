"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { normalizePhone, normalizeEmail, normalizeName, normalizeStudentId, isValidEmail, isValidPhone, formatPhone } from "@/lib/normalize";

interface Career {
  content: string;
  detail: string;
  period: string;
}

const ESSAY5_QUESTION =
  "5. 다음 경제·금융 논문 분야 중 가장 관심 있는 분야와 그 이유를 서술해주십시오. (다음 학기의 원활한 일정 조율을 위한 질문입니다.)";

const ESSAY5_BRANCHES = [
  { name: "기업재무 및 기업지배구조", desc: "기업의 자금조달, 투자, 배당, 소유구조, 경영진 특성이 기업가치에 미치는 영향을 연구하는 분야" },
  { name: "자산 및 투자전략", desc: "주식 수익률과 위험을 설명하는 요인을 찾거나 투자전략의 성과를 분석하는 분야" },
  { name: "금융시장 및 금융기관", desc: "은행, 증권사, 보험사 등의 경영성과와 금융시장 제도 및 안정성을 연구하는 분야" },
  { name: "거시금융 및 국제금융", desc: "금리, 환율, 물가, 경기 등 거시경제 변수가 금융시장과 기업에 미치는 영향을 분석하는 분야" },
  { name: "금융혁신 및 사회금융", desc: "핀테크, AI, ESG, 기후금융 등 최근 금융산업의 변화를 연구하는 분야" },
] as const;

const BRANCH_NUMBERS = ["①", "②", "③", "④", "⑤"];

const BIRTH_YEARS = Array.from({ length: 2010 - 1980 + 1 }, (_, i) => String(2010 - i));
const MONTHS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1));

export default function ApplyForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    name: "",
    phone: "",
    birthDate: "",
    email: "",
    address: "",
    gender: "",
    militaryStatus: "",
    studentId: "",
    grade: "",
    major: "",
    gpa: "",
    subMajor: "",
    graduationPlan: "",
    enrollmentStatus: "",
    essay1: "",
    essay2: "",
    essay3: "",
    essay4: "",
    essay5: "",
  });

  const [birth, setBirth] = useState({ year: "", month: "", day: "" });
  const [gradeParts, setGradeParts] = useState({ year: "", semester: "" });

  const [careers, setCareers] = useState<Career[]>([
    { content: "", detail: "", period: "" },
  ]);

  const set = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const setBirthPart = (part: "year" | "month" | "day", value: string) => {
    const next = { ...birth, [part]: value };
    setBirth(next);
    const combined =
      next.year && next.month && next.day
        ? `${next.year}-${next.month.padStart(2, "0")}-${next.day.padStart(2, "0")}`
        : "";
    set("birthDate", combined);
  };

  const setGradePart = (part: "year" | "semester", value: string) => {
    const next = { ...gradeParts, [part]: value };
    setGradeParts(next);
    set("grade", next.year && next.semester ? `${next.year} ${next.semester}` : "");
  };

  const setCareer = (index: number, field: keyof Career, value: string) => {
    setCareers((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [field]: value } : c))
    );
  };

  const addCareer = () =>
    setCareers((prev) => [...prev, { content: "", detail: "", period: "" }]);

  const removeCareer = (index: number) =>
    setCareers((prev) => prev.filter((_, i) => i !== index));

  const validate = () => {
    const required: (keyof typeof form)[] = [
      "name", "phone", "birthDate", "email", "gender", "militaryStatus",
      "studentId", "grade", "major", "gpa", "enrollmentStatus",
      "essay1", "essay2", "essay3", "essay4", "essay5",
    ];
    const newErrors: Record<string, string> = {};
    required.forEach((key) => {
      if (!form[key].trim()) newErrors[key] = "필수 입력 항목입니다.";
    });
    if (form.email && !isValidEmail(form.email)) {
      newErrors.email = "이메일 형식이 올바르지 않습니다.";
    }
    if (form.phone && !isValidPhone(form.phone)) {
      newErrors.phone = "전화번호 형식이 올바르지 않습니다. (예: 010-1234-5678)";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, name: normalizeName(form.name), email: normalizeEmail(form.email), phone: normalizePhone(form.phone), studentId: normalizeStudentId(form.studentId), careers }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "제출에 실패했습니다.");
      }
      router.push("/apply/success");
    } catch (err) {
      alert(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const charCount = (text: string) => text.length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-hyfin-blue text-white py-8">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <p className="text-sm font-medium text-blue-200 mb-1">Hanyang University Finance Investment</p>
          <h1 className="text-3xl font-bold tracking-tight">HYFIN 8기 지원서</h1>
          <p className="mt-2 text-sm text-blue-200">
            제출 전 모든 항목을 꼼꼼히 확인해 주세요.
          </p>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* 안내사항 */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
          <ul className="space-y-1 list-disc list-inside">
            <li>모든 필드(*)는 필수 입력 항목입니다.</li>
            <li>자기소개서 각 항목은 500자 내외로 작성해 주세요.</li>
            <li>제출 후 수정이 불가합니다. 신중하게 작성해 주세요.</li>
          </ul>
        </div>

        {Object.keys(errors).length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
            필수 항목이 누락되었습니다. 항목을 확인해 주세요.
          </div>
        )}

        {/* 인적사항 */}
        <div className="section-card">
          <h2 className="section-title">인적사항</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">이름 *</label>
              <input className={`input ${errors.name ? "border-red-400" : ""}`} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="홍길동" />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
            </div>
            <div>
              <label className="label">전화번호 *</label>
              <input className={`input ${errors.phone ? "border-red-400" : ""}`} value={form.phone} onChange={(e) => set("phone", formatPhone(e.target.value))} placeholder="010-0000-0000" />
              {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
            </div>
            <div>
              <label className="label">생년월일 *</label>
              <div className="flex gap-2">
                <select
                  className={`input ${errors.birthDate ? "border-red-400" : ""}`}
                  value={birth.year}
                  onChange={(e) => setBirthPart("year", e.target.value)}
                >
                  <option value="">년</option>
                  {BIRTH_YEARS.map((y) => (
                    <option key={y} value={y}>{y}년</option>
                  ))}
                </select>
                <select
                  className={`input ${errors.birthDate ? "border-red-400" : ""}`}
                  value={birth.month}
                  onChange={(e) => setBirthPart("month", e.target.value)}
                >
                  <option value="">월</option>
                  {MONTHS.map((m) => (
                    <option key={m} value={m}>{m}월</option>
                  ))}
                </select>
                <select
                  className={`input ${errors.birthDate ? "border-red-400" : ""}`}
                  value={birth.day}
                  onChange={(e) => setBirthPart("day", e.target.value)}
                >
                  <option value="">일</option>
                  {DAYS.map((d) => (
                    <option key={d} value={d}>{d}일</option>
                  ))}
                </select>
              </div>
              {errors.birthDate && <p className="text-xs text-red-500 mt-1">{errors.birthDate}</p>}
            </div>
            <div>
              <label className="label">성별 *</label>
              <select
                className={`input ${errors.gender ? "border-red-400" : ""}`}
                value={form.gender}
                onChange={(e) => set("gender", e.target.value)}
              >
                <option value="">선택해 주세요</option>
                <option value="남성">남성</option>
                <option value="여성">여성</option>
              </select>
              {errors.gender && <p className="text-xs text-red-500 mt-1">{errors.gender}</p>}
            </div>
            <div>
              <label className="label">이메일 *</label>
              <input type="email" className={`input ${errors.email ? "border-red-400" : ""}`} value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="example@email.com" />
              {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
            </div>
            <div>
              <label className="label">군필 여부 *</label>
              <select
                className={`input ${errors.militaryStatus ? "border-red-400" : ""}`}
                value={form.militaryStatus}
                onChange={(e) => set("militaryStatus", e.target.value)}
              >
                <option value="">선택해 주세요</option>
                <option value="군필">군필</option>
                <option value="미필">미필</option>
                <option value="면제">면제</option>
                <option value="해당없음">해당없음</option>
              </select>
              {errors.militaryStatus && <p className="text-xs text-red-500 mt-1">{errors.militaryStatus}</p>}
            </div>
            <div className="col-span-2">
              <label className="label">주소</label>
              <input className="input" value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="서울특별시 성동구..." />
            </div>
          </div>
        </div>

        {/* 학적사항 */}
        <div className="section-card">
          <h2 className="section-title">학적사항</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">학번 *</label>
              <input className={`input ${errors.studentId ? "border-red-400" : ""}`} value={form.studentId} onChange={(e) => set("studentId", e.target.value)} placeholder="2023XXXXX" />
              {errors.studentId && <p className="text-xs text-red-500 mt-1">{errors.studentId}</p>}
            </div>
            <div>
              <label className="label">학년/학기 *</label>
              <div className="flex gap-2">
                <select
                  className={`input ${errors.grade ? "border-red-400" : ""}`}
                  value={gradeParts.year}
                  onChange={(e) => setGradePart("year", e.target.value)}
                >
                  <option value="">학년</option>
                  {["1학년", "2학년", "3학년", "4학년"].map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                <select
                  className={`input ${errors.grade ? "border-red-400" : ""}`}
                  value={gradeParts.semester}
                  onChange={(e) => setGradePart("semester", e.target.value)}
                >
                  <option value="">학기</option>
                  {["1학기", "2학기"].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              {errors.grade && <p className="text-xs text-red-500 mt-1">{errors.grade}</p>}
            </div>
            <div>
              <label className="label">주 전공 *</label>
              <input className={`input ${errors.major ? "border-red-400" : ""}`} value={form.major} onChange={(e) => set("major", e.target.value)} placeholder="경영학과" />
              {errors.major && <p className="text-xs text-red-500 mt-1">{errors.major}</p>}
            </div>
            <div>
              <label className="label">증명용 평점 *</label>
              <input className={`input ${errors.gpa ? "border-red-400" : ""}`} value={form.gpa} onChange={(e) => set("gpa", e.target.value)} placeholder="4.0 / 4.5" />
              {errors.gpa && <p className="text-xs text-red-500 mt-1">{errors.gpa}</p>}
            </div>
            <div>
              <label className="label">다중/부 전공</label>
              <input className="input" value={form.subMajor} onChange={(e) => set("subMajor", e.target.value)} placeholder="없으면 공란" />
            </div>
            <div>
              <label className="label">졸업예정</label>
              <input className="input" value={form.graduationPlan} onChange={(e) => set("graduationPlan", e.target.value)} placeholder="2027년 2월" />
            </div>
            <div>
              <label className="label">재·휴학 여부 *</label>
              <select
                className={`input ${errors.enrollmentStatus ? "border-red-400" : ""}`}
                value={form.enrollmentStatus}
                onChange={(e) => set("enrollmentStatus", e.target.value)}
              >
                <option value="">선택해 주세요</option>
                <option value="재학">재학</option>
                <option value="휴학">휴학</option>
              </select>
              {errors.enrollmentStatus && <p className="text-xs text-red-500 mt-1">{errors.enrollmentStatus}</p>}
            </div>
          </div>
        </div>

        {/* 경력사항 */}
        <div className="section-card">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
            <h2 className="text-base font-bold text-hyfin-blue">경력사항</h2>
            <button type="button" onClick={addCareer} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
              + 항목 추가
            </button>
          </div>
          <p className="text-xs text-gray-500 mb-4">금융과 관련이 없는 분야도 서술해 주십시오.</p>
          {careers.map((career, i) => (
            <div key={i} className="mb-4 p-4 bg-gray-50 rounded-lg relative">
              {careers.length > 1 && (
                <button type="button" onClick={() => removeCareer(i)} className="absolute top-3 right-3 text-xs text-red-400 hover:text-red-600">
                  삭제
                </button>
              )}
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="label text-xs">내용</label>
                  <input className="input text-sm" value={career.content} onChange={(e) => setCareer(i, "content", e.target.value)} placeholder="예) 군복무" />
                </div>
                <div>
                  <label className="label text-xs">세부내용</label>
                  <input className="input text-sm" value={career.detail} onChange={(e) => setCareer(i, "detail", e.target.value)} placeholder="예) 육군 병장 만기 전역" />
                </div>
                <div>
                  <label className="label text-xs">활동 기간 및 취득 일자</label>
                  <input className="input text-sm" value={career.period} onChange={(e) => setCareer(i, "period", e.target.value)} placeholder="예) 2021.10~2023.04" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 자기소개서 */}
        <div className="section-card">
          <h2 className="section-title">자기소개서</h2>
          <div className="space-y-6">
            {[
              { key: "essay1", label: "1. 지원동기와 지원자의 역량 및 특기에 대해 서술해주십시오." },
              { key: "essay2", label: "2. 가장 열정을 가지고 도전하여 성취한 경험에 대해 서술해주십시오." },
              { key: "essay3", label: "3. 향후 학습 및 진로 계획에 대해 서술해주십시오." },
              { key: "essay4", label: "4. 최근 3년간 가장 책임감을 가지고 임했던 활동에 대해 서술해주시기 바랍니다." },
              {
                key: "essay5",
                label: ESSAY5_QUESTION,
                hint: "100자 이내로 간단하게 작성해 주셔도 됩니다.",
                warnAt: 100,
                minH: "min-h-[80px]",
              },
            ].map(({ key, label, hint, warnAt, minH }: { key: string; label: string; hint?: string; warnAt?: number; minH?: string }) => {
              const value = form[key as keyof typeof form];
              const count = charCount(value);
              const warnLimit = warnAt ?? 550;
              return (
                <div key={key}>
                  <label className="label text-sm font-semibold text-gray-800">{label}</label>
                  {key === "essay5" && (
                    <div className="bg-gray-50 rounded-lg p-4 my-2 space-y-1.5">
                      {ESSAY5_BRANCHES.map((branch, i) => (
                        <p key={branch.name} className="text-xs text-gray-600 leading-relaxed">
                          <span className="font-bold text-gray-800">{BRANCH_NUMBERS[i]} {branch.name}</span>
                          <span> — {branch.desc}</span>
                        </p>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-gray-400 mb-2">{hint ?? "500자 내외"}</p>
                  <textarea
                    className={`textarea ${minH ?? "min-h-[160px]"} ${errors[key] ? "border-red-400" : ""}`}
                    value={value}
                    onChange={(e) => set(key, e.target.value)}
                    placeholder="내용을 입력해 주세요."
                  />
                  <div className="flex justify-between mt-1">
                    {errors[key] ? (
                      <p className="text-xs text-red-500">{errors[key]}</p>
                    ) : (
                      <span />
                    )}
                    <p className={`text-xs ${count > warnLimit ? "text-red-500" : "text-gray-400"}`}>
                      {count}자
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 제출 */}
        <div className="flex flex-col items-center gap-3 py-4">
          <p className="text-xs text-gray-500">제출 후에는 수정이 불가합니다.</p>
          <button type="submit" disabled={loading} className="btn-primary px-12 py-3 text-base">
            {loading ? "제출 중..." : "지원서 제출"}
          </button>
        </div>
      </form>
    </div>
  );
}
