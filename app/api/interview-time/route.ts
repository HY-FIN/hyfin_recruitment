import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeName, normalizeStudentId } from "@/lib/normalize";

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
    const { name, studentId, slotIds, verifyOnly } = await req.json();

    if (!name || !studentId || (!verifyOnly && !Array.isArray(slotIds))) {
      return NextResponse.json({ error: "name, studentId, slotIds가 필요합니다." }, { status: 400 });
    }

    const cleanName = normalizeName(name);
    const cleanStudentId = normalizeStudentId(studentId);

    const applicant = await prisma.applicant.findFirst({
      where: { studentId: cleanStudentId, name: cleanName },
      orderBy: { appliedAt: "desc" },
    });

    if (!applicant) {
      return NextResponse.json({ error: "해당 지원자를 찾을 수 없습니다." }, { status: 404 });
    }

    if (!["INTERVIEW_READY", "INTERVIEW_SET"].includes(applicant.stage)) {
      return NextResponse.json({ error: "면접 대상자가 아닙니다." }, { status: 403 });
    }

    if (verifyOnly) {
      const alreadySubmitted =
        applicant.interviewPreferences !== "[]" && applicant.interviewPreferences !== "";
      return NextResponse.json({ success: true, alreadySubmitted, name: applicant.name });
    }

    await prisma.applicant.update({
      where: { id: applicant.id },
      data: { interviewPreferences: JSON.stringify(slotIds) },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[interview-time POST]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
