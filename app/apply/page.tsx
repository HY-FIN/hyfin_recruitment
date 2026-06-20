"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Career {
  content: string;
  detail: string;
  period: string;
}

export default function ApplyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    name: "",
    phone: "010-",
    birthDate: "",
    email: "",
    address: "",
    university: "",
    grade: "",
    major: "",
    gpa: "",
    subMajor: "",
    graduationPlan: "",
    essay1: "",
    essay2: "",
    essay3: "",
    essay4: "",
  });

  const [careers, setCareers] = useState<Career[]>([
    { content: "", detail: "", period: "" },
  ]);

  const set = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
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
      "name", "phone", "birthDate", "email", "address",
      "university", "grade", "major", "gpa",
      "essay1", "essay2", "essay3", "essay4",
    ];
    const newErrors: Record<string, string> = {};
    required.forEach((key) => {
      if (!form[key].trim()) newErrors[key] = "필수 입력 항목입니다.";
    });
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
        body: JSON.stringify({ ...form, careers }),
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
              <input className={`input ${errors.phone ? "border-red-400" : ""}`} value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="010-0000-0000" />
              {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
            </div>
            <div>
              <label className="label">생년월일 *</label>
              <input type="date" className={`input ${errors.birthDate ? "border-red-400" : ""}`} value={form.birthDate} onChange={(e) => set("birthDate", e.target.value)} />
              {errors.birthDate && <p className="text-xs text-red-500 mt-1">{errors.birthDate}</p>}
            </div>
            <div>
              <label className="label">이메일 *</label>
              <input type="email" className={`input ${errors.email ? "border-red-400" : ""}`} value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="example@email.com" />
              {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
            </div>
            <div className="col-span-2">
              <label className="label">주소 *</label>
              <input className={`input ${errors.address ? "border-red-400" : ""}`} value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="서울특별시 성동구..." />
              {errors.address && <p className="text-xs text-red-500 mt-1">{errors.address}</p>}
            </div>
          </div>
        </div>

        {/* 학적사항 */}
        <div className="section-card">
          <h2 className="section-title">학적사항</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">대학 *</label>
              <input className={`input ${errors.university ? "border-red-400" : ""}`} value={form.university} onChange={(e) => set("university", e.target.value)} placeholder="한양대학교" />
              {errors.university && <p className="text-xs text-red-500 mt-1">{errors.university}</p>}
            </div>
            <div>
              <label className="label">학년/학기 *</label>
              <input className={`input ${errors.grade ? "border-red-400" : ""}`} value={form.grade} onChange={(e) => set("grade", e.target.value)} placeholder="3학년 1학기" />
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
            ].map(({ key, label }) => {
              const value = form[key as keyof typeof form];
              const count = charCount(value);
              return (
                <div key={key}>
                  <label className="label text-sm font-semibold text-gray-800">{label}</label>
                  <p className="text-xs text-gray-400 mb-2">500자 내외</p>
                  <textarea
                    className={`textarea min-h-[160px] ${errors[key] ? "border-red-400" : ""}`}
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
                    <p className={`text-xs ${count > 550 ? "text-red-500" : "text-gray-400"}`}>
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
