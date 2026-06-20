import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail, EmailType } from "@/lib/email";

function isAdmin(req: NextRequest) {
  return req.headers.get("x-admin-token") === process.env.ADMIN_PASSWORD;
}

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { applicantIds, type, interviewDate } = await req.json();

  const validTypes = ["RECEIPT", "DOC_RESULT", "INTERVIEW", "FINAL_RESULT"];
  if (!validTypes.includes(type) || !Array.isArray(applicantIds) || applicantIds.length === 0) {
    return NextResponse.json({ error: "요청 데이터가 올바르지 않습니다." }, { status: 400 });
  }

  const applicants = await prisma.applicant.findMany({
    where: { id: { in: applicantIds } },
    select: { id: true, name: true, email: true, status: true },
  });

  const results = await Promise.allSettled(
    applicants.map(async (a) => {
      const passed = ["DOC_PASS", "INTERVIEW", "FINAL_PASS"].includes(a.status);
      try {
        await sendEmail({ to: a.email, name: a.name, type: type as EmailType, passed, interviewDate });
        await prisma.notificationLog.create({
          data: { applicantId: a.id, type, channel: "email", success: true },
        });
        return { id: a.id, success: true };
      } catch (err) {
        await prisma.notificationLog.create({
          data: { applicantId: a.id, type, channel: "email", success: false },
        });
        return { id: a.id, success: false, error: String(err) };
      }
    })
  );

  const summary = results.map((r) => (r.status === "fulfilled" ? r.value : { success: false }));
  const successCount = summary.filter((r) => r.success).length;

  return NextResponse.json({ total: applicants.length, success: successCount, results: summary });
}
