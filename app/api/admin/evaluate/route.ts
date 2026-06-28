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

  return NextResponse.json(evaluation);
}
