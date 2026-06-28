import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminRequest } from "@/lib/auth";

const SLOTS = [
  { date: "2026-08-18", startTime: "18:00", endTime: "18:30" },
  { date: "2026-08-18", startTime: "18:30", endTime: "19:00" },
  { date: "2026-08-18", startTime: "19:00", endTime: "19:30" },
  { date: "2026-08-18", startTime: "19:30", endTime: "20:00" },
  { date: "2026-08-18", startTime: "20:00", endTime: "20:30" },
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
];

export async function GET(req: NextRequest) {
  const user = requireAdminRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // InterviewSlot seed
  const existingSlots = await prisma.interviewSlot.count();
  let slotsCreated = 0;
  if (existingSlots === 0) {
    await prisma.interviewSlot.createMany({ data: SLOTS.map((s) => ({ ...s, maxCount: 3 })) });
    slotsCreated = SLOTS.length;
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
    commonQuestionsCreated: cqCreated,
  });
}
