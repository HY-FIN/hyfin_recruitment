// 저장·조회·검색이 동일한 정규화 규칙을 공유하기 위한 공용 유틸.

export const normalizePhone = (s: string): string =>
  String(s ?? "")
    .replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0))
    .replace(/[^\d]/g, "");

export const normalizeEmail = (s: string): string =>
  String(s ?? "").trim().toLowerCase();

export const normalizeName = (s: string): string =>
  String(s ?? "").trim().replace(/\s+/g, " ");

export const normalizeStudentId = (s: string): string =>
  String(s ?? "")
    .replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0))
    .replace(/\s+/g, "");

export const formatPhone = (s: string): string => {
  const digits = normalizePhone(s);
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return digits;
};

export const isValidEmail = (s: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s ?? ""));

export const isValidPhone = (s: string): boolean => {
  const digits = normalizePhone(s);
  return digits.length === 10 || digits.length === 11;
};
