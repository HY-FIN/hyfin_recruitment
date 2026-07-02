import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = verifyRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [applicants, finalQuestions, commonQuestions] = await Promise.all([
    prisma.applicant.findMany({
      include: {
        evaluations: true,
        interviewSlot: true,
      },
      orderBy: { appliedAt: "desc" },
    }),
    prisma.finalQuestion.findMany(),
    prisma.commonQuestion.findMany({ orderBy: { day: "asc" } }),
  ]);

  const finalQMap = Object.fromEntries(finalQuestions.map((fq) => [fq.applicantId, fq.question]));

  const applicantsWithFinal = applicants.map((a) => ({
    ...a,
    finalQuestion: finalQMap[a.id] ?? null,
  }));

  return NextResponse.json({ applicants: applicantsWithFinal, commonQuestions });
}
