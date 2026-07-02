import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail, EmailType } from "@/lib/email";
import { requireAdminRequest } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const user = requireAdminRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { applicantIds, type, interviewDate } = await req.json();

  const validTypes = ["RECEIPT", "DOC_RESULT", "INTERVIEW", "FINAL_RESULT"];
  if (!validTypes.includes(type) || !Array.isArray(applicantIds) || applicantIds.length === 0) {
    return NextResponse.json({ error: "요청 데이터가 올바르지 않습니다." }, { status: 400 });
  }

  const applicants = await prisma.applicant.findMany({
    where: { id: { in: applicantIds } },
    select: {
      id: true,
      name: true,
      email: true,
      stage: true,
      docResult: true,
      finalResult: true,
      interviewSlot: { select: { date: true, startTime: true, endTime: true } },
    },
  });

  // INTERVIEW 타입일 때 날짜→day 매핑 및 CommonQuestion에서 location 조회
  let dateToLocation: Record<string, string> = {};
  if (type === "INTERVIEW") {
    const allSlots = await prisma.interviewSlot.findMany({
      select: { date: true },
      distinct: ["date"],
      orderBy: { date: "asc" },
    });
    const dateToDay: Record<string, number> = {};
    allSlots.forEach((s, i) => { dateToDay[s.date] = i + 1; });

    const commonQuestions = await prisma.commonQuestion.findMany();
    const dayToLocation: Record<number, string> = {};
    commonQuestions.forEach((cq) => { dayToLocation[cq.day] = cq.location ?? ""; });

    allSlots.forEach((s) => {
      const day = dateToDay[s.date];
      dateToLocation[s.date] = dayToLocation[day] ?? "";
    });
  }

  const results = await Promise.allSettled(
    applicants.map(async (a) => {
      const passed =
        type === "DOC_RESULT" ? a.docResult === "PASS" :
        type === "INTERVIEW" ? true :
        type === "FINAL_RESULT" ? a.finalResult === "PASS" : false;

      const slotDateTime =
        type === "INTERVIEW" && a.interviewSlot
          ? `${a.interviewSlot.date} ${a.interviewSlot.startTime}~${a.interviewSlot.endTime}`
          : interviewDate;

      const locationForApplicant =
        type === "INTERVIEW" && a.interviewSlot
          ? dateToLocation[a.interviewSlot.date] ?? ""
          : "";

      try {
        await sendEmail({
          to: a.email,
          name: a.name,
          type: type as EmailType,
          passed,
          interviewDate: slotDateTime,
          interviewLocation: locationForApplicant,
        });
        await prisma.notificationLog.create({
          data: { applicantId: a.id, type, channel: "email", success: true },
        });

        // 메일 발송 성공 시 stage 자동 전환
        if (type === "DOC_RESULT") {
          await prisma.applicant.update({
            where: { id: a.id },
            data: { stage: a.docResult === "PASS" ? "INTERVIEW_READY" : "DOC_REJECTED" },
          });
        }
        if (type === "INTERVIEW") {
          await prisma.applicant.update({
            where: { id: a.id },
            data: { stage: "INTERVIEW_SET" },
          });
        }
        if (type === "FINAL_RESULT") {
          await prisma.applicant.update({
            where: { id: a.id },
            data: { stage: "FINISHED" },
          });
        }

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
