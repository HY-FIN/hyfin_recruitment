import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail, EmailType } from "@/lib/email";
import { requireAdminRequest } from "@/lib/auth";
import { isValidEmail } from "@/lib/normalize";

// Vercel Hobby 기본 10초 타임아웃으로는 대량 발송이 끊길 수 있음
export const maxDuration = 60;

const CHUNK_SIZE = 10;
const CHUNK_DELAY_MS = 500;

type SendResultItem = {
  id?: string;
  success: boolean;
  dbError?: boolean;
  error?: string;
};

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

  // 해당 타입의 성공 발송 이력이 이미 있는 지원자 (재발송 차단은 하지 않고 프론트 경고용으로만 반환)
  const alreadySentLogs = await prisma.notificationLog.findMany({
    where: { applicantId: { in: applicantIds }, type, success: true },
    select: { applicantId: true },
    distinct: ["applicantId"],
  });
  const alreadySent = alreadySentLogs.map((l) => l.applicantId);

  const sendOne = async (a: (typeof applicants)[number]): Promise<SendResultItem> => {
    // 결과값이 아직 확정되지 않았다면 오발송 방지를 위해 스킵 (실패 로그는 남기지 않음)
    if (type === "DOC_RESULT" && a.docResult == null) {
      return { id: a.id, success: false, error: "서류 결과 미확정" };
    }
    if (type === "FINAL_RESULT" && a.finalResult == null) {
      return { id: a.id, success: false, error: "최종 결과 미확정" };
    }
    if (!a.email || !isValidEmail(a.email)) {
      return { id: a.id, success: false, error: "유효하지 않은 이메일" };
    }

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
    } catch (err) {
      try {
        await prisma.notificationLog.create({
          data: { applicantId: a.id, type, channel: "email", success: false },
        });
      } catch (logErr) {
        console.error(`실패 로그 기록 실패 (applicantId=${a.id}):`, logErr);
      }
      return { id: a.id, success: false, error: String(err) };
    }

    // 메일은 이미 발송된 상태 — 이후 DB 작업 실패를 "발송 실패"로 기록하면 재발송 시 중복 메일 위험
    // 성공 로그와 stage 전환을 하나의 트랜잭션으로 묶어 정합성 보장
    try {
      const ops: any[] = [
        prisma.notificationLog.create({
          data: { applicantId: a.id, type, channel: "email", success: true },
        }),
      ];
      if (type === "DOC_RESULT") {
        ops.push(
          prisma.applicant.update({
            where: { id: a.id },
            data: { stage: a.docResult === "PASS" ? "INTERVIEW_READY" : "DOC_REJECTED" },
          })
        );
      } else if (type === "INTERVIEW") {
        ops.push(
          prisma.applicant.update({ where: { id: a.id }, data: { stage: "INTERVIEW_SET" } })
        );
      } else if (type === "FINAL_RESULT") {
        ops.push(
          prisma.applicant.update({ where: { id: a.id }, data: { stage: "FINISHED" } })
        );
      }
      await prisma.$transaction(ops);
      return { id: a.id, success: true };
    } catch (err) {
      console.error(`메일은 발송됐으나 DB 갱신 실패 (applicantId=${a.id}):`, err);
      return { id: a.id, success: true, dbError: true };
    }
  };

  // 요청됐지만 DB에서 발견되지 않은 ID도 결과에 포함 (프론트 집계에서 누락되지 않도록)
  const foundIds = new Set(applicants.map((a) => a.id));
  const summary: SendResultItem[] = (applicantIds as string[])
    .filter((id) => !foundIds.has(id))
    .map((id) => ({ id, success: false, error: "not found" }));

  // Gmail 동시 연결 제한을 피하기 위해 10명 단위로 나눠 순차 처리
  for (let i = 0; i < applicants.length; i += CHUNK_SIZE) {
    const chunk = applicants.slice(i, i + CHUNK_SIZE);
    const results = await Promise.allSettled(chunk.map(sendOne));
    summary.push(
      ...results.map((r): SendResultItem =>
        r.status === "fulfilled" ? r.value : { success: false, error: String(r.reason) }
      )
    );
    if (i + CHUNK_SIZE < applicants.length) {
      await new Promise((resolve) => setTimeout(resolve, CHUNK_DELAY_MS));
    }
  }

  const successCount = summary.filter((r) => r.success).length;

  return NextResponse.json({
    total: applicantIds.length,
    success: successCount,
    results: summary,
    alreadySent,
  });
}
