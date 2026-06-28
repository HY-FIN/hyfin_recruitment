import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminRequest } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = requireAdminRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { applicantId, action } = await req.json();
  // action: "assign" | "unassign"

  if (!applicantId || !action) {
    return NextResponse.json({ error: "필수 값이 누락되었습니다." }, { status: 400 });
  }

  const slot = await prisma.interviewSlot.findUnique({
    where: { id },
    include: { applicants: true },
  });
  if (!slot) return NextResponse.json({ error: "슬롯을 찾을 수 없습니다." }, { status: 404 });

  if (action === "assign") {
    if (slot.applicants.length >= slot.maxCount) {
      return NextResponse.json({ error: "해당 슬롯이 이미 꽉 찼습니다." }, { status: 400 });
    }
    await prisma.applicant.update({
      where: { id: applicantId },
      data: { interviewSlotId: id },
    });
  } else if (action === "unassign") {
    await prisma.applicant.update({
      where: { id: applicantId },
      data: { interviewSlotId: null },
    });
  } else {
    return NextResponse.json({ error: "유효하지 않은 action입니다." }, { status: 400 });
  }

  const updated = await prisma.interviewSlot.findUnique({
    where: { id },
    include: { applicants: { select: { id: true, name: true, major: true } } },
  });
  return NextResponse.json(updated);
}
