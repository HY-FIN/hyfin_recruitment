export type Role = "ADMIN" | "STAFF";

export interface User {
  id: string;
  password: string;
  role: Role;
  title?: string;
}

export const USERS: User[] = [
  // 관리자 (ADMIN) - 5명
  { id: "한민우", password: "83621047", role: "ADMIN", title: "학회장" },
  { id: "송영인", password: "29174563", role: "ADMIN", title: "부학회장" },
  { id: "박지원", password: "54738291", role: "ADMIN", title: "대외협력부장" },
  { id: "강이원", password: "71829364", role: "ADMIN", title: "집행부장" },
  { id: "박상윤", password: "15736482", role: "ADMIN", title: "서비스 개발" },
  // 운영진 (STAFF) - 10명
  { id: "한은섭", password: "46392817", role: "STAFF" },
  { id: "이효창", password: "92847361", role: "STAFF" },
  { id: "김도현", password: "63829147", role: "STAFF" },
  { id: "김희서", password: "47291836", role: "STAFF" },
  { id: "엄수민", password: "85163924", role: "STAFF" },
  { id: "이우현", password: "29483716", role: "STAFF" },
  { id: "장나경", password: "74619283", role: "STAFF" },
  { id: "최인영", password: "38274619", role: "STAFF" },
  { id: "이재욱", password: "91638247", role: "STAFF" },
  { id: "권승빈", password: "56483921", role: "STAFF" },
];

export function findUser(id: string, password: string): User | null {
  return USERS.find((u) => u.id === id && u.password === password) ?? null;
}
