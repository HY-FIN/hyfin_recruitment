import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyRequest } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const user = verifyRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { applicantId, docScore, docComment, personalQuestion, interviewScore, interviewComment } =
    await req.json();

  if (!applicantId) {
    return NextResponse.json({ error: "applicantId가 누락되었습니다." }, { status: 400 });
  }

  const staffName = user.id;

  // docScore가 처음 저장되는지 확인하기 위해 기존 평가 조회
  const existing = await prisma.evaluation.findUnique({
    where: { applicantId_staffName: { applicantId, staffName } },
    select: { docScore: true },
  });
  const isFirstDocScore = docScore != null && (existing === null || existing.docScore === null);

  const evaluation = await prisma.evaluation.upsert({
    where: { applicantId_staffName: { applicantId, staffName } },
    create: {
      applicantId,
      staffName,
      docScore: docScore != null ? Number(docScore) : null,
      docComment: docComment ?? null,
      personalQuestion: personalQuestion ?? null,
      interviewScore: interviewScore != null ? Number(interviewScore) : null,
      interviewComment: interviewComment ?? null,
    },
    update: {
      ...(docScore != null ? { docScore: Number(docScore) } : {}),
      ...(docComment !== undefined ? { docComment } : {}),
      ...(personalQuestion !== undefined ? { personalQuestion } : {}),
      ...(interviewScore != null ? { interviewScore: Number(interviewScore) } : {}),
      ...(interviewComment !== undefined ? { interviewComment } : {}),
    },
  });

  // 첫 번째 서류 평가 입력 시 SUBMITTED → DOC_REVIEWING 자동 전환
  if (isFirstDocScore) {
    const applicant = await prisma.applicant.findUnique({
      where: { id: applicantId },
      select: { stage: true },
    });
    if (applicant?.stage === "SUBMITTED") {
      await prisma.applicant.update({
        where: { id: applicantId },
        data: { stage: "DOC_REVIEWING" },
      });
    }
  }

  return NextResponse.json(evaluation);
}
