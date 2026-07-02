import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyRequest } from "@/lib/auth";
import { getEmailTemplate, EmailType } from "@/lib/emailTemplates";

export async function GET(req: NextRequest) {
  const user = verifyRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") as EmailType | null;
  const passedParam = searchParams.get("passed");

  const validTypes: EmailType[] = ["RECEIPT", "DOC_RESULT", "INTERVIEW", "FINAL_RESULT"];
  if (!type || !validTypes.includes(type)) {
    return NextResponse.json({ error: "유효하지 않은 type입니다." }, { status: 400 });
  }

  const passed = passedParam === "true" ? true : passedParam === "false" ? false : undefined;

  let interviewLocation = "2026-08-18 18:00~18:30";
  if (type === "INTERVIEW") {
    const cq = await prisma.commonQuestion.findFirst({
      where: { location: { not: null } },
      orderBy: { day: "asc" },
    });
    interviewLocation = cq?.location ?? "아직 면접 장소가 등록되지 않았습니다.";
  }

  const { subject, html } = getEmailTemplate(type, {
    name: "홍길동",
    interviewDate: "2026-08-18 18:00~18:30",
    interviewLocation,
    passed,
  });
  return NextResponse.json({ subject, html });
}
