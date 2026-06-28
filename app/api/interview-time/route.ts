import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const slots = await prisma.interviewSlot.findMany({
    include: {
      applicants: { select: { id: true } },
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });

  const result = slots.map((slot) => ({
    id: slot.id,
    date: slot.date,
    startTime: slot.startTime,
    endTime: slot.endTime,
    maxCount: slot.maxCount,
    currentCount: slot.applicants.length,
  }));

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  try {
    const { name, email, slotIds } = await req.json();

    if (!name || !email || !Array.isArray(slotIds)) {
      return NextResponse.json({ error: "name, email, slotIds가 필요합니다." }, { status: 400 });
    }

    const applicant = await prisma.applicant.findFirst({
      where: { name, email },
    });

    if (!applicant) {
      return NextResponse.json({ error: "해당 지원자를 찾을 수 없습니다." }, { status: 404 });
    }

    if (applicant.status !== "INTERVIEW") {
      return NextResponse.json({ error: "면접 대상자가 아닙니다." }, { status: 403 });
    }

    await prisma.applicant.update({
      where: { id: applicant.id },
      data: { interviewPreferences: JSON.stringify(slotIds) },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
