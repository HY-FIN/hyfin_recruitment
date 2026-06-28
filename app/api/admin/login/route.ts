import { NextRequest, NextResponse } from "next/server";
import { findUser } from "@/lib/users";

export async function POST(req: NextRequest) {
  try {
    const { id, password } = await req.json();
    if (!id || !password) {
      return NextResponse.json({ error: "ID와 비밀번호를 입력해 주세요." }, { status: 400 });
    }
    const user = findUser(id, password);
    if (!user) {
      return NextResponse.json({ error: "ID 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
    }
    return NextResponse.json({ id: user.id, role: user.role, title: user.title ?? null });
  } catch {
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
