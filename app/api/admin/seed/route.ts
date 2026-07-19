import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminRequest } from "@/lib/auth";

const SLOTS = [
  { date: "2026-08-19", startTime: "18:00", endTime: "18:30" },
  { date: "2026-08-19", startTime: "18:30", endTime: "19:00" },
  { date: "2026-08-19", startTime: "19:00", endTime: "19:30" },
  { date: "2026-08-19", startTime: "19:30", endTime: "20:00" },
  { date: "2026-08-19", startTime: "20:00", endTime: "20:30" },
  { date: "2026-08-20", startTime: "18:00", endTime: "18:30" },
  { date: "2026-08-20", startTime: "18:30", endTime: "19:00" },
  { date: "2026-08-20", startTime: "19:00", endTime: "19:30" },
  { date: "2026-08-20", startTime: "19:30", endTime: "20:00" },
  { date: "2026-08-20", startTime: "20:00", endTime: "20:30" },
  { date: "2026-08-21", startTime: "18:00", endTime: "18:30" },
  { date: "2026-08-21", startTime: "18:30", endTime: "19:00" },
  { date: "2026-08-21", startTime: "19:00", endTime: "19:30" },
  { date: "2026-08-21", startTime: "19:30", endTime: "20:00" },
  { date: "2026-08-21", startTime: "20:00", endTime: "20:30" },
];

export async function GET(req: NextRequest) {
  const user = requireAdminRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ?resetSlots=1: 기존 슬롯을 전부 삭제하고 새 SLOTS로 재생성
  const resetSlots = req.nextUrl.searchParams.get("resetSlots") === "1";

  let slotsCreated = 0;
  let slotsReset = false;
  let preferencesRemapped = 0;
  let preferencesCleared = 0;
  let assignmentsRestored = 0;

  if (resetSlots) {
    // 슬롯 재생성 시 id가 새로 발급되므로, 지원자의 선호/배정을
    // "date|startTime|endTime" 키 기준으로 새 슬롯 id에 리매핑해 보존한다.
    const slotKey = (s: { date: string; startTime: string; endTime: string }) =>
      `${s.date}|${s.startTime}|${s.endTime}`;

    await prisma.$transaction(async (tx) => {
      const oldSlots = await tx.interviewSlot.findMany({
        select: { id: true, date: true, startTime: true, endTime: true },
      });
      const oldIdToKey = new Map(oldSlots.map((s) => [s.id, slotKey(s)]));

      const affected = await tx.applicant.findMany({
        where: {
          OR: [{ interviewPreferences: { not: "[]" } }, { interviewSlotId: { not: null } }],
        },
        select: { id: true, interviewPreferences: true, interviewSlotId: true },
      });

      // FK 문제 방지: 슬롯 삭제 전에 지원자의 배정을 먼저 해제
      await tx.applicant.updateMany({ data: { interviewSlotId: null } });
      await tx.interviewSlot.deleteMany();
      await tx.interviewSlot.createMany({ data: SLOTS.map((s) => ({ ...s, maxCount: 3 })) });

      const newSlots = await tx.interviewSlot.findMany({
        select: { id: true, date: true, startTime: true, endTime: true },
      });
      const keyToNewId = new Map(newSlots.map((s) => [slotKey(s), s.id]));

      const remapId = (oldId: string): string | null => {
        const key = oldIdToKey.get(oldId);
        if (!key) return null;
        return keyToNewId.get(key) ?? null;
      };

      for (const applicant of affected) {
        let oldPrefIds: string[] = [];
        try {
          const parsed = JSON.parse(applicant.interviewPreferences);
          if (Array.isArray(parsed)) oldPrefIds = parsed.filter((v) => typeof v === "string");
        } catch {
          // 파싱 불가 시 빈 배열로 취급 (재제출 가능 상태로 복구)
        }

        const newPrefIds = oldPrefIds
          .map(remapId)
          .filter((id): id is string => id !== null);
        const newPreferences = JSON.stringify(newPrefIds);

        const newSlotId = applicant.interviewSlotId ? remapId(applicant.interviewSlotId) : null;

        if (oldPrefIds.length > 0) {
          if (newPrefIds.length > 0) preferencesRemapped++;
          else preferencesCleared++;
        }
        if (newSlotId) assignmentsRestored++;

        const data: { interviewPreferences?: string; interviewSlotId?: string } = {};
        if (newPreferences !== applicant.interviewPreferences) {
          data.interviewPreferences = newPreferences;
        }
        if (newSlotId) data.interviewSlotId = newSlotId;

        if (Object.keys(data).length > 0) {
          await tx.applicant.update({ where: { id: applicant.id }, data });
        }
      }
    });

    slotsCreated = SLOTS.length;
    slotsReset = true;
  } else {
    // InterviewSlot seed (슬롯이 하나도 없을 때만)
    const existingSlots = await prisma.interviewSlot.count();
    if (existingSlots === 0) {
      await prisma.interviewSlot.createMany({ data: SLOTS.map((s) => ({ ...s, maxCount: 3 })) });
      slotsCreated = SLOTS.length;
    }
  }

  // CommonQuestion seed
  const existingCQ = await prisma.commonQuestion.count();
  let cqCreated = 0;
  if (existingCQ < 3) {
    const existingDays = (await prisma.commonQuestion.findMany({ select: { day: true } })).map(
      (q) => q.day
    );
    for (const day of [1, 2, 3]) {
      if (!existingDays.includes(day)) {
        await prisma.commonQuestion.create({ data: { day, questions: "[]" } });
        cqCreated++;
      }
    }
  }

  return NextResponse.json({
    message: "Seed 완료",
    slotsCreated,
    slotsReset,
    commonQuestionsCreated: cqCreated,
    preferencesRemapped,
    preferencesCleared,
    assignmentsRestored,
  });
}
